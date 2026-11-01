import { createClient } from "@/lib/supabase/server";
import { admin } from "@/lib/push";
import JoinInvite from "@/components/team/JoinInvite";

export const dynamic = "force-dynamic";
export const metadata = { title: "Join your team | BrightPro" };

// Página pública de la invitación: muestra a qué compañía te invitan y te deja entrar o crear tu cuenta
export default async function JoinPage({ params }: { params: { token: string } }) {
  const db = admin();
  const token = params.token.replace(/[^a-f0-9]/gi, "").slice(0, 80);
  let state: "ok" | "missing" | "expired" | "revoked" | "used" = "missing";
  let info: { company: string; logo: string | null; role: string; email: string; name: string | null; inviter: string | null } | null = null;
  if (db && token) {
    const { data: inv } = await db.from("company_invites").select("company_id, email, full_name, role, invited_by_name, expires_at, accepted_at, revoked_at").eq("token", token).maybeSingle();
    if (inv) {
      const [{ data: co }, { data: prefs }] = await Promise.all([
        db.from("companies").select("name").eq("id", inv.company_id).maybeSingle(),
        db.from("sales_prefs").select("logo_url").eq("company_id", inv.company_id).maybeSingle(),
      ]);
      info = { company: (co?.name as string) ?? "your team", logo: (prefs?.logo_url as string) ?? null, role: inv.role as string, email: inv.email as string, name: inv.full_name as string | null, inviter: inv.invited_by_name as string | null };
      state = inv.revoked_at ? "revoked" : inv.accepted_at ? "used" : new Date(inv.expires_at as string).getTime() < Date.now() ? "expired" : "ok";
    }
  }
  const { data: { user } } = await createClient().auth.getUser();
  return <JoinInvite token={token} state={state} info={info} userEmail={user?.email ?? null} />;
}
