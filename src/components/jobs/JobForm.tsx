"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { inputClass } from "@/components/customers/ui";
import { FormHeader, FormRow, SaveBar, SectionTitle } from "@/components/catalog/FormBits";
import SelectMenu from "@/components/ui/SelectMenu";
import DatePicker from "@/components/ui/DatePicker";
import PayerPicker from "@/components/expenses/PayerPicker";
import type { PayerOption } from "@/components/expenses/ExpensesWorkspace";
import { TechDot } from "@/components/jobs/EventBar";
import {
  ARRIVAL_WINDOWS, ChecklistTemplate, JobSettings, JobTag, JobType, PRIORITIES, Priority, SiteAddress, TeamMember,
  addressLine, arrivalLabel, atMinute, dayStart, durationLabel, fmtHour, fromIsoDay, isoDay, jobError, minutesOf, timeToMin,
} from "@/lib/jobs";

type Addr = { id: string; label: string | null; street: string | null; unit: string | null; city: string | null; state: string | null; zip: string | null; is_primary: boolean };
type CheckRow = { id?: string; label: string; required: boolean; done?: boolean };
export type JobFormInitial = {
  id: string; number: string; status: string; customer_id: string | null; customer_name: string; address_id: string | null; site_address: SiteAddress;
  job_type_id: string | null; title: string | null; description: string | null; office_notes: string | null; tech_notes: string | null;
  priority: Priority; estimated_total: number; tag_ids: string[]; checklist: CheckRow[];
  visit: { id: string; visit_no: number; status: string; starts_at: string | null; ends_at: string | null; arrival_window_min: number; tech_ids: string[]; lead_id: string | null } | null;
  cancelled_at: string | null; cancel_reason: string | null;
};

const TIMES = Array.from({ length: 96 }, (_, i) => i * 15);
const timeLabel = (m: number) => `${fmtHour(m).replace(" ", ":" + String(m % 60).padStart(2, "0") + " ")}`;

