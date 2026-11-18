import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/session";
import { canManageJobs } from "@/lib/jobs";
import { JobInfo, VisitInfo, admin, brandOf, whenText } from "@/lib/jobs-notify";
import { buildNotice, cnSettings, customerContact, logNotice, markReviewAsked, reviewAllowed, sendCustomerNotice } from "@/lib/customer-notices";
import { validReviewUrl } from "@/lib/customer-notice-text";
import { appOrigin } from "@/lib/team";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Paso 5.8 · Avisos al cliente desde la ficha del trabajo (oficina y dueño):
//   GET  → cómo va (recordatorio enviado, respuesta del cliente, reseña) y el mensaje listo para texto / WhatsApp
//   POST → mandar el recordatorio o la reseña por correo, o dejar anotado que se mandó por texto / WhatsApp
type Visit = VisitInfo & { status: string; eta_at: string | null; customer_token: string | null; reminder_sent_at: string | null; customer_reply: string | null; customer_reply_at: string | null; customer_reply_note: string | null };
type Job = JobInfo & { status: string; cancelled_at: string | null; review_asked_at: string | null };

async function load(supabase: SupabaseClient, db: SupabaseClient, companyId: string, jobId: string) {
  // Permiso: se lee con la sesión del usuario (la seguridad de la base decide si puede verlo)
  const { data: seen } = await supabase.from("jobs").select("id").eq("id", jobId).eq("company_id", companyId).maybeSingle();
  if (!seen) return null;
  const [{ data: job, error: jobErr }, { data: visits, error: visitErr }] = await Promise.all([
    db.from("jobs").select("id, company_id, number, status, title, customer_id, customer_name, customer_phone, site_address, cancelled_at, review_asked_at").eq("id", jobId).maybeSingle(),
    db.from("job_visits").select("id, visit_no, status, starts_at, ends_at, arrival_window_min, eta_at, customer_token, reminder_sent_at, customer_reply, customer_reply_at, customer_reply_note").eq("job_id", jobId).order("visit_no"),
  ]);
  if (jobErr || visitErr || !job) return { needsSql: true as const };
  const list = (visits ?? []) as Visit[];
  // La próxima visita agendada (la que el cliente puede confirmar)
  const next = list.filter((v) => v.status === "scheduled" && v.starts_at && new Date(v.starts_at).getTime() > Date.now()).sort((a, b) => a.starts_at!.localeCompare(b.starts_at!))[0] ?? null;
  return { needsSql: false as const, job: job as Job, next };
}

export async function GET(request: NextRequest) {
  const { supabase, current } = await getSession();
  if (!current || !canManageJobs(current.role)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const jobId = request.nextUrl.searchParams.get("jobId") ?? "";
  const db = admin();
  if (!db) return NextResponse.json({ needsSql: true });
  const d = await load(supabase, db, current.id, jobId);
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const settings = d.needsSql ? null : await cnSettings(db, current.id);
  if (d.needsSql || !settings) return NextResponse.json({ needsSql: true });

  const { job, next } = d;
  const brand = await brandOf(db, current.id);
  const origin = appOrigin(request.nextUrl.origin);
  const reviewOk = validReviewUrl(settings.review_url);
  const reminder = next && !job.cancelled_at ? await buildNotice(db, { kind: "reminder", job, visit: next, brand, origin }) : null;
  const review = reviewOk ? await buildNotice(db, { kind: "review", job, visit: null, brand, origin, reviewUrl: settings.review_url, contact: reminder?.contact }) : null;
  const contact = reminder?.contact ?? review?.contact ?? await customerContact(db, job);
  const allowed = job.review_asked_at ? { ok: false, reason: "already_asked" } : await reviewAllowed(db, job);
  return NextResponse.json({
    needsSql: false, settings: { ...settings, review_ok: reviewOk },
    contact: { email: contact.email, phone: contact.phone, lang: contact.lang },
    visit: next ? { id: next.id, when: whenText(next, brand.timezone), reminder_sent_at: next.reminder_sent_at, reply: next.customer_reply, reply_at: next.customer_reply_at, reply_note: next.customer_reply_note } : null,
    review: { asked_at: job.review_asked_at, can_ask: job.status === "completed" && !job.cancelled_at, recently: allowed.reason === "asked_recently" },
    texts: { reminder: reminder?.copy.sms ?? null, review: review?.copy.sms ?? null },
  });
}

export async function POST(request: NextRequest) {
  const { supabase, current, user } = await getSession();
  if (!current || !canManageJobs(current.role)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const b = await request.json().catch(() => null) as { jobId?: string; kind?: string; via?: string } | null;
  const kind = b?.kind === "reminder" || b?.kind === "review" ? b.kind : null;
  const via = b?.via === "email" || b?.via === "text" || b?.via === "whatsapp" || b?.via === "copy" ? b.via : null;
  if (!b?.jobId || !kind || !via) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const db = admin();
  if (!db) return NextResponse.json({ ok: false, reason: "needs_sql" });
  const d = await load(supabase, db, current.id, b.jobId);
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const settings = d.needsSql ? null : await cnSettings(db, current.id);
  if (d.needsSql || !settings) return NextResponse.json({ ok: false, reason: "needs_sql" });
  const { job, next } = d;
  if (job.cancelled_at) return NextResponse.json({ ok: false, reason: "cancelled" });
  if (kind === "reminder" && !next) return NextResponse.json({ ok: false, reason: "no_visit" });
  if (kind === "review" && !validReviewUrl(settings.review_url)) return NextResponse.json({ ok: false, reason: "no_review_link" });

  const { data: me } = await db.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const actor = { id: user.id, name: (me?.full_name as string) || "Office" };
  const mark = async () => {
    if (kind === "reminder") await db.from("job_visits").update({ reminder_sent_at: new Date().toISOString() }).eq("id", next!.id);
    else await markReviewAsked(db, job.id);
  };
  if (via === "email") {
    const brand = await brandOf(db, current.id);
    const r = await sendCustomerNotice(db, { kind, job, visit: kind === "reminder" ? next : null, brand, origin: appOrigin(request.nextUrl.origin), reviewUrl: settings.review_url, actor });
    if (r.ok) await mark();
    return NextResponse.json(r);
  }
  // Por texto, WhatsApp o copiado: sale desde el teléfono de la oficina; aquí solo queda anotado quién y cuándo
  const how = via === "text" ? "by text message" : via === "whatsapp" ? "by WhatsApp" : "(message copied)";
  await logNotice(db, { job, visitId: next?.id, actor, message: `${kind === "reminder" ? "Appointment reminder" : "Google review request"} sent ${how}` });
  await mark();
  return NextResponse.json({ ok: true, reason: null, to: null });
}
