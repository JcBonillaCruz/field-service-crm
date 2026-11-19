import { redirect } from "next/navigation";
import NoAccess from "@/components/customers/NoAccess";
import FinancingWorkspace from "@/components/finances/FinancingWorkspace";
import { Financed, financingError, needsFinancingSql } from "@/lib/financing";
import { canSeeCompanyMoney, financeContext } from "@/lib/payroll-server";

export const dynamic = "force-dynamic";

// Finances → Financing (Paso 5.10d): compras a pagos (troca, herramientas, material). Dueño y manager.
export default async function FinancingPage() {
  const { supabase, current, today } = await financeContext();
  if (!current) redirect("/dashboard");
  if (!canSeeCompanyMoney(current.role)) return <NoAccess />;
  const { data, error } = await supabase.rpc("financing_list", { p_company: current.id });
  return <FinancingWorkspace companyId={current.id} today={today} list={(error ? [] : data ?? []) as Financed[]} needsSql={needsFinancingSql(error)} error={error && !needsFinancingSql(error) ? financingError(error) : ""} />;
}
