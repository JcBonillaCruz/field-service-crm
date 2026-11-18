import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageJobs } from "@/lib/jobs";
import { loadJobBasics } from "@/lib/jobs-server";
import JobsNeedSql from "@/components/jobs/JobsNeedSql";
import TeamTimesheets from "@/components/jobs/time/TeamTimesheets";

export const dynamic = "force-dynamic";

// Timesheets de la oficina (Paso 5.7): horas de todo el equipo, correcciones y exportar a Excel
export default async function TimesheetsPage() {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageJobs(current.role)) redirect("/dashboard/jobs/my-timesheet");
  const data = await loadJobBasics(supabase, current.id);
  if (data.needsSql) return <JobsNeedSql />;
  return <TeamTimesheets companyId={current.id} team={data.team} weekStartsOn={data.settings.week_starts_on}
    canDelete={current.role === "owner" || current.role === "manager"} />;
}
