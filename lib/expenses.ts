import { prisma } from "./db";
import { monthStart } from "./ledger";

// Live expense report for a month from the monthly totals. Admin sees everyone; a user sees only themselves.
export async function expenseReport(opts: { userId?: string; month?: Date }) {
  const from = monthStart(opts.month);
  const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
  const range = { gte: from, lt: to };
  const userFilter = opts.userId ? { userId: opts.userId } : {};

  const month = from.toISOString().slice(0, 7);
  const totals = await prisma.monthlySpend.findMany({
    where: { month, ...(opts.userId ? { userKey: opts.userId } : {}) },
  });
  const users = await prisma.user.findMany({
    where: opts.userId ? { id: opts.userId } : {},
    orderBy: { name: "asc" },
  });

  const rows = users.map((u) => {
    const t = totals.find((r) => r.userKey === u.id);
    const total = t ? t.fareInr + t.aiInr : 0;
    return {
      userId: u.id,
      name: u.name,
      username: u.username,
      capInr: u.monthlyCapInr,
      searches: t?.searches ?? 0,
      fareApiInr: t?.fareInr ?? 0,
      aiInr: t?.aiInr ?? 0,
      totalInr: total,
      usedPct: u.monthlyCapInr > 0 ? Math.round((total / u.monthlyCapInr) * 100) : 100,
    };
  });

  const company = totals.find((r) => r.userKey === "company");
  const companyInr = company ? company.fareInr + company.aiInr : 0;
  // Call-by-call detail is kept for 7 days only.
  const recent = await prisma.usageEvent.findMany({
    where: { createdAt: range, ...userFilter },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { name: true } } },
  });

  return {
    month,
    users: rows,
    companyScanInr: opts.userId ? null : companyInr,
    totalInr: rows.reduce((s, r) => s + r.totalInr, 0) + (opts.userId ? 0 : companyInr),
    recent: recent.map((e) => ({
      at: e.createdAt,
      who: e.user?.name ?? "Company (nightly scan)",
      provider: e.provider,
      action: e.action,
      costInr: e.costInr,
    })),
  };
}
