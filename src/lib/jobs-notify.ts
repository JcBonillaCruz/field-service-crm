import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { admin } from "@/lib/push";

// =====================================================================
// Avisos de Jobs (solo servidor): push al teléfono, aviso en la campana y correo (Resend)
// =====================================================================
export type JobInfo = {
  id: string; company_id: string; number: string; title: string | null; customer_id: string | null; customer_name: string; customer_phone: string | null;
  site_address: { street?: string | null; unit?: string | null; city?: string | null; state?: string | null; zip?: string | null } | null;
};
export type VisitInfo = { id: string; visit_no: number; starts_at: string | null; ends_at: string | null; arrival_window_min: number };
export type Brand = { companyName: string; logoUrl: string | null; replyTo: string | null; timezone: string };

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const addressText = (a: JobInfo["site_address"]) => (a ? [a.street, a.unit, a.city, [a.state, a.zip].filter(Boolean).join(" ")].filter((x) => x && String(x).trim()).join(", ") : "");

export function whenText(v: VisitInfo, tz: string) {
  if (!v.starts_at) return "Not scheduled yet";
  const s = new Date(v.starts_at);
  const day = s.toLocaleDateString("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" });
  const t = (d: Date) => d.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
  const arrival = v.arrival_window_min > 0 ? `${t(s)} – ${t(new Date(s.getTime() + v.arrival_window_min * 60000))}` : t(s);
  return `${day}, arriving ${v.arrival_window_min > 0 ? "between " : "at "}${arrival}`;
}
export const timeRange = (v: VisitInfo, tz: string) => {
  if (!v.starts_at || !v.ends_at) return "";
  const t = (d: string) => new Date(d).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
  return `${t(v.starts_at)} – ${t(v.ends_at)}`;
};

export async function brandOf(db: SupabaseClient, companyId: string): Promise<Brand> {
  const [{ data: c }, { data: p }, { data: s }] = await Promise.all([
    db.from("companies").select("name").eq("id", companyId).maybeSingle(),
    db.from("sales_prefs").select("logo_url, org_info").eq("company_id", companyId).maybeSingle(),
    db.from("job_settings").select("timezone").eq("company_id", companyId).maybeSingle(),
  ]);
  return {
    companyName: (c?.name as string) || "BrightPro", logoUrl: (p?.logo_url as string | null) ?? null,
    replyTo: ((p?.org_info as { email?: string } | null)?.email) || null, timezone: (s?.timezone as string) || "America/Chicago",
  };
}

// ---------- Push solo a ciertas personas ----------
let vapid: boolean | null = null;
function setupPush() {
  if (vapid !== null) return vapid;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  vapid = Boolean(pub && priv);
  if (vapid) webpush.setVapidDetails(`mailto:${process.env.SALES_FROM_EMAIL || "alerts@brightpro.app"}`, pub!, priv!);
  return vapid;
}
export async function pushToUsers(db: SupabaseClient, companyId: string, userIds: string[], payload: { title: string; body: string; url: string; tag?: string }) {
  if (!userIds.length || !setupPush()) return 0;
  const { data } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("company_id", companyId).in("user_id", userIds);
  let sent = 0;
  await Promise.all((data ?? []).map(async (s) => {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 12 }); sent++; }
    catch (e) { const code = (e as { statusCode?: number }).statusCode; if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("id", s.id); }
  }));
  return sent;
}

