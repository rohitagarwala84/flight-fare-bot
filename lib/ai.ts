// Two small AI jobs, each on the cheapest model that does it well:
//  1. parseQuery: turn "Kolkata theke Lagos, 5-20 Dec, 2 jon" into a search (cheap model).
//  2. adviseOnResults: short saving tips from the fares we already found (better model).
// Every call is written to the expense tracker. Fares themselves never come from the AI.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { config } from "./config";
import { aiCostUsd, record } from "./ledger";
import type { RankedItinerary, SearchRequest } from "./types";

let client: Anthropic | null = null;
export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);
const getClient = () => (client ??= new Anthropic());

const ParsedQuery = z.object({
  origins: z.array(z.string()).describe("IATA airport codes, or IN for any Indian airport"),
  destinations: z.array(z.string()).describe("IATA airport codes, or country codes NG, VN, SG, AE"),
  dateFrom: z.string().describe("YYYY-MM-DD"),
  dateTo: z.string().describe("YYYY-MM-DD"),
  adults: z.number().int(),
  cabin: z.enum(["economy", "premium_economy", "business", "first"]),
  layover: z.enum(["Any", "Direct", "Short", "Medium", "Long"]),
});

const PARSE_SYSTEM = `You convert a corporate traveller's flight request into search fields.
The user may write in English, Bengali, Hindi or romanized Bengali ("Banglish").
Rules:
- Use IATA airport codes. City names map to their main airport (Kolkata=CCU, Mumbai/Bombay=BOM, Delhi=DEL, Hyderabad=HYD, Kozhikode/Calicut=CCJ, Dubai=DXB, Lagos=LOS, Abuja=ABV, Kano=KAN, Hanoi=HAN, Ho Chi Minh/Saigon=SGN, Singapore=SIN).
- "any Indian airport" or "India theke" means origins ["IN"]. A whole destination country means its country code: Nigeria NG, Vietnam VN, Singapore SG, UAE AE.
- If only one date is given, dateFrom = dateTo = that date. If no year, use the next future occurrence.
- Default adults 1, cabin economy, layover Any. "short layover" = Short (<4h), medium = Medium (4-8h), long = Long (>8h), "direct"/"non-stop" = Direct.`;

export async function parseQuery(text: string, userId: string): Promise<SearchRequest | null> {
  if (!aiEnabled()) return null;
  const today = new Date().toISOString().slice(0, 10);
  const res = await getClient().messages.parse({
    model: config.parseModel,
    max_tokens: 1024,
    system: PARSE_SYSTEM,
    messages: [{ role: "user", content: `Today is ${today}.\n\nRequest: ${text}` }],
    output_config: { format: zodOutputFormat(ParsedQuery), effort: "low" },
  });
  await record({
    userId,
    provider: "AI",
    action: "parse",
    usd: aiCostUsd(config.parseModel, res.usage.input_tokens, res.usage.output_tokens),
    meta: { model: config.parseModel, in: res.usage.input_tokens, out: res.usage.output_tokens },
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) return null;
  return res.parsed_output;
}

const ADVICE_SYSTEM = `You are the travel desk analyst for an Indian company that wants the lowest total cost for business trips.
You get real fare data (all prices in INR, already fetched from live fare sources). Write 3 to 5 short tips in simple romanized Bengali (Banglish), one line each, starting with "- ".
Look for: cheaper nearby dates (say how much is saved), a cheaper nearby airport, a cheaper connection hub, layover or self-transfer risks (separate check-in, transit visa, baggage), and policy flags.
Only use numbers that appear in the data. Never invent a fare, flight or rule. If nothing useful stands out, say so in one line.`;

function compact(results: RankedItinerary[], calendar: { route: string; date: string; priceInr: number }[]) {
  return JSON.stringify({
    top: results.map((r) => ({
      route: `${r.origin}-${r.destination}`,
      date: r.date,
      inr: r.priceInr,
      airline: r.carrier,
      flights: r.segments.map((s) => `${s.carrierCode}${s.flightNumber} ${s.from}-${s.to}`).join(", "),
      layover: r.layoverClass,
      hours: r.totalMinutes ? Math.round(r.totalMinutes / 6) / 10 : null,
      selfTransfer: r.selfTransfer,
      policy: r.policyViolations,
    })),
    calendarCheapest: calendar.slice(0, 30),
  });
}

export async function adviseOnResults(
  results: RankedItinerary[],
  calendar: { route: string; date: string; priceInr: number }[],
  policyNotes: string,
  userId: string,
  searchId: string,
): Promise<string | null> {
  if (!aiEnabled() || results.length === 0) return null;
  const model = config.adviceModel;
  const res = await getClient().beta.messages.create({
    model,
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: [{ type: "text", text: ADVICE_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: `Company travel policy notes: ${policyNotes || "none"}\n\nFare data:\n${compact(results, calendar)}`,
      },
    ],
  });
  await record({
    userId,
    provider: "AI",
    action: "advice",
    searchId,
    usd: aiCostUsd(res.model, res.usage.input_tokens, res.usage.output_tokens),
    meta: { model: res.model, in: res.usage.input_tokens, out: res.usage.output_tokens },
  });
  if (res.stop_reason === "refusal") return null;
  return res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
}
