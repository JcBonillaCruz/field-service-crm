import type { Plan } from "@/lib/maintenance";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardData } from "@/lib/dashboard-data";
import { daysBetween, today } from "@/lib/sales";

// =====================================================================
// Dashboard de inicio (Paso 5.3f): alertas de todas las apps + ingresos del dueño.
// Solo LEE de las tablas que ya existen (no crea nada en la base de datos).
// =====================================================================

export type AlertApp = "jobs" | "inventory" | "finances" | "quotes";
export type AlertLevel = "red" | "orange" | "blue" | "gray" | "teal";
export type HomeAlert = {
  id: string; app: AlertApp; level: AlertLevel; kind: string; title: string; sub: string; pill: string; href: string; at: string;
  item?: string; location?: string; qty?: number; min?: number; // inventario: para la barrita de stock
  days?: number; amount?: number; customer?: string; number?: string; // facturas: días para vencer (negativo = vencida) y saldo
  docId?: string; viewed?: boolean; // cotizaciones (Paso 6.7): id de la cotización y si el cliente ya la abrió
};

// Paso 6.7: cuántos días se espera respuesta antes de avisar, cuántos días antes de vencer se avisa
// y cuántos días se queda en el Home una cotización rechazada.
export const QUOTE_NO_REPLY_DAYS = 3;
export const QUOTE_EXPIRING_DAYS = 3;
export const QUOTE_DECLINED_DAYS = 14;

