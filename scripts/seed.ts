// First-time setup: creates the admin login, the default company policy and
// the nightly watchlists for the company's main routes. Safe to run again.
import { prisma } from "../lib/db";
import { hashPassword } from "../lib/auth";
import { MAIN_ORIGINS } from "../lib/airports";
import { DEFAULT_POLICY } from "../lib/settings";

async function main() {
  const username = (process.env.ADMIN_USERNAME ?? "admin").toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 8) throw new Error("Set ADMIN_PASSWORD (8+ characters) before seeding");

  await prisma.user.upsert({
    where: { username },
    create: {
      username,
      name: process.env.ADMIN_NAME ?? "Admin",
      role: "ADMIN",
      monthlyCapInr: 5000,
      passwordHash: await hashPassword(password),
    },
    update: {},
  });

  await prisma.setting.upsert({ where: { key: "policy" }, create: { key: "policy", value: DEFAULT_POLICY }, update: {} });

  // Nigeria is scanned every night; the rest once a week (Monday) unless the admin changes it.
  const lists = [
    { label: "India → Nigeria", destinations: ["NG"], days: [0, 1, 2, 3, 4, 5, 6] },
    { label: "India → Vietnam", destinations: ["VN"], days: [1] },
    { label: "India → Singapore", destinations: ["SG"], days: [1] },
    { label: "India → UAE", destinations: ["AE"], days: [1] },
    { label: "Domestic (main cities)", destinations: MAIN_ORIGINS, days: [1] },
  ];
  for (const l of lists) {
    const exists = await prisma.watchlist.findFirst({ where: { label: l.label } });
    if (!exists) await prisma.watchlist.create({ data: { ...l, origins: MAIN_ORIGINS, monthsAhead: 3, detailDates: 3 } });
  }
  // One-time: lists created before scan days existed default to every day; apply the schedule above once.
  if (!(await prisma.setting.findUnique({ where: { key: "scanDaysV1" } }))) {
    for (const l of lists) await prisma.watchlist.updateMany({ where: { label: l.label }, data: { days: l.days } });
    await prisma.setting.create({ data: { key: "scanDaysV1", value: true } });
  }
  console.log(`Seeded admin "${username}", policy and ${lists.length} watchlists.`);
}

main().finally(() => prisma.$disconnect());
