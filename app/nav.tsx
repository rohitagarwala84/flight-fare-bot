"use client";
import { usePathname } from "next/navigation";

export default function Nav({ name, admin }: { name: string; admin: boolean }) {
  const path = usePathname();
  const link = (href: string, label: string) => (
    <a href={href} className={path === href ? "active" : ""}>
      {label}
    </a>
  );
  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    location.href = "/login";
  }
  return (
    <nav className="nav">
      <span className="brand">✈ Fare Bot</span>
      {link("/", "Search")}
      {link("/expenses", "Kharach")}
      {admin && link("/admin", "Admin")}
      <span className="muted">{name}</span>
      <button className="ghost" onClick={logout}>
        Logout
      </button>
    </nav>
  );
}
