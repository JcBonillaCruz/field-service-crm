import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import MyJobs from "@/components/jobs/tech/MyJobs";

export const dynamic = "force-dynamic";

// Técnico (y cualquiera que tenga trabajos asignados): sus trabajos del día
export default async function MyJobsPage() {
  const { current, user } = await getSession();
  if (!current) redirect("/dashboard");
  return <MyJobs companyId={current.id} userId={user.id} />;
}
