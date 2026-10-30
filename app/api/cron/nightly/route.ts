export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { runAllWatchlists } from "@/lib/scan";

export const maxDuration = 3600;

// Called once a night by a scheduler (Cloud Scheduler / Vercel Cron) with
// "Authorization: Bearer $CRON_SECRET".
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const lines: string[] = [];
  const result = await runAllWatchlists((s) => lines.push(s));
  return NextResponse.json({ result, log: lines });
}

export const GET = POST;
