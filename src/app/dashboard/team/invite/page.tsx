import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageTeam } from "@/lib/team";
import NoAccess from "@/components/customers/NoAccess";
import InviteForm from "@/components/team/InviteForm";

export const dynamic = "force-dynamic";

export default async function InvitePage({ searchParams }: { searchParams: { role?: string } }) {
  const { current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageTeam(current.role)) return <NoAccess />;
  const role = ["manager", "office", "technician"].includes(searchParams.role ?? "") ? searchParams.role as "manager" | "office" | "technician" : "technician";
  return <InviteForm myRole={current.role} companyName={current.name} initialRole={role} />;
}
