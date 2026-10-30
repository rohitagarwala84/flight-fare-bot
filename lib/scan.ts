// Nightly scan: for every active watchlist, refresh the cheapest-fare
// calendar for the next N months, then pull full itineraries for the
// cheapest few dates of each route so the morning's searches are free.
import { prisma } from "./db";
import { expandPlaces } from "./airports";
import { addDays, fetchCalendarLive, getItineraries } from "./fares";

export async function runWatchlist(watchlistId: string, log: (s: string) => void = console.log) {
  const w = await prisma.watchlist.findUniqueOrThrow({ where: { id: watchlistId } });
  const origins = expandPlaces(w.origins);
  const destinations = expandPlaces(w.destinations);
  const start = addDays(new Date().toISOString().slice(0, 10), 1);
  const end = addDays(start, w.monthsAhead * 30 - 1);
  const bill = { userId: null, allowLive: true, forceLive: true };
  let routes = 0;
  let errors = 0;
  for (const o of origins) {
    for (const d of destinations) {
      if (o === d) continue;
      try {
        await fetchCalendarLive(o, d, start, end, bill);
        const cheapest = await prisma.fareCalendar.findMany({
          where: { origin: o, destination: d, date: { gte: start, lte: end }, priceInr: { not: null } },
          orderBy: { priceInr: "asc" },
          take: w.detailDates,
        });
        for (const c of cheapest) {
          await getItineraries({ origin: o, destination: d, date: c.date, adults: 1, cabin: "economy" }, bill);
        }
        routes++;
      } catch (e) {
        errors++;
        log(`[${w.label}] ${o}-${d}: ${(e as Error).message}`);
      }
    }
  }
  await prisma.watchlist.update({ where: { id: w.id }, data: { lastRunAt: new Date() } });
  log(`[${w.label}] ${routes} route scanned, ${errors} error`);
  return { routes, errors };
}

export async function runAllWatchlists(log: (s: string) => void = console.log) {
  const lists = await prisma.watchlist.findMany({ where: { active: true } });
  const out = [];
  for (const w of lists) out.push({ id: w.id, label: w.label, ...(await runWatchlist(w.id, log)) });
  await prune(log);
  return out;
}

// Keeps the database small enough for a free Postgres plan: past travel dates
// and old itinerary snapshots are never read again.
export async function prune(log: (s: string) => void = console.log) {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400_000);
  const cal = await prisma.fareCalendar.deleteMany({ where: { date: { lt: today } } });
  const snap = await prisma.fareSnapshot.deleteMany({ where: { OR: [{ date: { lt: today } }, { observedAt: { lt: weekAgo } }] } });
  log(`prune: ${cal.count} calendar rows, ${snap.count} snapshots removed`);
}
