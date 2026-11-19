import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageJobs } from "@/lib/jobs";
import { loadJobBasics } from "@/lib/jobs-server";
import JobsNeedSql from "@/components/jobs/JobsNeedSql";
import JobReports from "@/components/jobs/reports/JobReports";

export const dynamic = "force-dynamic";

// Reports de Jobs (Paso 5.10): rendimiento por colaborador y piezas que no se escanearon.
// Solo oficina, manager y dueño; el técnico vuelve a sus trabajos. ?tab=parts o ?tab=pnl abren directo en esa pestaña.
export default async function JobReportsPage({ searchParams }: { searchParams?: { tab?: string } }) {
  const { supabase, current, user } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageJobs(current.role)) redirect("/dashboard/jobs/mine");
  const data = await loadJobBasics(supabase, current.id);
  if (data.needsSql) return <JobsNeedSql />;
  return <JobReports companyId={current.id} team={data.team} weekStartsOn={data.settings.week_starts_on} initialTab={searchParams?.tab === "parts" ? "parts" : searchParams?.tab === "pnl" ? "pnl" : "team"}
    companyName={current.name} preparedBy={data.team.find((m) => m.user_id === user.id)?.full_name ?? user.email ?? ""} />;
}
