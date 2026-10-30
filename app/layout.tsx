import "./globals.css";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import Nav from "./nav";

export const metadata: Metadata = { title: "Fare Bot", description: "Cheapest flight fares for the company travel desk" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <html lang="en">
      <body>
        {session && <Nav name={session.name} admin={session.role === "ADMIN"} />}
        <main>{children}</main>
      </body>
    </html>
  );
}
