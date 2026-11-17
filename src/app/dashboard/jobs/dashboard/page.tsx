import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageJobs } from "@/lib/jobs";
import { loadJobBasics } from "@/lib/jobs-server";
import { loadHomeAlerts } from "@/lib/home-dashboard";
import JobsNeedSql from "@/components/jobs/JobsNeedSql";
import JobsDashboard from "@/components/home/JobsDashboard";
import JobsDashHeader from "@/components/home/JobsDashHeader";

export const dynamic = "force-dynamic";

// Dashboard propio de la app Jobs (Paso 5.3f): distinto al inicio — solo trabajos y equipo (sin inventario ni finanzas)
export default async function JobsDashboardPage() {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageJobs(current.role)) redirect("/dashboard/jobs/mine");
  const [basics, alerts] = await Promise.all([
    loadJobBasics(supabase, current.id),
    loadHomeAlerts(supabase, current.id, { finances: false, inventory: false }).catch(() => []),
  ]);
  if (basics.needsSql) return <JobsNeedSql />;
  return (
    <div className="min-h-full bg-[#f4f6f8]">
      <JobsDashboard variant="jobs" companyId={current.id} team={basics.team} weekStartsOn={basics.settings.week_starts_on}
        canSeePrice={current.role === "owner" || current.role === "manager"} canDelete={current.role === "owner" || current.role === "manager"} revenue={null} alerts={alerts} header={<JobsDashHeader />} />
    </div>
  );
}