// ---------- Correo ----------
export function emailShell(o: { brand: Brand; heading: string; rows: [string, string][]; intro: string; button?: { label: string; url: string }; footer?: string }) {
  const accent = "#0f766e";
  const rows = o.rows.filter(([, v]) => v).map(([k, v]) => `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;width:110px;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;font-size:14px;color:#0b1f3a">${esc(v)}</td></tr>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb">
<tr><td style="background:${accent};height:6px;font-size:0">&nbsp;</td></tr>
<tr><td style="padding:24px 30px 6px">${o.brand.logoUrl ? `<img src="${o.brand.logoUrl}" alt="${esc(o.brand.companyName)}" style="max-height:60px;max-width:200px;display:block">` : `<p style="margin:0;font-size:19px;font-weight:700;color:#0b1f3a">${esc(o.brand.companyName)}</p>`}</td></tr>
<tr><td style="padding:10px 30px 0"><p style="margin:0;font-size:21px;font-weight:700;color:#0b1f3a">${esc(o.heading)}</p>
<p style="margin:8px 0 0;font-size:15px;line-height:1.55">${esc(o.intro)}</p></td></tr>
<tr><td style="padding:14px 30px"><table role="presentation" width="100%" style="background:#f8fafc;border-radius:10px;padding:8px 16px">${rows}</table></td></tr>
${o.button ? `<tr><td style="padding:4px 30px 18px"><a href="${o.button.url}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;font-weight:600;padding:11px 24px;border-radius:8px;font-size:15px">${esc(o.button.label)}</a></td></tr>` : ""}
<tr><td style="padding:14px 30px 22px;border-top:1px solid #f1f5f9;color:#94a3b8;font-size:12px">${esc(o.footer ?? o.brand.companyName)}</td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendEmail(o: { brand: Brand; to: string[]; subject: string; html: string; text: string }) {
  const key = process.env.RESEND_API_KEY, from = process.env.SALES_FROM_EMAIL;
  const to = o.to.filter((e) => /^\S+@\S+\.\S+$/.test(e));
  if (!key || !from || !to.length) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `${o.brand.companyName.replace(/[<>"]/g, "")} <${from}>`, to, reply_to: o.brand.replyTo || undefined, subject: o.subject, html: o.html, text: o.text }),
  }).catch(() => null);
  return Boolean(res?.ok);
}

export async function userEmails(db: SupabaseClient, ids: string[]) {
  const out = new Map<string, { email: string; name: string }>();
  const { data: profiles } = await db.from("profiles").select("id, full_name").in("id", ids);
  await Promise.all(ids.map(async (id) => {
    const { data } = await db.auth.admin.getUserById(id);
    if (data?.user?.email) out.set(id, { email: data.user.email, name: (profiles?.find((p) => p.id === id)?.full_name as string) || data.user.email.split("@")[0] });
  }));
  return out;
}

export async function customerEmail(db: SupabaseClient, customerId: string) {
  const [{ data: list }, { data: c }] = await Promise.all([
    db.from("customer_emails").select("email, is_primary").eq("customer_id", customerId),
    db.from("customers").select("email").eq("id", customerId).maybeSingle(),
  ]);
  const primary = (list ?? []).find((e) => e.is_primary)?.email ?? (list ?? [])[0]?.email ?? c?.email;
  return (primary as string | null) ?? null;
}

// Aviso al técnico: campana + push + (opcional) correo
export async function notifyTechs(db: SupabaseClient, o: {
  job: JobInfo; visit: VisitInfo; userIds: string[]; kind: "assigned" | "rescheduled" | "unassigned"; brand: Brand; origin: string; email: boolean;
}) {
  if (!o.userIds.length) return 0;
  const tz = o.brand.timezone;
  const what = o.job.title || o.job.customer_name || o.job.number;
  const title = o.kind === "assigned" ? `New job: ${o.job.customer_name || o.job.number}` : o.kind === "rescheduled" ? `Job moved: ${o.job.customer_name || o.job.number}` : `Removed from job ${o.job.number}`;
  const body = o.kind === "unassigned" ? `${what} is no longer assigned to you.` : `${whenText(o.visit, tz)}${addressText(o.job.site_address) ? ` · ${addressText(o.job.site_address)}` : ""}`;
  await db.from("job_notices").insert(o.userIds.map((user_id) => ({ company_id: o.job.company_id, user_id, job_id: o.job.id, kind: o.kind, title, body })));
  const sent = await pushToUsers(db, o.job.company_id, o.userIds, { title, body, url: "/dashboard/jobs/mine", tag: `job-${o.job.id}` });
  if (o.email && o.kind !== "unassigned") {
    const people = await userEmails(db, o.userIds);
    await Promise.all(Array.from(people.values()).map((p) => sendEmail({
      brand: o.brand, to: [p.email], subject: `${title} · ${o.job.number}`,
      html: emailShell({
        brand: o.brand, heading: o.kind === "assigned" ? "You have a new job" : "A job on your schedule changed",
        intro: `Hi ${p.name.split(" ")[0]}, ${o.kind === "assigned" ? "a job was assigned to you." : "the time of one of your jobs changed."}`,
        rows: [["Job", `${o.job.number}${o.job.title ? ` · ${o.job.title}` : ""}`], ["Customer", o.job.customer_name], ["When", whenText(o.visit, tz)], ["Time on site", timeRange(o.visit, tz)], ["Address", addressText(o.job.site_address)], ["Phone", o.job.customer_phone ?? ""]],
        button: { label: "Open my jobs", url: `${o.origin}/dashboard/jobs/mine` },
      }),
      text: `${title}\n${whenText(o.visit, tz)}\n${addressText(o.job.site_address)}`,
    })));
  }
  return sent;
}

// Aviso al cliente: su cita cambió
export async function notifyCustomer(db: SupabaseClient, o: { job: JobInfo; visit: VisitInfo; brand: Brand }) {
  if (!o.job.customer_id) return { ok: false, reason: "no_customer" };
  const to = await customerEmail(db, o.job.customer_id);
  if (!to) return { ok: false, reason: "no_email" };
  const tz = o.brand.timezone;
  const ok = await sendEmail({
    brand: o.brand, to: [to], subject: `Your appointment with ${o.brand.companyName} was updated`,
    html: emailShell({
      brand: o.brand, heading: "Your appointment was updated",
      intro: `Hi ${o.job.customer_name.split(" ")[0] || "there"}, here is the new time for your service with ${o.brand.companyName}.`,
      rows: [["When", whenText(o.visit, tz)], ["Service", o.job.title ?? ""], ["Address", addressText(o.job.site_address)], ["Reference", o.job.number]],
      footer: `${o.brand.companyName} · Reply to this email if the new time doesn't work for you.`,
    }),
    text: `Your appointment with ${o.brand.companyName} was updated: ${whenText(o.visit, tz)}.`,
  });
  return { ok, reason: ok ? null : "send_failed" };
}

export { admin };
