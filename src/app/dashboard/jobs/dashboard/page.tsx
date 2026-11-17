import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageJobs } from "@/lib/jobs";
import { loadJobBasics } from "@/lib/jobs-server";
import { loadDashboard } from "@/lib/dashboard-server";
import { buildRevenue, loadHomeAlerts } from "@/lib/home-dashboard";
import JobsNeedSql from "@/components/jobs/JobsNeedSql";
import JobsDashboard from "@/components/home/JobsDashboard";
import JobsDashHeader from "@/components/home/JobsDashHeader";

export const dynamic = "force-dynamic";

// Dashboard dentro de la app Jobs (Paso 5.3f): el mismo tablero del inicio, solo con avisos de trabajos.
export default async function JobsDashboardPage() {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageJobs(current.role)) redirect("/dashboard/jobs/mine");
  const owner = current.role === "owner";
  const [basics, alerts, dash] = await Promise.all([
    loadJobBasics(supabase, current.id),
    loadHomeAlerts(supabase, current.id, { finances: false, inventory: false }).catch(() => []),
    owner ? loadDashboard(supabase, current.id).catch(() => null) : Promise.resolve(null),
  ]);
  if (basics.needsSql) return <JobsNeedSql />;
  return (
    <div className="min-h-full bg-[#f4f6f8]">
      <JobsDashboard companyId={current.id} team={basics.team} weekStartsOn={basics.settings.week_starts_on}
        canSeePrice={owner || current.role === "manager"} revenue={owner && dash ? buildRevenue(dash.data, basics.settings.week_starts_on) : null}
        alerts={alerts} header={<JobsDashHeader />} />
    </div>
  );
}
