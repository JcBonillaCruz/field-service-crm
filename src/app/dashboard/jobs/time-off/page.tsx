import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { addDays, canManageJobs, dayStart } from "@/lib/jobs";
import { loadJobBasics } from "@/lib/jobs-server";
import { OFF_SELECT, TimeOff } from "@/lib/time-off";
import NoAccess from "@/components/customers/NoAccess";
import TimeOffList from "@/components/jobs/time-off/TimeOffList";

export const dynamic = "force-dynamic";

// Paso 6.13b · Jobs → Time off: quién está fuera hoy, lo que viene y lo que pasó (90 días)
export default async function TimeOffPage({ searchParams }: { searchParams: { saved?: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageJobs(current.role)) return <NoAccess />;
  const [basics, off] = await Promise.all([
    loadJobBasics(supabase, current.id),
    supabase.from("team_time_off").select(OFF_SELECT).eq("company_id", current.id).gt("ends_at", addDays(dayStart(new Date()), -90).toISOString()).order("starts_at").limit(3000),
  ]);
  return <TimeOffList team={basics.team} rows={(off.data ?? []) as TimeOff[]} needsSql={Boolean(off.error)} saved={searchParams.saved ?? ""} />;
}
