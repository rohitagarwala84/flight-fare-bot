// Airports the bot knows by country. "Any airport of the country" means
// this list, so keep it to airports with scheduled international or busy
// domestic service.
export const AIRPORTS: Record<string, { code: string; city: string }[]> = {
  IN: [
    { code: "CCU", city: "Kolkata" },
    { code: "BOM", city: "Mumbai" },
    { code: "DEL", city: "Delhi" },
    { code: "HYD", city: "Hyderabad" },
    { code: "CCJ", city: "Kozhikode" },
    { code: "BLR", city: "Bengaluru" },
    { code: "MAA", city: "Chennai" },
    { code: "COK", city: "Kochi" },
    { code: "AMD", city: "Ahmedabad" },
    { code: "TRV", city: "Thiruvananthapuram" },
    { code: "LKO", city: "Lucknow" },
    { code: "ATQ", city: "Amritsar" },
    { code: "JAI", city: "Jaipur" },
    { code: "GOI", city: "Goa" },
    { code: "BBI", city: "Bhubaneswar" },
    { code: "IXB", city: "Bagdogra" },
    { code: "GAU", city: "Guwahati" },
    { code: "IXC", city: "Chandigarh" },
    { code: "PNQ", city: "Pune" },
  ],
  NG: [
    { code: "LOS", city: "Lagos" },
    { code: "ABV", city: "Abuja" },
    { code: "KAN", city: "Kano" },
    { code: "PHC", city: "Port Harcourt" },
  ],
  VN: [
    { code: "HAN", city: "Hanoi" },
    { code: "SGN", city: "Ho Chi Minh City" },
    { code: "DAD", city: "Da Nang" },
  ],
  SG: [{ code: "SIN", city: "Singapore" }],
  AE: [
    { code: "DXB", city: "Dubai" },
    { code: "SHJ", city: "Sharjah" },
    { code: "AUH", city: "Abu Dhabi" },
  ],
};

// Cities the company sends people from most often (Rohit, 30 Oct).
export const MAIN_ORIGINS = ["CCU", "BOM", "DEL", "HYD", "CCJ"];

export const COUNTRY_NAMES: Record<string, string> = {
  IN: "India",
  NG: "Nigeria",
  VN: "Vietnam",
  SG: "Singapore",
  AE: "UAE",
};

const byCode = new Map(
  Object.entries(AIRPORTS).flatMap(([country, list]) => list.map((a) => [a.code, { ...a, country }] as const)),
);

export function airportInfo(code: string) {
  return byCode.get(code.toUpperCase());
}

// Accepts airport codes ("CCU") and country codes ("NG") and returns airport codes.
export function expandPlaces(places: string[]): string[] {
  const out = new Set<string>();
  for (const raw of places) {
    const p = raw.trim().toUpperCase();
    if (!p) continue;
    if (AIRPORTS[p]) AIRPORTS[p].forEach((a) => out.add(a.code));
    else out.add(p);
  }
  return [...out];
}
