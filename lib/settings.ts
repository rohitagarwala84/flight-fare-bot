import { prisma } from "./db";
import type { Policy } from "./types";

export const DEFAULT_POLICY: Policy = {
  cabin: "economy",
  maxStops: null,
  maxLayoverHours: null,
  noRedEye: false,
  blockedAirlines: [],
  preferredAirlines: [],
  maxFareInr: null,
  hideViolations: false,
  notes: "",
};

export async function getPolicy(): Promise<Policy> {
  const row = await prisma.setting.findUnique({ where: { key: "policy" } });
  return { ...DEFAULT_POLICY, ...((row?.value as Partial<Policy>) ?? {}) };
}

export async function savePolicy(p: Policy) {
  await prisma.setting.upsert({
    where: { key: "policy" },
    create: { key: "policy", value: p },
    update: { value: p },
  });
}
