export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { handle } from "@/lib/http";
import { WatchlistInput } from "@/lib/schemas";

export const GET = handle(async () => {
  await requireAdmin();
  return NextResponse.json(await prisma.watchlist.findMany({ orderBy: { createdAt: "asc" } }));
});

export const POST = handle(async (req: Request) => {
  await requireAdmin();
  const w = await prisma.watchlist.create({ data: WatchlistInput.parse(await req.json()) });
  return NextResponse.json(w, { status: 201 });
});
