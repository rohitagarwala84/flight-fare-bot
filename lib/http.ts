import { NextResponse } from "next/server";

// Route handlers throw a Response (from requireUser/requireAdmin) to stop early.
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof Response) return NextResponse.json({ error: await e.text() }, { status: e.status });
      console.error(e);
      return NextResponse.json({ error: (e as Error).message ?? "Server error" }, { status: 500 });
    }
  };
}
