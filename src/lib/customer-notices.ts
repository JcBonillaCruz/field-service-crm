import type { SupabaseClient } from "@supabase/supabase-js";
import { Brand, JobInfo, VisitInfo, addressText, brandOf, emailShell, sendEmail } from "@/lib/jobs-notify";
import {
  CnCopy, CnKind, CnSettings, Lang, REVIEW_GAP_DAYS, arrivalText, clockText, dayText, daysUntil, firstName, langOf, noticeCopy, validReviewUrl,
} from "@/lib/customer-notice-text";

// =====================================================================
// Paso 5.8 · Avisos al cliente (solo servidor): "va en camino", recordatorio y reseña en Google.
// Salen por correo (Resend). Cada aviso queda en el historial del trabajo (job_events).
// =====================================================================
export const CN_OFF: CnSettings = { cn_on_my_way: false, cn_reminder: false, cn_reminder_days: 1, cn_review: false, review_url: null };

// null = todavía no se corrió el SQL del Paso 5.8
export async function cnSettings(db: SupabaseClient, companyId: string): Promise<CnSettings | null> {
  const { data, error } = await db.from("job_settings").select("cn_on_my_way, cn_reminder, cn_reminder_days, cn_review, review_url").eq("company_id", companyId).maybeSingle();
  if (error) return null;
  const d = (data ?? {}) as Partial<CnSettings>;
  return { cn_on_my_way: Boolean(d.cn_on_my_way), cn_reminder: Boolean(d.cn_reminder), cn_reminder_days: d.cn_reminder_days === 2 ? 2 : 1, cn_review: Boolean(d.cn_review), review_url: d.review_url?.trim() || null };
}

export type Contact = { email: string | null; phone: string | null; lang: Lang; first: string };
export async function customerContact(db: SupabaseClient, job: Pick<JobInfo, "customer_id" | "customer_name" | "customer_phone">): Promise<Contact> {
  const out: Contact = { email: null, phone: job.customer_phone ?? null, lang: "en", first: firstName(job.customer_name) };
  if (!job.customer_id) return out;
  const [{ data: list }, { data: c }] = await Promise.all([
    db.from("customer_emails").select("email, is_primary").eq("customer_id", job.customer_id),
    db.from("customers").select("*").eq("id", job.customer_id).maybeSingle(),
  ]);
  const cu = (c ?? {}) as { email?: string | null; phone?: string | null; language?: string | null; first_name?: string | null; company_name?: string | null };
  out.email = ((list ?? []).find((e) => e.is_primary)?.email ?? (list ?? [])[0]?.email ?? cu.email ?? null) as string | null;
  out.phone = out.phone || cu.phone || null;
  out.lang = langOf(cu.language);
  // Si el cliente es una empresa sin nombre de persona, el saludo queda neutro ("Hi there")
  out.first = cu.first_name?.trim() ? firstName(cu.first_name) : cu.company_name?.trim() ? "" : out.first;
  return out;
}

async function companyPhone(db: SupabaseClient, companyId: string) {
  const { data } = await db.from("sales_prefs").select("org_info").eq("company_id", companyId).maybeSingle();
  return ((data?.org_info as { phone?: string } | null)?.phone ?? "").trim() || null;
}

// Cada visita tiene su propio enlace para el cliente (se crea la primera vez que hace falta)
export async function ensureToken(db: SupabaseClient, visitId: string): Promise<string | null> {
  const { data, error } = await db.from("job_visits").select("customer_token").eq("id", visitId).maybeSingle();
  if (error || !data) return null;
  if (data.customer_token) return data.customer_token as string;
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "").slice(0, 40);
  await db.from("job_visits").update({ customer_token: token }).eq("id", visitId).is("customer_token", null);
  const { data: again } = await db.from("job_visits").select("customer_token").eq("id", visitId).maybeSingle();
  return (again?.customer_token as string | null) ?? null;
}

