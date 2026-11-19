import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageJobs } from "@/lib/jobs";
import { loadPlans } from "@/lib/maintenance";
import NoAccess from "@/components/customers/NoAccess";
import PlansWorkspace from "@/components/jobs/plans/PlansWorkspace";

export const dynamic = "force-dynamic";

// Jobs → Maintenance plans (Paso 5.11): dueño, manager y oficina
export default async function PlansPage() {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageJobs(current.role)) return <NoAccess />;
  // Primero se crean las visitas que ya tocan (próximos 60 días), luego se lista
  await supabase.rpc("maintenance_generate", { p_company: current.id }).then(() => null, () => null);
  const { plans, needsSql } = await loadPlans(supabase, current.id);
  return <PlansWorkspace plans={plans} needsSql={needsSql} />;
}
