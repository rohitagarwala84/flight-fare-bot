// End-to-end over the real database with a fake Ignav server: nightly scan
// fills the cache, a user search then costs nothing, and the monthly cap
// stops live calls.
import http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { prune, runWatchlist } from "@/lib/scan";
import { runSearch } from "@/lib/search";
import { capStatus } from "@/lib/ledger";
import { expenseReport } from "@/lib/expenses";
import { addDays } from "@/lib/fares";

const calls: { path: string; body: any; key: string | undefined }[] = [];

function fakeIgnav(req: http.IncomingMessage, res: http.ServerResponse) {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = raw ? JSON.parse(raw) : {};
    calls.push({ path: req.url!, body, key: req.headers["x-api-key"] as string });
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/api/fares/cheapest-dates") {
      const { start, end } = body.departure_date_range;
      const dates = [];
      for (let d = start, i = 0; d <= end; d = addDays(d, 1), i++)
        dates.push({ departure_date: d, price: { amount: 20000 + ((i * 7919) % 13) * 500, currency: "INR", status: "verified" } });
      return res.end(JSON.stringify({ origin: body.origin, destination: body.destination, dates, observed_at: new Date().toISOString() }));
    }
    if (req.url === "/api/fares/one-way") {
      const d = body.departure_date;
      const seg = (code: string, num: string, from: string, to: string, dep: string, arr: string) => ({
        marketing_carrier_code: code,
        flight_number: num,
        operating_carrier_name: code,
        departure_airport: from,
        arrival_airport: to,
        departure_time_local: `${d}T${dep}:00`,
        arrival_time_local: `${d}T${arr}:00`,
        departure_timezone: null,
        arrival_timezone: null,
        departure_time_utc: `${d}T${dep}:00Z`,
        arrival_time_utc: `${d}T${arr}:00Z`,
        duration_minutes: 120,
        aircraft: null,
      });
      const itineraries = [
        {
          price: { amount: 30000 * body.adults, currency: "INR", status: "verified" },
          outbound: { carrier: "Emirates", duration_minutes: 240, segments: [seg("EK", "571", body.origin, body.destination, "09:00", "13:00")] },
          ignav_id: `direct-${d}-${body.origin}`,
          requires_self_transfer: false,
        },
        {
          price: { amount: 22000 * body.adults, currency: "INR", status: "verified" },
          outbound: {
            carrier: "IndiGo",
            duration_minutes: 480,
            segments: [seg("6E", "11", body.origin, "BOM", "06:00", "08:00"), seg("6E", "12", "BOM", body.destination, "13:00", "14:00")],
          },
          ignav_id: `stop-${d}-${body.origin}`,
          requires_self_transfer: false,
        },
      ];
      return res.end(JSON.stringify({ origin: body.origin, destination: body.destination, departure_date: d, itineraries, observed_at: new Date().toISOString() }));
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: { type: "not_found", code: "not_found", message: "no route" } }));
  });
}

const server = http.createServer(fakeIgnav);
let userId = "";
const tomorrow = addDays(new Date().toISOString().slice(0, 10), 1);

beforeAll(async () => {
  await new Promise<void>((r) => server.listen(4555, "127.0.0.1", r));
  await prisma.usageEvent.deleteMany();
  await prisma.monthlySpend.deleteMany();
  await prisma.search.deleteMany();
  await prisma.user.deleteMany();
  await prisma.fareCalendar.deleteMany();
  await prisma.fareSnapshot.deleteMany();
  await prisma.watchlist.deleteMany();
  const u = await prisma.user.create({ data: { username: "tester", name: "Tester", passwordHash: "x", monthlyCapInr: 1000 } });
  userId = u.id;
});

afterAll(async () => {
  server.close();
  await prisma.$disconnect();
});

