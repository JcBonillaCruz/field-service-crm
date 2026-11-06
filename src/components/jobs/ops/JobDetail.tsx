"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { askConfirm } from "@/lib/confirm";
import {
  JobSettings, JobStatus, Priority, STATUS_META, SiteAddress, TechChip, VISIT_LABEL, VisitStatus, addressLine, afterHoursFee, afterHoursOf, businessHoursLabel,
  fmtDayShort, fmtTime, holdLabel, jobError, mapsLink, usd,
} from "@/lib/jobs";
import { OpsJob, groupOf, progressOf } from "@/lib/operations";
import { AfterHoursMoon, StatusArt, TechDot } from "@/components/jobs/EventBar";
import { DelayTag, GROUP_TONE, ProgressRing } from "@/components/jobs/ops/OpsBits";
import { Timeline } from "@/components/catalog/DetailBits";

type Visit = {
  id: string; visit_no: number; status: VisitStatus; starts_at: string | null; ends_at: string | null; arrival_window_min: number; techs: TechChip[];
  on_my_way_at: string | null; started_at: string | null; finished_at: string | null;
};
type Line = { id: string; name: string; description: string | null; quantity: number; unit: string | null; kind: string; source: string; rate?: number; amount?: number; created_by_name?: string | null };
type Check = { id: string; label: string; is_required: boolean; done: boolean; done_by_name: string | null; done_at: string | null };
type Part = { movement_id: string; name: string; sku: string | null; qty: number; at: string; by: string | null };
type Ev = { id: string; kind: string; message: string; detail: string | null; actor_name: string | null; created_at: string };
type Form = { id: string; kind: "work" | "tune_up"; data: Record<string, unknown>; alerts: string[]; submitted_by_name: string | null; submitted_at: string | null; created_at: string };
type Photo = { id: string; path: string; kind: string; caption: string | null; uploaded_by_name: string | null; created_at: string };
type Equip = { id: string; kind: string; brand: string | null; model: string | null; serial: string | null; location_note: string | null; warranty: string; is_active: boolean };
export type JobDetailDoc = { id: string; kind: string; number: string; status: string; total: number; amount_paid: number };
export type JobDetailData = {
  job: {
    id: string; company_id: string; number: string; status: JobStatus; title: string | null; description: string | null; tech_notes: string | null; office_notes: string | null;
    customer_id: string | null; customer_name: string; customer_phone: string | null; site_address: SiteAddress; priority: Priority;
    hold_reason: string | null; hold_note: string | null; hold_by_name: string | null; needs_followup: boolean; estimated_total: number | null;
    quote_id: string | null; invoice_id: string | null; source: string; created_at: string; created_by_name: string | null;
    scheduled_at: string | null; on_my_way_at: string | null; started_at: string | null; finished_at: string | null; invoiced_at: string | null; paid_at: string | null; completed_at: string | null;
    cancelled_at: string | null; cancelled_by_name: string | null; cancel_reason: string | null;
  };
  prices_visible: boolean; type: { name: string; color: string; form_kind: string } | null; tags: { id: string; name: string; color: string }[];
  visits: Visit[]; lines: Line[]; checklist: Check[]; parts: Part[]; events: Ev[]; forms: Form[]; photos: Photo[]; equipment: Equip[];
};

const card = "rounded-2xl border border-slate-200 bg-white";
const Icon = ({ d, className = "h-[18px] w-[18px]" }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null);

// La visita "actual", igual que en Operations: la que está en curso → la próxima → la que falta agendar → la última
function currentVisit(vs: Visit[]): Visit | null {
  const open = vs.filter((v) => v.status !== "cancelled");
  return open.find((v) => ["on_my_way", "in_progress", "paused"].includes(v.status))
    ?? [...open].filter((v) => v.status === "scheduled").sort((a, b) => (a.starts_at ?? "").localeCompare(b.starts_at ?? ""))[0]
    ?? open.find((v) => v.status === "unscheduled") ?? open.find((v) => v.status === "on_hold") ?? open[open.length - 1] ?? null;
}

