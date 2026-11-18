import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { admin, pushToCompany } from "@/lib/push";
import { JobInfo, addressText, brandOf } from "@/lib/jobs-notify";
import { cnSettings, markReviewAsked, reviewAllowed, sendCustomerNotice } from "@/lib/customer-notices";
import { ETA_CHOICES, clockText, validReviewUrl } from "@/lib/customer-notice-text";
import { appOrigin } from "@/lib/team";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WHAT: Record<string, { icon: string; verb: string }> = {
  on_my_way: { icon: "🚐", verb: "is on the way to" },
  start: { icon: "🔧", verb: "started" },
  resume: { icon: "▶️", verb: "resumed" },
  pause: { icon: "⏸️", verb: "paused" },
  hold: { icon: "⚠️", verb: "couldn't finish" },
  finish: { icon: "✅", verb: "finished" },
  // Paso 5.6: el técnico creó (o actualizó) la factura en borrador desde el teléfono
  invoice: { icon: "🧾", verb: "created a draft invoice for" },
  invoice_update: { icon: "🧾", verb: "updated the draft invoice for" },
};
const KIND: Record<string, string> = { on_my_way: "on_my_way", start: "started", resume: "resumed", pause: "paused", hold: "on_hold", finish: "finished", invoice: "invoiced", invoice_update: "invoiced" };

// El técnico avanzó en un trabajo: aviso en la campana + push a la oficina (dueño, manager y oficina)
export async function POST(request: NextRequest) {
  const { supabase, current, user } = await getSession();
  if (!current) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  let b: { visitId?: string; action?: string; etaMin?: number };
  try { b = await request.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const w = b.action ? WHAT[b.action] : null;
  if (!b.visitId || !w) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  // Solo si la visita es suya (la seguridad de la base lo decide con su sesión)
  const { data: mine } = await supabase.from("job_visit_techs").select("visit_id").eq("visit_id", b.visitId).eq("user_id", user.id).maybeSingle();
  if (!mine) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const db = admin();
  if (!db) return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is missing" });
  const { data: v } = await db.from("job_visits").select("id, visit_no, starts_at, ends_at, arrival_window_min, job_id, jobs ( id, company_id, number, status, customer_id, customer_name, customer_phone, title, site_address, hold_reason, hold_note, invoice_id )").eq("id", b.visitId).maybeSingle();
  const job = (v as unknown as { jobs: JobInfo & { status: string; hold_note: string | null; invoice_id: string | null } } | null)?.jobs;
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [{ data: me }, { data: office }] = await Promise.all([
    db.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    db.from("company_members").select("user_id").eq("company_id", current.id).in("role", ["owner", "manager", "office"]).eq("is_active", true),
  ]);
  const isInvoice = b.action === "invoice" || b.action === "invoice_update";
  if (isInvoice && !job.invoice_id) return NextResponse.json({ error: "No invoice" }, { status: 400 });
  const who = ((me?.full_name as string) || "Your technician").split(" ")[0];
  // Paso 5.8: hora estimada de llegada que eligió el técnico al tocar "On my way"
  const etaMin = b.action === "on_my_way" && ETA_CHOICES.includes(Number(b.etaMin)) ? Number(b.etaMin) : null;
  const etaAt = etaMin ? new Date(Date.now() + etaMin * 60000) : null;
  const brand = b.action === "on_my_way" || b.action === "finish" ? await brandOf(db, current.id) : null;
  const etaText = etaAt && brand ? clockText(etaAt, brand.timezone, "en") : null;
  const title = `${w.icon} ${who} ${w.verb} ${job.customer_name || job.number}`;
  const body = b.action === "hold" ? `Needs follow-up${job.hold_note ? `: ${job.hold_note}` : ""} · ${job.number}` : b.action === "finish" ? `Ready to invoice · ${job.number}` : isInvoice ? `Review it and send it to the customer · ${job.number}` : [etaText ? `Arriving around ${etaText}` : null, job.title, addressText(job.site_address)].filter(Boolean).join(" · ") || job.number;
  // Los avisos abren la ficha completa del trabajo (no el formulario de editar): ahí está todo, también la factura
  const url = `/dashboard/jobs/${job.id}`;

  const ids = (office ?? []).map((o) => o.user_id as string).filter((id) => id !== user.id);
  if (ids.length) {
    const rows = (kind: string) => ids.map((user_id) => ({ company_id: current.id, user_id, job_id: job.id, kind, title, body }));
    const first = await db.from("job_notices").insert(rows(KIND[b.action!]));
    // Si la base aún no acepta el tipo "invoiced", el aviso sale igual como "finished"
    if (first.error && isInvoice) await db.from("job_notices").insert(rows("finished"));
  }
  const sent = await pushToCompany(current.id, { title, body, url, tag: `job-${job.id}` });

  // ----- Paso 5.8: avisos al cliente (solo si la compañía los encendió en Jobs → Settings) -----
  let customer: { ok: boolean; reason: string | null } | null = null;
  if (brand && (b.action === "on_my_way" || b.action === "finish")) {
    try {
      const visit = v as unknown as { id: string; visit_no: number; starts_at: string | null; ends_at: string | null; arrival_window_min: number };
      const cn = await cnSettings(db, current.id);
      const actor = { id: user.id, name: (me?.full_name as string) || "Technician" };
      const origin = appOrigin(request.headers.get("origin") || `https://${request.headers.get("host")}`);
      if (b.action === "on_my_way") {
        if (cn && etaAt) await db.from("job_visits").update({ eta_at: etaAt.toISOString() }).eq("id", visit.id);
        if (cn?.cn_on_my_way) customer = await sendCustomerNotice(db, { kind: "on_my_way", job, visit, brand, origin, etaAt, techName: me?.full_name as string | null, actor });
      } else if (cn?.cn_review && validReviewUrl(cn.review_url)) {
        // Solo cuando el trabajo quedó terminado de verdad (no si falta otra visita) y sin repetirle al mismo cliente
        const { data: fresh } = await db.from("jobs").select("status, cancelled_at").eq("id", job.id).maybeSingle();
        if (fresh?.status === "completed" && !fresh.cancelled_at && (await reviewAllowed(db, job)).ok) {
          customer = await sendCustomerNotice(db, { kind: "review", job, visit, brand, origin, reviewUrl: cn.review_url, techName: me?.full_name as string | null, actor: { id: null, name: "Automatic" } });
          if (customer.ok) await markReviewAsked(db, job.id);
        }
      }
    } catch { /* el aviso al cliente nunca debe romper el aviso a la oficina */ }
  }
  return NextResponse.json({ ok: true, sent, customer, eta: etaText });
}
