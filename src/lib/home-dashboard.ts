import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardData } from "@/lib/dashboard-data";
import { daysBetween, today } from "@/lib/sales";

// =====================================================================
// Dashboard de inicio (Paso 5.3f): alertas de todas las apps + ingresos del dueño.
// Solo LEE de las tablas que ya existen (no crea nada en la base de datos).
// =====================================================================

export type AlertApp = "jobs" | "inventory" | "finances";
export type AlertLevel = "red" | "orange" | "blue" | "gray";
export type HomeAlert = { id: string; app: AlertApp; level: AlertLevel; kind: string; title: string; sub: string; pill: string; href: string; at: string };

// ---------- Alertas guardadas en la base (las de trabajos "en vivo" se calculan en el navegador) ----------
export async function loadHomeAlerts(supabase: SupabaseClient, companyId: string, opts: { finances: boolean; inventory: boolean }): Promise<HomeAlert[]> {
  const [jobs, stock, digest] = await Promise.all([
    supabase.from("job_alerts").select("id, job_id, kind, title, body, created_at").eq("company_id", companyId).is("resolved_at", null).order("created_at", { ascending: false }).limit(30),
    opts.inventory
      ? supabase.from("inventory_alerts").select("id, qty, min_qty, created_at, item_id, items ( name ), inventory_locations ( name )").eq("company_id", companyId).is("resolved_at", null).order("created_at", { ascending: false }).limit(30)
      : Promise.resolve({ data: [], error: null }),
    opts.finances ? supabase.rpc("get_company_notifications_digest", { p_company_id: companyId }) : Promise.resolve({ data: null, error: null }),
  ]);
  const out: HomeAlert[] = [];

  // Jobs: quedó a medias (hay que re-agendar) · Tune-Up con lecturas fuera de rango
  for (const r of ((jobs.error ? [] : jobs.data) ?? []) as { id: string; job_id: string; kind: string; title: string; body: string | null; created_at: string }[]) {
    const followup = r.kind === "needs_followup";
    out.push({
      id: `ja-${r.id}`, app: "jobs", level: followup ? "orange" : "red", kind: r.kind, title: r.title,
      sub: r.body ?? (followup ? "Book the next visit" : "Check the readings"), pill: followup ? "Follow-up" : "Check",
      href: followup ? "/dashboard/jobs/schedule" : `/dashboard/jobs/${r.job_id}`, at: r.created_at,
    });
  }

  // Inventario: stock bajo o agotado
  type StockRow = { id: string; qty: number; min_qty: number; created_at: string; item_id: string; items: { name: string } | null; inventory_locations: { name: string } | null };
  for (const r of ((stock.error ? [] : stock.data) ?? []) as unknown as StockRow[]) {
    const out0 = Number(r.qty) <= 0;
    out.push({
      id: `ls-${r.id}`, app: "inventory", level: out0 ? "red" : "orange", kind: out0 ? "out_of_stock" : "low_stock",
      title: `${out0 ? "Out of stock" : "Low stock"}: ${r.items?.name ?? "item"}`,
      sub: `${r.inventory_locations?.name ?? "Location"} · ${Number(r.qty)} left (alert at ${Number(r.min_qty)})`,
      pill: out0 ? "Out" : "Low", href: `/dashboard/inventory/${r.item_id}`, at: r.created_at,
    });
  }

  // Finanzas (solo dueño y manager): facturas vencidas, que vencen hoy o en 1–2 días
  type Inv = { id: string; number: string; customer_name: string; total: number; amount_paid: number; written_off: number; due_date: string; status: string };
  const invoices = ((digest.error ? null : (digest.data as { invoices?: Inv[] } | null))?.invoices ?? []) as Inv[];
  const t = today();
  const money = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
  for (const inv of invoices) {
    const bal = Math.round((Number(inv.total) - Number(inv.amount_paid) - Number(inv.written_off)) * 100) / 100;
    if (bal <= 0 || !inv.due_date) continue;
    const days = daysBetween(t, inv.due_date);
    if (days > 2) continue;
    const late = days < 0;
    out.push({
      id: `inv-${inv.id}`, app: "finances", level: late ? "red" : days === 0 ? "orange" : "blue", kind: late ? "overdue" : "due_soon",
      title: late ? `Invoice overdue ${-days} ${days === -1 ? "day" : "days"}` : days === 0 ? "Invoice due today" : `Invoice due in ${days} ${days === 1 ? "day" : "days"}`,
      sub: `${inv.number} · ${inv.customer_name} · ${money(bal)}`, pill: late ? "Overdue" : "Due soon",
      href: `/dashboard/invoices/${inv.id}`, at: inv.due_date,
    });
  }
  return out;
}

// ---------- Ingresos (solo dueño): semana, mes y año ----------
export type RevenueRange = "week" | "month" | "year";
export type RevenueSeries = {
  labels: { label: string; title: string }[];
  invoiced: number[]; collected: number[]; costs: number[];
  totals: { invoiced: number; collected: number; costs: number; profit: number };
};
export type RevenueData = { outstanding: number; overdue: number; ranges: Record<RevenueRange, RevenueSeries> };

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Usa los mismos datos que ya carga el dashboard de finanzas (facturas, pagos + Money In, gastos)
export function buildRevenue(data: DashboardData, weekStartsOn: number, now = new Date()): RevenueData {
  const sum = (rows: { date: string; amount: number }[], from: string, to: string) =>
    rows.filter((r) => r.date >= from && r.date <= to).reduce((a, r) => a + (Number(r.amount) || 0), 0);
  const make = (buckets: { from: string; to: string; label: string; title: string }[]): RevenueSeries => {
    const invoiced = buckets.map((b) => sum(data.invoices, b.from, b.to));
    const collected = buckets.map((b) => sum(data.payments, b.from, b.to));
    const costs = buckets.map((b) => sum(data.expenses, b.from, b.to));
    const tot = (a: number[]) => Math.round(a.reduce((x, y) => x + y, 0) * 100) / 100;
    return {
      labels: buckets.map((b) => ({ label: b.label, title: b.title })), invoiced, collected, costs,
      totals: { invoiced: tot(invoiced), collected: tot(collected), costs: tot(costs), profit: Math.round((tot(collected) - tot(costs)) * 100) / 100 },
    };
  };
  const day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Semana: los 7 días de esta semana (según el día en que empieza la semana en Jobs settings)
  const ws = new Date(day0); ws.setDate(ws.getDate() - ((ws.getDay() - weekStartsOn + 7) % 7));
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + i);
    return { from: ymd(d), to: ymd(d), label: d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(), title: d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }) };
  });
  // Mes: cada día de este mes
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const month = Array.from({ length: dim }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), i + 1);
    return { from: ymd(d), to: ymd(d), label: String(i + 1), title: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) };
  });
  // Año: los 12 meses de este año
  const year = Array.from({ length: 12 }, (_, i) => {
    const a = new Date(now.getFullYear(), i, 1), b = new Date(now.getFullYear(), i + 1, 0);
    return { from: ymd(a), to: ymd(b), label: a.toLocaleDateString("en-US", { month: "short" }), title: a.toLocaleDateString("en-US", { month: "long", year: "numeric" }) };
  });
  const t = ymd(day0);
  const open = data.openInvoices ?? [];
  return {
    outstanding: Math.round(open.reduce((a, o) => a + o.balance, 0) * 100) / 100,
    overdue: Math.round(open.filter((o) => o.due < t).reduce((a, o) => a + o.balance, 0) * 100) / 100,
    ranges: { week: make(week), month: make(month), year: make(year) },
  };
}