export default function JobDetail({ companyId, data, docs, photoUrls, isOwner, settings }: {
  companyId: string; data: JobDetailData; docs: JobDetailDoc[]; photoUrls: Record<string, string>; isOwner: boolean; settings: JobSettings;
}) {
  const router = useRouter();
  const j = data.job;
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState<{ m: string; err?: boolean } | null>(null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const flash = (m: string, err = false) => { setToast({ m, err }); setTimeout(() => setToast((t) => (t?.m === m ? null : t)), err ? 5000 : 2600); };

  // En vivo: si el colaborador cambia el estado o la oficina lo mueve, la ficha se actualiza sola
  useEffect(() => {
    const sb = createClient();
    let t: ReturnType<typeof setTimeout>;
    const again = () => { clearTimeout(t); t = setTimeout(() => router.refresh(), 700); };
    const ch = sb.channel(`job-${j.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `id=eq.${j.id}` }, again)
      .on("postgres_changes", { event: "*", schema: "public", table: "job_visits", filter: `job_id=eq.${j.id}` }, again)
      .on("postgres_changes", { event: "*", schema: "public", table: "job_visit_techs", filter: `company_id=eq.${companyId}` }, again)
      .subscribe();
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => { clearTimeout(t); clearInterval(tick); sb.removeChannel(ch); };
  }, [j.id, companyId, router]);

  const cv = useMemo(() => currentVisit(data.visits), [data.visits]);
  const ops: OpsJob = useMemo(() => ({
    id: j.id, number: j.number, title: j.title, status: j.status, priority: j.priority, customer_id: j.customer_id, customer_name: j.customer_name,
    customer_phone: j.customer_phone, site_address: j.site_address, type_name: data.type?.name ?? null, type_color: data.type?.color ?? null,
    hold_reason: j.hold_reason, needs_followup: j.needs_followup, estimated_total: Number(j.estimated_total ?? 0), created_at: j.created_at,
    completed_at: j.completed_at, invoiced_at: j.invoiced_at, paid_at: j.paid_at,
    visit: cv ? { id: cv.id, visit_no: cv.visit_no, status: cv.status, starts_at: cv.starts_at, ends_at: cv.ends_at, arrival_window_min: cv.arrival_window_min, on_my_way_at: cv.on_my_way_at, started_at: cv.started_at, finished_at: cv.finished_at } : null,
    techs: cv?.techs ?? [], checklist_total: data.checklist.length, checklist_done: data.checklist.filter((c) => c.done).length,
    photos: data.photos.length, visits_total: data.visits.filter((v) => v.status !== "cancelled").length, visits_done: data.visits.filter((v) => v.status === "completed").length,
  }), [j, data, cv]);
  const group = groupOf(ops, now);
  const pct = progressOf(ops);
  const cancelled = Boolean(j.cancelled_at);

  // Todos los colaboradores que han estado en el trabajo (de todas las visitas)
  const people = useMemo(() => {
    const m = new Map<string, TechChip & { visits: number[] }>();
    data.visits.forEach((v) => v.techs.forEach((t) => { const x = m.get(t.user_id) ?? { ...t, visits: [] }; x.visits.push(v.visit_no); if (t.is_lead) x.is_lead = true; m.set(t.user_id, x); }));
    return Array.from(m.values());
  }, [data.visits]);

  const assignedAt = data.events.find((e) => e.kind === "assigned")?.created_at ?? (people.length ? j.scheduled_at ?? j.created_at : null);
  const steps: { label: string; at: string | null }[] = [
    { label: "Created", at: j.created_at }, { label: "Assigned", at: assignedAt }, { label: "Scheduled", at: j.scheduled_at },
    { label: "On my way", at: j.on_my_way_at }, { label: "Started", at: j.started_at }, { label: "Finished", at: j.completed_at ?? j.finished_at },
    { label: "Invoiced", at: j.invoiced_at }, { label: "Paid", at: j.paid_at },
  ];
  const reached = steps.reduce((n, s, i) => (s.at ? i : n), 0);
  const quote = docs.find((d) => d.kind === "quote"), invoice = docs.find((d) => d.kind === "invoice");
  const linesTotal = data.lines.reduce((a, l) => a + Number(l.amount ?? 0), 0);
  const map = mapsLink(j.site_address);
  // Fuera de horario: alguna visita abierta (o la actual) cae fuera del horario de oficina
  const afterHours = data.visits.some((v) => v.status !== "cancelled" && afterHoursOf(v.starts_at ? new Date(v.starts_at) : null, v.ends_at ? new Date(v.ends_at) : null, settings));
  const feeBase = linesTotal || Number(j.estimated_total ?? 0);
  const fee = afterHoursFee(settings, feeBase);
  const feeAdded = data.lines.some((l) => /after-hours/i.test(l.name));
  async function addFee() {
    if (!fee) return;
    if (!(await askConfirm({ title: `Add the after-hours fee (${fee.label})?`, message: `It adds ${usd(fee.amount)} to this job's services. You can still change it on the invoice.`, confirmLabel: "Add fee", tone: "green" }))) return;
    setBusy("fee");
    const { error } = await createClient().from("job_lines").insert({
      company_id: companyId, job_id: j.id, position: data.lines.length, kind: "service", name: "After-hours service fee",
      description: `Outside business hours (${businessHoursLabel(settings)})`, quantity: 1, rate: fee.amount, amount: fee.amount, source: "office",
    });
    setBusy("");
    if (error) return flash(jobError(error), true);
    flash("After-hours fee added"); router.refresh();
  }
  const phone = j.customer_phone?.replace(/[^\d+]/g, "");

  async function createInvoice() {
    if (!(await askConfirm({ title: "Create a draft invoice?", message: "It copies the services and materials of this job. You can edit it before sending.", confirmLabel: "Create draft", tone: "green" }))) return;
    setBusy("invoice");
    const { data: id, error } = await createClient().rpc("job_draft_invoice", { p_job: j.id });
    setBusy("");
    if (error || !id) return flash(error?.hint || jobError(error), true);
    router.push(`/dashboard/invoices/${id}`);
  }
  async function officeAction(a: "finish" | "resume") {
    if (!cv) return;
    if (a === "finish" && !(await askConfirm({ title: `Mark ${j.customer_name || j.number} as finished?`, message: "The visit closes and the job shows as completed.", confirmLabel: "Mark as finished", tone: "green" }))) return;
    setBusy(a);
    const { error } = await createClient().rpc("job_office_action", { p_visit: cv.id, p_action: a, p_reason: null, p_note: null });
    setBusy("");
    if (error) return flash(error.hint || jobError(error), true);
    flash(a === "finish" ? "Job marked as finished" : "Work resumed"); router.refresh();
  }

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[#f4f6f8] pb-24 lg:pb-10">
      {/* Encabezado */}
      <div className="border-b border-slate-200 bg-white px-4 py-4 lg:px-8">
        <div className="flex flex-wrap items-start gap-4">
          <Link prefetch={false} href="/dashboard/jobs/operations" aria-label="Back to Operations"
            className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-all hover:-translate-x-0.5 hover:border-[#14a39a] hover:text-[#0f766e]">
            <Icon d="M15 5 8 12l7 7" />
          </Link>
          {group === "done" && !cancelled ? <StatusArt s="completed" size={58} /> : <ProgressRing pct={cancelled ? 0 : pct} size={58} stroke={5} color={cancelled ? "#94a3b8" : GROUP_TONE[group]} />}
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-slate-400">
              <span>Job #{j.number}</span>
              {data.type && <span className="rounded-full px-2 py-0.5 text-[11.5px]" style={{ background: `${data.type.color}18`, color: data.type.color }}>{data.type.name}</span>}
              {(j.priority === "urgent" || j.priority === "high") && <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase ${j.priority === "urgent" ? "bg-[#ffe4e6] text-[#be123c]" : "bg-[#fff4e0] text-[#b45309]"}`}>{j.priority}</span>}
              {data.tags.map((t) => <span key={t.id} className="rounded-full px-2 py-0.5 text-[11px]" style={{ background: `${t.color}18`, color: t.color }}>{t.name}</span>)}
            </p>
            <h1 className="mt-0.5 truncate text-[22px] font-semibold tracking-tight text-[#0b1f3a]">{j.customer_name || j.title || "Job"}</h1>
            {j.title && j.customer_name && <p className="truncate text-[14px] text-slate-500">{j.title}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold ring-1 ${STATUS_META[j.status].badge}`}>{STATUS_META[j.status].label}</span>
              <DelayTag job={ops} now={now} />
              {j.status === "on_hold" && j.hold_reason && <span className="rounded-full bg-[#fff1f2] px-2.5 py-0.5 text-[12px] font-semibold text-[#be123c]">{holdLabel(j.hold_reason)}</span>}
              {afterHours && <AfterHoursMoon withText size={20} />}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {phone && <a href={`tel:${phone}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[14px] font-medium text-slate-700 transition-colors hover:border-[#14a39a] hover:text-[#0f766e]"><Icon d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />Call</a>}
            {!cancelled && cv && ["paused", "on_hold"].includes(cv.status) && <button type="button" disabled={busy === "resume"} onClick={() => officeAction("resume")} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[14px] font-medium text-slate-700 transition-colors hover:border-[#14a39a] hover:text-[#0f766e] disabled:opacity-60"><Icon d="M8 5v14l11-7z" />Resume</button>}
            {!cancelled && cv && ["on_my_way", "in_progress", "paused"].includes(cv.status) && <button type="button" disabled={busy === "finish"} onClick={() => officeAction("finish")} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[14px] font-medium text-slate-700 transition-colors hover:border-[#14a39a] hover:text-[#0f766e] disabled:opacity-60"><Icon d="m5 12.5 4.5 4.5L19 7" />Finish</button>}
            {!cancelled && !j.invoice_id && j.customer_id && (j.status === "completed" || data.lines.length > 0) && (
              <button type="button" disabled={busy === "invoice"} onClick={createInvoice} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[14px] font-medium text-slate-700 transition-colors hover:border-[#14a39a] hover:text-[#0f766e] disabled:opacity-60"><Icon d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h4" />Create invoice</button>
            )}
            <Link prefetch={false} href={`/dashboard/jobs/${j.id}/edit`} className="group inline-flex h-10 items-center gap-2 rounded-lg bg-[#0f766e] px-4 text-[14px] font-semibold text-white shadow-sm shadow-[#0f766e]/30 transition-colors hover:bg-[#0c5f59]">
              <span className="transition-transform duration-200 group-hover:-rotate-12 group-hover:scale-110"><Icon d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" /></span>Edit
            </Link>
          </div>
        </div>

        {/* Barra de pasos */}
        {!cancelled && (
          <ol className="mt-5 grid grid-cols-4 gap-y-3 sm:grid-cols-8">
            {steps.map((s, i) => (
              <li key={s.label} className="relative flex flex-col items-center text-center">
                {i > 0 && <span className={`absolute right-1/2 top-[11px] h-[3px] w-full ${i <= reached && s.at ? "bg-[#14a39a]" : "bg-slate-200"}`} style={{ transformOrigin: "left", animation: s.at ? `bp-bar-in .5s ${i * 0.06}s ease-out both` : undefined }} />}
                <span className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-white ${s.at ? "border-[#14a39a] text-[#0f766e]" : "border-slate-200 text-slate-300"}`}>
                  {s.at ? <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 10.5 3 3 7-7" /></svg> : <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />}
                </span>
                <span className={`mt-1 text-[12px] font-semibold ${s.at ? "text-[#0b1f3a]" : "text-slate-400"}`}>{s.label}</span>
                <span className="text-[11px] text-slate-400">{when(s.at) ?? "—"}</span>
              </li>
            ))}
          </ol>
        )}
        {cancelled && <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] text-slate-600">Cancelled {when(j.cancelled_at)}{j.cancelled_by_name ? ` by ${j.cancelled_by_name}` : ""}{j.cancel_reason ? ` — ${j.cancel_reason}` : ""}</p>}
      </div>

      <div className="grid gap-4 px-3 pt-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:px-8">
        <div className="min-w-0 space-y-4">
          {afterHours && !cancelled && (
            <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#c7d2fe] bg-[#f5f6ff] px-4 py-3.5">
              <AfterHoursMoon size={34} />
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-semibold text-[#312e81]">After-hours job</p>
                <p className="text-[13px] text-[#4338ca]">Outside your business hours ({businessHoursLabel(settings)}). {fee ? `Your after-hours fee is ${fee.label}${settings.after_hours_fee_type === "percent" ? ` (${usd(fee.amount)})` : ""} — you decide if you charge it.` : "Set an after-hours fee in Jobs → Settings, or add the price you want on the invoice."}</p>
              </div>
              {fee && !feeAdded && <button type="button" disabled={busy === "fee"} onClick={addFee} className="rounded-lg bg-[#4f46e5] px-4 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-[#4338ca] disabled:opacity-60">Add fee {usd(fee.amount)}</button>}
              {feeAdded && <span className="rounded-full bg-white px-3 py-1 text-[12.5px] font-semibold text-[#4338ca] ring-1 ring-[#c7d2fe]">Fee added ✓</span>}
            </section>
          )}
          {/* Lo que hay que hacer */}
          {(j.description || j.tech_notes || j.office_notes || (j.status === "on_hold" && j.hold_note)) && (
            <section className={`${card} p-5`}>
              <h2 className="text-[16px] font-semibold text-[#0b1f3a]">Job notes</h2>
              {j.description && <p className="mt-2 whitespace-pre-line text-[14.5px] text-slate-700">{j.description}</p>}
              {j.status === "on_hold" && j.hold_note && (
                <div className="mt-3 rounded-xl bg-[#fff7f8] px-3.5 py-2.5 text-[14px] text-[#9f1239]"><b>Left for follow-up</b>{j.hold_by_name ? ` by ${j.hold_by_name}` : ""}: {j.hold_note}</div>
              )}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {j.tech_notes && <div className="rounded-xl bg-[#f6f9fc] px-3.5 py-2.5"><p className="text-[12px] font-semibold text-slate-500">For the collaborators</p><p className="mt-0.5 whitespace-pre-line text-[14px] text-slate-700">{j.tech_notes}</p></div>}
                {j.office_notes && <div className="rounded-xl bg-[#fffaf0] px-3.5 py-2.5"><p className="text-[12px] font-semibold text-[#b45309]">Office only</p><p className="mt-0.5 whitespace-pre-line text-[14px] text-slate-700">{j.office_notes}</p></div>}
              </div>
            </section>
          )}

          {/* Visitas */}
          <section className={`${card} p-5`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[16px] font-semibold text-[#0b1f3a]">Visits <span className="font-normal text-slate-400">({data.visits.length})</span></h2>
              <Link prefetch={false} href="/dashboard/jobs/schedule" className="text-[13.5px] font-semibold text-[#0f766e] hover:underline">Open Schedule</Link>
            </div>
            <ul className="mt-3 space-y-2.5">
              {data.visits.map((v) => (
                <li key={v.id} className={`flex flex-wrap items-center gap-3 rounded-xl border px-3.5 py-3 ${v.id === cv?.id ? "border-[#bfe6da] bg-[#f6fcfa]" : "border-slate-100"}`}>
                  {["on_my_way", "in_progress", "paused", "on_hold", "completed"].includes(v.status) ? <StatusArt s={v.status} size={34} /> :
                    <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-slate-100 text-[12px] font-bold text-slate-500">{v.visit_no}</span>}
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] font-semibold text-[#0b1f3a]">Visit {v.visit_no} · <span className="font-medium text-slate-600">{VISIT_LABEL[v.status]}</span></p>
                    <p className="text-[13px] text-slate-500">{v.starts_at ? `${fmtDayShort(new Date(v.starts_at))} · ${fmtTime(new Date(v.starts_at))}${v.ends_at ? ` – ${fmtTime(new Date(v.ends_at))}` : ""}` : "Not scheduled"}</p>
                    {(v.on_my_way_at || v.started_at || v.finished_at) && (
                      <p className="mt-0.5 text-[12px] text-slate-400">{[v.on_my_way_at && `On the way ${when(v.on_my_way_at)}`, v.started_at && `Started ${when(v.started_at)}`, v.finished_at && `Ended ${when(v.finished_at)}`].filter(Boolean).join(" · ")}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {v.techs.length === 0 ? <Link prefetch={false} href="/dashboard/jobs/assign" className="rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-[12px] font-semibold text-slate-500 hover:border-[#14a39a] hover:text-[#0f766e]">+ Assign</Link>
                      : v.techs.map((t) => (
                        <span key={t.user_id} className="flex items-center gap-1.5 rounded-full bg-white py-0.5 pl-0.5 pr-2.5 ring-1 ring-slate-200" title={t.is_lead ? "Lead" : undefined}>
                          <TechDot t={t} size={22} ring={false} /><span className="text-[12.5px] font-medium text-slate-700">{t.name.split(" ")[0]}</span>
                          {t.is_lead && v.techs.length > 1 && <span className="text-[9.5px] font-bold uppercase text-[#0f766e]">Lead</span>}
                        </span>
                      ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Checklist */}
          {data.checklist.length > 0 && (
            <section className={`${card} p-5`}>
              <h2 className="text-[16px] font-semibold text-[#0b1f3a]">Checklist <span className="font-normal text-slate-400">{ops.checklist_done}/{ops.checklist_total}</span></h2>
              <ul className="mt-3 divide-y divide-slate-100">
                {data.checklist.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-2.5">
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${c.done ? "border-[#14a39a] bg-[#14a39a] text-white" : "border-slate-300"}`}>
                      {c.done && <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3"><path d="m5 10.5 3 3 7-7" /></svg>}
                    </span>
                    <span className={`min-w-0 flex-1 text-[14.5px] ${c.done ? "text-slate-500" : "text-[#0b1f3a]"}`}>{c.label}{c.is_required && !c.done && <span className="ml-1.5 text-[11px] font-semibold text-[#be123c]">Required</span>}</span>
                    {c.done && <span className="text-right text-[12px] text-slate-400">{c.done_by_name}<br className="sm:hidden" /> {when(c.done_at)}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Servicios y materiales */}
          <section className={`${card} p-5`}>
            <h2 className="text-[16px] font-semibold text-[#0b1f3a]">Services &amp; materials</h2>
            {data.lines.length === 0 ? <p className="mt-2 text-[14px] text-slate-500">No services or materials yet.</p> : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-[14px]">
                  <thead><tr className="border-b border-slate-200 text-[12px] font-semibold uppercase tracking-wide text-slate-400"><th className="py-2 pr-3">Item</th><th className="w-16 py-2 text-right">Qty</th>{data.prices_visible && <><th className="w-24 py-2 text-right">Rate</th><th className="w-28 py-2 text-right">Amount</th></>}</tr></thead>
                  <tbody>
                    {data.lines.map((l) => (
                      <tr key={l.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2.5 pr-3"><p className="font-medium text-[#0b1f3a]">{l.name}</p>
                          <p className="text-[12px] text-slate-400">{l.kind === "material" ? "Material" : "Service"}{l.source === "scan" ? " · scanned on site" : l.source === "tech" ? ` · added by ${l.created_by_name ?? "a collaborator"}` : l.source === "quote" ? " · from the quote" : ""}</p></td>
                        <td className="py-2.5 text-right tabular-nums text-slate-600">{Number(l.quantity)}{l.unit ? ` ${l.unit}` : ""}</td>
                        {data.prices_visible && <><td className="py-2.5 text-right tabular-nums text-slate-600">{usd(Number(l.rate ?? 0))}</td><td className="py-2.5 text-right font-semibold tabular-nums text-[#0b1f3a]">{usd(Number(l.amount ?? 0))}</td></>}
                      </tr>
                    ))}
                  </tbody>
                  {data.prices_visible && <tfoot><tr><td colSpan={3} className="pt-3 text-right text-[13px] font-semibold text-slate-500">Total</td><td className="pt-3 text-right text-[16px] font-semibold tabular-nums text-[#0b1f3a]">{usd(linesTotal)}</td></tr></tfoot>}
                </table>
              </div>
            )}
            {data.parts.length > 0 && (
              <div className="mt-4 rounded-xl bg-[#f8fafb] px-3.5 py-3">
                <p className="text-[12.5px] font-semibold text-slate-500">Parts scanned from the van</p>
                <ul className="mt-1.5 space-y-1">{data.parts.map((p) => <li key={p.movement_id} className="flex justify-between gap-3 text-[13px] text-slate-600"><span className="truncate">{Math.abs(Number(p.qty))} × {p.name}{p.sku ? ` · ${p.sku}` : ""}</span><span className="shrink-0 text-slate-400">{p.by} · {when(p.at)}</span></li>)}</ul>
              </div>
            )}
          </section>

          {/* Fotos y reportes */}
          <section className={`${card} p-5`}>
            <h2 className="text-[16px] font-semibold text-[#0b1f3a]">Photos &amp; reports</h2>
            {data.photos.length === 0 && data.forms.length === 0 && <p className="mt-2 text-[14px] text-slate-500">Photos and forms from the field show up here.</p>}
            {data.photos.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
                {data.photos.map((p) => (
                  <button key={p.id} type="button" onClick={() => setPhoto(p)} className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100">
                    {photoUrls[p.path] && <img src={photoUrls[p.path]} alt={p.caption ?? p.kind} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />}
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-1.5 pb-1 pt-4 text-left text-[10.5px] font-semibold capitalize text-white">{p.kind}</span>
                  </button>
                ))}
              </div>
            )}
            {data.forms.map((f) => (
              <div key={f.id} className="mt-3 rounded-xl border border-slate-100 px-3.5 py-3">
                <p className="text-[14px] font-semibold text-[#0b1f3a]">{f.kind === "tune_up" ? "Tune-Up readings" : "Work report"}
                  <span className="ml-2 text-[12px] font-normal text-slate-400">{f.submitted_at ? `Submitted by ${f.submitted_by_name ?? "—"} · ${when(f.submitted_at)}` : "Draft"}</span></p>
                {f.alerts.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{f.alerts.map((a) => <span key={a} className="rounded-full bg-[#fff1f2] px-2 py-0.5 text-[12px] font-semibold text-[#be123c]">{a}</span>)}</div>}
                <dl className="mt-2 grid gap-x-4 gap-y-1 text-[13px] sm:grid-cols-2">
                  {Object.entries(f.data).filter(([, v]) => v !== null && v !== "" && typeof v !== "object").slice(0, 24).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 border-b border-slate-50 py-1"><dt className="capitalize text-slate-500">{k.replace(/_/g, " ")}</dt><dd className="font-medium text-[#0b1f3a]">{String(v)}</dd></div>
                  ))}
                </dl>
              </div>
            ))}
          </section>

          {/* Historial */}
          <section className={`${card} p-5`}>
            <h2 className="mb-4 text-[16px] font-semibold text-[#0b1f3a]">Activity</h2>
            <Timeline rows={[...data.events].reverse().map((e) => ({ id: e.id, title: e.message, who: e.actor_name, when: e.created_at, note: e.detail ?? undefined }))} />
          </section>
        </div>

        {/* Columna derecha */}
        <aside className="space-y-4">
          <section className={`${card} p-5`}>
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-400">Customer</h2>
            {j.customer_id ? <Link prefetch={false} href={`/dashboard/customers/${j.customer_id}`} className="mt-1 block text-[16px] font-semibold text-[#0b1f3a] hover:text-[#0f766e]">{j.customer_name}</Link>
              : <p className="mt-1 text-[16px] font-semibold text-[#0b1f3a]">{j.customer_name || "No customer"}</p>}
            {j.customer_phone && <a href={`tel:${phone}`} className="mt-1 block text-[14px] text-slate-600 hover:text-[#0f766e]">{j.customer_phone}</a>}
            <h2 className="mt-4 text-[13px] font-semibold uppercase tracking-wide text-slate-400">Job site</h2>
            {addressLine(j.site_address) ? (
              <>
                <p className="mt-1 text-[14px] text-slate-700">{j.site_address?.label && <span className="block font-semibold">{j.site_address.label}</span>}{addressLine(j.site_address)}</p>
                {map && <a href={map} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[#0f766e] hover:underline"><Icon d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" className="h-4 w-4" />Open in Maps</a>}
              </>
            ) : <p className="mt-1 text-[14px] text-slate-400">No address</p>}
          </section>

          <section className={`${card} p-5`}>
            <div className="flex items-center justify-between"><h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-400">Collaborators</h2>
              <Link prefetch={false} href="/dashboard/jobs/assign" className="text-[13px] font-semibold text-[#0f766e] hover:underline">Assign</Link></div>
            {people.length === 0 ? <p className="mt-2 text-[14px] text-slate-500">Nobody yet.</p> : (
              <ul className="mt-2 space-y-2">
                {people.map((p) => (
                  <li key={p.user_id} className="flex items-center gap-2.5">
                    <TechDot t={p} size={32} ring={false} />
                    <span className="min-w-0 flex-1"><span className="block truncate text-[14.5px] font-semibold text-[#0b1f3a]">{p.name}</span>
                      <span className="text-[12px] text-slate-500">{p.is_lead ? "Lead · " : ""}Visit {p.visits.join(", ")}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={`${card} p-5`}>
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-400">Quote &amp; invoice</h2>
            {data.prices_visible && Number(j.estimated_total ?? 0) > 0 && <p className="mt-1 text-[14px] text-slate-600">Estimated <b className="text-[#0b1f3a]">{usd(Number(j.estimated_total))}</b></p>}
            <div className="mt-2 space-y-2">
              {quote ? <DocLink href={`/dashboard/quotes/${quote.id}`} label={`Quote ${quote.number}`} status={quote.status} total={quote.total} /> : <p className="text-[13.5px] text-slate-400">No quote</p>}
              {invoice ? <DocLink href={`/dashboard/invoices/${invoice.id}`} label={`Invoice ${invoice.number}`} status={invoice.status} total={invoice.total} paid={invoice.amount_paid} /> : <p className="text-[13.5px] text-slate-400">No invoice yet</p>}
            </div>
          </section>

          <section className={`${card} p-5 text-[13px] text-slate-500`}>
            <p>Created {when(j.created_at)}{j.created_by_name ? ` by ${j.created_by_name}` : ""}{j.source === "quote" ? " from a quote" : ""}.</p>
            {data.equipment.length > 0 && <p className="mt-1">{data.equipment.filter((e) => e.is_active).length} equipment saved at this job site.</p>}
            {isOwner && <p className="mt-2 rounded-lg bg-[#f6f9fc] px-3 py-2 text-[12.5px]">Job profitability (labor, materials and margin) arrives in a later step — only you will see it.</p>}
          </section>
        </aside>
      </div>

      {photo && (
        <div className="fixed inset-0 z-[96] flex items-center justify-center bg-slate-950/80 p-4 animate-[bp-fade_0.15s_ease-out]" onClick={() => setPhoto(null)}>
          {photoUrls[photo.path] && <img src={photoUrls[photo.path]} alt={photo.caption ?? photo.kind} className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl" />}
          <p className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-[13px] text-white">{photo.caption || photo.kind}{photo.uploaded_by_name ? ` · ${photo.uploaded_by_name}` : ""} · {when(photo.created_at)}</p>
        </div>
      )}
      {toast && <div role="status" className={`fixed bottom-5 left-1/2 z-[95] max-w-[92vw] -translate-x-1/2 rounded-xl px-4 py-2.5 text-[13.5px] font-medium text-white shadow-lg animate-[bp-pop-in_0.2s_ease-out] ${toast.err ? "bg-[#be123c]" : "bg-[#0b1f3a]"}`}>{toast.m}</div>}
    </div>
  );
}

function DocLink({ href, label, status, total, paid }: { href: string; label: string; status: string; total: number; paid?: number }) {
  return (
    <Link prefetch={false} href={href} className="group flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 transition-all hover:-translate-y-0.5 hover:border-[#14a39a] hover:shadow-[0_8px_18px_rgba(15,40,60,0.07)]">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef8f5] text-[#0f766e] transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-110">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h4" /></svg>
      </span>
      <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold text-[#0b1f3a]">{label}</span>
        <span className="block text-[12px] capitalize text-slate-500">{status.replace(/_/g, " ")}{paid ? ` · ${usd(paid)} paid` : ""}</span></span>
      <span className="text-[13.5px] font-semibold tabular-nums text-[#0b1f3a]">{usd(Number(total))}</span>
    </Link>
  );
}
