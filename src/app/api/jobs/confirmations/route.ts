import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { canManageJobs } from "@/lib/jobs";
import { admin } from "@/lib/jobs-notify";
import { cnSettings, remindCompany } from "@/lib/customer-notices";
import { countStates, loadConfirmations } from "@/lib/confirmations";
import { appOrigin } from "@/lib/team";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Paso 5.8b · Confirmaciones de clientes
//   GET  → cuántas visitas de los próximos 7 días están confirmadas, sin respuesta, sin recordar o pidieron otro horario (para los Dashboards)
//   POST → "Send reminders now": manda ya los recordatorios pendientes de la compañía (lo mismo que hace la tarea de cada mañana)
export async function GET() {
  const { supabase, current } = await getSession();
  if (!current || !canManageJobs(current.role)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const rows = await loadConfirmations(supabase, current.id, 7);
  if (!rows) return NextResponse.json({ needsSql: true });
  return NextResponse.json({ needsSql: false, total: rows.length, counts: countStates(rows) });
}

export async function POST(request: NextRequest) {
  const { current, user } = await getSession();
  if (!current || !canManageJobs(current.role)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const db = admin();
  const cn = db ? await cnSettings(db, current.id) : null;
  if (!db || !cn) return NextResponse.json({ ok: false, reason: "needs_sql" });
  const { data: me } = await db.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const r = await remindCompany(db, current.id, cn.cn_reminder_days, appOrigin(request.nextUrl.origin), { id: user.id, name: (me?.full_name as string) || "Office" });
  return NextResponse.json({ ok: true, ...r, days: cn.cn_reminder_days });
}
