import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import MyTimesheet from "@/components/jobs/time/MyTimesheet";

export const dynamic = "force-dynamic";

// Mi hoja de tiempos (Paso 5.7): el técnico y cualquiera que reciba trabajos ve sus propias horas
export default async function MyTimesheetPage() {
  const { supabase, current, user } = await getSession();
  if (!current) redirect("/dashboard");
  const { data } = await supabase.from("job_settings").select("week_starts_on").eq("company_id", current.id).maybeSingle();
  return <MyTimesheet companyId={current.id} userId={user.id} weekStartsOn={Number(data?.week_starts_on ?? 0)} />;
}
