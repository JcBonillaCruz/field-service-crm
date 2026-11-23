import { redirect } from "next/navigation";
import NoAccess from "@/components/customers/NoAccess";
import CompanyReportView from "@/components/finances/CompanyReportView";
import { REPORT_PERIODS, finRange, pickPeriod } from "@/lib/finance-period";
import { canSeeCompanyMoney, financeContext } from "@/lib/payroll-server";
import { loadCompanyReport } from "@/lib/company-report-server";
import { loadMarketingRaw } from "@/lib/marketing-roi-server";

export const dynamic = "force-dynamic";

// Finances → Reports (Paso 5.10c): el reporte de toda la compañía, semanal, mensual, trimestral o anual. Dueño y manager.
// El periodo va en la dirección: ?p=week|month|quarter|year & d=un día dentro del periodo.
export default async function CompanyReportPage({ searchParams }: { searchParams?: { p?: string; d?: string } }) {
  const { supabase, current, user, tz, weekStartsOn, today } = await financeContext();
  if (!current) redirect("/dashboard");
  if (!canSeeCompanyMoney(current.role)) return <NoAccess />;
  const range = finRange(pickPeriod(searchParams?.p, REPORT_PERIODS, "month"), searchParams?.d ?? today, weekStartsOn, today);
  const [r, marketing] = await Promise.all([
    loadCompanyReport(supabase, current.id, range, tz, weekStartsOn, today),
    loadMarketingRaw(supabase, current.id, range.from, range.to, tz).catch(() => null), // Paso 6.16-M
  ]);
  return <CompanyReportView range={range} today={today} report={r.report} extras={r.extras} buckets={r.buckets}
    needsExpensesSql={r.needsExpensesSql} needsPayrollSql={r.needsPayrollSql} companyName={current.name} preparedBy={user.fullName || user.email || ""} marketing={marketing} />;
}
