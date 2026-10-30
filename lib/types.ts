export type Segment = {
  carrierCode: string | null;
  flightNumber: string | null;
  carrierName: string | null;
  from: string;
  to: string;
  departLocal: string;
  arriveLocal: string;
  departUtc: string | null;
  arriveUtc: string | null;
  durationMinutes: number;
};

export type LayoverClass = "Direct" | "Short" | "Medium" | "Long";

export type Itinerary = {
  id: string; // provider id (ignav_id) or a stable hash
  source: "ignav" | "serpapi";
  origin: string;
  destination: string;
  date: string;
  priceInr: number;
  currency: string;
  priceVerified: boolean;
  carrier: string | null;
  segments: Segment[];
  totalMinutes: number | null;
  selfTransfer: boolean;
  checkedBags: number | null;
  observedAt: string;
};

export type RankedItinerary = Itinerary & {
  stops: number;
  layoverMinutes: number[];
  layoverClass: LayoverClass;
  policyViolations: string[];
};

export type SearchRequest = {
  origins: string[]; // airport or country codes
  destinations: string[];
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;
  adults: number;
  cabin: "economy" | "premium_economy" | "business" | "first";
  layover?: LayoverClass | "Any";
  forceLive?: boolean;
};

export type Policy = {
  cabin: "economy" | "premium_economy" | "business" | "first";
  maxStops: number | null;
  maxLayoverHours: number | null;
  noRedEye: boolean; // no departures between 00:00 and 05:00
  blockedAirlines: string[];
  preferredAirlines: string[];
  maxFareInr: number | null;
  hideViolations: boolean;
  notes: string; // free-text rules learned from booking instructions
};
