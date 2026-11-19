import { redirect } from "next/navigation";
import NoAccess from "@/components/customers/NoAccess";
import FinancingWorkspace from "@/components/finances/FinancingWorkspace";
import { Financed, financingError, needsFinancingSql } from "@/lib/financing";
import { loadAutoFlags, runFinancingAuto } from "@/lib/financing-server";
import { canSeeCompanyMoney, financeContext } from "@/lib/payroll-server";

export const dynamic = "force-dynamic";

// Finances → Financing (Paso 5.10d): compras a pagos (troca, herramientas, material). Dueño y manager.
export default async function FinancingPage() {
  const { supabase, current, today } = await financeContext();
  if (!current) redirect("/dashboard");
  if (!canSeeCompanyMoney(current.role)) return <NoAccess />;
  // Paso 5.12: primero entran solas las cuotas que ya tocan, luego se lista
  await runFinancingAuto(supabase, current.id, today);
  const [{ data, error }, auto] = await Promise.all([supabase.rpc("financing_list", { p_company: current.id }), loadAutoFlags(supabase, current.id)]);
  return <FinancingWorkspace companyId={current.id} today={today} auto={auto} list={(error ? [] : data ?? []) as Financed[]} needsSql={needsFinancingSql(error)} error={error && !needsFinancingSql(error) ? financingError(error) : ""} />;
}
