// One search, cheapest path first:
// 1. Price calendar for every route in the date range (last night's scan; live only if missing).
// 2. Full itineraries for the cheapest few route+date combos (cache, else live).
// 3. Rank: layover filter, company policy, top 10.
// 4. Short AI tips on how to save more.
import { prisma } from "./db";
import { config } from "./config";
import { expandPlaces } from "./airports";
import { capStatus, countSearch } from "./ledger";
import { getCalendar, getItineraries, type Billing } from "./fares";
import { rankItineraries } from "./rank";
import { getPolicy } from "./settings";
import { adviseOnResults } from "./ai";
import type { Itinerary, SearchRequest } from "./types";

const MAX_ROUTES = 40;

export type SearchOutcome = Awaited<ReturnType<typeof runSearch>>;

export async function runSearch(userId: string, req: SearchRequest) {
  const cap = await capStatus(userId);
  const policy = await getPolicy();
  const cabin = req.cabin ?? policy.cabin;
  const origins = expandPlaces(req.origins);
  const destinations = expandPlaces(req.destinations);
  const routes = origins.flatMap((o) => destinations.filter((d) => d !== o).map((d) => [o, d] as const));
  const notes: string[] = [];
  if (routes.length > MAX_ROUTES) notes.push(`${routes.length} route theke prothom ${MAX_ROUTES} ta khoja holo.`);
  if (cap.blocked) notes.push("Ei maaser limit sesh, tai sudhu age theke rakha (raater scan) data dekhano holo.");

  const search = await prisma.search.create({ data: { userId, request: req, results: [] } });
  await countSearch(userId);
  const bill: Billing = { userId, searchId: search.id, allowLive: !cap.blocked, forceLive: req.forceLive };

  // 1. Calendar
  const calendar: { route: string; origin: string; destination: string; date: string; priceInr: number }[] = [];
  for (const [o, d] of routes.slice(0, MAX_ROUTES)) {
    try {
      const rows = await getCalendar(o, d, req.dateFrom, req.dateTo, bill);
      for (const r of rows)
        if (r.priceInr != null)
          calendar.push({ route: `${o}-${d}`, origin: o, destination: d, date: r.date, priceInr: r.priceInr });
    } catch (e) {
      notes.push(`${o}-${d}: ${(e as Error).message}`);
    }
  }
  calendar.sort((a, b) => a.priceInr - b.priceInr);

  // 2. Itineraries for the cheapest combos
  const items: Itinerary[] = [];
  let usedLive = false;
  for (const c of calendar.slice(0, config.detailCombos)) {
    try {
      const r = await getItineraries(
        { origin: c.origin, destination: c.destination, date: c.date, adults: req.adults, cabin },
        bill,
      );
      usedLive ||= r.live;
      items.push(...r.items);
    } catch (e) {
      notes.push(`${c.route} ${c.date}: ${(e as Error).message}`);
    }
  }

  // 3. Rank
  const results = rankItineraries(items, policy, { layover: req.layover, limit: 10 });

  // 4. Advice (skipped once the user is over their cap)
  let tips: string | null = null;
  if (!cap.blocked) {
    try {
      tips = await adviseOnResults(results, calendar, policy.notes, userId, search.id);
    } catch (e) {
      notes.push(`AI tips paoa jayni: ${(e as Error).message}`);
    }
  }

  const cost = await prisma.usageEvent.aggregate({ where: { searchId: search.id }, _sum: { costInr: true } });
  const costInr = cost._sum.costInr ?? 0;
  await prisma.search.update({
    where: { id: search.id },
    data: { results, tips, costInr, usedLive },
  });
  return {
    searchId: search.id,
    results,
    tips,
    costInr,
    usedLive,
    notes,
    cap: await capStatus(userId),
    cheapestDays: calendar.slice(0, 15),
  };
}
