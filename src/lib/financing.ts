import { addDaysIso, daysBetweenIso, money, r2 } from "@/lib/finance-period";
import type { Notice } from "@/lib/notifications";

// =====================================================================
// Compras a pagos (Financing) y gastos que se repiten (Recurring expenses) · Paso 5.10d
// Financing: troca, herramientas o material que se paga en cuotas. Cada pago registrado entra solo a Expenses.
//   pagado = enganche + cuotas pagadas antes de anotarla aquí + pagos registrados   ·   se debe = total − pagado
// Las cuentas (pagado, se debe, cuotas que faltan, próxima fecha) las entrega financing_list() ya hechas.
// =====================================================================
export type FinPayment = {
  id: string; kind: "down" | "installment"; amount: number; paid_on: string; payment_mode: string | null; reference: string | null; notes: string | null;
  expense_id: string | null; created_by_name: string | null;
};
export type Financed = {
  id: string; name: string; vendor: string | null; category: string; purchased_on: string | null; total: number; down_payment: number; opening_paid: number;
  monthly_payment: number; first_due: string; notes: string | null; created_by_name: string | null; created_at: string;
  tracked: number; paid: number; owed: number; installments_total: number; installments_left: number; next_due: string | null; payments: FinPayment[];
};
const n = (v: unknown) => Number(v) || 0;
export const SOON_DAYS = 3; // la campana avisa desde 3 días antes de cada cuota

export type DueTone = "done" | "overdue" | "today" | "soon" | "ok";
export function dueOf(f: Pick<Financed, "next_due" | "owed">, today: string): { tone: DueTone; days: number | null; label: string } {
  if (n(f.owed) <= 0.004 || !f.next_due) return { tone: "done", days: null, label: "Paid off" };
  const days = daysBetweenIso(today, f.next_due);
  if (days < 0) return { tone: "overdue", days, label: `Past due by ${-days} day${days === -1 ? "" : "s"}` };
  if (days === 0) return { tone: "today", days, label: "Due today" };
  if (days <= SOON_DAYS) return { tone: "soon", days, label: `Due in ${days} day${days === 1 ? "" : "s"}` };
  return { tone: "ok", days, label: `Due in ${days} days` };
}
// Lo que toca pagar en la próxima cuota (la última puede ser menor)
export const nextAmount = (f: Pick<Financed, "owed" | "monthly_payment">) => r2(Math.min(n(f.owed), n(f.monthly_payment)));
export const progressOf = (f: Pick<Financed, "paid" | "total">) => (n(f.total) > 0 ? Math.max(0, Math.min(100, (n(f.paid) / n(f.total)) * 100)) : 0);
export const dayLong = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const ordinal = (d: number) => `${d}${d % 10 === 1 && d !== 11 ? "st" : d % 10 === 2 && d !== 12 ? "nd" : d % 10 === 3 && d !== 13 ? "rd" : "th"}`;
export const payDayText = (firstDue: string) => `the ${ordinal(Number(firstDue.slice(8, 10)))} of each month`;

export type FinTotals = { count: number; open: number; total: number; paid: number; owed: number; monthly: number; overdue: number; dueSoon: number };
export function financingTotals(list: Financed[], today: string): FinTotals {
  const open = list.filter((f) => n(f.owed) > 0.004);
  return {
    count: list.length, open: open.length, total: r2(list.reduce((a, f) => a + n(f.total), 0)), paid: r2(list.reduce((a, f) => a + n(f.paid), 0)),
    owed: r2(open.reduce((a, f) => a + n(f.owed), 0)), monthly: r2(open.reduce((a, f) => a + nextAmount(f), 0)),
    overdue: open.filter((f) => dueOf(f, today).tone === "overdue").length, dueSoon: open.filter((f) => ["today", "soon"].includes(dueOf(f, today).tone)).length,
  };
}

// Campana: cuota que vence en 3 días o menos, hoy, o ya vencida. La clave lleva el día: si sigue sin pagarse, mañana vuelve a avisar.
export function financingNotices(rows: Financed[], reads: string[], today: string): Notice[] {
  const read = new Set(reads);
  const out: Notice[] = [];
  for (const f of rows) {
    const d = dueOf(f, today);
    if (d.tone === "done" || d.tone === "ok" || !f.next_due) continue;
    const id = `fin-${f.id}`;
    out.push({
      id, key: `${id}-${today}`, kind: d.tone === "overdue" ? "overdue" : d.tone === "today" ? "due_today" : "due_soon",
      title: d.tone === "overdue" ? `Payment past due: ${f.name}` : d.tone === "today" ? `Payment due today: ${f.name}` : `Payment due in ${d.days} day${d.days === 1 ? "" : "s"}: ${f.name}`,
      body: `${money(nextAmount(f))}${f.vendor ? ` to ${f.vendor}` : ""} · ${money(f.owed)} still owed`, href: "/dashboard/financing", when: f.next_due,
    });
  }
  return out.filter((x) => !read.has(x.key));
}

export const needsFinancingSql = (e: { message?: string; code?: string } | null | undefined) =>
  Boolean(e && (e.code === "PGRST202" || e.code === "PGRST205" || e.code === "42883" || e.code === "42P01" || /does not exist|Could not find/.test(e.message ?? "")));
export function financingError(e: { message?: string; code?: string; hint?: string } | null | undefined): string {
  if (!e) return "";
  if (needsFinancingSql(e)) return "Run paso-5.10d-financing.sql in Supabase first.";
  if (e.hint) return e.hint;
  if ((e.message ?? "").includes("NO_ACCESS")) return "You don't have permission to do this.";
  return "Something went wrong. Try again.";
}

// ---------- Gastos que se repiten ----------
export type Frequency = "weekly" | "monthly" | "yearly";
export const FREQUENCIES: { value: Frequency; label: string; every: string }[] = [
  { value: "monthly", label: "Every month", every: "month" }, { value: "weekly", label: "Every week", every: "week" }, { value: "yearly", label: "Every year", every: "year" },
];
export type Recurring = {
  id: string; company_id: string; category: string; vendor: string | null; amount: number; payment_mode: string | null; notes: string | null;
  frequency: Frequency; start_date: string; runs: number; next_date: string; end_date: string | null; is_active: boolean; last_run: string | null; created_by_name: string | null;
  lead_source_id?: string | null; // Paso 6.16-M: gastos de Marketing → para qué fuente de clientes
};
// Cuánto pesa al mes (para sumar renta mensual + seguro anual + algo semanal)
export const monthlyOf = (r: Pick<Recurring, "amount" | "frequency">) => r2(n(r.amount) * (r.frequency === "weekly" ? 52 / 12 : r.frequency === "yearly" ? 1 / 12 : 1));
// Cuántos gastos se crearían de una vez si la fecha de inicio ya pasó
export function catchUpCount(start: string, frequency: Frequency, today: string, end?: string | null): number {
  if (!start || start > today) return 0;
  const last = end && end < today ? end : today;
  if (frequency === "weekly") return Math.floor(daysBetweenIso(start, last) / 7) + 1;
  const [y1, m1, d1] = start.split("-").map(Number), [y2, m2, d2] = last.split("-").map(Number);
  const months = (y2 - y1) * 12 + (m2 - m1) - (d2 < Math.min(d1, new Date(Date.UTC(y2, m2, 0)).getUTCDate()) ? 1 : 0);
  return Math.max(0, frequency === "yearly" ? Math.floor(months / 12) : months) + 1;
}
export const tomorrowOf = (today: string) => addDaysIso(today, 1);