export async function logNotice(db: SupabaseClient, o: { job: Pick<JobInfo, "id" | "company_id">; visitId?: string | null; kind?: "customer_notice" | "customer_reply"; message: string; detail?: string | null; actor?: { id: string | null; name: string } }) {
  await db.from("job_events").insert({
    company_id: o.job.company_id, job_id: o.job.id, visit_id: o.visitId ?? null, kind: o.kind ?? "customer_notice",
    message: o.message, detail: o.detail ?? null, actor_id: o.actor?.id ?? null, actor_name: o.actor?.name ?? "Automatic",
  });
}

export type NoticeInput = {
  kind: CnKind; job: JobInfo; visit: (VisitInfo & { customer_token?: string | null }) | null; brand: Brand; origin: string;
  etaAt?: Date | null; techName?: string | null; reviewUrl?: string | null; contact?: Contact;
};
// Arma el aviso completo (asunto, texto, botones y la versión corta para texto/WhatsApp)
export async function buildNotice(db: SupabaseClient, o: NoticeInput): Promise<{ copy: CnCopy; contact: Contact; lang: Lang }> {
  const contact = o.contact ?? await customerContact(db, o.job);
  const lang = contact.lang, tz = o.brand.timezone;
  let confirmUrl: string | undefined, changeUrl: string | undefined;
  if (o.kind === "reminder" && o.visit) {
    const token = o.visit.customer_token ?? await ensureToken(db, o.visit.id);
    if (token) { confirmUrl = `${o.origin}/visit/${token}`; changeUrl = `${o.origin}/visit/${token}?a=change`; }
  }
  const copy = noticeCopy(o.kind, lang, {
    company: o.brand.companyName, customer: contact.first, tech: o.techName ? firstName(o.techName) : null, service: o.job.title, address: addressText(o.job.site_address), number: o.job.number,
    day: o.visit?.starts_at ? dayText(o.visit.starts_at, tz, lang) : undefined, arrival: o.visit ? arrivalText(o.visit, tz, lang) : undefined,
    daysAway: o.visit?.starts_at ? daysUntil(o.visit.starts_at, tz) : undefined, eta: o.etaAt ? clockText(o.etaAt, tz, lang) : null,
    companyPhone: await companyPhone(db, o.job.company_id), confirmUrl, changeUrl, reviewUrl: o.reviewUrl,
  });
  return { copy, contact, lang };
}
export const noticeHtml = (brand: Brand, copy: CnCopy) => emailShell({ brand, heading: copy.heading, intro: copy.intro, rows: copy.rows, button: copy.button, button2: copy.button2, footer: copy.footer });

const SENT: Record<CnKind, string> = { on_my_way: "On-my-way notice emailed to the customer", reminder: "Appointment reminder emailed to the customer", review: "Google review request emailed to the customer" };
const NOT_SENT: Record<CnKind, string> = { on_my_way: "On-my-way notice not sent", reminder: "Appointment reminder not sent", review: "Google review request not sent" };

export type NoticeResult = { ok: boolean; reason: null | "no_customer" | "no_email" | "send_failed" | "no_review_link"; to: string | null };
// Manda el correo y lo deja en el historial del trabajo
export async function sendCustomerNotice(db: SupabaseClient, o: NoticeInput & { actor?: { id: string | null; name: string } }): Promise<NoticeResult> {
  const say = (message: string, detail?: string | null) => logNotice(db, { job: o.job, visitId: o.visit?.id, message, detail, actor: o.actor });
  if (!o.job.customer_id) return { ok: false, reason: "no_customer", to: null };
  if (o.kind === "review" && !validReviewUrl(o.reviewUrl)) return { ok: false, reason: "no_review_link", to: null };
  const { copy, contact } = await buildNotice(db, o);
  if (!contact.email) { await say(NOT_SENT[o.kind], "The customer has no email. You can send it by text or WhatsApp from this job."); return { ok: false, reason: "no_email", to: null }; }
  const ok = await sendEmail({ brand: o.brand, to: [contact.email], subject: copy.subject, html: noticeHtml(o.brand, copy), text: `${copy.intro}\n\n${copy.rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n")}${copy.button ? `\n\n${copy.button.label}: ${copy.button.url}` : ""}` });
  if (!ok) { await say(NOT_SENT[o.kind], "The email could not be sent. Try again from this job."); return { ok: false, reason: "send_failed", to: contact.email }; }
  await say(SENT[o.kind], `${contact.email}${o.kind === "on_my_way" && o.etaAt ? ` · arriving around ${clockText(o.etaAt, o.brand.timezone, "en")}` : ""}`);
  return { ok: true, reason: null, to: contact.email };
}

