// "Live check": re-price one result on Google Flights (SerpApi) right before
// someone books or approves, and find the same flight there.
import { googleFlightsOneWay } from "./serpapi";
import { recordSerpapi } from "./ledger";
import type { RankedItinerary } from "./types";

export async function liveCheck(it: Pick<RankedItinerary, "origin" | "destination" | "date" | "segments">, adults: number, userId: string) {
  const options = await googleFlightsOneWay({ origin: it.origin, destination: it.destination, date: it.date, adults });
  await recordSerpapi(userId, "live-check", undefined, { origin: it.origin, destination: it.destination, date: it.date });
  const want = it.segments.map((s) => `${s.carrierCode}${s.flightNumber}`).join(">");
  const same = options.find((o) => o.segments.map((s) => `${s.carrierCode}${s.flightNumber}`).join(">") === want);
  const cheapest = options.reduce<(typeof options)[number] | null>((m, o) => (!m || o.priceInr < m.priceInr ? o : m), null);
  return {
    sameFlightInr: same?.priceInr ?? null,
    cheapestInr: cheapest?.priceInr ?? null,
    cheapestFlights: cheapest?.segments.map((s) => `${s.carrierCode} ${s.flightNumber}`).join(", ") ?? null,
    checkedAt: new Date().toISOString(),
  };
}
