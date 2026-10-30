import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { handle } from "@/lib/http";
import { config } from "@/lib/config";

const NewUser = z.object({
  username: z.string().min(3).max(40).regex(/^[a-zA-Z0-9._-]+$/, "Sudhu a-z, 0-9, . _ -"),
  name: z.string().min(1).max(80),
  password: z.string().min(8, "Password kompokkhe 8 okkhor"),
  role: z.enum(["ADMIN", "USER"]).default("USER"),
  monthlyCapInr: z.number().int().min(0).default(config.defaultUserCapInr),
});

export const GET = handle(async () => {
  await requireAdmin();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, username: true, name: true, role: true, monthlyCapInr: true, active: true, createdAt: true },
  });
  return NextResponse.json(users);
});

export const POST = handle(async (req: Request) => {
  await requireAdmin();
  const input = NewUser.parse(await req.json());
  const username = input.username.toLowerCase();
  if (await prisma.user.findUnique({ where: { username } }))
    return NextResponse.json({ error: "Ei username age theke ache" }, { status: 409 });
  const user = await prisma.user.create({
    data: {
      username,
      name: input.name,
      role: input.role,
      monthlyCapInr: input.monthlyCapInr,
      passwordHash: await hashPassword(input.password),
    },
  });
  return NextResponse.json({ id: user.id }, { status: 201 });
});
