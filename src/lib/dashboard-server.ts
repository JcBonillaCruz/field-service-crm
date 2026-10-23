import type { SupabaseClient } from "@supabase/supabase-js";
import { DashboardData, EMPTY_DATA } from "@/lib/dashboard-data";
import { SalesDoc, Subscription, balanceOf, daysBetween, today } from "@/lib/sales";

export type MobileStats = {
  total: number; current: number; overdue: number; aging: number[]; agingCount: number[];
  expenseByCat: [string, number][];
  recentPayments: { date: string; amount: number; number: string; customer: string; mode: string | null }[];
  recentExpenses: { date: string; amount: number; category: string; vendor: string | null }[]; quoteStats: { sent: number; accepted: number; declined: number; open: number; openValue: number };
  months: string[]; income: number[]; receipts: number[]; expenses: number[];
  ytdReceived: number; ytdExpenses: number; ytdInvoiced: number;
  revenue12: number; income12: number; receipts12: number; invoiceReceipts12: number; mrr: number; activeSubs: number; arpu: number;
};

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const monthly = (s: Pick<Subscription, "total" | "bill_every" | "bill_unit">) =>
  (Number(s.total) || 0) / Math.max(1, s.bill_every) * (s.bill_unit === "week" ? 52 / 12 : s.bill_unit === "year" ? 1 / 12 : 1);

