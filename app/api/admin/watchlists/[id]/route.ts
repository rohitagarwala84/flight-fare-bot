import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { handle } from "@/lib/http";
import { runWatchlist } from "@/lib/scan";
import { WatchlistInput } from "@/lib/schemas";

export const maxDuration = 900;

export const PATCH = handle(async (req: Request, { params }: { params: { id: string } }) => {
  await requireAdmin();
  const data = WatchlistInput.partial().parse(await req.json());
  return NextResponse.json(await prisma.watchlist.update({ where: { id: params.id }, data }));
});

export const DELETE = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  await requireAdmin();
  await prisma.watchlist.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
});

// "Run now" button: scan this watchlist immediately instead of waiting for tonight.
export const POST = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  await requireAdmin();
  const lines: string[] = [];
  const result = await runWatchlist(params.id, (s) => lines.push(s));
  return NextResponse.json({ ...result, log: lines });
});
