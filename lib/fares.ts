// Cache-first access to fares. The nightly scan fills these tables; a user
// search only calls the paid API for what is missing or stale, and only if
// that user is still under their monthly cap.
import { prisma } from "./db";
import { config } from "./config";
import * as ignav from "./ignav";
import { recordIgnav } from "./ledger";
import type { Itinerary } from "./types";

export type Billing = { userId: string | null; searchId?: string; allowLive: boolean; forceLive?: boolean };

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);

export function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400_000);
}

// Ignav takes at most 31 days per cheapest-dates call.
export function windows(start: string, end: string, size = 31): [string, string][] {
  const out: [string, string][] = [];
  for (let s = start; daysBetween(s, end) >= 0; s = addDays(s, size)) {
    const e = addDays(s, size - 1);
    out.push([s, daysBetween(e, end) < 0 ? end : e]);
  }
  return out;
}

export async function fetchCalendarLive(origin: string, destination: string, start: string, end: string, bill: Billing) {
  let calls = 0;
  for (const [s, e] of windows(start, end)) {
    const { days, observedAt } = await ignav.cheapestDates({ origin, destination, start: s, end: e });
    calls++;
    await recordIgnav(bill.userId, "cheapest-dates", bill.searchId, { origin, destination, start: s, end: e });
    const at = new Date(observedAt);
    for (const d of days) {
      await prisma.fareCalendar.upsert({
        where: { origin_destination_date: { origin, destination, date: d.date } },
        create: { origin, destination, date: d.date, priceInr: d.price, observedAt: at },
        update: { priceInr: d.price, observedAt: at },
      });
    }
  }
  return calls;
}

export async function getCalendar(origin: string, destination: string, start: string, end: string, bill: Billing) {
  const need = daysBetween(start, end) + 1;
  let rows = await prisma.fareCalendar.findMany({
    where: { origin, destination, date: { gte: start, lte: end } },
  });
  const fresh = rows.filter((r) => r.observedAt >= hoursAgo(config.calendarMaxAgeHours));
  const stale = bill.forceLive || fresh.length < need;
  if (stale && bill.allowLive) {
    await fetchCalendarLive(origin, destination, start, end, bill);
    rows = await prisma.fareCalendar.findMany({ where: { origin, destination, date: { gte: start, lte: end } } });
  }
  return rows;
}

export async function getItineraries(
  q: { origin: string; destination: string; date: string; adults: number; cabin: string },
  bill: Billing,
): Promise<{ items: Itinerary[]; live: boolean; observedAt: Date | null }> {
  const key = { origin: q.origin, destination: q.destination, date: q.date, adults: q.adults };
  const snap = await prisma.fareSnapshot.findUnique({ where: { origin_destination_date_adults: key } });
  const fresh = snap && snap.observedAt >= hoursAgo(config.snapshotMaxAgeHours);
  if ((fresh && !bill.forceLive) || !bill.allowLive) {
    return { items: (snap?.itineraries as Itinerary[]) ?? [], live: false, observedAt: snap?.observedAt ?? null };
  }
  const items = await ignav.oneWay(q);
  await recordIgnav(bill.userId, "one-way", bill.searchId, key);
  const observedAt = new Date();
  await prisma.fareSnapshot.upsert({
    where: { origin_destination_date_adults: key },
    create: { ...key, itineraries: items, observedAt },
    update: { itineraries: items, observedAt },
  });
  return { items, live: true, observedAt };
}
