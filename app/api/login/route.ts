import { NextResponse } from "next/server";
import { checkLogin, signSession, SESSION_COOKIE } from "@/lib/auth";
import { handle } from "@/lib/http";

export const POST = handle(async (req: Request) => {
  const { username, password } = await req.json();
  const user = await checkLogin(String(username ?? ""), String(password ?? ""));
  if (!user) return NextResponse.json({ error: "Username ba password bhul" }, { status: 401 });
  const token = await signSession({ userId: user.id, role: user.role, name: user.name });
  const res = NextResponse.json({ ok: true, name: user.name, role: user.role });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 12 * 3600,
  });
  return res;
});
