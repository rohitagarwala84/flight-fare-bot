// Expense tracker: every paid call is written here with its rupee cost, and
// per-user monthly caps are checked against these rows.
import type { Provider } from "@prisma/client";
import { prisma } from "./db";
import { config, usdToInr } from "./config";

export function monthStart(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export async function record(e: {
  userId: string | null;
  provider: Provider;
  action: string;
  usd: number;
  units?: number;
  searchId?: string;
  meta?: object;
}) {
  const costInr = usdToInr(e.usd);
  await prisma.usageEvent.create({
    data: {
      userId: e.userId,
      provider: e.provider,
      action: e.action,
      units: e.units ?? 1,
      costInr,
      searchId: e.searchId,
      meta: e.meta,
    },
  });
  return costInr;
}

export const recordIgnav = (userId: string | null, action: string, searchId?: string, meta?: object) =>
  record({ userId, provider: "IGNAV", action, usd: config.ignavUsdPerCall, searchId, meta });

export const recordSerpapi = (userId: string | null, action: string, searchId?: string, meta?: object) =>
  record({ userId, provider: "SERPAPI", action, usd: config.serpapiUsdPerCall, searchId, meta });

export function aiCostUsd(model: string, inputTokens: number, outputTokens: number) {
  const [inp, out] = config.modelPrices[model] ?? [4, 20];
  return (inputTokens * inp + outputTokens * out) / 1_000_000;
}

export async function monthSpendInr(userId: string) {
  const r = await prisma.usageEvent.aggregate({
    where: { userId, createdAt: { gte: monthStart() } },
    _sum: { costInr: true },
  });
  return r._sum.costInr ?? 0;
}

export type CapStatus = { spentInr: number; capInr: number; ratio: number; blocked: boolean; warn: boolean };

export async function capStatus(userId: string): Promise<CapStatus> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const spentInr = await monthSpendInr(userId);
  const ratio = user.monthlyCapInr > 0 ? spentInr / user.monthlyCapInr : 1;
  return {
    spentInr,
    capInr: user.monthlyCapInr,
    ratio,
    blocked: ratio >= 1,
    warn: ratio >= config.capWarnRatio && ratio < 1,
  };
}
