import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC = ["/login", "/api/login", "/api/cron"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();
  const token = req.cookies.get("ffb_session")?.value;
  try {
    if (!token) throw new Error("no session");
    await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET ?? "dev-only-change-me"));
    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Login korun" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = { matcher: ["/((?!_next|favicon.ico).*)"] };
