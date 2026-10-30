// SerpApi Google Flights, used only to re-check a fare live before someone
// acts on it. Prices requested in INR for the Indian point of sale.
import type { Itinerary } from "./types";

type GFlight = {
  departure_airport: { id: string; time: string };
  arrival_airport: { id: string; time: string };
  duration: number;
  airline?: string;
  flight_number?: string;
};
type GOption = { flights: GFlight[]; total_duration?: number; price?: number; booking_token?: string };

const CLASS: Record<string, number> = { economy: 1, premium_economy: 2, business: 3, first: 4 };

export async function googleFlightsOneWay(params: {
  origin: string;
  destination: string;
  date: string;
  adults?: number;
  cabin?: string;
}): Promise<Itinerary[]> {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) throw new Error("SERPAPI_API_KEY is not set");
  const q = new URLSearchParams({
    engine: "google_flights",
    departure_id: params.origin,
    arrival_id: params.destination,
    outbound_date: params.date,
    type: "2",
    currency: "INR",
    gl: "in",
    hl: "en",
    adults: String(params.adults ?? 1),
    travel_class: String(CLASS[params.cabin ?? "economy"] ?? 1),
    api_key: key,
  });
  const res = await fetch(`https://serpapi.com/search.json?${q}`);
  const json = (await res.json()) as { error?: string; best_flights?: GOption[]; other_flights?: GOption[] };
  if (!res.ok || json.error) throw new Error(json.error ?? `SerpApi ${res.status}`);
  const observedAt = new Date().toISOString();
  const options = [...(json.best_flights ?? []), ...(json.other_flights ?? [])].filter((o) => o.price != null);
  return options.map((o, i) => ({
    id: o.booking_token ?? `serp-${params.origin}-${params.destination}-${params.date}-${i}`,
    source: "serpapi" as const,
    origin: params.origin,
    destination: params.destination,
    date: params.date,
    priceInr: o.price!,
    currency: "INR",
    priceVerified: true,
    carrier: o.flights[0]?.airline ?? null,
    segments: o.flights.map((f) => {
      const [code, num] = (f.flight_number ?? "").split(" ");
      return {
        carrierCode: code || null,
        flightNumber: num || null,
        carrierName: f.airline ?? null,
        from: f.departure_airport.id,
        to: f.arrival_airport.id,
        // Google gives local times as "YYYY-MM-DD HH:MM".
        departLocal: f.departure_airport.time.replace(" ", "T") + ":00",
        arriveLocal: f.arrival_airport.time.replace(" ", "T") + ":00",
        departUtc: null,
        arriveUtc: null,
        durationMinutes: f.duration,
      };
    }),
    totalMinutes: o.total_duration ?? null,
    selfTransfer: false,
    checkedBags: null,
    observedAt,
  }));
}
