import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageJobs } from "@/lib/jobs";
import JobsNeedSql from "@/components/jobs/JobsNeedSql";
import CancelledJobs, { CancelledJob } from "@/components/jobs/CancelledJobs";

export const dynamic = "force-dynamic";

// Trabajos cancelados (Paso 5.6): quién lo canceló, cuándo y por qué. Nunca se borran; se pueden restaurar.
export default async function CancelledJobsPage() {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageJobs(current.role)) redirect("/dashboard/jobs/mine");
  const { data, error } = await supabase.from("v_jobs")
    .select("id, number, customer_name, customer_phone, title, site_address, type_name, type_color, estimated_total, cancelled_at, cancelled_by_name, cancel_reason, created_at, source")
    .eq("company_id", current.id).not("cancelled_at", "is", null).order("cancelled_at", { ascending: false }).limit(500);
  if (error) return <JobsNeedSql />;
  return <CancelledJobs jobs={(data ?? []) as CancelledJob[]} />;
}
