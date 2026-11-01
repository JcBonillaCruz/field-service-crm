import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { admin } from "@/lib/push";
import { canManageTeam, teamError } from "@/lib/team";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Quitar a alguien del equipo. Si ya no pertenece a ninguna otra compañía, también se borra su login,
// así se le puede volver a invitar o crear desde cero.
export async function POST(request: NextRequest) {
  const { supabase, current } = await getSession();
  if (!current || !canManageTeam(current.role)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  let b: { user_id?: string } = {};
  try { b = await request.json(); } catch { /* */ }
  if (!b.user_id) return NextResponse.json({ error: "Missing member" }, { status: 400 });

  const { error } = await supabase.rpc("team_remove_member", { p_company: current.id, p_user: b.user_id });
  if (error) return NextResponse.json({ error: teamError(error) }, { status: 400 });

  let loginDeleted = false;
  const db = admin();
  if (db) {
    const { count } = await db.from("company_members").select("user_id", { count: "exact", head: true }).eq("user_id", b.user_id);
    if (!count) {
      const { error: delErr } = await db.auth.admin.deleteUser(b.user_id);
      loginDeleted = !delErr;
    }
  }
  return NextResponse.json({ ok: true, loginDeleted });
}
