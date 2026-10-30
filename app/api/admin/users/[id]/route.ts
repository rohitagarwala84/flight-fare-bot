import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { handle } from "@/lib/http";

const Patch = z.object({
  name: z.string().min(1).max(80).optional(),
  role: z.enum(["ADMIN", "USER"]).optional(),
  monthlyCapInr: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

export const PATCH = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const admin = await requireAdmin();
  const { password, ...rest } = Patch.parse(await req.json());
  if (params.id === admin.userId && (rest.active === false || rest.role === "USER"))
    return NextResponse.json({ error: "Nijeke block ba admin theke sorano jabe na" }, { status: 400 });
  await prisma.user.update({
    where: { id: params.id },
    data: { ...rest, ...(password ? { passwordHash: await hashPassword(password) } : {}) },
  });
  return NextResponse.json({ ok: true });
});
