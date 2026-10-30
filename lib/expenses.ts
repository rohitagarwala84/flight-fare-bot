import { prisma } from "./db";
import { monthStart } from "./ledger";

// Live expense report for a month. Admin sees everyone; a user sees only themselves.
export async function expenseReport(opts: { userId?: string; month?: Date }) {
  const from = monthStart(opts.month);
  const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
  const range = { gte: from, lt: to };
  const userFilter = opts.userId ? { userId: opts.userId } : {};

  const byUserProvider = await prisma.usageEvent.groupBy({
    by: ["userId", "provider"],
    where: { createdAt: range, ...userFilter },
    _sum: { costInr: true },
    _count: true,
  });
  const users = await prisma.user.findMany({
    where: opts.userId ? { id: opts.userId } : {},
    orderBy: { name: "asc" },
  });
  const searches = await prisma.search.groupBy({
    by: ["userId"],
    where: { createdAt: range, ...userFilter },
    _count: true,
  });

  const rows = users.map((u) => {
    const mine = byUserProvider.filter((r) => r.userId === u.id);
    const by = (p: string) => mine.find((r) => r.provider === p)?._sum.costInr ?? 0;
    const total = mine.reduce((s, r) => s + (r._sum.costInr ?? 0), 0);
    return {
      userId: u.id,
      name: u.name,
      username: u.username,
      capInr: u.monthlyCapInr,
      searches: searches.find((s) => s.userId === u.id)?._count ?? 0,
      fareApiInr: by("IGNAV") + by("SERPAPI"),
      aiInr: by("AI"),
      totalInr: total,
      usedPct: u.monthlyCapInr > 0 ? Math.round((total / u.monthlyCapInr) * 100) : 100,
    };
  });

  const company = byUserProvider.filter((r) => r.userId === null);
  const companyInr = company.reduce((s, r) => s + (r._sum.costInr ?? 0), 0);
  const recent = await prisma.usageEvent.findMany({
    where: { createdAt: range, ...userFilter },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { name: true } } },
  });

  return {
    month: from.toISOString().slice(0, 7),
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
