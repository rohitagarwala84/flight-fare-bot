"use client";
import { useState } from "react";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: f.get("username"), password: f.get("password") }),
    });
    setBusy(false);
    if (res.ok) location.href = "/";
    else setError((await res.json()).error ?? "Login hoyni");
  }
  return (
    <div className="card" style={{ maxWidth: 380, margin: "80px auto" }}>
      <h1>✈ Fare Bot</h1>
      <form onSubmit={submit}>
        <label htmlFor="u">Username</label>
        <input id="u" name="username" autoComplete="username" required />
        <div style={{ height: 10 }} />
        <label htmlFor="p">Password</label>
        <input id="p" name="password" type="password" autoComplete="current-password" required />
        <div style={{ height: 14 }} />
        <button disabled={busy}>{busy ? "..." : "Login"}</button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}
