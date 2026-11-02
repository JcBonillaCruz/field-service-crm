import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageJobs } from "@/lib/jobs";
import { loadCustomerOptions, loadJobBasics } from "@/lib/jobs-server";
import NoAccess from "@/components/customers/NoAccess";
import JobForm, { JobFormInitial } from "@/components/jobs/JobForm";
import JobsNeedSql from "@/components/jobs/JobsNeedSql";

export const dynamic = "force-dynamic";

export default async function EditJobPage({ params }: { params: { id: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageJobs(current.role)) return <NoAccess />;
  const [data, customers, job, tags, checklist, visits] = await Promise.all([
    loadJobBasics(supabase, current.id),
    loadCustomerOptions(supabase, current.id),
    supabase.from("jobs").select("*").eq("id", params.id).eq("company_id", current.id).maybeSingle(),
    supabase.from("job_tag_links").select("tag_id").eq("job_id", params.id),
    supabase.from("job_checklist").select("id, label, is_required, done").eq("job_id", params.id).order("position"),
    supabase.from("job_visits").select("id, visit_no, status, starts_at, ends_at, arrival_window_min, job_visit_techs ( user_id, is_lead )").eq("job_id", params.id).order("visit_no"),
  ]);
  if (data.needsSql) return <JobsNeedSql />;
  if (!job.data) notFound();
  const j = job.data;
  type V = { id: string; visit_no: number; status: string; starts_at: string | null; ends_at: string | null; arrival_window_min: number; job_visit_techs: { user_id: string; is_lead: boolean }[] };
  // La visita que se edita aquí: la siguiente abierta (sin agendar o agendada); si ya empezó, se muestra bloqueada
  const vs = (visits.data ?? []) as V[];
  const open = vs.find((v) => ["on_my_way", "in_progress", "paused"].includes(v.status)) ?? vs.find((v) => ["unscheduled", "scheduled"].includes(v.status)) ?? null;
  const initial: JobFormInitial = {
    id: j.id, number: j.number, status: j.status, customer_id: j.customer_id, customer_name: j.customer_name, address_id: j.address_id, site_address: j.site_address,
    job_type_id: j.job_type_id, title: j.title, description: j.description, office_notes: j.office_notes, tech_notes: j.tech_notes,
    priority: j.priority, estimated_total: Number(j.estimated_total), tag_ids: (tags.data ?? []).map((t) => t.tag_id as string),
    checklist: (checklist.data ?? []).map((c) => ({ id: c.id as string, label: c.label as string, required: Boolean(c.is_required), done: Boolean(c.done) })),
    visit: open ? {
      id: open.id, visit_no: open.visit_no, status: open.status, starts_at: open.starts_at, ends_at: open.ends_at, arrival_window_min: open.arrival_window_min,
      tech_ids: open.job_visit_techs.map((t) => t.user_id), lead_id: open.job_visit_techs.find((t) => t.is_lead)?.user_id ?? null,
    } : null,
    cancelled_at: j.cancelled_at, cancel_reason: j.cancel_reason,
  };
  return <JobForm companyId={current.id} settings={data.settings} types={data.types} tags={data.tags} team={data.team} templates={data.templates} customers={customers} initial={initial} />;
}
