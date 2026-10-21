import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { SalesDoc, balanceOf, canManageSales, daysBetween, money, today } from "@/lib/sales";

export const dynamic = "force-dynamic";

export type Notice = { id: string; kind: "overdue" | "due_today" | "due_soon" | "activity"; title: string; body: string; href: string; when: string };

// Avisos: facturas por vencer / vencidas y lo que hizo el cliente (abrió, aceptó, firmó…)
export async function GET() {
  const { supabase, current } = await getSession();
  if (!current || !canManageSales(current.role)) return NextResponse.json({ items: [] });
  const t = today();
  const [{ data: inv }, { data: act }] = await Promise.all([
    supabase.from("sales_docs").select("*").eq("company_id", current.id).eq("kind", "invoice").not("status", "in", "(draft,void,paid,written_off)").not("due_date", "is", null).limit(500),
    supabase.from("sales_activity").select("id, entity, entity_id, message, detail, actor_name, created_at").eq("company_id", current.id).eq("actor_name", "Customer")
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()).order("created_at", { ascending: false }).limit(30),
  ]);
  const items: Notice[] = [];
  ((inv ?? []) as SalesDoc[]).filter((d) => balanceOf(d) > 0).forEach((d) => {
    const days = daysBetween(t, d.due_date!);
    const href = `/dashboard/invoices/${d.id}`;
    const who = `${d.number} · ${d.customer_name} · ${money(balanceOf(d))}`;
    if (days < 0) items.push({ id: `o-${d.id}`, kind: "overdue", title: `Invoice overdue by ${-days} ${days === -1 ? "day" : "days"}`, body: who, href, when: d.due_date! });
    else if (days === 0) items.push({ id: `t-${d.id}`, kind: "due_today", title: "Invoice due today", body: who, href, when: d.due_date! });
    else if (days <= 2) items.push({ id: `s-${d.id}`, kind: "due_soon", title: `Invoice due in ${days} ${days === 1 ? "day" : "days"}`, body: who, href, when: d.due_date! });
  });
  // También los nombres de los firmantes (actor_name = nombre) en firmas
  const { data: signed } = await supabase.from("sales_activity").select("id, entity, entity_id, message, detail, actor_name, created_at").eq("company_id", current.id)
    .ilike("message", "%by the customer%").gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()).order("created_at", { ascending: false }).limit(30);
  const seen = new Set<string>();
  [...(act ?? []), ...(signed ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)).forEach((a) => {
    if (seen.has(a.id)) return; seen.add(a.id);
    items.push({ id: `a-${a.id}`, kind: "activity", title: a.message, body: a.detail ?? (a.entity === "quote" ? "Quote" : "Invoice"),
      href: `/dashboard/${a.entity === "quote" ? "quotes" : "invoices"}/${a.entity_id}`, when: a.created_at });
  });
  const rank = { overdue: 0, due_today: 1, due_soon: 2, activity: 3 };
  items.sort((a, b) => rank[a.kind] - rank[b.kind] || (a.kind === "activity" ? b.when.localeCompare(a.when) : a.when.localeCompare(b.when)));
  return NextResponse.json({ items: items.slice(0, 40) });
}
