import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { loadJobBasics } from "@/lib/jobs-server";
import NoAccess from "@/components/customers/NoAccess";
import JobSettingsForm from "@/components/jobs/JobSettingsForm";
import JobsNeedSql from "@/components/jobs/JobsNeedSql";

export const dynamic = "force-dynamic";

export default async function JobSettingsPage() {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (current.role !== "owner" && current.role !== "manager") return <NoAccess />;
  const data = await loadJobBasics(supabase, current.id);
  if (data.needsSql) return <JobsNeedSql />;
  return <JobSettingsForm companyId={current.id} settings={data.settings} types={data.types} tags={data.tags} team={data.team} templates={data.templates} />;
}
