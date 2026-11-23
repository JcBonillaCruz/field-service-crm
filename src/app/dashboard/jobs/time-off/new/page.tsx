import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { addDays, canManageJobs, dayStart } from "@/lib/jobs";
import { loadJobBasics } from "@/lib/jobs-server";
import { OFF_SELECT, TimeOff } from "@/lib/time-off";
import NoAccess from "@/components/customers/NoAccess";
import TimeOffEditor from "@/components/jobs/time-off/TimeOffEditor";

export const dynamic = "force-dynamic";

// Paso 6.13b · Asignar día libre / permiso / vacaciones (?tech=<id> llega con la persona marcada)
export default async function NewTimeOffPage({ searchParams }: { searchParams: { tech?: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageJobs(current.role)) return <NoAccess />;
  const [basics, off] = await Promise.all([
    loadJobBasics(supabase, current.id),
    supabase.from("team_time_off").select(OFF_SELECT).eq("company_id", current.id).gt("ends_at", addDays(dayStart(new Date()), -1).toISOString()).limit(1000),
  ]);
  return <TimeOffEditor companyId={current.id} team={basics.team} offs={(off.data ?? []) as TimeOff[]} editOff={null} ready={!off.error} techId={searchParams.tech} />;
}
