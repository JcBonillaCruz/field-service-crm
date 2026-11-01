import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { admin } from "@/lib/push";
import { appOrigin, canManageTeam } from "@/lib/team";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { email?: string; full_name?: string; role?: string; job_title?: string; phone?: string; password?: string };
const okEmail = (e: string) => /^\S+@\S+\.\S+$/.test(e);

// Crear la cuenta del empleado directamente (sin que él tenga que registrarse).
// Entra con su correo y una contraseña temporal; la primera vez el sistema le pide crear SU propia contraseña.
export async function POST(request: NextRequest) {
  const { current } = await getSession();
  if (!current || !canManageTeam(current.role)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const db = admin();
  if (!db) return NextResponse.json({ error: "Add SUPABASE_SERVICE_ROLE_KEY in Vercel to create accounts." }, { status: 501 });
  let b: Body = {};
  try { b = await request.json(); } catch { /* */ }
  const email = (b.email ?? "").trim().toLowerCase(), name = (b.full_name ?? "").trim(), password = (b.password ?? "").trim();
  if (!name) return NextResponse.json({ error: "Enter the person's name." }, { status: 400 });
  if (!okEmail(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "The temporary password needs at least 8 characters." }, { status: 400 });
  if (!["manager", "office", "technician"].includes(b.role ?? "")) return NextResponse.json({ error: "Choose a role." }, { status: 400 });
  if (b.role === "manager" && current.role !== "owner") return NextResponse.json({ error: "Only the owner can add managers." }, { status: 403 });

  const { data: created, error } = await db.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: name, must_change_password: true },
  });
  if (error || !created.user) {
    const taken = /already|registered|exists/i.test(error?.message ?? "");
    return NextResponse.json({ error: taken ? "This email already has a BrightPro account. Send an invitation instead, so they join with their own login." : "The account couldn't be created. Try again." }, { status: 400 });
  }
  const uid = created.user.id;
  await db.from("profiles").upsert({ id: uid, full_name: name });
  const { error: memErr } = await db.from("company_members").insert({
    company_id: current.id, user_id: uid, role: b.role, is_active: true,
    job_title: b.job_title?.trim() || null, phone: b.phone?.trim() || null, joined_at: new Date().toISOString(),
  });
  if (memErr) {
    await db.auth.admin.deleteUser(uid).catch(() => null);
    return NextResponse.json({ error: "The account couldn't be added to your company. Did you run the SQL for Paso 4.3?" }, { status: 500 });
  }
  const origin = appOrigin(request.headers.get("origin") || new URL(request.url).origin);
  return NextResponse.json({ ok: true, loginUrl: `${origin}/`, email, password });
}
