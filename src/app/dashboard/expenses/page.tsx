import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/session";
import { canManageSales } from "@/lib/sales";
import { resolveRange, todayIn } from "@/lib/expense-range";
import NoAccess from "@/components/customers/NoAccess";
import ExpensesWorkspace, { Expense } from "@/components/expenses/ExpensesWorkspace";

const COLS = "id, company_id, expense_date, category, vendor, amount, payment_mode, reference, notes, receipt_path, receipt_name, created_by_name, created_at";

// Gastos: SIEMPRE en vivo (sin caché) y solo el rango elegido (gte/lte en la base de datos),
// así la pantalla sigue rápida aunque haya miles de gastos.
export default async function ExpensesPage({ searchParams }: { searchParams?: { range?: string; from?: string; to?: string } }) {
  const { supabase, current, user } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageSales(current.role)) return <NoAccess />;
  const today = todayIn(headers().get("x-vercel-ip-timezone"));
  const r = resolveRange(searchParams?.range, today, searchParams?.from, searchParams?.to);
  const { data, error } = await supabase.from("expenses").select(COLS).eq("company_id", current.id)
    .gte("expense_date", r.from).lte("expense_date", r.to)
    .order("expense_date", { ascending: false }).order("created_at", { ascending: false }).limit(5000);
  return <ExpensesWorkspace companyId={current.id} actor={user.fullName || user.email} rows={(data ?? []) as Expense[]} needsSql={Boolean(error)} range={r} />;
}
