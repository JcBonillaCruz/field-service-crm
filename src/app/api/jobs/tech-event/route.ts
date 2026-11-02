import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { admin, pushToCompany } from "@/lib/push";
import { addressText } from "@/lib/jobs-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WHAT: Record<string, { icon: string; verb: string }> = {
  on_my_way: { icon: "🚐", verb: "is on the way to" },
  start: { icon: "🔧", verb: "started" },
  resume: { icon: "▶️", verb: "resumed" },
  pause: { icon: "⏸️", verb: "paused" },
  hold: { icon: "⚠️", verb: "couldn't finish" },
  finish: { icon: "✅", verb: "finished" },
};
const KIND: Record<string, string> = { on_my_way: "on_my_way", start: "started", resume: "resumed", pause: "paused", hold: "on_hold", finish: "finished" };

// El técnico avanzó en un trabajo: aviso en la campana + push a la oficina (dueño, manager y oficina)
export async function POST(request: NextRequest) {
  const { supabase, current, user } = await getSession();
  if (!current) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  let b: { visitId?: string; action?: string };
  try { b = await request.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const w = b.action ? WHAT[b.action] : null;
  if (!b.visitId || !w) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  // Solo si la visita es suya (la seguridad de la base lo decide con su sesión)
  const { data: mine } = await supabase.from("job_visit_techs").select("visit_id").eq("visit_id", b.visitId).eq("user_id", user.id).maybeSingle();
  if (!mine) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const db = admin();
  if (!db) return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is missing" });
  const { data: v } = await db.from("job_visits").select("id, job_id, jobs ( id, number, customer_name, title, site_address, hold_reason, hold_note )").eq("id", b.visitId).maybeSingle();
  const job = (v as unknown as { jobs: { id: string; number: string; customer_name: string; title: string | null; site_address: Record<string, string | null> | null; hold_note: string | null } } | null)?.jobs;
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [{ data: me }, { data: office }] = await Promise.all([
    db.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    db.from("company_members").select("user_id").eq("company_id", current.id).in("role", ["owner", "manager", "office"]).eq("is_active", true),
  ]);
  const who = ((me?.full_name as string) || "Your technician").split(" ")[0];
  const title = `${w.icon} ${who} ${w.verb} ${job.customer_name || job.number}`;
  const body = b.action === "hold" ? `Needs follow-up${job.hold_note ? `: ${job.hold_note}` : ""} · ${job.number}` : b.action === "finish" ? `Ready to invoice · ${job.number}` : [job.title, addressText(job.site_address)].filter(Boolean).join(" · ") || job.number;
  const url = `/dashboard/jobs/${job.id}/edit`;

  const ids = (office ?? []).map((o) => o.user_id as string).filter((id) => id !== user.id);
  if (ids.length) await db.from("job_notices").insert(ids.map((user_id) => ({ company_id: current.id, user_id, job_id: job.id, kind: KIND[b.action!], title, body })));
  const sent = await pushToCompany(current.id, { title, body, url, tag: `job-${job.id}` });
  return NextResponse.json({ ok: true, sent });
}
