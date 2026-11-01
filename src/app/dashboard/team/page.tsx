import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Invite, Member, canManageTeam } from "@/lib/team";
import NoAccess from "@/components/customers/NoAccess";
import TeamView from "@/components/team/TeamView";

export const dynamic = "force-dynamic";

export default async function TeamPage({ searchParams }: { searchParams: { tab?: string } }) {
  const { supabase, current, user } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageTeam(current.role)) return <NoAccess />;
  const [members, invites, vans] = await Promise.all([
    supabase.rpc("team_members", { p_company: current.id }),
    supabase.from("company_invites").select("id, email, full_name, role, job_title, phone, token, invited_by_name, created_at, expires_at, accepted_at, revoked_at")
      .eq("company_id", current.id).is("accepted_at", null).is("revoked_at", null).order("created_at", { ascending: false }),
    supabase.from("inventory_locations").select("name, assigned_user_id").eq("company_id", current.id).eq("kind", "van").eq("is_active", true),
  ]);
  const vanOf: Record<string, string> = {};
  (vans.data ?? []).forEach((v) => { if (v.assigned_user_id) vanOf[v.assigned_user_id as string] = v.name as string; });
  return <TeamView companyId={current.id} members={(members.data ?? []) as Member[]} invites={(invites.data ?? []) as Invite[]} vanOf={vanOf}
    me={user.id} myRole={current.role} needsSql={Boolean(members.error || invites.error)} initialTab={searchParams.tab === "invites" ? "invites" : "members"} />;
}
