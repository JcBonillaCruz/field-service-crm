import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageJobs } from "@/lib/jobs";
import { loadJobBasics } from "@/lib/jobs-server";
import NoAccess from "@/components/customers/NoAccess";
import ScheduleBoard from "@/components/jobs/ScheduleBoard";
import JobsNeedSql from "@/components/jobs/JobsNeedSql";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageJobs(current.role)) return <NoAccess />;
  const data = await loadJobBasics(supabase, current.id);
  if (data.needsSql) return <JobsNeedSql />;
  return <ScheduleBoard companyId={current.id} settings={data.settings} types={data.types} team={data.team} canSeeMoney />;
}
