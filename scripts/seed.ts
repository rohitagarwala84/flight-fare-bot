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

  const lists = [
    { label: "India → Nigeria", destinations: ["NG"] },
    { label: "India → Vietnam", destinations: ["VN"] },
    { label: "India → Singapore", destinations: ["SG"] },
    { label: "India → UAE", destinations: ["AE"] },
    { label: "Domestic (main cities)", destinations: MAIN_ORIGINS },
  ];
  for (const l of lists) {
    const exists = await prisma.watchlist.findFirst({ where: { label: l.label } });
    if (!exists) await prisma.watchlist.create({ data: { ...l, origins: MAIN_ORIGINS, monthsAhead: 3, detailDates: 3 } });
  }
  console.log(`Seeded admin "${username}", policy and ${lists.length} watchlists.`);
}

main().finally(() => prisma.$disconnect());
