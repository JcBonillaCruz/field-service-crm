import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/session";
import { canManageSales } from "@/lib/sales";
import { resolveRange, todayIn } from "@/lib/expense-range";
import type { Entry, LedgerKind, PayerOption } from "@/components/expenses/ExpensesWorkspace";

const SRC = {
  expense: { table: "expenses", date: "expense_date", party: "vendor" },
  income: { table: "other_income", date: "income_date", party: "payer" },
} as const;

// Gastos y Entradas de dinero: SIEMPRE en vivo (sin caché) y solo el periodo elegido (gte/lte en la base de datos)
export async function loadLedger(kind: LedgerKind, sp?: { range?: string; from?: string; to?: string }) {
  const { supabase, current, user } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageSales(current.role)) return { denied: true as const };
  const s = SRC[kind];
  const range = resolveRange(sp?.range, todayIn(headers().get("x-vercel-ip-timezone")), sp?.from, sp?.to);
  const base = `id, company_id, ${s.date}, category, ${s.party}, amount, payment_mode, reference, notes, receipt_path, receipt_name, created_by_name, created_at`;
  const query = (cols: string) => supabase.from(s.table).select(cols).eq("company_id", current.id)
    .gte(s.date, range.from).lte(s.date, range.to)
    .order(s.date, { ascending: false }).order("created_at", { ascending: false }).limit(5000);
  // Money In puede ir ligado a un cliente (columna customer_id del SQL nuevo). Si aún no se corrió, sigue funcionando igual.
  let res = await query(kind === "income" ? `${base}, customer_id` : base);
  let linkReady = kind === "income" && !res.error;
  if (res.error && kind === "income") { res = await query(base); linkReady = false; }
  const { data, error } = res;
  const rows: Entry[] = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    ...(r as unknown as Entry), date: r[s.date] as string, party: (r[s.party] as string | null) ?? null, customer_id: (r.customer_id as string | null | undefined) ?? null,
  }));
  // Clientes para el buscador de "Received from" (la MISMA base de datos de Customers)
  let customers: PayerOption[] = [];
  if (kind === "income") {
    const { data: cs } = await supabase.from("customers").select("id, display_name, company_name, email, phone").eq("company_id", current.id).order("display_name").limit(5000);
    customers = (cs ?? []) as PayerOption[];
  }
  return { denied: false as const, companyId: current.id, actor: user.fullName || user.email, rows, needsSql: Boolean(error), range, customers, linkReady };
}