// ---------- Alertas guardadas en la base (las de trabajos "en vivo" se calculan en el navegador) ----------
export async function loadHomeAlerts(supabase: SupabaseClient, companyId: string, opts: { finances: boolean; inventory: boolean; quotes?: boolean }): Promise<HomeAlert[]> {
  const [jobs, stock, digest, plans, quotes] = await Promise.all([
    supabase.from("job_alerts").select("id, job_id, kind, title, body, created_at").eq("company_id", companyId).is("resolved_at", null).order("created_at", { ascending: false }).limit(30),
    opts.inventory
      ? supabase.from("inventory_alerts").select("id, qty, min_qty, created_at, item_id, items ( name ), inventory_locations ( name )").eq("company_id", companyId).is("resolved_at", null).order("created_at", { ascending: false }).limit(30)
      : Promise.resolve({ data: [], error: null }),
    opts.finances ? supabase.rpc("get_company_notifications_digest", { p_company_id: companyId }) : Promise.resolve({ data: null, error: null }),
    // Paso 5.11: planes de mantenimiento (los técnicos y las bases sin el SQL nuevo reciben error → sin avisos)
    supabase.rpc("maintenance_plans_list", { p_company: companyId }).then((r) => r, () => ({ data: null, error: true })),
    // Paso 6.7: cotizaciones que piden algo (dueño, manager y oficina)
    opts.quotes ? loadQuoteAlerts(supabase, companyId).catch(() => [] as HomeAlert[]) : Promise.resolve([] as HomeAlert[]),
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

  // Maintenance plans: un plan que no pudo crear su visita · un plan que está por terminar (para renovarlo)
  const todayMs = Date.now();
  for (const p of ((plans.error ? [] : plans.data) ?? []) as Plan[]) {
    const href = `/dashboard/jobs/plans/${p.id}`;
    if (p.status === "active" && p.last_error) {
      out.push({ id: `mp-err-${p.id}`, app: "jobs", level: "red", kind: "plan_error", title: `${p.customer_name} · ${p.name}`, sub: "The plan couldn't create its next visit", pill: "Check", href, at: new Date().toISOString() });
      continue;
    }
    const daysLeft = p.end_kind === "date" && p.end_date ? Math.round((new Date(`${p.end_date}T12:00:00`).getTime() - todayMs) / 86400000) : null;
    const endsSoon = (p.status === "active" || p.status === "finished") && ((daysLeft != null && daysLeft >= 0 && daysLeft <= 30) || (p.status === "finished" && p.end_kind === "count" && (p.visits_upcoming ?? 0) === 1));
    if (endsSoon) {
      out.push({ id: `mp-end-${p.id}`, app: "jobs", level: "orange", kind: "plan_ending", title: `${p.customer_name} · ${p.name}`,
        sub: daysLeft != null ? `Maintenance plan ends ${daysLeft === 0 ? "today" : `in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}` : "Last visit of the maintenance plan is coming up", pill: "Renew", href, at: p.next_visit ?? new Date().toISOString() });
    }
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
      item: r.items?.name ?? "Item", location: r.inventory_locations?.name ?? "Location", qty: Number(r.qty), min: Number(r.min_qty),
    });
  }

  // Finanzas (solo dueño y manager): facturas vencidas o que vencen en los próximos 7 días (para llamar al cliente)
  type Inv = { id: string; number: string; customer_name: string; total: number; amount_paid: number; written_off: number; due_date: string; status: string };
  const invoices = ((digest.error ? null : (digest.data as { invoices?: Inv[] } | null))?.invoices ?? []) as Inv[];
  const t = today();
  const money = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
  for (const inv of invoices) {
    const bal = Math.round((Number(inv.total) - Number(inv.amount_paid) - Number(inv.written_off)) * 100) / 100;
    if (bal <= 0 || !inv.due_date) continue;
    const days = daysBetween(t, inv.due_date);
    if (days > 7) continue;
    const late = days < 0;
    out.push({
      id: `inv-${inv.id}`, app: "finances", level: late ? "red" : days === 0 ? "orange" : "blue", kind: late ? "overdue" : "due_soon",
      title: late ? `Invoice overdue ${-days} ${days === -1 ? "day" : "days"}` : days === 0 ? "Invoice due today" : `Invoice due in ${days} ${days === 1 ? "day" : "days"}`,
      sub: `${inv.number} · ${inv.customer_name} · ${money(bal)}`, pill: late ? "Overdue" : "Due soon",
      href: `/dashboard/invoices/${inv.id}`, at: inv.due_date,
      days, amount: bal, customer: inv.customer_name, number: inv.number,
    });
  }
  return [...out, ...quotes];
}

// ---------- Cotizaciones en el Home (Paso 6.7) ----------
//   · quote_accepted  → aceptada y todavía sin trabajo ni factura (Convert to job / Convert to invoice)
//   · quote_declined  → rechazada en los últimos 14 días
//   · quote_expiring  → enviada, sin respuesta, vence hoy o en los próximos 3 días
//   · quote_no_reply  → enviada hace 3 días o más y el cliente no ha contestado
// Una cotización sale una sola vez (si vence pronto, no sale también como "sin respuesta").
async function loadQuoteAlerts(supabase: SupabaseClient, companyId: string): Promise<HomeAlert[]> {
  type Q = { id: string; number: string; customer_name: string; total: number; status: string; doc_date: string; expiry_date: string | null;
    sent_at: string | null; viewed_at: string | null; accepted_at: string | null; declined_at: string | null; updated_at: string };
  const r = await supabase.from("sales_docs")
    .select("id, number, customer_name, total, status, doc_date, expiry_date, sent_at, viewed_at, accepted_at, declined_at, updated_at")
    .eq("company_id", companyId).eq("kind", "quote").in("status", ["sent", "viewed", "accepted", "declined"])
    .order("updated_at", { ascending: false }).limit(400);
  if (r.error) return [];
  const rows = (r.data ?? []) as Q[];
  // Las aceptadas que ya tienen un trabajo (Convert to Job) no piden nada
  const acceptedIds = rows.filter((q) => q.status === "accepted").map((q) => q.id);
  const withJob = new Set<string>();
  if (acceptedIds.length) {
    const j = await supabase.from("jobs").select("quote_id").in("quote_id", acceptedIds).is("cancelled_at", null);
    for (const x of (j.error ? [] : j.data ?? []) as { quote_id: string }[]) withJob.add(x.quote_id);
  }
  const t = today();
  const dayOf = (iso: string | null) => (iso ? iso.slice(0, 10) : null);
  const out: HomeAlert[] = [];
  for (const q of rows) {
    const base = { app: "quotes" as const, href: `/dashboard/quotes/${q.id}`, amount: Number(q.total) || 0, customer: q.customer_name, number: q.number, docId: q.id, viewed: Boolean(q.viewed_at) || q.status === "viewed" };
    if (q.status === "accepted") {
      if (withJob.has(q.id)) continue;
      const at = q.accepted_at ?? q.updated_at;
      out.push({ ...base, id: `qa-${q.id}`, level: "teal", kind: "quote_accepted", title: "Quote accepted", sub: `${q.number} · ${q.customer_name}`, pill: "Accepted", at, days: daysBetween(dayOf(at) ?? t, t) });
      continue;
    }
    if (q.status === "declined") {
      const at = q.declined_at ?? q.updated_at;
      const ago = daysBetween(dayOf(at) ?? t, t);
      if (ago > QUOTE_DECLINED_DAYS) continue;
      out.push({ ...base, id: `qd-${q.id}`, level: "red", kind: "quote_declined", title: "Quote declined", sub: `${q.number} · ${q.customer_name}`, pill: "Declined", at, days: ago });
      continue;
    }
    // Enviada o vista, sin respuesta. Las ya vencidas no salen (las ve en Quotes como Expired).
    if (q.expiry_date && q.expiry_date < t) continue;
    if (q.expiry_date) {
      const left = daysBetween(t, q.expiry_date);
      if (left <= QUOTE_EXPIRING_DAYS) {
        out.push({ ...base, id: `qe-${q.id}`, level: "orange", kind: "quote_expiring", title: "Quote expiring", sub: `${q.number} · ${q.customer_name}`, pill: "Expiring", at: q.expiry_date, days: left });
        continue;
      }
    }
    const sent = dayOf(q.sent_at) ?? q.doc_date;
    const waited = daysBetween(sent, t);
    if (waited >= QUOTE_NO_REPLY_DAYS) {
      out.push({ ...base, id: `qn-${q.id}`, level: "blue", kind: "quote_no_reply", title: "No answer yet", sub: `${q.number} · ${q.customer_name}`, pill: "Waiting", at: q.sent_at ?? q.doc_date, days: waited });
    }
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
