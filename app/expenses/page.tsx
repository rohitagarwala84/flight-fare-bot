"use client";
import { useEffect, useState } from "react";

type Report = {
  month: string;
  totalInr: number;
  companyScanInr: number | null;
  users: {
    userId: string;
    name: string;
    username: string;
    capInr: number;
    searches: number;
    fareApiInr: number;
    aiInr: number;
    totalInr: number;
    usedPct: number;
  }[];
  recent: { at: string; who: string; provider: string; action: string; costInr: number }[];
};

const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

export default function ExpensesPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [r, setR] = useState<Report | null>(null);

  useEffect(() => {
    const load = () => fetch(`/api/expenses?month=${month}`).then((x) => x.json()).then(setR);
    load();
    const t = setInterval(load, 30_000); // live: refresh every 30 seconds
    return () => clearInterval(t);
  }, [month]);

  if (!r) return <p className="muted">Loading...</p>;
  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h1>Kharach ({r.month})</h1>
          <div className="row">
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: 170 }} />
            <a href={`/api/expenses?month=${month}&format=csv`}>Excel/CSV download</a>
          </div>
        </div>
        <div className="grid">
          <div>
            <div className="muted">Mot kharach</div>
            <div className="price">{inr(r.totalInr)}</div>
          </div>
          {r.companyScanInr != null && (
            <div>
              <div className="muted">Raater auto-scan (company)</div>
              <div className="price">{inr(r.companyScanInr)}</div>
            </div>
          )}
          <div>
            <div className="muted">Mot search</div>
            <div className="price">{r.users.reduce((s, u) => s + u.searches, 0)}</div>
          </div>
        </div>
      </div>

      <div className="card table-wrap">
        <h2>User onujayi</h2>
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th className="num">Search</th>
              <th className="num">Fare API</th>
              <th className="num">AI</th>
              <th className="num">Mot</th>
              <th style={{ width: 200 }}>Limit</th>
            </tr>
          </thead>
          <tbody>
            {r.users.map((u) => (
              <tr key={u.userId}>
                <td>
                  {u.name}
                  <div className="muted">{u.username}</div>
                </td>
                <td className="num">{u.searches}</td>
                <td className="num">{inr(u.fareApiInr)}</td>
                <td className="num">{inr(u.aiInr)}</td>
                <td className="num">
                  <b>{inr(u.totalInr)}</b>
                </td>
                <td>
                  <div className="bar">
                    <span
                      className={u.usedPct >= 100 ? "bad" : u.usedPct >= 80 ? "warn" : ""}
                      style={{ width: `${Math.min(100, u.usedPct)}%` }}
                    />
                  </div>
                  <div className="muted">
                    {u.usedPct}% of {inr(u.capInr)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card table-wrap">
        <h2>Sesh 50 ta call</h2>
        <table>
          <thead>
            <tr>
              <th>Somoy</th>
              <th>Ke</th>
              <th>Ki</th>
              <th className="num">Kharach</th>
            </tr>
          </thead>
          <tbody>
            {r.recent.map((e, i) => (
              <tr key={i}>
                <td>{new Date(e.at).toLocaleString("en-IN")}</td>
                <td>{e.who}</td>
                <td>
                  {e.provider} · {e.action}
                </td>
                <td className="num">{inr(e.costInr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
