import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageJobs } from "@/lib/jobs";

// Jobs: la oficina entra al Centro de Operaciones; el técnico a sus trabajos
export default async function JobsIndexPage() {
  const { current } = await getSession();
  if (!current) redirect("/dashboard");
  redirect(canManageJobs(current.role) ? "/dashboard/jobs/operations" : "/dashboard/jobs/mine");
}