// Reseña: una vez por trabajo y no más de una cada 90 días al mismo cliente
export async function reviewAllowed(db: SupabaseClient, job: Pick<JobInfo, "id" | "customer_id" | "company_id">): Promise<{ ok: boolean; reason: null | "already_asked" | "asked_recently" | "no_customer" | "needs_sql" }> {
  if (!job.customer_id) return { ok: false, reason: "no_customer" };
  const since = new Date(Date.now() - REVIEW_GAP_DAYS * 86400000).toISOString();
  const { data, error } = await db.from("jobs").select("id, review_asked_at").eq("company_id", job.company_id).eq("customer_id", job.customer_id).gte("review_asked_at", since).limit(20);
  if (error) return { ok: false, reason: "needs_sql" };
  if ((data ?? []).some((r) => r.id === job.id)) return { ok: false, reason: "already_asked" };
  if ((data ?? []).length) return { ok: false, reason: "asked_recently" };
  const { data: mine } = await db.from("jobs").select("review_asked_at").eq("id", job.id).maybeSingle();
  if (mine?.review_asked_at) return { ok: false, reason: "already_asked" };
  return { ok: true, reason: null };
}
export const markReviewAsked = (db: SupabaseClient, jobId: string) => db.from("jobs").update({ review_asked_at: new Date().toISOString() }).eq("id", jobId);

// Cada mañana (Vercel Cron): recordatorio a los clientes con visita en 1 o 2 días, según el ajuste de cada compañía.
// Una visita solo recibe un recordatorio; si le cambian la fecha, la base lo vuelve a habilitar.
export async function processCustomerReminders(db: SupabaseClient, origin: string): Promise<number> {
  const { data: companies, error } = await db.from("job_settings").select("company_id, cn_reminder_days").eq("cn_reminder", true).limit(2000);
  if (error) return 0; // falta el SQL del Paso 5.8
  let sent = 0;
  for (const c of companies ?? []) {
    const days = c.cn_reminder_days === 2 ? 2 : 1;
    const { data: visits } = await db.from("job_visits")
      .select("id, visit_no, starts_at, ends_at, arrival_window_min, customer_token, jobs!inner ( id, company_id, number, title, customer_id, customer_name, customer_phone, site_address, cancelled_at )")
      .eq("company_id", c.company_id).eq("status", "scheduled").is("reminder_sent_at", null)
      .gt("starts_at", new Date().toISOString()).lt("starts_at", new Date(Date.now() + (days + 1) * 86400000).toISOString()).order("starts_at").limit(500);
    type Row = VisitInfo & { customer_token: string | null; jobs: JobInfo & { cancelled_at: string | null } };
    const all = (visits ?? []) as unknown as Row[];
    if (!all.length) continue;
    const brand = await brandOf(db, c.company_id as string);
    // Mañana (o pasado mañana, si la compañía eligió 2 días). Nunca el mismo día de la visita.
    const due = all.filter((v) => { const d = daysUntil(v.starts_at!, brand.timezone); return d >= 1 && d <= days && !v.jobs.cancelled_at && v.jobs.customer_id; });
    for (let i = 0; i < due.length; i += 5) {
      const oks = await Promise.all(due.slice(i, i + 5).map(async (v) => {
        // Se aparta primero: si la tarea corre dos veces, el cliente recibe un solo correo
        const { data: claimed } = await db.from("job_visits").update({ reminder_sent_at: new Date().toISOString() }).eq("id", v.id).is("reminder_sent_at", null).select("id");
        if (!claimed?.length) return false;
        const r = await sendCustomerNotice(db, { kind: "reminder", job: v.jobs, visit: v, brand, origin });
        return r.ok;
      }));
      sent += oks.filter(Boolean).length;
    }
  }
  return sent;
}