describe("nightly scan → search → cap", () => {
  it("scan fills the calendar and the cheapest dates for each route", async () => {
    const w = await prisma.watchlist.create({
      data: { label: "test", origins: ["CCU", "BOM"], destinations: ["DXB"], monthsAhead: 1, detailDates: 2 },
    });
    const r = await runWatchlist(w.id, () => {});
    expect(r).toEqual({ routes: 2, errors: 0 });
    // 30 days = 1 calendar call + 2 detail calls, per route
    expect(calls.filter((c) => c.path === "/api/fares/cheapest-dates")).toHaveLength(2);
    expect(calls.filter((c) => c.path === "/api/fares/one-way")).toHaveLength(4);
    expect(calls.every((c) => c.key === "test-key" && c.body.market === "IN")).toBe(true);
    const company = await prisma.usageEvent.findMany({ where: { userId: null } });
    expect(company).toHaveLength(6);
    expect(company[0].costInr).toBeCloseTo(0.176, 4); // $0.002 x 88
  });

  it("a search inside the scanned range is served from cache at zero cost", async () => {
    calls.length = 0;
    const cheapest = await prisma.fareCalendar.findMany({ where: { origin: "CCU" }, orderBy: { priceInr: "asc" }, take: 1 });
    const day = cheapest[0].date;
    const out = await runSearch(userId, {
      origins: ["CCU", "BOM"],
      destinations: ["DXB"],
      dateFrom: tomorrow,
      dateTo: addDays(tomorrow, 20),
      adults: 1,
      cabin: "economy",
      layover: "Any",
    });
    expect(out.results.length).toBeGreaterThan(0);
    expect(out.results[0].priceInr).toBe(22000);
    expect(out.results[0].layoverClass).toBe("Medium"); // 5h at BOM
    expect(out.results.some((r) => r.date === day)).toBe(true);
    // Any detail dates the scan didn't cover may cost a little; calendars must not be re-fetched.
    expect(calls.filter((c) => c.path === "/api/fares/cheapest-dates")).toHaveLength(0);
    const saved = await prisma.search.findUniqueOrThrow({ where: { id: out.searchId } });
    expect(saved.costInr).toBeCloseTo(calls.length * 0.176, 2);
  });

  it("layover filter keeps only matching fares", async () => {
    const out = await runSearch(userId, {
      origins: ["CCU"],
      destinations: ["DXB"],
      dateFrom: tomorrow,
      dateTo: addDays(tomorrow, 20),
      adults: 1,
      cabin: "economy",
      layover: "Direct",
    });
    expect(out.results.length).toBeGreaterThan(0);
    expect(out.results.every((r) => r.layoverClass === "Direct")).toBe(true);
  });

  it("over the cap: no live calls, cached data still shown", async () => {
    await prisma.user.update({ where: { id: userId }, data: { monthlyCapInr: 0 } });
    calls.length = 0;
    const out = await runSearch(userId, {
      origins: ["CCU"],
      destinations: ["DXB", "SHJ"], // SHJ was never scanned
      dateFrom: tomorrow,
      dateTo: addDays(tomorrow, 10),
      adults: 2,
      cabin: "economy",
      layover: "Any",
      forceLive: true,
    });
    expect(calls).toHaveLength(0);
    expect(out.cap.blocked).toBe(true);
    expect(out.notes.join(" ")).toContain("limit sesh");
    expect(out.costInr).toBe(0);
  });

  it("expense report splits user and company spend", async () => {
    await prisma.user.update({ where: { id: userId }, data: { monthlyCapInr: 1000 } });
    const r = await expenseReport({});
    const me = r.users.find((u) => u.userId === userId)!;
    expect(r.companyScanInr).toBeCloseTo(6 * 0.176, 3);
    expect(me.searches).toBe(3);
    expect(r.totalInr).toBeCloseTo((r.companyScanInr ?? 0) + me.totalInr, 5);
    const cap = await capStatus(userId);
    expect(cap.spentInr).toBeCloseTo(me.totalInr, 5);
    expect(cap.blocked).toBe(false);
  });

  it("prune drops past dates and stale snapshots, keeps the rest", async () => {
    const before = await prisma.fareCalendar.count();
    await prisma.fareCalendar.create({ data: { origin: "CCU", destination: "DXB", date: "2020-01-01", priceInr: 1, observedAt: new Date() } });
    await prisma.fareSnapshot.create({
      data: { origin: "CCU", destination: "DXB", date: tomorrow, adults: 9, itineraries: [], observedAt: new Date("2020-01-01") },
    });
    const snaps = await prisma.fareSnapshot.count();
    const old = new Date(Date.now() - 8 * 86400_000);
    await prisma.usageEvent.updateMany({ data: { createdAt: old } });
    await prisma.search.updateMany({ data: { createdAt: old } });
    const spentBefore = (await capStatus(userId)).spentInr;
    await prune(() => {});
    expect(await prisma.fareCalendar.count()).toBe(before);
    expect(await prisma.fareSnapshot.count()).toBe(snaps - 1);
    expect(await prisma.usageEvent.count()).toBe(0);
    expect(await prisma.search.count()).toBe(0);
    // monthly totals survive, so the cap and expense page still work
    expect((await capStatus(userId)).spentInr).toBeCloseTo(spentBefore, 5);
    expect((await expenseReport({})).companyScanInr).toBeCloseTo(6 * 0.176, 3);
  });
});
