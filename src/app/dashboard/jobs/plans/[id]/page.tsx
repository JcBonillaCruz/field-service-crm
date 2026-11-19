import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageJobs } from "@/lib/jobs";
import { PlanJob, loadPlans } from "@/lib/maintenance";
import NoAccess from "@/components/customers/NoAccess";
import PlanDetail from "@/components/jobs/plans/PlanDetail";

export const dynamic = "force-dynamic";

// Ficha de un plan: resumen, botones y todas sus visitas
export default async function PlanPage({ params, searchParams }: { params: { id: string }; searchParams: { saved?: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageJobs(current.role)) return <NoAccess />;
  await supabase.rpc("maintenance_generate", { p_company: current.id, p_plan: params.id }).then(() => null, () => null);
  const [{ plans }, jobs, team] = await Promise.all([
    loadPlans(supabase, current.id),
    supabase.rpc("maintenance_plan_jobs", { p_plan: params.id }),
    supabase.rpc("job_team", { p_company: current.id }),
  ]);
  const plan = plans.find((p) => p.id === params.id);
  if (!plan) notFound();
  const names: Record<string, string> = {};
  ((team.data ?? []) as { user_id: string; full_name: string }[]).forEach((m) => { names[m.user_id] = m.full_name; });
  return <PlanDetail plan={plan} jobs={(jobs.error ? [] : jobs.data ?? []) as PlanJob[]} techNames={plan.tech_ids.map((id) => names[id]).filter(Boolean)} justSaved={searchParams.saved === "1"} />;
}
