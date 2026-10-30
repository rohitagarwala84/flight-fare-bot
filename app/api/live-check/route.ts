import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { capStatus } from "@/lib/ledger";
import { liveCheck } from "@/lib/verify";
import type { RankedItinerary, SearchRequest } from "@/lib/types";

export const POST = handle(async (req: Request) => {
  const s = await requireUser();
  const { searchId, index } = await req.json();
  if ((await capStatus(s.userId)).blocked)
    return NextResponse.json({ error: "Maaser limit sesh, live check bondho." }, { status: 402 });
  const search = await prisma.search.findUnique({ where: { id: String(searchId) } });
  if (!search || (search.userId !== s.userId && s.role !== "ADMIN"))
    return NextResponse.json({ error: "Search paoa jayni" }, { status: 404 });
  const it = (search.results as RankedItinerary[])[Number(index)];
  if (!it) return NextResponse.json({ error: "Result paoa jayni" }, { status: 404 });
  const adults = (search.request as SearchRequest).adults ?? 1;
  return NextResponse.json(await liveCheck(it, adults, s.userId));
});
