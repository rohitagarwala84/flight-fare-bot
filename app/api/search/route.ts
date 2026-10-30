import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { parseQuery } from "@/lib/ai";
import { runSearch } from "@/lib/search";
import { capStatus } from "@/lib/ledger";
import type { SearchRequest } from "@/lib/types";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Form = z.object({
  origins: z.array(z.string().min(2)).min(1),
  destinations: z.array(z.string().min(2)).min(1),
  dateFrom: date,
  dateTo: date,
  adults: z.number().int().min(1).max(9).default(1),
  cabin: z.enum(["economy", "premium_economy", "business", "first"]).default("economy"),
  layover: z.enum(["Any", "Direct", "Short", "Medium", "Long"]).default("Any"),
  forceLive: z.boolean().optional(),
});

export const maxDuration = 120;

export const POST = handle(async (req: Request) => {
  const s = await requireUser();
  const body = await req.json();
  let request: SearchRequest;
  if (typeof body.text === "string" && body.text.trim()) {
    if ((await capStatus(s.userId)).blocked)
      return NextResponse.json({ error: "Maaser limit sesh. Form diye search korun (sudhu raater data)." }, { status: 402 });
    const parsed = await parseQuery(body.text, s.userId);
    if (!parsed) return NextResponse.json({ error: "Bujhte parlam na, form diye search korun." }, { status: 422 });
    request = Form.parse(parsed);
  } else {
    request = Form.parse(body);
  }
  if (request.dateTo < request.dateFrom) [request.dateFrom, request.dateTo] = [request.dateTo, request.dateFrom];
  return NextResponse.json({ request, ...(await runSearch(s.userId, request)) });
});
