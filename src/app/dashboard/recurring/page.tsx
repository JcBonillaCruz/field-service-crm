import { redirect } from "next/navigation";
import NoAccess from "@/components/customers/NoAccess";
import RecurringWorkspace from "@/components/finances/RecurringWorkspace";
import { canManageSales } from "@/lib/sales";
import type { Recurring } from "@/lib/financing";
import { financeContext } from "@/lib/payroll-server";

export const dynamic = "force-dynamic";

// Finances → Recurring expenses (Paso 5.10d): gastos que se repiten. Los mismos roles que Expenses.
export default async function RecurringPage() {
  const { supabase, current, user, today } = await financeContext();
  if (!current) redirect("/dashboard");
  if (!canManageSales(current.role)) return <NoAccess />;
  // Primero se crean los que ya tocan, luego se lista
  await supabase.rpc("recurring_expenses_run", { p_company: current.id, p_today: today }).then(() => null, () => null);
  const { data, error } = await supabase.from("recurring_expenses").select("*").eq("company_id", current.id).order("is_active", { ascending: false }).order("next_date").limit(500);
  return <RecurringWorkspace companyId={current.id} actor={user.fullName || user.email || ""} today={today} rows={(data ?? []) as Recurring[]} needsSql={Boolean(error)} />;
}
