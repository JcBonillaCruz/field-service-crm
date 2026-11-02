import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageJobs } from "@/lib/jobs";
import { loadCustomerOptions, loadJobBasics } from "@/lib/jobs-server";
import NoAccess from "@/components/customers/NoAccess";
import JobForm from "@/components/jobs/JobForm";
import JobsNeedSql from "@/components/jobs/JobsNeedSql";

export const dynamic = "force-dynamic";

export default async function NewJobPage({ searchParams }: { searchParams: { start?: string; end?: string; tech?: string; unscheduled?: string; customer?: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageJobs(current.role)) return <NoAccess />;
  const [data, customers] = await Promise.all([loadJobBasics(supabase, current.id), loadCustomerOptions(supabase, current.id)]);
  if (data.needsSql) return <JobsNeedSql />;
  return (
    <JobForm companyId={current.id} settings={data.settings} types={data.types} tags={data.tags} team={data.team} templates={data.templates} customers={customers}
      defaults={{ start: searchParams.start, end: searchParams.end, tech: searchParams.tech, unscheduled: searchParams.unscheduled === "1", customer: searchParams.customer }} />
  );
}
