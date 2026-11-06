import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Invite, Member, canManageTeam } from "@/lib/team";
import NoAccess from "@/components/customers/NoAccess";
import TeamView, { WorkInfo } from "@/components/team/TeamView";
import InviteForm from "@/components/team/InviteForm";
import MemberForm, { PayRate, WorkProfile } from "@/components/team/MemberForm";

// =====================================================================
// Team es el mismo en todas las apps; solo cambia la dirección para que el menú
// lateral siga siendo el de la app donde estabas (Finances, Inventory o Jobs).
// =====================================================================
export async function TeamListPage({ searchParams }: { searchParams: { tab?: string } }) {
  const { supabase, current, user } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageTeam(current.role)) return <NoAccess />;
  const [members, invites, vans, work] = await Promise.all([
    supabase.rpc("team_members", { p_company: current.id }),
    supabase.from("company_invites").select("id, email, full_name, role, job_title, phone, token, invited_by_name, created_at, expires_at, accepted_at, revoked_at")
      .eq("company_id", current.id).is("accepted_at", null).is("revoked_at", null).order("created_at", { ascending: false }),
    supabase.from("inventory_locations").select("name, assigned_user_id").eq("company_id", current.id).eq("kind", "van").eq("is_active", true),
    supabase.from("member_work_profiles").select("user_id, worker_type, can_receive_jobs").eq("company_id", current.id),
  ]);
  const vanOf: Record<string, string> = {};
  (vans.data ?? []).forEach((v) => { if (v.assigned_user_id) vanOf[v.assigned_user_id as string] = v.name as string; });
  const workOf: Record<string, WorkInfo> = {};
  ((work.data ?? []) as (WorkInfo & { user_id: string })[]).forEach((w) => { workOf[w.user_id] = { worker_type: w.worker_type, can_receive_jobs: w.can_receive_jobs }; });
  return <TeamView companyId={current.id} members={(members.data ?? []) as Member[]} invites={(invites.data ?? []) as Invite[]} vanOf={vanOf} work={workOf}
    me={user.id} myRole={current.role} needsSql={Boolean(members.error || invites.error)} initialTab={searchParams.tab === "invites" ? "invites" : "members"} />;
}

export async function TeamInvitePage({ searchParams }: { searchParams: { role?: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageTeam(current.role)) return <NoAccess />;
  const role = ["manager", "office", "technician"].includes(searchParams.role ?? "") ? searchParams.role as "manager" | "office" | "technician" : "technician";
  // Para avisar antes de enviar si ese correo ya está en el equipo o ya tiene una invitación
  const [members, invites] = await Promise.all([
    supabase.rpc("team_members", { p_company: current.id }),
    supabase.from("company_invites").select("id, email, full_name, created_at").eq("company_id", current.id).is("accepted_at", null).is("revoked_at", null),
  ]);
  return <InviteForm myRole={current.role} companyName={current.name} initialRole={role}
    members={((members.data ?? []) as { user_id: string; email: string; full_name: string; role: string }[]).map((m) => ({ id: m.user_id, email: m.email, name: m.full_name, role: m.role }))}
    invites={((invites.data ?? []) as { id: string; email: string; full_name: string | null; created_at: string }[])} />;
}

export async function TeamMemberEditPage({ params }: { params: { userId: string } }) {
  const { supabase, current, user } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageTeam(current.role)) return <NoAccess />;
  const isOwner = current.role === "owner";
  // La tarifa se pide SOLO si eres el dueño (y la base de datos tampoco se la da a nadie más)
  const [{ data }, work, pay] = await Promise.all([
    supabase.rpc("team_members", { p_company: current.id }),
    supabase.from("member_work_profiles").select("worker_type, can_receive_jobs, business_name").eq("company_id", current.id).eq("user_id", params.userId).maybeSingle(),
    isOwner
      ? supabase.from("member_pay_rates").select("pay_type, rate, overtime_rate, notes, updated_at, updated_by_name").eq("company_id", current.id).eq("user_id", params.userId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const member = ((data ?? []) as Member[]).find((m) => m.user_id === params.userId);
  if (!member) notFound();
  const p = pay.data as PayRate;
  return <MemberForm companyId={current.id} member={member} myRole={current.role} isMe={member.user_id === user.id}
    work={(work.data as WorkProfile) ?? null} pay={p ? { ...p, rate: Number(p.rate), overtime_rate: p.overtime_rate == null ? null : Number(p.overtime_rate) } : null}
    workReady={!work.error} />;
}
