import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageJobs } from "@/lib/jobs";

// Jobs: la oficina entra al calendario; el técnico a sus trabajos
export default async function JobsIndexPage() {
  const { current } = await getSession();
  if (!current) redirect("/dashboard");
  redirect(canManageJobs(current.role) ? "/dashboard/jobs/schedule" : "/dashboard/jobs/mine");
}
