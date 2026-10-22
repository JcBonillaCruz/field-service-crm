import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageSales } from "@/lib/sales";
import NoAccess from "@/components/customers/NoAccess";
import ExpensesWorkspace, { Expense } from "@/components/expenses/ExpensesWorkspace";

export default async function ExpensesPage() {
  const { supabase, current, user } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageSales(current.role)) return <NoAccess />;
  const { data, error } = await supabase.from("expenses").select("*").eq("company_id", current.id).order("expense_date", { ascending: false }).limit(5000);
  return <ExpensesWorkspace companyId={current.id} actor={user.fullName || user.email} rows={(data ?? []) as Expense[]} needsSql={Boolean(error)} />;
}
