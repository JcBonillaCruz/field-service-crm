import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { COMPANY_COOKIE, CompanySummary, CurrentUser, Role } from "@/lib/types";

// Carga una sola vez por página: el usuario, sus compañías y la compañía activa
export const getSession = cache(async () => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .single();

  const { data: rows } = await supabase
    .from("company_members")
    .select("role, companies ( id, name, industry, created_at )")
    .eq("user_id", user.id)
    .eq("is_active", true);

  type Row = { role: Role; companies: { id: string; name: string; industry: string | null; created_at: string } | null };
  const companies: CompanySummary[] = ((rows ?? []) as unknown as Row[])
    .filter((r) => r.companies)
    .sort((a, b) => a.companies!.created_at.localeCompare(b.companies!.created_at))
    .map((r) => ({ id: r.companies!.id, name: r.companies!.name, industry: r.companies!.industry, role: r.role, createdAt: r.companies!.created_at }));

  const saved = cookies().get(COMPANY_COOKIE)?.value;
  const current = companies.find((c) => c.id === saved) ?? companies[0] ?? null;

  const fullName = profile?.full_name || "";
  const currentUser: CurrentUser = {
    id: user.id,
    email: user.email ?? "",
    fullName,
    avatarUrl: profile?.avatar_url ?? null,
  };

  return {
    supabase,
    user: currentUser,
    firstName: (fullName || user.email || "").split(" ")[0],
    companies,
    current,
  };
});
