import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { admin } from "@/lib/push";
import { pushToUsers } from "@/lib/jobs-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Chat del trabajo (Paso 5.3k): al enviar un mensaje, aviso en la campana + push a los demás del trabajo
// (dueño, manager y oficina + los colaboradores asignados), menos a quien lo escribió.
export async function POST(request: NextRequest) {
  const { supabase, current, user } = await getSession();
  if (!current) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  let b: { messageId?: string };
  try { b = await request.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  if (!b.messageId) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  // Solo si el mensaje existe, es suyo y puede verlo (lo decide la seguridad de la base con su sesión)
  const { data: msg } = await supabase.from("job_messages").select("id, job_id, company_id, user_id, body").eq("id", b.messageId).maybeSingle();
  if (!msg || msg.user_id !== user.id || msg.company_id !== current.id) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const db = admin();
  if (!db) return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is missing" });
  const jobId = msg.job_id as string;
  const [{ data: job }, { data: me }, { data: office }, { data: visits }] = await Promise.all([
    db.from("jobs").select("id, number, customer_name").eq("id", jobId).maybeSingle(),
    db.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    db.from("company_members").select("user_id").eq("company_id", current.id).in("role", ["owner", "manager", "office"]).eq("is_active", true),
    db.from("job_visits").select("id").eq("job_id", jobId),
  ]);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const visitIds = (visits ?? []).map((v) => v.id as string);
  const { data: techRows } = visitIds.length ? await db.from("job_visit_techs").select("user_id").in("visit_id", visitIds) : { data: [] as { user_id: string }[] };

  const officeIds = Array.from(new Set((office ?? []).map((o) => o.user_id as string))).filter((id) => id !== user.id);
  const techIds = Array.from(new Set((techRows ?? []).map((t) => t.user_id as string))).filter((id) => id !== user.id && !officeIds.includes(id));
  const all = [...officeIds, ...techIds];
  if (!all.length) return NextResponse.json({ ok: true, sent: 0 });

  const who = ((me?.full_name as string) || "Your team").split(" ")[0];
  const text = String(msg.body).replace(/\s+/g, " ").trim();
  const title = `💬 ${who} · ${job.customer_name || job.number}`;
  const body = text.length > 140 ? `${text.slice(0, 137)}…` : text;
  const rows = (kind: string) => all.map((user_id) => ({ company_id: current.id, user_id, job_id: jobId, kind, title, body }));
  const first = await db.from("job_notices").insert(rows("message"));
  // Si la base todavía no acepta el tipo "message" (falta correr el SQL), se guarda como aviso normal del trabajo
  if (first.error) await db.from("job_notices").insert(rows("assigned"));

  const tag = `job-chat-${jobId}`;
  const [a, t] = await Promise.all([
    pushToUsers(db, current.id, officeIds, { title, body, url: `/dashboard/jobs/${jobId}?chat=1`, tag }),
    pushToUsers(db, current.id, techIds, { title, body, url: `/dashboard/jobs/mine/${jobId}?chat=1`, tag }),
  ]);
  return NextResponse.json({ ok: true, sent: a + t });
}
