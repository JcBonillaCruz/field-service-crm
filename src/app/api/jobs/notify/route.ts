import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { canManageJobs } from "@/lib/jobs";
import { JobInfo, VisitInfo, admin, brandOf, notifyCustomer, notifyTechs } from "@/lib/jobs-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// La oficina avisa después de crear, mover o reasignar un trabajo.
// body: { visitId, assigned?: string[], unassigned?: string[], moved?: boolean, notifyCustomer?: boolean }
export async function POST(request: NextRequest) {
  const { supabase, current } = await getSession();
  if (!current || !canManageJobs(current.role)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  let b: { visitId?: string; jobId?: string; assignAll?: boolean; assigned?: string[]; unassigned?: string[]; moved?: boolean; notifyCustomer?: boolean };
  try { b = await request.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  // Permiso: se lee con la sesión del usuario (la seguridad de la base decide si puede verlo)
  let visitQ = supabase.from("job_visits").select("id, visit_no, starts_at, ends_at, arrival_window_min, job_id, job_visit_techs ( user_id )").eq("company_id", current.id);
  visitQ = b.visitId ? visitQ.eq("id", b.visitId) : visitQ.eq("job_id", b.jobId ?? "").order("visit_no", { ascending: false }).limit(1);
  const { data: vrows } = await visitQ;
  const v = (vrows ?? [])[0] as (VisitInfo & { job_id: string; job_visit_techs: { user_id: string }[] }) | undefined;
  if (!v) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: job } = await supabase.from("jobs").select("id, company_id, number, title, customer_id, customer_name, customer_phone, site_address").eq("id", v.job_id).maybeSingle();
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const db = admin();
  if (!db) return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is missing" }, { status: 200 });
  const { data: s } = await db.from("job_settings").select("notify_tech_assign").eq("company_id", current.id).maybeSingle();
  const brand = await brandOf(db, current.id);
  const origin = request.headers.get("origin") || `https://${request.headers.get("host")}`;
  const techsNow = v.job_visit_techs.map((t) => t.user_id);
  const assigned = b.assignAll ? techsNow : (b.assigned ?? []).filter((id) => techsNow.includes(id));
  const stayed = techsNow.filter((id) => !assigned.includes(id));
  const email = s?.notify_tech_assign !== false;
  const result = { techs: 0, customer: null as null | { ok: boolean; reason: string | null } };

  if (s?.notify_tech_assign !== false) {
    if (assigned.length) result.techs += await notifyTechs(db, { job: job as JobInfo, visit: v, userIds: assigned, kind: "assigned", brand, origin, email });
    if (b.moved && stayed.length) result.techs += await notifyTechs(db, { job: job as JobInfo, visit: v, userIds: stayed, kind: "rescheduled", brand, origin, email: false });
    if (b.unassigned?.length) result.techs += await notifyTechs(db, { job: job as JobInfo, visit: v, userIds: b.unassigned.filter((id) => !techsNow.includes(id)), kind: "unassigned", brand, origin, email: false });
  }
  if (b.notifyCustomer) result.customer = await notifyCustomer(db, { job: job as JobInfo, visit: v, brand });
  return NextResponse.json({ ok: true, ...result });
}
