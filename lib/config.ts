// Prices used by the expense tracker. All overridable from env so the
// numbers stay right when a plan or exchange rate changes.
const num = (v: string | undefined, d: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : d);

export const config = {
  usdToInr: num(process.env.USD_TO_INR, 88),
  // Ignav: $2 per 1,000 successful requests.
  ignavUsdPerCall: num(process.env.IGNAV_USD_PER_CALL, 0.002),
  // SerpApi: 0 while on the free 250/month plan; 0.025 on the $25 / 1,000 plan.
  serpapiUsdPerCall: num(process.env.SERPAPI_USD_PER_CALL, 0),
  market: process.env.FARE_MARKET ?? "IN",
  // Cheap model reads the request; better model writes the advice.
  parseModel: process.env.AI_PARSE_MODEL ?? "claude-haiku-5-5",
  adviceModel: process.env.AI_ADVICE_MODEL ?? "claude-opus-5-5",
  // USD per million tokens [input, output].
  modelPrices: {
    "claude-haiku-5-5": [0.1, 0.5],
    "claude-sonnet-5-5": [2, 10],
    "claude-opus-5-5": [4, 20],
  } as Record<string, [number, number]>,
  // Snapshots younger than this are reused instead of calling the API again.
  snapshotMaxAgeHours: num(process.env.SNAPSHOT_MAX_AGE_HOURS, 3),
  // A calendar from last night's scan is good enough to pick dates.
  calendarMaxAgeHours: num(process.env.CALENDAR_MAX_AGE_HOURS, 30),
  // How many cheapest route+date combos get a full itinerary search.
  detailCombos: num(process.env.DETAIL_COMBOS, 4),
  defaultUserCapInr: num(process.env.DEFAULT_USER_CAP_INR, 1000),
  capWarnRatio: 0.8,
};

export function usdToInr(usd: number) {
  // Keep sub-paisa precision: a fare call is ~₹0.176 and rounding each one would overstate spend.
  return Math.round(usd * config.usdToInr * 10000) / 10000;
}
