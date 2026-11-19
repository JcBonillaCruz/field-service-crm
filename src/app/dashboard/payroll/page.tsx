import { redirect } from "next/navigation";
import NoAccess from "@/components/customers/NoAccess";
import PayrollWorkspace from "@/components/finances/PayrollWorkspace";
import { PAYROLL_PERIODS, finRange, pickPeriod } from "@/lib/finance-period";
import { canSeeCompanyMoney, financeContext, loadPayroll } from "@/lib/payroll-server";

export const dynamic = "force-dynamic";

// Finances → Payroll (Paso 5.10c): lo que ganó cada persona en el periodo y lo que ya se le pagó. Dueño y manager.
// El periodo va en la dirección: ?p=week|2weeks|month & d=un día dentro del periodo.
export default async function PayrollPage({ searchParams }: { searchParams?: { p?: string; d?: string } }) {
  const { supabase, current, user, tz, weekStartsOn, today } = await financeContext();
  if (!current) redirect("/dashboard");
  if (!canSeeCompanyMoney(current.role)) return <NoAccess />;
  const range = finRange(pickPeriod(searchParams?.p, PAYROLL_PERIODS, "week"), searchParams?.d ?? today, weekStartsOn, today);
  const r = await loadPayroll(supabase, current.id, range, tz, weekStartsOn);
  return <PayrollWorkspace companyId={current.id} isOwner={current.role === "owner"} range={range} today={today} payroll={r.payroll} needsSql={r.needsSql} error={r.error} timeReady={r.timeReady} companyName={current.name} preparedBy={user.fullName || user.email || ""} />;
}
