import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KEY_HEADER, USER_HEADER, internalKey } from "@/lib/auth-headers";
import { COMPANY_COOKIE, CompanySummary, CurrentUser, Role } from "@/lib/types";

// Usuario ya verificado por el middleware en esta misma petición (evita otro GET /auth/v1/user)
function userFromMiddleware(): { id: string; email: string } | null {
  try {
    const h = headers();
    const key = internalKey();
    if (!key || key.length < 12 || h.get(KEY_HEADER) !== key) return null;
    const raw = h.get(USER_HEADER);
    if (!raw) return null;
    const u = JSON.parse(decodeURIComponent(raw)) as { id?: string; email?: string };
    return u.id ? { id: u.id, email: u.email ?? "" } : null;
  } catch { return null; }
}

// Carga UNA sola vez por petición (React.cache): usuario, perfil, compañías, logos y compañía activa.
// Perfil, membresías y logos van en paralelo (antes eran 3 viajes uno detrás de otro).
export const getSession = cache(async () => {
  const supabase = createClient();
  let user = userFromMiddleware();
  if (!user) {
    const { data } = await supabase.auth.getUser();
    if (data.user) user = { id: data.user.id, email: data.user.email ?? "" };
  }
  if (!user) redirect("/");
  const uid = user.id;

  const [{ data: profile }, { data: rows }, { data: logos }] = await Promise.all([
    supabase.from("profiles").select("full_name, avatar_url").eq("id", uid).maybeSingle(),
    supabase.from("company_members").select("role, companies ( id, name, industry, created_at )").eq("user_id", uid).eq("is_active", true),
    // RLS ya limita sales_prefs a las compañías de este usuario
    supabase.from("sales_prefs").select("company_id, logo_url").limit(200),
  ]);

  type Row = { role: Role; companies: { id: string; name: string; industry: string | null; created_at: string } | null };
  const map = new Map((logos ?? []).map((l) => [l.company_id as string, l.logo_url as string | null]));
  const companies: CompanySummary[] = ((rows ?? []) as unknown as Row[])
    .filter((r) => r.companies)
    .sort((a, b) => a.companies!.created_at.localeCompare(b.companies!.created_at))
    .map((r) => ({ id: r.companies!.id, name: r.companies!.name, industry: r.companies!.industry, role: r.role, createdAt: r.companies!.created_at, logoUrl: map.get(r.companies!.id) ?? null }));

  const saved = cookies().get(COMPANY_COOKIE)?.value;
  const current = companies.find((c) => c.id === saved) ?? companies[0] ?? null;

  const fullName = profile?.full_name || "";
  const currentUser: CurrentUser = { id: uid, email: user.email, fullName, avatarUrl: profile?.avatar_url ?? null };

  return {
    supabase,
    user: currentUser,
    firstName: (fullName || user.email || "").split(" ")[0],
    companies,
    current,
  };
});
