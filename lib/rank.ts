import type { Itinerary, LayoverClass, Policy, RankedItinerary } from "./types";

// Short < 4h, Medium 4-8h, Long > 8h, judged on the longest layover.
export function classifyLayover(layovers: number[]): LayoverClass {
  if (layovers.length === 0) return "Direct";
  const longest = Math.max(...layovers);
  if (longest < 240) return "Short";
  if (longest <= 480) return "Medium";
  return "Long";
}

const minutes = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 60000);

export function layoverMinutes(it: Itinerary): number[] {
  const out: number[] = [];
  for (let i = 1; i < it.segments.length; i++) {
    const prev = it.segments[i - 1];
    const next = it.segments[i];
    // UTC when we have it; local times are only safe when both ends are the same airport.
    if (prev.arriveUtc && next.departUtc) out.push(minutes(prev.arriveUtc, next.departUtc));
    else out.push(minutes(prev.arriveLocal, next.departLocal));
  }
  return out;
}

export function policyViolations(it: Itinerary, layovers: number[], policy: Policy): string[] {
  const v: string[] = [];
  const stops = Math.max(0, it.segments.length - 1);
  if (policy.maxStops != null && stops > policy.maxStops) v.push(`${stops} stop (max ${policy.maxStops})`);
  if (policy.maxLayoverHours != null && layovers.some((m) => m > policy.maxLayoverHours! * 60))
    v.push(`layover ${policy.maxLayoverHours}h er beshi`);
  if (policy.noRedEye) {
    const hour = Number(it.segments[0]?.departLocal.slice(11, 13));
    if (hour >= 0 && hour < 5) v.push("raat 12-5 er flight");
  }
  const codes = it.segments.map((s) => s.carrierCode).filter(Boolean) as string[];
  const blocked = codes.filter((c) => policy.blockedAirlines.includes(c));
  if (blocked.length) v.push(`blocked airline ${[...new Set(blocked)].join(", ")}`);
  if (policy.maxFareInr != null && it.priceInr > policy.maxFareInr) v.push(`fare ₹${policy.maxFareInr} er beshi`);
  if (it.selfTransfer) v.push("self-transfer (alada ticket, transit visa/baggage dekhun)");
  return v;
}

// Same flights on the same day from two sources count once, cheapest wins.
function flightKey(it: Itinerary) {
  return `${it.date}|${it.segments.map((s) => `${s.carrierCode}${s.flightNumber}@${s.departLocal}`).join(">")}`;
}

export function rankItineraries(
  items: Itinerary[],
  policy: Policy,
  opts: { layover?: LayoverClass | "Any"; limit?: number } = {},
): RankedItinerary[] {
  const best = new Map<string, Itinerary>();
  for (const it of items) {
    const k = flightKey(it);
    const cur = best.get(k);
    if (!cur || it.priceInr < cur.priceInr) best.set(k, it);
  }
  const preferred = new Set(policy.preferredAirlines);
  let ranked: RankedItinerary[] = [...best.values()].map((it) => {
    const lay = layoverMinutes(it);
    return {
      ...it,
      stops: Math.max(0, it.segments.length - 1),
      layoverMinutes: lay,
      layoverClass: classifyLayover(lay),
      policyViolations: policyViolations(it, lay, policy),
    };
  });
  if (opts.layover && opts.layover !== "Any") ranked = ranked.filter((r) => r.layoverClass === opts.layover);
  if (policy.hideViolations) ranked = ranked.filter((r) => r.policyViolations.length === 0);
  ranked.sort((a, b) => {
    // Policy-clean fares first, then price; a preferred airline wins a tie.
    if (a.policyViolations.length === 0 !== (b.policyViolations.length === 0))
      return a.policyViolations.length === 0 ? -1 : 1;
    if (a.priceInr !== b.priceInr) return a.priceInr - b.priceInr;
    const ap = a.segments.some((s) => preferred.has(s.carrierCode ?? "")) ? 0 : 1;
    const bp = b.segments.some((s) => preferred.has(s.carrierCode ?? "")) ? 0 : 1;
    return ap - bp;
  });
  return ranked.slice(0, opts.limit ?? 10);
}
