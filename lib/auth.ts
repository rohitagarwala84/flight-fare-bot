import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

export const SESSION_COOKIE = "ffb_session";
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(s ?? "dev-only-change-me");
};

export type Session = { userId: string; role: "ADMIN" | "USER"; name: string };

export async function signSession(s: Session) {
  return new SignJWT(s).setProtectedHeader({ alg: "HS256" }).setExpirationTime("12h").sign(secret());
}

export async function readSessionToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const s = await readSessionToken(cookies().get(SESSION_COOKIE)?.value);
  if (!s) return null;
  // A blocked user loses access at once, not when the cookie expires.
  const user = await prisma.user.findUnique({ where: { id: s.userId } });
  return user?.active ? { userId: user.id, role: user.role, name: user.name } : null;
}

export async function requireUser() {
  const s = await getSession();
  if (!s) throw new Response("Unauthorized", { status: 401 });
  return s;
}

export async function requireAdmin() {
  const s = await requireUser();
  if (s.role !== "ADMIN") throw new Response("Forbidden", { status: 403 });
  return s;
}

export const hashPassword = (p: string) => bcrypt.hash(p, 10);

export async function checkLogin(username: string, password: string) {
  const user = await prisma.user.findUnique({ where: { username: username.trim().toLowerCase() } });
  if (!user || !user.active) return null;
  return (await bcrypt.compare(password, user.passwordHash)) ? user : null;
}
