import type { SupabaseClient } from "@supabase/supabase-js";

// =====================================================================
// Rentabilidad por Cliente y por Trabajo (Job Costing)
// Cobrado  = pagos de SUS invoices (sales_payments) + Money In ligado a él (other_income.customer_id)
// Gastos   = expenses ligados a él (customer_id), separados en Material / Mano de obra / Otros
// Ganancia = Cobrado − Gastos   ·   Margen = Ganancia ÷ Cobrado
// Cada "trabajo" es un invoice: sus cobros vs. los gastos ligados a ese invoice (doc_id).
// Un mismo cálculo para la lista de gastos (filtrada) y para el perfil del cliente.
// =====================================================================
export type CostType = "material" | "labor" | "other";
export const COST_TYPES: { value: CostType; label: string; short: string; color: string; soft: string; icon: string }[] = [
  { value: "material", label: "Material", short: "Material", color: "#2563eb", soft: "#eef6ff", icon: "M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8" },
  { value: "labor", label: "Labor / Job pay", short: "Labor", color: "#c2410c", soft: "#fff3e8", icon: "M16 11a4 4 0 1 0-8 0M4 21a8 8 0 0 1 16 0M12 7V3M9 4h6" },
  { value: "other", label: "Other", short: "Other", color: "#64748b", soft: "#f1f5f9", icon: "M5 12h.01M12 12h.01M19 12h.01" },
];
export const costTypeOf = (v?: string | null) => COST_TYPES.find((c) => c.value === v) ?? COST_TYPES[2];

export type JobRow = { id: string; number: string; date: string; status: string; total: number; collected: number; material: number; labor: number; other: number; costs: number; profit: number };
export type Profit = {
  ready: boolean;              // false = falta correr paso-job-costing.sql
  collected: number; fromInvoices: number; fromMoneyIn: number;
  material: number; labor: number; other: number; costs: number;
  profit: number; margin: number | null;
  outstanding: number;         // lo que aún le deben (invoices abiertos)
  jobs: JobRow[];              // por invoice (solo los que tienen cobros o gastos)
  unassigned: { material: number; labor: number; other: number; costs: number }; // gastos del cliente sin invoice
};

const n = (v: unknown) => Number(v) || 0;
const r2 = (v: number) => Math.round(v * 100) / 100;

export async function loadProfit(supabase: SupabaseClient, companyId: string, customerId: string, range?: { from: string; to: string }): Promise<Profit> {
  let moneyQ = supabase.from("other_income").select("amount, income_date").eq("company_id", companyId).eq("customer_id", customerId);
  let expQ = supabase.from("expenses").select("amount, cost_type, doc_id, expense_date").eq("company_id", companyId).eq("customer_id", customerId);
  if (range) { moneyQ = moneyQ.gte("income_date", range.from).lte("income_date", range.to); expQ = expQ.gte("expense_date", range.from).lte("expense_date", range.to); }

  const [{ data: docs }, money, exps] = await Promise.all([
    supabase.from("sales_docs").select("id, number, doc_date, status, total, amount_paid, written_off")
      .eq("company_id", companyId).eq("customer_id", customerId).eq("kind", "invoice").neq("status", "void").order("doc_date", { ascending: false }).limit(2000),
    moneyQ.limit(5000),
    expQ.limit(5000),
  ]);
  const invoices = (docs ?? []) as { id: string; number: string; doc_date: string; status: string; total: number; amount_paid: number; written_off: number }[];
  const ids = invoices.map((d) => d.id);

  let pays: { invoice_id: string; amount: number }[] = [];
  if (ids.length) {
    let payQ = supabase.from("sales_payments").select("invoice_id, amount, paid_on").eq("company_id", companyId).eq("kind", "payment").in("invoice_id", ids);
    if (range) payQ = payQ.gte("paid_on", range.from).lte("paid_on", range.to);
    const { data } = await payQ.limit(10000);
    pays = (data ?? []) as typeof pays;
  }
  const ready = !exps.error;
  const expenses = (ready ? exps.data ?? [] : []) as { amount: number; cost_type: string | null; doc_id: string | null }[];

  const paidBy = new Map<string, number>();
  pays.forEach((p) => paidBy.set(p.invoice_id, (paidBy.get(p.invoice_id) ?? 0) + n(p.amount)));
  const fromInvoices = r2(pays.reduce((a, p) => a + n(p.amount), 0));
  const fromMoneyIn = r2((money.error ? [] : money.data ?? []).reduce((a, m) => a + n((m as { amount: number }).amount), 0));

  const sum = { material: 0, labor: 0, other: 0 };
  const perJob = new Map<string, { material: number; labor: number; other: number }>();
  const unassigned = { material: 0, labor: 0, other: 0 };
  expenses.forEach((e) => {
    const t = (["material", "labor"].includes(e.cost_type ?? "") ? e.cost_type : "other") as CostType;
    sum[t] += n(e.amount);
    const bucket = e.doc_id && ids.includes(e.doc_id) ? (perJob.get(e.doc_id) ?? perJob.set(e.doc_id, { material: 0, labor: 0, other: 0 }).get(e.doc_id)!) : unassigned;
    bucket[t] += n(e.amount);
  });

  const collected = r2(fromInvoices + fromMoneyIn);
  const costs = r2(sum.material + sum.labor + sum.other);
  const profit = r2(collected - costs);
  const jobs: JobRow[] = invoices.map((d) => {
    const c = perJob.get(d.id) ?? { material: 0, labor: 0, other: 0 };
    const jc = r2(c.material + c.labor + c.other);
    const col = r2(paidBy.get(d.id) ?? 0);
    return { id: d.id, number: d.number, date: d.doc_date, status: d.status, total: n(d.total), collected: col, material: r2(c.material), labor: r2(c.labor), other: r2(c.other), costs: jc, profit: r2(col - jc) };
  }).filter((j) => j.collected > 0 || j.costs > 0);
  const outstanding = r2(invoices.filter((d) => !["draft", "written_off"].includes(d.status))
    .reduce((a, d) => a + Math.max(0, n(d.total) - n(d.amount_paid) - n(d.written_off)), 0));

  return {
    ready, collected, fromInvoices, fromMoneyIn,
    material: r2(sum.material), labor: r2(sum.labor), other: r2(sum.other), costs, profit,
    margin: collected > 0 ? profit / collected : null,
    outstanding, jobs,
    unassigned: { material: r2(unassigned.material), labor: r2(unassigned.labor), other: r2(unassigned.other), costs: r2(unassigned.material + unassigned.labor + unassigned.other) },
  };
}
