import type { SupabaseClient } from "@supabase/supabase-js";
import { loadLeadSources } from "@/lib/lead-sources";
import { addDaysIso, dayKeyIn, tzMidnight } from "@/lib/finance-period";
import { MARKETING_CATEGORY, MkCustomer, MkPay, MkRaw, MkSpend } from "@/lib/marketing-roi";

// =====================================================================
// Marketing ROI (Paso 6.16-M): carga en vivo lo necesario entre dos días (YYYY-MM-DD) en la zona de la compañía.
// Dueño y manager (lo deciden las páginas que lo llaman). Si algo falla, devuelve listas vacías: nunca rompe la pantalla.
// =====================================================================
type Page = PromiseLike<{ data: unknown[] | null; error: { message?: string } | null }>;
async function fetchAll<T>(page: (from: number, to: number) => Page): Promise<{ rows: T[]; error: boolean }> {
  const rows: T[] = [];
  for (let i = 0; i < 60; i++) {
    const { data, error } = await page(i * 1000, i * 1000 + 999);
    if (error) return { rows, error: true };
    rows.push(...((data ?? []) as T[]));
    if ((data ?? []).length < 1000) break;
  }
  return { rows, error: false };
}
// .in() con muchos ids: por pedazos
async function inChunks<T>(ids: string[], get: (chunk: string[]) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  for (let i = 0; i < uniq.length; i += 200) {
    const { data } = await get(uniq.slice(i, i + 200));
    out.push(...((data ?? []) as T[]));
  }
  return out;
}

export async function loadMarketingRaw(supabase: SupabaseClient, companyId: string, from: string, to: string, tz: string): Promise<MkRaw> {
  const fromIso = tzMidnight(from, tz).toISOString(), toIso = tzMidnight(addDaysIso(to, 1), tz).toISOString();
  const dayOf = dayKeyIn(tz);
  const spendQ = (withSource: boolean) => fetchAll<{ amount: number; expense_date: string; lead_source_id?: string | null }>((a, b) => {
    let q = supabase.from("expenses").select(withSource ? "amount, expense_date, lead_source_id" : "amount, expense_date")
      .eq("company_id", companyId).gte("expense_date", from).lte("expense_date", to);
    q = withSource ? q.or(`category.eq."${MARKETING_CATEGORY}",lead_source_id.not.is.null`) : q.eq("category", MARKETING_CATEGORY);
    return q.order("expense_date").order("id").range(a, b);
  });

  const [src, spendFull, pays, income, custs, untagged] = await Promise.all([
    loadLeadSources(supabase, companyId).catch(() => ({ list: [], needsSql: true })),
    spendQ(true),
    fetchAll<{ amount: number; paid_on: string; invoice_id: string | null }>((a, b) => supabase.from("sales_payments").select("amount, paid_on, invoice_id")
      .eq("company_id", companyId).eq("kind", "payment").gte("paid_on", from).lte("paid_on", to).order("paid_on").order("id").range(a, b)),
    fetchAll<{ amount: number; income_date: string; customer_id: string | null }>((a, b) => supabase.from("other_income").select("amount, income_date, customer_id")
      .eq("company_id", companyId).not("customer_id", "is", null).gte("income_date", from).lte("income_date", to).order("income_date").order("id").range(a, b)),
    fetchAll<{ created_at: string; lead_source_id: string | null }>((a, b) => supabase.from("customers").select("created_at, lead_source_id")
      .eq("company_id", companyId).gte("created_at", fromIso).lt("created_at", toIso).order("created_at").order("id").range(a, b)),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("company_id", companyId).is("lead_source_id", null),
  ]);
  const needsSql = spendFull.error;
  const spendRows = needsSql ? (await spendQ(false)).rows : spendFull.rows;

  // Pagos de facturas → cliente → su fuente. Se quita la parte del pago que es impuesto (no es dinero de la compañía).
  const docs = await inChunks<{ id: string; customer_id: string | null; total: number; tax_amount: number | null }>(
    pays.rows.map((p) => p.invoice_id ?? ""),
    (c) => supabase.from("sales_docs").select("id, customer_id, total, tax_amount").in("id", c));
  const docOf = new Map(docs.map((d) => [d.id, d]));
  const custIds = [...docs.map((d) => d.customer_id ?? ""), ...income.rows.map((r) => r.customer_id ?? "")];
  const people = await inChunks<{ id: string; lead_source_id: string | null }>(custIds,
    (c) => supabase.from("customers").select("id, lead_source_id").in("id", c));
  const sourceOf = new Map(people.map((p) => [p.id, p.lead_source_id]));

  const pay: MkPay[] = [];
  for (const p of pays.rows) {
    const d = p.invoice_id ? docOf.get(p.invoice_id) : undefined;
    const total = Number(d?.total) || 0, tax = Number(d?.tax_amount) || 0;
    const share = total > 0 && tax > 0 ? Math.max(0, 1 - Math.min(1, tax / total)) : 1;
    pay.push({ day: p.paid_on, amount: (Number(p.amount) || 0) * share, source: d?.customer_id ? sourceOf.get(d.customer_id) ?? null : null });
  }
  for (const r of income.rows) pay.push({ day: r.income_date, amount: Number(r.amount) || 0, source: r.customer_id ? sourceOf.get(r.customer_id) ?? null : null });

  const spend: MkSpend[] = spendRows.map((s) => ({ day: s.expense_date, amount: Number(s.amount) || 0, source: s.lead_source_id ?? null }));
  const customers: MkCustomer[] = custs.rows.map((c) => ({ day: dayOf(new Date(c.created_at)), source: c.lead_source_id ?? null }));
  return { from, to, sources: src.list, spend, pays: pay, customers, needsSql, untaggedCustomers: untagged.count ?? 0 };
}
