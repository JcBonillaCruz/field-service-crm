import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import TechJob from "@/components/jobs/tech/TechJob";

export const dynamic = "force-dynamic";

export default async function TechJobPage({ params }: { params: { id: string } }) {
  const { current, user } = await getSession();
  if (!current) redirect("/dashboard");
  return <TechJob jobId={params.id} companyId={current.id} userId={user.id} />;
}