// Llena el dashboard con lo que de verdad pasa en Quotes / Invoices / Payments / Subscriptions
export async function loadDashboard(supabase: SupabaseClient, companyId: string): Promise<{ data: DashboardData; mobile: MobileStats }> {
  const [{ data: inv }, { data: pays }, { data: subs }, { data: exps }, { data: qts }, { data: other }] = await Promise.all([
    // Solo las columnas que usan las métricas (antes select=* traía las ~55 columnas, firmas incluidas)
    supabase.from("sales_docs").select("id, number, customer_name, doc_date, due_date, status, total, amount_paid, written_off").eq("company_id", companyId).eq("kind", "invoice").not("status", "in", "(draft,void)").limit(10000),
    supabase.from("sales_payments").select("kind, amount, paid_on, invoice_id, mode").eq("company_id", companyId).order("paid_on", { ascending: false }).limit(20000),
    supabase.from("subscriptions").select("total, bill_every, bill_unit, start_date, cancelled_at, status, created_at").eq("company_id", companyId).limit(5000),
    supabase.from("expenses").select("expense_date, amount, category, vendor").eq("company_id", companyId).order("expense_date", { ascending: false }).limit(20000), // sin el SQL 3.36 viene vacío
    supabase.from("sales_docs").select("status, total, expiry_date").eq("company_id", companyId).eq("kind", "quote").limit(10000),
    // Entradas de dinero manuales (Money In): cuentan como dinero recibido. Sin el SQL nuevo viene vacío.
    supabase.from("other_income").select("income_date, amount, category, payer").eq("company_id", companyId).order("income_date", { ascending: false }).limit(20000),
  ]);
  const invoices = (inv ?? []) as SalesDoc[];
  const manual = (other ?? []).map((o) => ({ kind: "payment", amount: Number(o.amount), paid_on: o.income_date as string, invoice_id: null, mode: null, manual: (o.payer as string | null) || (o.category as string) || "Money In" }));
  // Pagos de facturas + entradas manuales, del más reciente al más viejo
  const payments = [...(pays ?? []).filter((p) => p.kind === "payment").map((p) => ({ ...p, manual: null as string | null })), ...manual]
    .sort((a, b) => String(b.paid_on).localeCompare(String(a.paid_on)));
  const subscriptions = (subs ?? []) as Subscription[];
  const t = today();

  // Fotos mensuales del MRR y suscripciones activas (24 meses)
  const mrr: { date: string; amount: number }[] = []; const active: { date: string; amount: number }[] = [];
  const now = new Date();
  for (let i = 23; i >= 0; i--) {
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const e = i === 0 ? t : ymd(end);
    const live = subscriptions.filter((s) => s.start_date <= e && (!s.cancelled_at || s.cancelled_at.slice(0, 10) > e) && s.status !== "paused");
    mrr.push({ date: e, amount: Math.round(live.reduce((a, s) => a + monthly(s), 0) * 100) / 100 });
    active.push({ date: e, amount: live.length });
  }
  const data: DashboardData = {
    ...EMPTY_DATA,
    invoices: invoices.map((d) => ({ date: d.doc_date, amount: Number(d.total) })),
    payments: payments.map((p) => ({ date: p.paid_on, amount: Number(p.amount) })),
    openInvoices: invoices.filter((d) => balanceOf(d) > 0 && d.status !== "written_off").map((d) => ({ due: d.due_date || d.doc_date, balance: balanceOf(d) })),
    mrr, activeSubs: active,
    expenses: (exps ?? []).map((e) => ({ date: e.expense_date as string, amount: Number(e.amount), category: (e.category as string) || "Other" })),
    subEvents: subscriptions.flatMap((s) => [
      { date: s.created_at.slice(0, 10), type: "signup" as const },
      ...(s.start_date <= t ? [{ date: s.start_date, type: "activation" as const }] : []),
      ...(s.cancelled_at ? [{ date: s.cancelled_at.slice(0, 10), type: "cancellation" as const }] : []),
    ]),
  };

  // Resumen para el celular
  const aging = [0, 0, 0, 0, 0]; const agingCount = [0, 0, 0, 0, 0];
  let current = 0, overdue = 0;
  data.openInvoices.forEach((o) => {
    const late = daysBetween(o.due, t);
    const b = late <= 0 ? 0 : late <= 15 ? 1 : late <= 30 ? 2 : late <= 45 ? 3 : 4;
    if (b === 0) current += o.balance; else overdue += o.balance;
    aging[b] += o.balance; agingCount[b] += 1;
  });
  const months: string[] = []; const income: number[] = []; const receipts: number[] = []; const expenses: number[] = [];
  for (let i = 12; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = ymd(d).slice(0, 7);
    months.push(d.toLocaleDateString("en-US", { month: "short" }));
    income.push(data.invoices.filter((x) => x.date.startsWith(key)).reduce((a, x) => a + x.amount, 0));
    receipts.push(data.payments.filter((x) => x.date.startsWith(key)).reduce((a, x) => a + x.amount, 0));
    expenses.push(data.expenses.filter((x) => x.date.startsWith(key)).reduce((a, x) => a + x.amount, 0));
  }
  const yr = String(now.getFullYear());
  const ytdReceived = data.payments.filter((x) => x.date.startsWith(yr)).reduce((a, x) => a + x.amount, 0);
  const ytdExpenses = data.expenses.filter((x) => x.date.startsWith(yr)).reduce((a, x) => a + x.amount, 0);
  const ytdInvoiced = data.invoices.filter((x) => x.date.startsWith(yr)).reduce((a, x) => a + x.amount, 0);
  const since = ymd(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()));
  const receipts12 = data.payments.filter((x) => x.date >= since).reduce((a, x) => a + x.amount, 0);
  // Para el % de cobro solo cuentan los pagos de facturas (no las entradas manuales)
  const invoiceReceipts12 = payments.filter((p) => !p.manual && String(p.paid_on) >= since).reduce((a, p) => a + Number(p.amount), 0);
  const income12 = data.invoices.filter((x) => x.date >= since).reduce((a, x) => a + x.amount, 0);
  const mrrNow = mrr[mrr.length - 1]?.amount ?? 0; const activeNow = active[active.length - 1]?.amount ?? 0;
  const yr12 = since;
  const catMap = new Map<string, number>();
  data.expenses.filter((x) => x.date >= yr12).forEach((x) => catMap.set(x.category ?? "Other", (catMap.get(x.category ?? "Other") ?? 0) + x.amount));
  const expenseByCat = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]);
  const q = (qts ?? []) as { status: string; total: number; expiry_date: string | null }[];
  const openQ = q.filter((x) => ["sent", "viewed"].includes(x.status) && (!x.expiry_date || x.expiry_date >= t));
  const quoteStats = {
    sent: q.filter((x) => x.status !== "draft").length, accepted: q.filter((x) => ["accepted", "invoiced"].includes(x.status)).length,
    declined: q.filter((x) => x.status === "declined").length, open: openQ.length, openValue: openQ.reduce((a, x) => a + Number(x.total), 0),
  };
  return {
    data,
    mobile: {
      agingCount, expenseByCat, quoteStats,
      recentPayments: payments.slice(0, 25).map((p) => {
        const inv = invoices.find((d) => d.id === (p as { invoice_id?: string }).invoice_id);
        if (p.manual) return { date: p.paid_on as string, amount: Number(p.amount), number: "Money In", customer: p.manual, mode: null };
        return { date: p.paid_on as string, amount: Number(p.amount), number: inv?.number ?? "", customer: inv?.customer_name ?? "", mode: (p as { mode?: string | null }).mode ?? null };
      }),
      recentExpenses: (exps ?? []).slice(0, 25).map((e) => ({ date: e.expense_date as string, amount: Number(e.amount), category: (e.category as string) || "Other", vendor: (e.vendor as string | null) ?? null })),
      total: current + overdue, current, overdue, aging, months, income, receipts, expenses, ytdReceived, ytdExpenses, ytdInvoiced, revenue12: receipts12, income12, receipts12, invoiceReceipts12,
      mrr: mrrNow, activeSubs: activeNow, arpu: activeNow ? mrrNow / activeNow : 0,
    },
  };
}
