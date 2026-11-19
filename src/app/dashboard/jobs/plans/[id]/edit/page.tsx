import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageJobs } from "@/lib/jobs";
import { loadCustomerOptions, loadJobBasics } from "@/lib/jobs-server";
import { loadPlans } from "@/lib/maintenance";
import NoAccess from "@/components/customers/NoAccess";
import JobsNeedSql from "@/components/jobs/JobsNeedSql";
import PlanForm from "@/components/jobs/plans/PlanForm";

export const dynamic = "force-dynamic";

export default async function EditPlanPage({ params }: { params: { id: string } }) {
  const { supabase, current, user } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageJobs(current.role)) return <NoAccess />;
  const [data, customers, { plans }] = await Promise.all([loadJobBasics(supabase, current.id), loadCustomerOptions(supabase, current.id), loadPlans(supabase, current.id)]);
  if (data.needsSql) return <JobsNeedSql />;
  const plan = plans.find((p) => p.id === params.id);
  if (!plan) notFound();
  return <PlanForm companyId={current.id} actor={user.fullName || user.email || ""} settings={data.settings} types={data.types} team={data.team} customers={customers} initial={plan} />;
}
