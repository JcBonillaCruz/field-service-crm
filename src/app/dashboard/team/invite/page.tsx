import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageTeam } from "@/lib/team";
import NoAccess from "@/components/customers/NoAccess";
import InviteForm from "@/components/team/InviteForm";

export const dynamic = "force-dynamic";

export default async function InvitePage({ searchParams }: { searchParams: { role?: string } }) {
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