export default function JobForm({ companyId, settings, types, tags, team, templates, customers: initialCustomers, initial, defaults }: {
  companyId: string; settings: JobSettings; types: JobType[]; tags: JobTag[]; team: TeamMember[]; templates: ChecklistTemplate[]; customers: PayerOption[];
  initial?: JobFormInitial; defaults?: { start?: string; end?: string; tech?: string; unscheduled?: boolean; customer?: string };
}) {
  const router = useRouter();
  const editing = Boolean(initial);
  const [customers, setCustomers] = useState(initialCustomers);
  const [customerId, setCustomerId] = useState<string | null>(initial?.customer_id ?? defaults?.customer ?? null);
  const [typed, setTyped] = useState("");
  const [addresses, setAddresses] = useState<Addr[]>([]);
  const [addressId, setAddressId] = useState(initial?.address_id ?? "");
  const [newSite, setNewSite] = useState<{ street: string; unit: string; city: string; state: string; zip: string } | null>(null);
  const [typeId, setTypeId] = useState(initial?.job_type_id ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? "normal");
  const [tagIds, setTagIds] = useState<string[]>(initial?.tag_ids ?? []);
  const [estimate, setEstimate] = useState(initial ? String(initial.estimated_total || "") : "");
  const [techNotes, setTechNotes] = useState(initial?.tech_notes ?? "");
  const [officeNotes, setOfficeNotes] = useState(initial?.office_notes ?? "");
  const [checklist, setChecklist] = useState<CheckRow[]>(initial?.checklist ?? []);
  const [newCheck, setNewCheck] = useState("");

  // Agenda
  const visit = initial?.visit ?? null;
  const visitLocked = Boolean(visit && !["unscheduled", "scheduled"].includes(visit.status));
  const s0 = visit?.starts_at ? new Date(visit.starts_at) : defaults?.start ? new Date(defaults.start) : null;
  const e0 = visit?.ends_at ? new Date(visit.ends_at) : defaults?.end ? new Date(defaults.end) : null;
  const fallbackStart = Math.max(timeToMin(settings.day_start), 8 * 60);
  const [scheduleNow, setScheduleNow] = useState(editing ? Boolean(visit?.starts_at) || !visit : !defaults?.unscheduled);
  const [date, setDate] = useState(isoDay(s0 ?? dayStart(new Date())));
  const [startMin, setStartMin] = useState(s0 ? minutesOf(s0) : fallbackStart);
  const [endMin, setEndMin] = useState(e0 ? (minutesOf(e0) || 24 * 60 - 15) : (s0 ? minutesOf(s0) : fallbackStart) + settings.default_duration_min);
  const [arrival, setArrival] = useState(visit?.arrival_window_min ?? settings.default_arrival_window_min);
  const [techIds, setTechIds] = useState<string[]>(visit?.tech_ids?.length ? [visit.lead_id ?? visit.tech_ids[0], ...visit.tech_ids.filter((t) => t !== (visit.lead_id ?? visit.tech_ids[0]))] : defaults?.tech ? [defaults.tech] : []);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [cancelAsk, setCancelAsk] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const customer = customers.find((c) => c.id === customerId) ?? null;
  const techFirst = useMemo(() => [...team].sort((a, b) => Number(b.role === "technician") - Number(a.role === "technician")), [team]);
  const activeTypes = types.filter((t) => t.is_active || t.id === typeId);

  // Direcciones (Job Sites) del cliente elegido
  useEffect(() => {
    if (!customerId) { setAddresses([]); return; }
    let alive = true;
    createClient().from("customer_addresses").select("id, label, street, unit, city, state, zip, is_primary").eq("customer_id", customerId)
      .order("is_primary", { ascending: false }).order("created_at").then(({ data }) => {
        if (!alive) return;
        const list = (data ?? []) as Addr[];
        setAddresses(list);
        setAddressId((cur) => (cur && list.some((a) => a.id === cur) ? cur : list[0]?.id ?? ""));
      });
    return () => { alive = false; };
  }, [customerId]);

  function pickType(id: string) {
    setTypeId(id);
    const t = types.find((x) => x.id === id);
    if (t && !editing) setEndMin(Math.min(24 * 60 - 15, startMin + t.default_duration_min));
  }
  function pickStart(m: number) { const dur = endMin - startMin; setStartMin(m); setEndMin(Math.min(24 * 60 - 15, m + Math.max(15, dur))); }
  function toggleTech(id: string) { setTechIds((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id])); }
  function makeLead(id: string) { setTechIds((l) => [id, ...l.filter((x) => x !== id)]); }
  function addCheck() { const v = newCheck.trim(); if (!v) return; setChecklist((l) => [...l, { label: v, required: true }]); setNewCheck(""); }
  function addTemplate(id: string) {
    const t = templates.find((x) => x.id === id); if (!t) return;
    setChecklist((l) => [...l, ...t.items.filter((i) => i.label?.trim() && !l.some((x) => x.label === i.label)).map((i) => ({ label: i.label, required: i.required !== false }))]);
  }

  async function saveSite(): Promise<string | null> {
    if (!newSite || !customerId) return addressId || null;
    if (!newSite.street.trim() || !newSite.city.trim()) { setError("Enter at least the street and city of the job site."); return null; }
    const { data, error: e } = await createClient().from("customer_addresses").insert({
      customer_id: customerId, company_id: companyId, label: "Job site", street: newSite.street.trim(), unit: newSite.unit.trim() || null,
      city: newSite.city.trim(), state: newSite.state.trim().toUpperCase() || null, zip: newSite.zip.trim() || null, country: "US", is_primary: addresses.length === 0,
    }).select("id").single();
    if (e || !data) { setError("The job site couldn't be saved. Try again."); return null; }
    return data.id as string;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId && !title.trim()) return setError("Choose a customer or write a short description.");
    if (scheduleNow && endMin <= startMin) return setError("The end time must be after the start time.");
    if (estimate && Number.isNaN(Number(estimate))) return setError("The estimate must be a number.");
    setSaving(true); setError("");
    const siteId = await saveSite();
    if (newSite && !siteId) { setSaving(false); return; }
    const day = fromIsoDay(date);
    const starts = atMinute(day, startMin), ends = atMinute(day, endMin);
    const sb = createClient();

    if (!editing) {
      const { data, error: err } = await sb.rpc("job_create", {
        p_company: companyId,
        p: {
          customer_id: customerId, address_id: siteId, job_type_id: typeId || null, title: title.trim(), description: description.trim(),
          office_notes: officeNotes.trim(), tech_notes: techNotes.trim(), priority, estimated_total: Number(estimate) || 0, tag_ids: tagIds,
          checklist: checklist.map((c) => ({ label: c.label, required: c.required })),
          visit: { starts_at: scheduleNow ? starts.toISOString() : null, ends_at: scheduleNow ? ends.toISOString() : null, arrival_window_min: arrival, tech_ids: techIds, lead_id: techIds[0] ?? null },
        },
      });
      if (err || !data) { setSaving(false); return setError(jobError(err)); }
      router.push(scheduleNow ? `/dashboard/jobs/schedule?view=day&date=${date}` : "/dashboard/jobs/schedule");
      router.refresh();
      return;
    }

    // ----- Editar -----
    const job = initial!;
    let snap: Record<string, unknown> = {};
    if (customerId !== job.customer_id || (siteId ?? null) !== job.address_id) {
      const site = siteId ? (await sb.from("customer_addresses").select("label, street, unit, city, state, zip, country").eq("id", siteId).maybeSingle()).data : null;
      snap = { customer_id: customerId, customer_name: customer?.display_name ?? "", customer_phone: customer?.phone ?? null, address_id: siteId, site_address: site };
    }
    const { error: upErr } = await sb.from("jobs").update({
      ...snap, job_type_id: typeId || null, title: title.trim() || null, description: description.trim() || null, priority,
      office_notes: officeNotes.trim() || null, tech_notes: techNotes.trim() || null, estimated_total: Number(estimate) || 0, updated_at: new Date().toISOString(),
    }).eq("id", job.id);
    if (upErr) { setSaving(false); return setError(jobError(upErr)); }

    // Etiquetas
    const gone = job.tag_ids.filter((t) => !tagIds.includes(t)), added = tagIds.filter((t) => !job.tag_ids.includes(t));
    if (gone.length) await sb.from("job_tag_links").delete().eq("job_id", job.id).in("tag_id", gone);
    if (added.length) await sb.from("job_tag_links").insert(added.map((tag_id) => ({ job_id: job.id, tag_id })));
    // Checklist
    const keep = checklist.filter((c) => c.id).map((c) => c.id as string);
    const removed = job.checklist.filter((c) => c.id && !keep.includes(c.id)).map((c) => c.id as string);
    if (removed.length) await sb.from("job_checklist").delete().in("id", removed);
    await Promise.all(checklist.map((c, i) => (c.id
      ? sb.from("job_checklist").update({ label: c.label, is_required: c.required, position: i }).eq("id", c.id)
      : sb.from("job_checklist").insert({ company_id: companyId, job_id: job.id, label: c.label, is_required: c.required, position: i }))));
    // Agenda y técnicos
    let schedErr = null;
    if (!visitLocked) {
      if (scheduleNow) {
        const r = visit
          ? await sb.rpc("visit_schedule", { p_visit: visit.id, p_starts: starts.toISOString(), p_ends: ends.toISOString(), p_window: arrival, p_techs: techIds, p_lead: techIds[0] ?? null })
          : await sb.rpc("job_schedule", { p_job: job.id, p_starts: starts.toISOString(), p_ends: ends.toISOString(), p_window: arrival, p_techs: techIds, p_lead: techIds[0] ?? null });
        schedErr = r.error;
      } else if (visit) {
        if (visit.starts_at) schedErr = (await sb.rpc("visit_unschedule", { p_visit: visit.id })).error;
        if (!schedErr) {
          await sb.from("job_visit_techs").delete().eq("visit_id", visit.id);
          if (techIds.length) await sb.from("job_visit_techs").insert(techIds.map((user_id, i) => ({ visit_id: visit.id, user_id, company_id: companyId, is_lead: i === 0 })));
          await sb.from("job_visits").update({ arrival_window_min: arrival }).eq("id", visit.id);
        }
      }
    }
    if (schedErr) { setSaving(false); return setError(jobError(schedErr)); }
    router.push(scheduleNow ? `/dashboard/jobs/schedule?view=day&date=${date}` : "/dashboard/jobs/schedule");
    router.refresh();
  }

  async function cancelJob() {
    if (!initial) return;
    if (!cancelReason.trim()) return setError("Write why the job is cancelled.");
    setSaving(true);
    const { error: err } = await createClient().rpc("job_cancel", { p_job: initial.id, p_reason: cancelReason.trim() });
    setSaving(false);
    if (err) return setError(jobError(err));
    router.push("/dashboard/jobs/schedule"); router.refresh();
  }
  async function restoreJob() {
    if (!initial) return;
    setSaving(true);
    const { error: err } = await createClient().rpc("job_restore", { p_job: initial.id });
    setSaving(false);
    if (err) return setError(jobError(err));
    router.refresh();
  }

  const timeOpts = TIMES.map((m) => ({ value: String(m), label: timeLabel(m) }));
  const closeHref = "/dashboard/jobs/schedule";

  return (
    <form onSubmit={submit} noValidate autoComplete="off" className="flex min-h-[calc(100vh-4rem)] flex-col bg-white">
      <FormHeader title={editing ? `Edit Job ${initial!.number}` : "New Job"} closeHref={closeHref} />

      {initial?.cancelled_at && (
        <div className="mx-5 mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:mx-8">
          <p className="text-[14px] text-slate-700"><b className="font-semibold">Cancelled.</b> {initial.cancel_reason}</p>
          <button type="button" onClick={restoreJob} className="ml-auto rounded-lg border border-[#0f766e] px-3 py-1.5 text-[13px] font-semibold text-[#0f766e] hover:bg-[#f3fbf8]">Restore job</button>
        </div>
      )}

      <div className="space-y-6 border-b border-slate-200 px-5 py-7 sm:px-8">
        <div className="grid max-w-[1000px] gap-6">
          <FormRow label="Customer" hint="Search your customers or add a new one here. It's saved in Customers too." alignTop width="max-w-[560px]">
            <PayerPicker companyId={companyId} people={customers} customerId={customerId} name={typed}
              onPick={(c) => setCustomerId(c?.id ?? null)} onType={setTyped}
              onCreated={(c) => { setCustomers((l) => [c, ...l]); setCustomerId(c.id); }} hint="Search by name, phone or email. Not there? Tap New to add it." />
          </FormRow>

          {customerId && (
            <FormRow label="Job Site" hint="The house or building where the work happens. Parts, equipment and readings stay linked to this address." alignTop width="max-w-[560px]">
              {newSite ? (
                <div className="rounded-xl border border-[#bfe7de] bg-[#f6fbfa] p-3.5 animate-[bp-pop-in_0.2s_ease-out]">
                  <div className="grid gap-2.5 sm:grid-cols-6">
                    <input autoFocus value={newSite.street} onChange={(e) => setNewSite({ ...newSite, street: e.target.value })} placeholder="Street" className={`${inputClass} sm:col-span-4`} />
                    <input value={newSite.unit} onChange={(e) => setNewSite({ ...newSite, unit: e.target.value })} placeholder="Apt / Unit" className={`${inputClass} sm:col-span-2`} />
                    <input value={newSite.city} onChange={(e) => setNewSite({ ...newSite, city: e.target.value })} placeholder="City" className={`${inputClass} sm:col-span-3`} />
                    <input value={newSite.state} onChange={(e) => setNewSite({ ...newSite, state: e.target.value })} placeholder="State" maxLength={2} className={`${inputClass} uppercase sm:col-span-1`} />
                    <input value={newSite.zip} onChange={(e) => setNewSite({ ...newSite, zip: e.target.value })} placeholder="ZIP" inputMode="numeric" className={`${inputClass} sm:col-span-2`} />
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="text-[12px] text-slate-500">Saved to the customer when you save the job.</span>
                    <button type="button" onClick={() => setNewSite(null)} className="ml-auto rounded-lg px-3 py-1.5 text-[13px] font-medium text-slate-500 hover:bg-white">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1">
                    <SelectMenu value={addressId} ariaLabel="Job site" placeholder={addresses.length ? "Choose a job site" : "No address on file"}
                      options={addresses.map((a) => ({ value: a.id, label: `${a.label ? `${a.label} · ` : ""}${addressLine(a)}` }))} onChange={setAddressId} />
                  </div>
                  <button type="button" onClick={() => setNewSite({ street: "", unit: "", city: "", state: "TX", zip: "" })}
                    className="shrink-0 rounded-lg border border-[#0f766e]/30 bg-[#e9f7f4] px-3 text-[13.5px] font-semibold text-[#0f766e] transition-all hover:-translate-y-0.5 hover:border-[#0f766e]">+ Job site</button>
                </div>
              )}
            </FormRow>
          )}

          <FormRow label="Job type" width="max-w-[340px]">
            <SelectMenu value={typeId} ariaLabel="Job type" placeholder="Choose a type"
              options={[{ value: "", label: "No type" }, ...activeTypes.map((t) => ({ value: t.id, label: `${t.name}${t.form_kind === "tune_up" ? " (Tune-Up form)" : ""}` }))]} onChange={pickType} />
          </FormRow>
          <FormRow label="Short description" htmlFor="j-title" hint="Shows on the calendar bar and the hover card. Example: AC not cooling upstairs." width="max-w-[560px]">
            <input id="j-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="What needs to be done" className={inputClass} />
          </FormRow>
          <FormRow label="Details" htmlFor="j-desc" alignTop width="max-w-[560px]">
            <textarea id="j-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Anything the team should know about this job" className={`${inputClass} resize-y`} />
          </FormRow>
          <FormRow label="Priority" width="max-w-[560px]">
            <div className="flex flex-wrap gap-2">
              {PRIORITIES.map((p) => (
                <button key={p.value} type="button" onClick={() => setPriority(p.value)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13.5px] font-medium transition-all ${priority === p.value ? "border-[#0f766e] bg-[#f3fbf8] text-[#0b1f3a]" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                  <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.label}
                </button>
              ))}
            </div>
          </FormRow>
          {tags.length > 0 && (
            <FormRow label="Tags" alignTop width="max-w-[560px]">
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => {
                  const on = tagIds.includes(t.id);
                  return (
                    <button key={t.id} type="button" onClick={() => setTagIds((l) => (on ? l.filter((x) => x !== t.id) : [...l, t.id]))} aria-pressed={on}
                      className="rounded-full border px-3 py-1 text-[13px] font-semibold transition-all hover:-translate-y-px"
                      style={on ? { background: t.color, borderColor: t.color, color: "#fff" } : { borderColor: `${t.color}55`, color: t.color, background: `${t.color}10` }}>
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </FormRow>
          )}
          <FormRow label="Estimate" htmlFor="j-est" hint="Expected amount. Services and parts are added on the job; quotes bring their own lines." width="max-w-[220px]">
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input id="j-est" inputMode="decimal" value={estimate} onChange={(e) => setEstimate(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.00" className={`${inputClass} pl-7`} />
            </div>
          </FormRow>
        </div>
      </div>

      {/* Agenda */}
      <div className="border-b border-slate-200 px-5 py-7 sm:px-8">
        <div className="max-w-[1000px]">
          <SectionTitle>Schedule</SectionTitle>
          {visitLocked ? (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-[14px] text-slate-600">Visit {visit!.visit_no} is already underway, so its time can&apos;t be changed here. The technician controls it from the app.</p>
          ) : (
            <div className="grid gap-6">
              <div className="flex w-fit rounded-lg bg-slate-100 p-0.5">
                {[[true, "Schedule now"], [false, "Leave unscheduled"]].map(([v, l]) => (
                  <button key={String(v)} type="button" onClick={() => setScheduleNow(v as boolean)}
                    className={`rounded-md px-3.5 py-1.5 text-[13.5px] font-semibold transition-all ${scheduleNow === v ? "bg-white text-[#0f766e] shadow-sm" : "text-slate-500 hover:text-[#0b1f3a]"}`}>{l as string}</button>
                ))}
              </div>
              {scheduleNow ? (
                <>
                  <FormRow label="Date" width="max-w-[260px]"><DatePicker value={date} onChange={setDate} /></FormRow>
                  <FormRow label="Time" width="max-w-[460px]">
                    <div className="flex items-center gap-2">
                      <div className="flex-1"><SelectMenu value={String(startMin)} ariaLabel="Start time" options={timeOpts} onChange={(v) => pickStart(Number(v))} /></div>
                      <span className="text-slate-400">to</span>
                      <div className="flex-1"><SelectMenu value={String(endMin)} ariaLabel="End time" options={timeOpts.filter((o) => Number(o.value) > startMin)} onChange={(v) => setEndMin(Number(v))} /></div>
                    </div>
                    <p className="mt-1 text-[12px] text-slate-400">{endMin > startMin ? `${durationLabel(endMin - startMin)} on site` : ""}</p>
                  </FormRow>
                </>
              ) : (
                <p className="-mt-2 text-[13.5px] text-slate-500">The job goes to the <b className="font-semibold text-[#0b1f3a]">To schedule</b> panel. Drag it onto the calendar when you have a date.</p>
              )}
              <FormRow label="Arrival window" hint="What the customer is told: the technician arrives between the start time and the end of this window." width="max-w-[560px]">
                <div className="flex flex-wrap gap-2">
                  {ARRIVAL_WINDOWS.map((m) => (
                    <button key={m} type="button" onClick={() => setArrival(m)}
                      className={`rounded-lg border px-3 py-1.5 text-[13.5px] font-medium transition-all ${arrival === m ? "border-[#0f766e] bg-[#f3fbf8] text-[#0b1f3a]" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>{arrivalLabel(m)}</button>
                  ))}
                </div>
                {scheduleNow && arrival > 0 && <p className="mt-1 text-[12px] text-slate-400">Customer sees: arriving between {timeLabel(startMin)} and {timeLabel(Math.min(24 * 60 - 15, startMin + arrival))}</p>}
              </FormRow>
              <FormRow label="Technicians" hint="The first one is the lead: their color paints the bar on the calendar." alignTop width="max-w-[640px]">
                {team.length === 0 ? <p className="pt-2 text-[13.5px] text-slate-500">Invite your technicians in Team first.</p> : (
                  <div className="flex flex-wrap gap-2">
                    {techFirst.map((m) => {
                      const i = techIds.indexOf(m.user_id);
                      const on = i >= 0;
                      return (
                        <div key={m.user_id} className={`group flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-[13.5px] transition-all ${on ? "border-transparent text-[#0b1f3a] shadow-sm" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
                          style={on ? { background: `${m.color}18`, boxShadow: `inset 0 0 0 1.5px ${m.color}` } : undefined}>
                          <button type="button" onClick={() => toggleTech(m.user_id)} className="flex items-center gap-2" aria-pressed={on}>
                            <TechDot t={m} size={26} ring={false} />
                            <span className="font-medium">{m.full_name}</span>
                          </button>
                          {on && (i === 0
                            ? <span className="rounded-full bg-white px-1.5 text-[10.5px] font-semibold" style={{ color: m.color }}>Lead</span>
                            : <button type="button" onClick={() => makeLead(m.user_id)} className="rounded-full px-1.5 text-[10.5px] font-semibold text-slate-400 hover:bg-white hover:text-[#0f766e]">Make lead</button>)}
                        </div>
                      );
                    })}
                  </div>
                )}
              </FormRow>
            </div>
          )}
        </div>
      </div>

      {/* Checklist y notas */}
      <div className="px-5 py-7 sm:px-8">
        <div className="grid max-w-[1000px] gap-6">
          <SectionTitle>Checklist</SectionTitle>
          <div className="-mt-3 max-w-[640px] space-y-2">
            {checklist.length === 0 && <p className="text-[13.5px] text-slate-500">Required tasks the technician must check off before finishing the job.</p>}
            {checklist.map((c, i) => (
              <div key={c.id ?? `n${i}`} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${c.done ? "border-[#0f766e] bg-[#0f766e] text-white" : "border-slate-300"}`}>
                  {c.done && <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="m5 10.5 3 3 7-7" /></svg>}
                </span>
                <input value={c.label} onChange={(e) => setChecklist((l) => l.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="min-w-0 flex-1 bg-transparent text-[14.5px] text-[#0b1f3a] focus:outline-none" />
                <button type="button" onClick={() => setChecklist((l) => l.map((x, j) => (j === i ? { ...x, required: !x.required } : x)))}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.required ? "bg-[#fff1f2] text-[#be123c]" : "bg-slate-100 text-slate-500"}`}>{c.required ? "Required" : "Optional"}</button>
                <button type="button" onClick={() => setChecklist((l) => l.filter((_, j) => j !== i))} aria-label="Remove task"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-all hover:rotate-90 hover:bg-red-50 hover:text-red-600">
                  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 5l10 10M15 5 5 15" /></svg>
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input value={newCheck} onChange={(e) => setNewCheck(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCheck(); } }}
                placeholder="Add a task, e.g. Photo of the unit's data plate" className={inputClass} />
              <button type="button" onClick={addCheck} className="shrink-0 rounded-lg border border-slate-200 px-4 text-[14px] font-semibold text-[#0f766e] hover:border-[#0f766e] hover:bg-[#f3fbf8]">Add</button>
            </div>
            {templates.length > 0 && (
              <div className="max-w-[300px]"><SelectMenu value="" ariaLabel="Add from template" placeholder="Add from a saved checklist…" options={templates.map((t) => ({ value: t.id, label: t.name }))} onChange={addTemplate} /></div>
            )}
          </div>

          <SectionTitle>Notes</SectionTitle>
          <FormRow label="For the technician" htmlFor="j-tn" hint="Gate code, pets, parking, where the unit is. The technician sees this in the app." alignTop width="max-w-[560px]">
            <textarea id="j-tn" value={techNotes} onChange={(e) => setTechNotes(e.target.value)} rows={2} className={`${inputClass} resize-y`} />
          </FormRow>
          <FormRow label="Office only" htmlFor="j-on" hint="Private. Technicians never see these notes." alignTop width="max-w-[560px]">
            <textarea id="j-on" value={officeNotes} onChange={(e) => setOfficeNotes(e.target.value)} rows={2} className={`${inputClass} resize-y`} />
          </FormRow>
        </div>
      </div>

      {cancelAsk && (
        <div className="mx-5 mb-2 rounded-xl border border-red-200 bg-red-50/60 p-4 sm:mx-8 animate-[bp-pop-in_0.2s_ease-out]">
          <p className="text-[14px] font-semibold text-[#0b1f3a]">Cancel this job?</p>
          <p className="text-[13px] text-slate-600">It stays in the history with who cancelled it, when and why. You can restore it later.</p>
          <textarea autoFocus value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={2} placeholder="Reason (required)" className={`${inputClass} mt-2.5 resize-y bg-white`} />
          <div className="mt-2.5 flex gap-2">
            <button type="button" onClick={cancelJob} disabled={saving} className="rounded-lg bg-[#be123c] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#9f1239] disabled:opacity-60">Cancel job</button>
            <button type="button" onClick={() => setCancelAsk(false)} className="rounded-lg px-3 py-2 text-[14px] font-medium text-slate-600 hover:bg-white">Keep it</button>
          </div>
        </div>
      )}
      <SaveBar saving={saving} cancelHref={closeHref} error={error} saveLabel={editing ? "Save" : "Create job"}
        onDelete={editing && !initial?.cancelled_at && initial?.status !== "completed" ? () => setCancelAsk(true) : undefined} deleteLabel="Cancel job" />
    </form>
  );
}
