import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { expenseReport } from "@/lib/expenses";

export const GET = handle(async (req: Request) => {
  const s = await requireUser();
  const month = new URL(req.url).searchParams.get("month"); // YYYY-MM
  const report = await expenseReport({
    userId: s.role === "ADMIN" ? undefined : s.userId,
    month: month ? new Date(`${month}-01T00:00:00Z`) : undefined,
  });
  if (new URL(req.url).searchParams.get("format") === "csv") {
    const head = "name,username,searches,fare_api_inr,ai_inr,total_inr,cap_inr,used_pct";
    const lines = report.users.map((u) =>
      [u.name, u.username, u.searches, u.fareApiInr.toFixed(2), u.aiInr.toFixed(2), u.totalInr.toFixed(2), u.capInr, u.usedPct].join(","),
    );
    if (report.companyScanInr != null) lines.push(`Company nightly scan,,,,,${report.companyScanInr.toFixed(2)},,`);
    return new Response([head, ...lines].join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="fare-bot-expenses-${report.month}.csv"`,
      },
    });
  }
  return NextResponse.json(report);
});
