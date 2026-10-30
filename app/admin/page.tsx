import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AdminPanel from "./panel";

export default async function AdminPage() {
  const s = await getSession();
  if (s?.role !== "ADMIN") redirect("/");
  return <AdminPanel selfId={s.userId} />;
}
