"use client";
import { useState } from "react";
import type { RankedItinerary, SearchRequest } from "@/lib/types";

type Outcome = {
  searchId: string;
  request: SearchRequest;
  results: RankedItinerary[];
  tips: string | null;
  costInr: number;
  usedLive: boolean;
  notes: string[];
  cap: { spentInr: number; capInr: number; warn: boolean; blocked: boolean };
  cheapestDays: { route: string; date: string; priceInr: number }[];
};
type Check = { sameFlightInr: number | null; cheapestInr: number | null; cheapestFlights: string | null };

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const hm = (m: number | null) => (m == null ? "" : `${Math.floor(m / 60)}h ${m % 60}m`);
const time = (s: string) => s.slice(11, 16);
const today = () => new Date().toISOString().slice(0, 10);
const plus = (d: number) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);
const list = (s: string) => s.split(/[,\s]+/).map((x) => x.trim().toUpperCase()).filter(Boolean);

export default function SearchPage() {
  const [text, setText] = useState("");
  const [form, setForm] = useState({
    origins: "CCU, BOM, DEL, HYD, CCJ",
    destinations: "NG",
    dateFrom: plus(7),
    dateTo: plus(21),
    adults: 1,
    cabin: "economy",
    layover: "Any",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [out, setOut] = useState<Outcome | null>(null);
  const [checks, setChecks] = useState<Record<number, Check | string>>({});

  async function run(body: object) {
    setBusy(true);
    setError("");
    setChecks({});
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "Search hoyni");
    setOut(json);
  }

  function submitForm(e: React.FormEvent) {
    e.preventDefault();
    run({ ...form, origins: list(form.origins), destinations: list(form.destinations), adults: Number(form.adults) });
  }

  async function liveCheck(i: number) {
    setChecks((c) => ({ ...c, [i]: "checking" }));
    const res = await fetch("/api/live-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ searchId: out!.searchId, index: i }),
    });
    const json = await res.json();
    setChecks((c) => ({ ...c, [i]: res.ok ? json : json.error ?? "Check hoyni" }));
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <div className="card">
        <h1>Sosta fare khujun</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) run({ text });
          }}
        >
          <label htmlFor="q">Likhe bolun (Bangla/English)</label>
          <div className="row">
            <input
              id="q"
              style={{ flex: 1, minWidth: 240 }}
              placeholder="jemon: Kolkata ba Mumbai theke Lagos, 10-25 Dec, 2 jon, short layover"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button disabled={busy || !text.trim()}>{busy ? "Khujchi..." : "AI diye khujun"}</button>
          </div>
        </form>
      </div>

      <form className="card" onSubmit={submitForm}>
        <h2>Ba form diye</h2>
        <div className="grid">
          <div>
            <label>Theke (airport/IN)</label>
            <input value={form.origins} onChange={set("origins")} />
          </div>
          <div>
            <label>Jabe (airport ba NG/VN/SG/AE)</label>
            <input value={form.destinations} onChange={set("destinations")} />
          </div>
          <div>
            <label>Date theke</label>
            <input type="date" min={today()} value={form.dateFrom} onChange={set("dateFrom")} />
          </div>
          <div>
            <label>Date porjonto</label>
            <input type="date" min={form.dateFrom} value={form.dateTo} onChange={set("dateTo")} />
          </div>
          <div>
            <label>Jon</label>
            <input type="number" min={1} max={9} value={form.adults} onChange={set("adults")} />
          </div>
          <div>
            <label>Class</label>
            <select value={form.cabin} onChange={set("cabin")}>
              <option value="economy">Economy</option>
              <option value="premium_economy">Premium economy</option>
              <option value="business">Business</option>
            </select>
          </div>
          <div>
            <label>Layover</label>
            <select value={form.layover} onChange={set("layover")}>
              <option>Any</option>
              <option>Direct</option>
              <option value="Short">Short (&lt;4h)</option>
              <option value="Medium">Medium (4-8h)</option>
              <option value="Long">Long (8h+)</option>
            </select>
          </div>
        </div>
        <div style={{ height: 12 }} />
        <button disabled={busy}>{busy ? "Khujchi..." : "Search"}</button>
      </form>

      {error && <p className="error">{error}</p>}

      {out && (
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>
              Best {out.results.length}: {out.request.origins.join("/")} → {out.request.destinations.join("/")},{" "}
              {out.request.dateFrom} – {out.request.dateTo}
            </h2>
            <span className="muted">
              Ei search er kharach {inr(out.costInr)} · {out.usedLive ? "live data" : "raater scan theke"} · maase{" "}
              {inr(out.cap.spentInr)} / {inr(out.cap.capInr)}
            </span>
          </div>
          {out.cap.warn && <p className="error">Maaser limit er 80% shesh hoye geche.</p>}
          {out.notes.map((n, i) => (
            <p key={i} className="muted">
              {n}
            </p>
          ))}
          {out.tips && <div className="tips">{out.tips}</div>}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date / Route</th>
                  <th>Flight</th>
                  <th>Time</th>
                  <th>Layover</th>
                  <th className="num">Fare ({out.request.adults} jon)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {out.results.map((r, i) => {
                  const c = checks[i];
                  return (
                    <tr key={r.id + i}>
                      <td>{i + 1}</td>
                      <td>
                        <b>{r.date}</b>
                        <div className="muted">
                          {r.origin} → {r.destination}
                        </div>
                      </td>
                      <td>
                        {r.carrier}
                        <div className="muted">
                          {r.segments.map((s) => `${s.carrierCode ?? ""}${s.flightNumber ?? ""} ${s.from}-${s.to}`).join(" · ")}
                        </div>
                      </td>
                      <td>
                        {time(r.segments[0].departLocal)} → {time(r.segments[r.segments.length - 1].arriveLocal)}
                        <div className="muted">{hm(r.totalMinutes)}</div>
                      </td>
                      <td>
                        <span className={`pill ${r.layoverClass}`}>{r.layoverClass}</span>
                        {r.layoverMinutes.length > 0 && (
                          <div className="muted">{r.layoverMinutes.map(hm).join(", ")}</div>
                        )}
                        {r.policyViolations.map((v) => (
                          <div key={v}>
                            <span className="pill bad">{v}</span>
                          </div>
                        ))}
                      </td>
                      <td className="num">
                        <span className="price">{inr(r.priceInr)}</span>
                        <div className="muted">{r.currency !== "INR" ? r.currency : ""}</div>
                      </td>
                      <td>
                        {!c && (
                          <button className="ghost" onClick={() => liveCheck(i)}>
                            Live check
                          </button>
                        )}
                        {c === "checking" && <span className="muted">checking...</span>}
                        {typeof c === "string" && c !== "checking" && <span className="error">{c}</span>}
                        {c && typeof c === "object" && (
                          <span className="muted">
                            Ekhon: {c.sameFlightInr != null ? inr(c.sameFlightInr) : "ei flight paoa jayni"}
                            <br />
                            Sobcheye sosta: {c.cheapestInr != null ? `${inr(c.cheapestInr)} (${c.cheapestFlights})` : "-"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {out.results.length === 0 && <p className="muted">Kono fare paoa jayni. Date range ba airport bodle dekhun.</p>}
        </div>
      )}
    </>
  );
}
