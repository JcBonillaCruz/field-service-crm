import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// Borra la cuenta completa del usuario.
// · Las organizaciones donde es el ÚNICO dueño se borran con todos sus datos.
// · De las demás solo sale (las organizaciones y sus otros usuarios siguen igual).
// · Al final se borra el usuario de Auth (perfil incluido).
export async function POST(req: Request) {
  const { supabase, user } = await getSession();
  const body = await req.json().catch(() => ({}));
  if (body.confirm !== "DELETE") return NextResponse.json({ error: "Type DELETE to confirm." }, { status: 400 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Account deletion isn't configured on the server (missing service key)." }, { status: 500 });
  const admin = createAdmin(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: mine } = await supabase.from("company_members").select("company_id, role").eq("user_id", user.id);
  for (const m of mine ?? []) {
    if (m.role === "owner") {
      const { count } = await admin.from("company_members").select("user_id", { count: "exact", head: true })
        .eq("company_id", m.company_id).eq("role", "owner").eq("is_active", true).neq("user_id", user.id);
      if (!count) { await admin.from("companies").delete().eq("id", m.company_id); continue; }
    }
    await admin.from("company_members").delete().eq("company_id", m.company_id).eq("user_id", user.id);
  }
  await admin.from("notification_reads").delete().eq("user_id", user.id);
  await admin.from("push_subscriptions").delete().eq("user_id", user.id);
  await admin.from("profiles").delete().eq("id", user.id);
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: "Your data was removed, but the login couldn't be deleted. Contact support." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
