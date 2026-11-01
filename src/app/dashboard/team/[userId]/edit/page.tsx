import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Member, canManageTeam } from "@/lib/team";
import NoAccess from "@/components/customers/NoAccess";
import MemberForm from "@/components/team/MemberForm";

export const dynamic = "force-dynamic";

export default async function EditMemberPage({ params }: { params: { userId: string } }) {
  const { supabase, current, user } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageTeam(current.role)) return <NoAccess />;
  const { data } = await supabase.rpc("team_members", { p_company: current.id });
  const member = ((data ?? []) as Member[]).find((m) => m.user_id === params.userId);
  if (!member) notFound();
  return <MemberForm companyId={current.id} member={member} myRole={current.role} isMe={member.user_id === user.id} />;
}
