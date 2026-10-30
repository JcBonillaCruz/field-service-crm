import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/session";
import { canManageSales } from "@/lib/sales";
import { resolveRange, todayIn } from "@/lib/expense-range";
import type { Entry, LedgerKind, PayerOption } from "@/components/expenses/ExpensesWorkspace";
import { Profit, loadProfit } from "@/lib/job-costing";

const SRC = {
  expense: { table: "expenses", date: "expense_date", party: "vendor" },
  income: { table: "other_income", date: "income_date", party: "payer" },
} as const;

// Gastos y Entradas de dinero: SIEMPRE en vivo (sin caché) y solo el periodo elegido (gte/lte en la base de datos)
export async function loadLedger(kind: LedgerKind, sp?: { range?: string; from?: string; to?: string; customer?: string }) {
  const { supabase, current, user } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageSales(current.role)) return { denied: true as const };
  const s = SRC[kind];
  const range = resolveRange(sp?.range, todayIn(headers().get("x-vercel-ip-timezone")), sp?.from, sp?.to);
  const base = `id, company_id, ${s.date}, category, ${s.party}, amount, payment_mode, reference, notes, receipt_path, receipt_name, created_by_name, created_at`;
  // Columnas de "a qué cliente / trabajo pertenece" (SQL nuevo). Si aún no se corrió, todo sigue funcionando como antes.
  const linkCols = kind === "income" ? "customer_id" : "customer_id, doc_id, cost_type";
  const customerId = sp?.customer && /^[0-9a-f-]{36}$/i.test(sp.customer) ? sp.customer : null;
  const query = (cols: string, byCustomer: boolean) => {
    let q = supabase.from(s.table).select(cols).eq("company_id", current.id).gte(s.date, range.from).lte(s.date, range.to);
    if (byCustomer && customerId) q = q.eq("customer_id", customerId);
    return q.order(s.date, { ascending: false }).order("created_at", { ascending: false }).limit(5000);
  };
  let res = await query(`${base}, ${linkCols}`, true);
  let linkReady = !res.error;
  if (res.error) { res = await query(base, false); linkReady = false; }
  const { data, error } = res;
  const rows: Entry[] = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    ...(r as unknown as Entry), date: r[s.date] as string, party: (r[s.party] as string | null) ?? null,
    customer_id: (r.customer_id as string | null | undefined) ?? null, doc_id: (r.doc_id as string | null | undefined) ?? null, cost_type: (r.cost_type as string | null | undefined) ?? null,
  }));
  // Clientes (la MISMA base de datos de Customers): buscador del formulario y filtro de la lista
  const { data: cs } = await supabase.from("customers").select("id, display_name, company_name, email, phone").eq("company_id", current.id).order("display_name").limit(5000);
  const customers = (cs ?? []) as PayerOption[];
  // Filtrado por un cliente: resumen de rentabilidad de ese cliente en el mismo periodo
  const filterCustomer = customerId && linkReady ? customers.find((c) => c.id === customerId) ?? null : null;
  const profit: Profit | null = filterCustomer ? await loadProfit(supabase, current.id, filterCustomer.id, range) : null;
  return { denied: false as const, companyId: current.id, actor: user.fullName || user.email, rows, needsSql: Boolean(error), range, customers, linkReady, filterCustomer, profit };
}
