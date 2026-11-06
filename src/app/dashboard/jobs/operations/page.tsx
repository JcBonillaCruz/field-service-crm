import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageJobs } from "@/lib/jobs";
import { loadJobBasics } from "@/lib/jobs-server";
import JobsNeedSql from "@/components/jobs/JobsNeedSql";
import OperationsCenter from "@/components/jobs/ops/OperationsCenter";

export const dynamic = "force-dynamic";

// Centro de Operaciones (Paso 5.3): el corazón de Jobs para el dueño y la oficina
export default async function OperationsPage() {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageJobs(current.role)) redirect("/dashboard/jobs/mine");
  const data = await loadJobBasics(supabase, current.id);
  if (data.needsSql) return <JobsNeedSql />;
  return <OperationsCenter companyId={current.id} team={data.team} weekStartsOn={data.settings.week_starts_on} canDelete={current.role === "owner" || current.role === "manager"} hours={data.settings}
    money={current.role === "owner" ? "owner" : current.role === "manager" ? "manager" : null} />;
}
