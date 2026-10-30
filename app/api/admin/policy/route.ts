export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { getPolicy, savePolicy } from "@/lib/settings";

const codes = z.array(z.string().trim().toUpperCase().length(2));
const PolicyInput = z.object({
  cabin: z.enum(["economy", "premium_economy", "business", "first"]),
  maxStops: z.number().int().min(0).max(3).nullable(),
  maxLayoverHours: z.number().min(0).max(48).nullable(),
  noRedEye: z.boolean(),
  blockedAirlines: codes,
  preferredAirlines: codes,
  maxFareInr: z.number().int().min(0).nullable(),
  hideViolations: z.boolean(),
  notes: z.string().max(4000),
});

export const GET = handle(async () => {
  await requireUser();
  return NextResponse.json(await getPolicy());
});

export const PUT = handle(async (req: Request) => {
  await requireAdmin();
  await savePolicy(PolicyInput.parse(await req.json()));
  return NextResponse.json({ ok: true });
});
