import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { addDays, canManageJobs, dayStart } from "@/lib/jobs";
import { loadJobBasics } from "@/lib/jobs-server";
import { OFF_SELECT, TimeOff } from "@/lib/time-off";
import NoAccess from "@/components/customers/NoAccess";
import TimeOffEditor from "@/components/jobs/time-off/TimeOffEditor";

export const dynamic = "force-dynamic";

export default async function EditTimeOffPage({ params }: { params: { id: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageJobs(current.role)) return <NoAccess />;
  const [basics, one, off] = await Promise.all([
    loadJobBasics(supabase, current.id),
    supabase.from("team_time_off").select(OFF_SELECT).eq("company_id", current.id).eq("id", params.id).maybeSingle(),
    supabase.from("team_time_off").select(OFF_SELECT).eq("company_id", current.id).gt("ends_at", addDays(dayStart(new Date()), -1).toISOString()).limit(1000),
  ]);
  if (!one.data) notFound();
  return <TimeOffEditor companyId={current.id} team={basics.team} offs={(off.data ?? []) as TimeOff[]} editOff={one.data as TimeOff} ready />;
}
