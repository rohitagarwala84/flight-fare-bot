// Expense tracker: every paid call is written here with its rupee cost and added
// to the user's monthly total, which the cap is checked against.
import type { Provider } from "@prisma/client";
import { prisma } from "./db";
import { config, usdToInr } from "./config";

export function monthStart(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);
const userKey = (userId: string | null) => userId ?? "company";

async function addToMonth(userId: string | null, add: { fareInr?: number; aiInr?: number; calls?: number; searches?: number }) {
  const inc = Object.fromEntries(Object.entries(add).map(([k, v]) => [k, { increment: v }]));
  await prisma.monthlySpend.upsert({
    where: { month_userKey: { month: monthKey(), userKey: userKey(userId) } },
    create: { month: monthKey(), userKey: userKey(userId), ...add },
    update: inc,
  });
}

export const countSearch = (userId: string) => addToMonth(userId, { searches: 1 });

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
  await addToMonth(e.userId, e.provider === "AI" ? { aiInr: costInr, calls: 1 } : { fareInr: costInr, calls: 1 });
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
  const r = await prisma.monthlySpend.findUnique({ where: { month_userKey: { month: monthKey(), userKey: userId } } });
  return r ? r.fareInr + r.aiInr : 0;
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
