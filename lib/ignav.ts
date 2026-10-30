// Ignav flight API client (https://ignav.com/docs). Fares come back in the
// currency of `market`; market "IN" gives INR.
import { config } from "./config";
import type { Itinerary, Segment } from "./types";

const BASE = process.env.IGNAV_BASE_URL ?? "https://ignav.com/api";

export class IgnavError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, body: unknown): Promise<T> {
  const key = process.env.IGNAV_API_KEY;
  if (!key) throw new IgnavError("IGNAV_API_KEY is not set", 0);
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "X-Api-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (json as { error?: { message?: string; code?: string } }).error;
    throw new IgnavError(err?.message ?? `Ignav ${res.status}`, res.status, err?.code);
  }
  return json as T;
}

type RawSegment = {
  marketing_carrier_code: string | null;
  flight_number: string | null;
  operating_carrier_name: string | null;
  departure_airport: string;
  arrival_airport: string;
  departure_time_local: string;
  arrival_time_local: string;
  departure_time_utc: string | null;
  arrival_time_utc: string | null;
  duration_minutes: number;
};

type RawItinerary = {
  price: { amount: number; currency: string; status: "verified" | "unverified" };
  outbound: { carrier: string | null; duration_minutes: number | null; segments: RawSegment[] };
  bags?: { carry_on: number | null; checked: number | null } | null;
  requires_self_transfer?: boolean | null;
  ignav_id: string;
};

export type CalendarDay = { date: string; price: number | null; currency: string | null };

export async function cheapestDates(params: {
  origin: string;
  destination: string;
  start: string;
  end: string;
  adults?: number;
  cabin?: string;
}): Promise<{ days: CalendarDay[]; observedAt: string }> {
  const res = await call<{
    dates: { departure_date: string; price: { amount: number; currency: string } | null }[];
    observed_at: string | null;
  }>("/fares/cheapest-dates", {
    origin: params.origin,
    destination: params.destination,
    departure_date_range: { start: params.start, end: params.end },
    adults: params.adults ?? 1,
    cabin_class: params.cabin ?? "economy",
    market: config.market,
  });
  return {
    days: res.dates.map((d) => ({
      date: d.departure_date,
      price: d.price?.amount ?? null,
      currency: d.price?.currency ?? null,
    })),
    observedAt: res.observed_at ?? new Date().toISOString(),
  };
}

export function mapSegment(s: RawSegment): Segment {
  return {
    carrierCode: s.marketing_carrier_code,
    flightNumber: s.flight_number,
    carrierName: s.operating_carrier_name,
    from: s.departure_airport,
    to: s.arrival_airport,
    departLocal: s.departure_time_local,
    arriveLocal: s.arrival_time_local,
    departUtc: s.departure_time_utc,
    arriveUtc: s.arrival_time_utc,
    durationMinutes: s.duration_minutes,
  };
}

export async function oneWay(params: {
  origin: string;
  destination: string;
  date: string;
  adults?: number;
  cabin?: string;
}): Promise<Itinerary[]> {
  const res = await call<{ itineraries: RawItinerary[]; observed_at: string | null }>("/fares/one-way", {
    origin: params.origin,
    destination: params.destination,
    departure_date: params.date,
    adults: params.adults ?? 1,
    cabin_class: params.cabin ?? "economy",
    market: config.market,
  });
  const observedAt = res.observed_at ?? new Date().toISOString();
  return res.itineraries.map((it) => ({
    id: it.ignav_id,
    source: "ignav",
    origin: params.origin,
    destination: params.destination,
    date: params.date,
    priceInr: it.price.amount,
    currency: it.price.currency,
    priceVerified: it.price.status === "verified",
    carrier: it.outbound.carrier,
    segments: it.outbound.segments.map(mapSegment),
    totalMinutes: it.outbound.duration_minutes,
    selfTransfer: Boolean(it.requires_self_transfer),
    checkedBags: it.bags?.checked ?? null,
    observedAt,
  }));
}

export async function bookingLinks(ignavId: string) {
  return call<{ booking_options: { links: { provider_name: string; url: string; price: unknown }[] }[] }>(
    "/fares/booking-links",
    { ignav_id: ignavId },
  );
}
