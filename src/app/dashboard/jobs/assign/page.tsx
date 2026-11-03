import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageJobs } from "@/lib/jobs";
import { loadJobBasics } from "@/lib/jobs-server";
import NoAccess from "@/components/customers/NoAccess";
import JobsNeedSql from "@/components/jobs/JobsNeedSql";
import AssignBoard, { AssignTech } from "@/components/jobs/AssignBoard";

export const dynamic = "force-dynamic";

export default async function AssignJobsPage() {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageJobs(current.role)) return <NoAccess />;
  const [data, members] = await Promise.all([loadJobBasics(supabase, current.id), supabase.rpc("team_members", { p_company: current.id })]);
  if (data.needsSql) return <JobsNeedSql />;
  type M = { user_id: string; email: string | null; phone: string | null; job_title: string | null; is_active: boolean; role: string };
  const extra = new Map(((members.data ?? []) as M[]).map((m) => [m.user_id, m]));
  const techs: AssignTech[] = data.team.filter((t) => t.role === "technician").map((t) => ({
    user_id: t.user_id, full_name: t.full_name, initials: t.initials, color: t.color, avatar_url: t.avatar_url,
    email: extra.get(t.user_id)?.email ?? null, phone: extra.get(t.user_id)?.phone ?? null, job_title: extra.get(t.user_id)?.job_title ?? null,
  }));
  return <AssignBoard companyId={current.id} techs={techs} weekStartsOn={data.settings.week_starts_on} />;
}
