import { describe, expect, it } from "vitest";
import { classifyLayover, layoverMinutes, rankItineraries } from "@/lib/rank";
import { windows } from "@/lib/fares";
import { expandPlaces } from "@/lib/airports";
import { DEFAULT_POLICY } from "@/lib/settings";
import type { Itinerary, Segment } from "@/lib/types";

const seg = (code: string, num: string, from: string, to: string, dep: string, arr: string): Segment => ({
  carrierCode: code,
  flightNumber: num,
  carrierName: code,
  from,
  to,
  departLocal: dep,
  arriveLocal: arr,
  departUtc: dep + "Z",
  arriveUtc: arr + "Z",
  durationMinutes: 60,
});

const itin = (price: number, segments: Segment[], extra: Partial<Itinerary> = {}): Itinerary => ({
  id: `${price}-${segments.length}`,
  source: "ignav",
  origin: segments[0].from,
  destination: segments[segments.length - 1].to,
  date: segments[0].departLocal.slice(0, 10),
  priceInr: price,
  currency: "INR",
  priceVerified: true,
  carrier: segments[0].carrierCode,
  segments,
  totalMinutes: 300,
  selfTransfer: false,
  checkedBags: null,
  observedAt: "2026-11-01T00:00:00Z",
  ...extra,
});

const direct = itin(30000, [seg("EK", "571", "CCU", "DXB", "2026-12-01T09:00:00", "2026-12-01T12:00:00")]);
const oneStopShort = itin(25000, [
  seg("6E", "1", "CCU", "BOM", "2026-12-01T06:00:00", "2026-12-01T08:00:00"),
  seg("6E", "2", "BOM", "DXB", "2026-12-01T10:00:00", "2026-12-01T12:00:00"),
]);
const oneStopLong = itin(20000, [
  seg("AI", "7", "CCU", "DEL", "2026-12-01T02:00:00", "2026-12-01T04:00:00"),
  seg("AI", "8", "DEL", "DXB", "2026-12-01T14:00:00", "2026-12-01T17:00:00"),
]);

describe("layovers", () => {
  it("classifies by the longest connection", () => {
    expect(classifyLayover([])).toBe("Direct");
    expect(classifyLayover([120])).toBe("Short");
    expect(classifyLayover([239, 300])).toBe("Medium");
    expect(classifyLayover([481])).toBe("Long");
  });
  it("measures connection time between segments", () => {
    expect(layoverMinutes(oneStopShort)).toEqual([120]);
    expect(layoverMinutes(oneStopLong)).toEqual([600]);
  });
});

describe("ranking", () => {
  it("sorts by price and filters by layover class", () => {
    const all = rankItineraries([direct, oneStopShort, oneStopLong], DEFAULT_POLICY);
    expect(all.map((r) => r.priceInr)).toEqual([20000, 25000, 30000]);
    const short = rankItineraries([direct, oneStopShort, oneStopLong], DEFAULT_POLICY, { layover: "Short" });
    expect(short.map((r) => r.priceInr)).toEqual([25000]);
  });

  it("puts policy-clean fares first and flags the rest", () => {
    const policy = { ...DEFAULT_POLICY, maxLayoverHours: 6, noRedEye: true };
    const r = rankItineraries([direct, oneStopShort, oneStopLong], policy);
    expect(r.map((x) => x.priceInr)).toEqual([25000, 30000, 20000]);
    expect(r[2].policyViolations).toContain("raat 12-5 er flight");
    expect(r[2].policyViolations.some((v) => v.includes("layover"))).toBe(true);
  });

  it("keeps the cheaper copy of the same flight", () => {
    const dear = { ...direct, priceInr: 31000, id: "x" };
    const r = rankItineraries([dear, direct], DEFAULT_POLICY);
    expect(r).toHaveLength(1);
    expect(r[0].priceInr).toBe(30000);
  });

  it("returns at most 10", () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      itin(10000 + i, [seg("EK", String(i), "CCU", "DXB", `2026-12-${String(i + 1).padStart(2, "0")}T09:00:00`, `2026-12-${String(i + 1).padStart(2, "0")}T12:00:00`)]),
    );
    expect(rankItineraries(many, DEFAULT_POLICY)).toHaveLength(10);
  });
});

describe("helpers", () => {
  it("splits a 3-month range into 31-day calendar calls", () => {
    expect(windows("2026-11-01", "2027-01-29")).toEqual([
      ["2026-11-01", "2026-12-01"],
      ["2026-12-02", "2027-01-01"],
      ["2027-01-02", "2027-01-29"],
    ]);
    expect(windows("2026-11-05", "2026-11-05")).toEqual([["2026-11-05", "2026-11-05"]]);
  });
  it("expands country codes to airports", () => {
    expect(expandPlaces(["NG"])).toEqual(["LOS", "ABV", "KAN", "PHC"]);
    expect(expandPlaces(["ccu", "AE"])).toEqual(["CCU", "DXB", "SHJ", "AUH"]);
  });
});
