"use client";
import { useEffect, useState } from "react";
import type { Policy } from "@/lib/types";

type User = { id: string; username: string; name: string; role: "ADMIN" | "USER"; monthlyCapInr: number; active: boolean };
type Watch = {
  id: string;
  label: string;
  origins: string[];
  destinations: string[];
  monthsAhead: number;
  detailDates: number;
  active: boolean;
  lastRunAt: string | null;
};

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Hoyni");
  return json;
}

export default function AdminPanel({ selfId }: { selfId: string }) {
  const [tab, setTab] = useState<"users" | "policy" | "scan">("users");
  return (
    <>
      <div className="tabs">
        <button className={tab === "users" ? "on" : ""} onClick={() => setTab("users")}>
          Users
        </button>
        <button className={tab === "policy" ? "on" : ""} onClick={() => setTab("policy")}>
          Travel policy
        </button>
        <button className={tab === "scan" ? "on" : ""} onClick={() => setTab("scan")}>
          Raater scan
        </button>
      </div>
      {tab === "users" && <Users selfId={selfId} />}
      {tab === "policy" && <PolicyForm />}
      {tab === "scan" && <Watchlists />}
    </>
  );
}

function Users({ selfId }: { selfId: string }) {
  const [users, setUsers] = useState<User[]>([]);
  const [msg, setMsg] = useState("");
  const load = () => api("/api/admin/users", "GET").then(setUsers);
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    try {
      await api("/api/admin/users", "POST", {
        username: f.get("username"),
        name: f.get("name"),
        password: f.get("password"),
        role: f.get("role"),
        monthlyCapInr: Number(f.get("cap")),
      });
      form.reset();
      setMsg("User banano holo");
      load();
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  async function patch(id: string, body: object) {
    try {
      await api(`/api/admin/users/${id}`, "PATCH", body);
      setMsg("Save holo");
      load();
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  return (
    <>
      <form className="card" onSubmit={create}>
        <h2>Notun user</h2>
        <div className="grid">
          <div>
            <label>Naam</label>
            <input name="name" required />
          </div>
          <div>
            <label>Username</label>
            <input name="username" required />
          </div>
          <div>
            <label>Password (8+)</label>
            <input name="password" type="password" minLength={8} required />
          </div>
          <div>
            <label>Monthly limit (₹)</label>
            <input name="cap" type="number" min={0} defaultValue={1000} />
          </div>
          <div>
            <label>Role</label>
            <select name="role">
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
        </div>
        <div style={{ height: 10 }} />
        <button>User banan</button> <span className="muted">{msg}</span>
      </form>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Naam</th>
              <th>Role</th>
              <th>Limit (₹/maas)</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  {u.name}
                  <div className="muted">{u.username}</div>
                </td>
                <td>{u.role}</td>
                <td>
                  <input
                    type="number"
                    min={0}
                    defaultValue={u.monthlyCapInr}
                    style={{ width: 110 }}
                    onBlur={(e) => Number(e.target.value) !== u.monthlyCapInr && patch(u.id, { monthlyCapInr: Number(e.target.value) })}
                  />
                </td>
                <td>{u.active ? "Active" : <span className="error">Blocked</span>}</td>
                <td className="row">
                  {u.id !== selfId && (
                    <button className="ghost" onClick={() => patch(u.id, { active: !u.active })}>
                      {u.active ? "Block" : "Unblock"}
                    </button>
                  )}
                  <button
                    className="ghost"
                    onClick={() => {
                      const p = prompt(`${u.name} er notun password (8+ okkhor)`);
                      if (p) patch(u.id, { password: p });
                    }}
                  >
                    Password reset
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PolicyForm() {
  const [p, setP] = useState<Policy | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    api("/api/admin/policy", "GET").then(setP);
  }, []);
  if (!p) return <p className="muted">Loading...</p>;
  const codes = (s: string) => s.split(/[,\s]+/).map((x) => x.trim().toUpperCase()).filter(Boolean);
  const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/admin/policy", "PUT", p);
      setMsg("Policy save holo");
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  return (
    <form className="card" onSubmit={save}>
      <h2>Company travel policy</h2>
      <p className="muted">Policy bhanga fare gulo laal mark hobe, ar policy-thik fare gulo upore thakbe.</p>
      <div className="grid">
        <div>
          <label>Class</label>
          <select value={p.cabin} onChange={(e) => setP({ ...p, cabin: e.target.value as Policy["cabin"] })}>
            <option value="economy">Economy</option>
            <option value="premium_economy">Premium economy</option>
            <option value="business">Business</option>
          </select>
        </div>
        <div>
          <label>Max stop (khali = jekono)</label>
          <input value={p.maxStops ?? ""} onChange={(e) => setP({ ...p, maxStops: numOrNull(e.target.value) })} />
        </div>
        <div>
          <label>Max layover (ghonta)</label>
          <input value={p.maxLayoverHours ?? ""} onChange={(e) => setP({ ...p, maxLayoverHours: numOrNull(e.target.value) })} />
        </div>
        <div>
          <label>Max fare (₹, jon pichu)</label>
          <input value={p.maxFareInr ?? ""} onChange={(e) => setP({ ...p, maxFareInr: numOrNull(e.target.value) })} />
        </div>
        <div>
          <label>Blocked airline (code, jemon AI, 6E)</label>
          <input defaultValue={p.blockedAirlines.join(", ")} onBlur={(e) => setP({ ...p, blockedAirlines: codes(e.target.value) })} />
        </div>
        <div>
          <label>Preferred airline</label>
          <input defaultValue={p.preferredAirlines.join(", ")} onBlur={(e) => setP({ ...p, preferredAirlines: codes(e.target.value) })} />
        </div>
      </div>
      <div style={{ height: 10 }} />
      <label className="row" style={{ color: "inherit" }}>
        <input type="checkbox" style={{ width: "auto" }} checked={p.noRedEye} onChange={(e) => setP({ ...p, noRedEye: e.target.checked })} />
        Raat 12-5 er flight na
      </label>
      <label className="row" style={{ color: "inherit" }}>
        <input type="checkbox" style={{ width: "auto" }} checked={p.hideViolations} onChange={(e) => setP({ ...p, hideViolations: e.target.checked })} />
        Policy bhanga fare lukiye rakhun
      </label>
      <div style={{ height: 10 }} />
      <label>Onyo niyom / agent ke deya instruction (AI eta mathay rekhe tips debe)</label>
      <textarea value={p.notes} onChange={(e) => setP({ ...p, notes: e.target.value })} />
      <div style={{ height: 10 }} />
      <button>Save</button> <span className="muted">{msg}</span>
    </form>
  );
}

function Watchlists() {
  const [items, setItems] = useState<Watch[]>([]);
  const [msg, setMsg] = useState("");
  const [running, setRunning] = useState<string | null>(null);
  const load = () => api("/api/admin/watchlists", "GET").then(setItems);
  useEffect(() => {
    load();
  }, []);
  const codes = (s: string) => s.split(/[,\s]+/).map((x) => x.trim().toUpperCase()).filter(Boolean);

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    try {
      await api("/api/admin/watchlists", "POST", {
        label: f.get("label"),
        origins: codes(String(f.get("origins"))),
        destinations: codes(String(f.get("destinations"))),
        monthsAhead: Number(f.get("months")),
      });
      form.reset();
      load();
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  async function runNow(id: string) {
    setRunning(id);
    try {
      const r = await api(`/api/admin/watchlists/${id}`, "POST");
      setMsg(`${r.routes} route scan holo, ${r.errors} error`);
      load();
    } catch (err) {
      setMsg((err as Error).message);
    }
    setRunning(null);
  }

  return (
    <>
      <div className="card table-wrap">
        <h2>Protiraate auto-scan</h2>
        <p className="muted">Je list "On" ache, seta protiraate cholbe jotokkhon na off koren. {msg}</p>
        <table>
          <thead>
            <tr>
              <th>Naam</th>
              <th>Theke</th>
              <th>Jabe</th>
              <th>Maas</th>
              <th>Sesh scan</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((w) => (
              <tr key={w.id}>
                <td>{w.label}</td>
                <td>{w.origins.join(", ")}</td>
                <td>{w.destinations.join(", ")}</td>
                <td>{w.monthsAhead}</td>
                <td>{w.lastRunAt ? new Date(w.lastRunAt).toLocaleString("en-IN") : "-"}</td>
                <td className="row">
                  <button className="ghost" onClick={() => api(`/api/admin/watchlists/${w.id}`, "PATCH", { active: !w.active }).then(load)}>
                    {w.active ? "On" : "Off"}
                  </button>
                  <button className="ghost" disabled={running !== null} onClick={() => runNow(w.id)}>
                    {running === w.id ? "Scan cholche..." : "Ekhon scan"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="card" onSubmit={add}>
        <h2>Notun route list</h2>
        <div className="grid">
          <div>
            <label>Naam</label>
            <input name="label" placeholder="India → Kenya" required />
          </div>
          <div>
            <label>Theke (airport ba IN)</label>
            <input name="origins" defaultValue="CCU, BOM, DEL, HYD, CCJ" required />
          </div>
          <div>
            <label>Jabe (airport ba NG/VN/SG/AE)</label>
            <input name="destinations" required />
          </div>
          <div>
            <label>Koto maas age</label>
            <input name="months" type="number" min={1} max={6} defaultValue={3} />
          </div>
        </div>
        <div style={{ height: 10 }} />
        <button>Add</button>
      </form>
    </>
  );
}
