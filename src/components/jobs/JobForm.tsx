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
import { AfterHoursMoon, TechDot } from "@/components/jobs/EventBar";
import {
  ARRIVAL_WINDOWS, ChecklistTemplate, JobSettings, JobTag, JobType, Priority, SiteAddress, TeamMember,
  addressLine, afterHoursFee, afterHoursOf, atMinute, dayStart, durationLabel, fromIsoDay, isoDay, minutesOf, receivesJobs, timeToMin,
} from "@/lib/jobs";

import { useTranslations } from "next-intl";
import { useJobsTx } from "@/i18n/useJobsTx";
import { useJobError } from "@/i18n/useFmt";
import { OFF_COLOR, TimeOff, lastDay, overlaps } from "@/lib/time-off";
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

// Paso 6.5: el mismo formulario dentro del modal grande del calendario (sin encabezado ni barra de abajo;
// Save/Cancel van arriba en el modal y al guardar te quedas en el calendario)
export type JobFormModal = {
  formId: string; onSaved: (date: string, scheduled: boolean) => void;
  onState?: (s: { saving: boolean; error: string }) => void; onCustomer?: (id: string | null) => void; offs?: TimeOff[];
};

export default function JobForm({ companyId, settings, types, tags, team, templates, customers: initialCustomers, initial, defaults, modal }: {
  companyId: string; settings: JobSettings; types: JobType[]; tags: JobTag[]; team: TeamMember[]; templates: ChecklistTemplate[]; customers: PayerOption[];
  initial?: JobFormInitial; defaults?: { start?: string; end?: string; tech?: string; unscheduled?: boolean; customer?: string }; modal?: JobFormModal;
}) {
  const t = useTranslations("jobForm");
  const tc = useTranslations("common");
  const jt = useJobsTx();
  const jobError = useJobError();
  const { arrival: arrivalLabel, businessHours: businessHoursLabel } = jt;
  const PRIORITIES = jt.priorities;
  const timeLabel = (m: number) => jt.time(new Date(2000, 0, 1, 0, m));
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
  const [techIds, setTechIds] = useState<string[]>(visit?.tech_ids?.length ? [visit.lead_id ?? visit.tech_ids[0], ...visit.tech_ids.filter((x) => x !== (visit.lead_id ?? visit.tech_ids[0]))] : defaults?.tech ? [defaults.tech] : []);

  const [saving, setSaving] = useState(false);
  // Avisos: técnicos (push + correo) y, si se pide, el cliente
  const notify = (body: Record<string, unknown>) => fetch("/api/jobs/notify", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  const [error, setError] = useState("");
  const [cancelAsk, setCancelAsk] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const customer = customers.find((c) => c.id === customerId) ?? null;
  // Modal: el botón Save de arriba necesita saber si se está guardando o si hubo un error
  const onState = modal?.onState, onCustomer = modal?.onCustomer;
  useEffect(() => { onState?.({ saving, error }); }, [saving, error, onState]);
  useEffect(() => { onCustomer?.(customerId); }, [customerId, onCustomer]);
  // Solo técnicos (si ya estaba asignado alguien de la oficina, también se muestra para poder quitarlo)
  const techFirst = useMemo(() => team.filter((m) => receivesJobs(m) || (visit?.tech_ids ?? []).includes(m.user_id)), [team, visit]);
  const [notifyCust, setNotifyCust] = useState(settings.notify_customer === "always");
  // Con muchos técnicos: buscador y solo se muestran los elegidos + los que coinciden (máx. 12)
  const [techQ, setTechQ] = useState("");
  const manyTechs = techFirst.length > 8;
  const techShown = useMemo(() => {
    if (!manyTechs) return techFirst;
    const q = techQ.trim().toLowerCase();
    const sel = techFirst.filter((m) => techIds.includes(m.user_id));
    const rest = techFirst.filter((m) => !techIds.includes(m.user_id) && (!q || m.full_name.toLowerCase().includes(q))).slice(0, q ? 12 : 6);
    return [...sel, ...rest];
  }, [manyTechs, techFirst, techQ, techIds]);
  const activeTypes = types.filter((x) => x.is_active || x.id === typeId);

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
    const ty = types.find((x) => x.id === id);
    if (ty && !editing) setEndMin(Math.min(24 * 60 - 15, startMin + ty.default_duration_min));
  }
  function pickStart(m: number) { const dur = endMin - startMin; setStartMin(m); setEndMin(Math.min(24 * 60 - 15, m + Math.max(15, dur))); }
  function toggleTech(id: string) { setTechIds((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id])); }
  function makeLead(id: string) { setTechIds((l) => [id, ...l.filter((x) => x !== id)]); }
  function addCheck() { const v = newCheck.trim(); if (!v) return; setChecklist((l) => [...l, { label: v, required: true }]); setNewCheck(""); }
  function addTemplate(id: string) {
    const tp = templates.find((x) => x.id === id); if (!tp) return;
    setChecklist((l) => [...l, ...tp.items.filter((i) => i.label?.trim() && !l.some((x) => x.label === i.label)).map((i) => ({ label: i.label, required: i.required !== false }))]);
  }

  async function saveSite(): Promise<string | null> {
    if (!newSite || !customerId) return addressId || null;
    if (!newSite.street.trim() || !newSite.city.trim()) { setError(t("eSite")); return null; }
    const { data, error: e } = await createClient().from("customer_addresses").insert({
      customer_id: customerId, company_id: companyId, label: t("jobSiteLabel"), street: newSite.street.trim(), unit: newSite.unit.trim() || null,
      city: newSite.city.trim(), state: newSite.state.trim().toUpperCase() || null, zip: newSite.zip.trim() || null, country: "US", is_primary: addresses.length === 0,
    }).select("id").single();
    if (e || !data) { setError(t("eSiteSave")); return null; }
    return data.id as string;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId && !title.trim()) return setError(t("eCustomer"));
    if (scheduleNow && endMin <= startMin) return setError(t("eTime"));
    if (estimate && Number.isNaN(Number(estimate))) return setError(t("eEstimate"));
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
      if (techIds.length) await notify({ jobId: data, assignAll: true });
      if (modal) { setSaving(false); modal.onSaved(date, scheduleNow); return; }
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
    const gone = job.tag_ids.filter((x) => !tagIds.includes(x)), added = tagIds.filter((x) => !job.tag_ids.includes(x));
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
    if (!visitLocked) {
      const was = visit?.tech_ids ?? [];
      const moved = scheduleNow && (!visit?.starts_at || new Date(visit.starts_at).getTime() !== starts.getTime() || new Date(visit.ends_at ?? 0).getTime() !== ends.getTime());
      const assigned = techIds.filter((x) => !was.includes(x)), unassigned = was.filter((x) => !techIds.includes(x));
      if (assigned.length || unassigned.length || moved) {
        await notify({ ...(visit ? { visitId: visit.id } : { jobId: job.id }), assigned, unassigned, moved, notifyCustomer: Boolean(moved && visit?.starts_at && notifyCust && customerId) });
      }
    }
    router.push(scheduleNow ? `/dashboard/jobs/schedule?view=day&date=${date}` : "/dashboard/jobs/schedule");
    router.refresh();
  }

  async function cancelJob() {
    if (!initial) return;
    if (!cancelReason.trim()) return setError(t("eCancel"));
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
  // Paso 6.5: aviso si alguien elegido está de descanso a esa hora
  const offHits = useMemo(() => {
    if (!modal?.offs?.length || !scheduleNow || !techIds.length) return [];
    const day = fromIsoDay(date), a = atMinute(day, startMin), b = atMinute(day, endMin);
    return modal.offs.filter((o) => techIds.includes(o.user_id) && overlaps(o, a, b));
  }, [modal?.offs, scheduleNow, techIds, date, startMin, endMin]);
  const closeHref = "/dashboard/jobs/schedule";

  return (
    <form id={modal?.formId} onSubmit={submit} noValidate autoComplete="off" className={`flex min-w-0 flex-col overflow-x-hidden bg-white ${modal ? "" : "min-h-[calc(100vh-4rem)]"}`}>
      {!modal && <FormHeader title={editing ? t("editTitle", { n: initial!.number }) : t("newTitle")} closeHref={closeHref} />}

      {initial?.cancelled_at && (
        <div className="mx-5 mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:mx-8">
          <p className="text-[14px] text-slate-700"><b className="font-semibold">{t("cancelledB")}</b> {initial.cancel_reason}</p>
          <button type="button" onClick={restoreJob} className="ml-auto rounded-lg border border-[#0f766e] px-3 py-1.5 text-[13px] font-semibold text-[#0f766e] hover:bg-[#f3fbf8]">{t("restore")}</button>
        </div>
      )}

      <div className="space-y-6 border-b border-slate-200 px-5 py-7 sm:px-8">
        <div className="grid max-w-[1000px] grid-cols-[minmax(0,1fr)] gap-6">
          <FormRow label={t("customer")} hint={t("customerHint")} alignTop width="max-w-[560px]">
            <PayerPicker companyId={companyId} people={customers} customerId={customerId} name={typed}
              onPick={(c) => setCustomerId(c?.id ?? null)} onType={setTyped}
              onCreated={(c) => { setCustomers((l) => [c, ...l]); setCustomerId(c.id); }} hint={t("pickerHint")} />
          </FormRow>

          {customerId && (
            <FormRow label={t("site")} hint={t("siteHint")} alignTop width="max-w-[560px]">
              {newSite ? (
                <div className="rounded-xl border border-[#bfe7de] bg-[#f6fbfa] p-3.5 animate-[bp-pop-in_0.2s_ease-out]">
                  <div className="grid gap-2.5 sm:grid-cols-6">
                    <input autoFocus value={newSite.street} onChange={(e) => setNewSite({ ...newSite, street: e.target.value })} placeholder={t("street")} className={`${inputClass} sm:col-span-4`} />
                    <input value={newSite.unit} onChange={(e) => setNewSite({ ...newSite, unit: e.target.value })} placeholder={t("unit")} className={`${inputClass} sm:col-span-2`} />
                    <input value={newSite.city} onChange={(e) => setNewSite({ ...newSite, city: e.target.value })} placeholder={t("city")} className={`${inputClass} sm:col-span-3`} />
                    <input value={newSite.state} onChange={(e) => setNewSite({ ...newSite, state: e.target.value })} placeholder={t("state")} maxLength={2} className={`${inputClass} uppercase sm:col-span-1`} />
                    <input value={newSite.zip} onChange={(e) => setNewSite({ ...newSite, zip: e.target.value })} placeholder={t("zip")} inputMode="numeric" className={`${inputClass} sm:col-span-2`} />
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="text-[12px] text-slate-500">{t("savedToCustomer")}</span>
                    <button type="button" onClick={() => setNewSite(null)} className="ml-auto rounded-lg px-3 py-1.5 text-[13px] font-medium text-slate-500 hover:bg-white">{tc("cancel")}</button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1">
                    <SelectMenu value={addressId} ariaLabel={t("jobSiteLabel")} placeholder={addresses.length ? t("chooseSite") : t("noAddr")}
                      options={addresses.map((a) => ({ value: a.id, label: `${a.label ? `${a.label} · ` : ""}${addressLine(a)}` }))} onChange={setAddressId} />
                  </div>
                  <button type="button" onClick={() => setNewSite({ street: "", unit: "", city: "", state: "TX", zip: "" })}
                    className="shrink-0 rounded-lg border border-[#0f766e]/30 bg-[#e9f7f4] px-3 text-[13.5px] font-semibold text-[#0f766e] transition-all hover:-translate-y-0.5 hover:border-[#0f766e]">{t("addSite")}</button>
                </div>
              )}
            </FormRow>
          )}

          <FormRow label={t("type")} width="max-w-[340px]">
            <SelectMenu value={typeId} ariaLabel={t("type")} placeholder={t("chooseType")}
              options={[{ value: "", label: t("noType") }, ...activeTypes.map((x) => ({ value: x.id, label: `${x.name}${x.form_kind === "tune_up" ? t("tuneForm") : ""}` }))]} onChange={pickType} />
          </FormRow>
          <FormRow label={t("short")} htmlFor="j-title" hint={t("shortHint")} width="max-w-[560px]">
            <input id="j-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={t("shortPh")} className={inputClass} />
          </FormRow>
          <FormRow label={t("details")} htmlFor="j-desc" alignTop width="max-w-[560px]">
            <textarea id="j-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder={t("detailsPh")} className={`${inputClass} resize-y`} />
          </FormRow>
          <FormRow label={t("priority")} width="max-w-[560px]">
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
            <FormRow label={t("tags")} alignTop width="max-w-[560px]">
              <div className="flex flex-wrap gap-2">
                {tags.map((tg) => {
                  const on = tagIds.includes(tg.id);
                  return (
                    <button key={tg.id} type="button" onClick={() => setTagIds((l) => (on ? l.filter((x) => x !== tg.id) : [...l, tg.id]))} aria-pressed={on}
                      className="rounded-full border px-3 py-1 text-[13px] font-semibold transition-all hover:-translate-y-px"
                      style={on ? { background: tg.color, borderColor: tg.color, color: "#fff" } : { borderColor: `${tg.color}55`, color: tg.color, background: `${tg.color}10` }}>
                      {tg.name}
                    </button>
                  );
                })}
              </div>
            </FormRow>
          )}
          <FormRow label={t("estimate")} htmlFor="j-est" hint={t("estimateHint")} width="max-w-[220px]">
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
          <SectionTitle>{t("schedule")}</SectionTitle>
          {visitLocked ? (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-[14px] text-slate-600">{t("locked", { n: visit!.visit_no })}</p>
          ) : (
            <div className="grid gap-6">
              <div className="flex w-fit rounded-lg bg-slate-100 p-0.5">
                {[[true, t("schedNow")], [false, t("leaveUn")]].map(([v, l]) => (
                  <button key={String(v)} type="button" onClick={() => setScheduleNow(v as boolean)}
                    className={`rounded-md px-3.5 py-1.5 text-[13.5px] font-semibold transition-all ${scheduleNow === v ? "bg-white text-[#0f766e] shadow-sm" : "text-slate-500 hover:text-[#0b1f3a]"}`}>{l as string}</button>
                ))}
              </div>
              {scheduleNow ? (
                <>
                  <FormRow label={t("date")} width="max-w-[260px]"><DatePicker value={date} onChange={setDate} /></FormRow>
                  <FormRow label={t("time")} width="max-w-[460px]">
                    <div className="flex items-center gap-2">
                      <div className="flex-1"><SelectMenu value={String(startMin)} ariaLabel={t("startTime")} options={timeOpts} onChange={(v) => pickStart(Number(v))} /></div>
                      <span className="text-slate-400">{t("to")}</span>
                      <div className="flex-1"><SelectMenu value={String(endMin)} ariaLabel={t("endTime")} options={timeOpts.filter((o) => Number(o.value) > startMin)} onChange={(v) => setEndMin(Number(v))} /></div>
                    </div>
                    <p className="mt-1 text-[12px] text-slate-400">{endMin > startMin ? t("onSite", { d: durationLabel(endMin - startMin) }) : ""}</p>
                    {afterHoursOf(atMinute(fromIsoDay(date), startMin), atMinute(fromIsoDay(date), endMin), settings) && (
                      <div className="mt-2 flex items-start gap-2.5 rounded-xl border border-[#c7d2fe] bg-[#f5f6ff] px-3 py-2.5 text-[13px] text-[#3730a3] animate-[bp-fade_0.2s_ease-out]">
                        <AfterHoursMoon size={22} />
                        <span>{t.rich("afterHours", { hours: businessHoursLabel(settings), fee: afterHoursFee(settings, 100)?.label ?? "none", b: (c) => <b>{c}</b> })}</span>
                      </div>
                    )}
                  </FormRow>
                </>
              ) : (
                <p className="-mt-2 text-[13.5px] text-slate-500">{t.rich("toSchedule", { b: (c) => <b className="font-semibold text-[#0b1f3a]">{c}</b> })}</p>
              )}
              {editing && visit?.starts_at && scheduleNow && customerId && settings.notify_customer !== "never" && (
                <FormRow label={t("customer")} width="max-w-[560px]">
                  <label className="flex cursor-pointer items-center gap-2.5 text-[14px] text-slate-700">
                    <input type="checkbox" checked={notifyCust} onChange={(e) => setNotifyCust(e.target.checked)} className="h-4 w-4 accent-[#0f766e]" />
                    {t("emailCust")}
                  </label>
                </FormRow>
              )}
              <FormRow label={t("arrival")} hint={t("arrivalHint")} width="max-w-[560px]">
                <div className="flex flex-wrap gap-2">
                  {ARRIVAL_WINDOWS.map((m) => (
                    <button key={m} type="button" onClick={() => setArrival(m)}
                      className={`rounded-lg border px-3 py-1.5 text-[13.5px] font-medium transition-all ${arrival === m ? "border-[#0f766e] bg-[#f3fbf8] text-[#0b1f3a]" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>{arrivalLabel(m)}</button>
                  ))}
                </div>
                {scheduleNow && arrival > 0 && <p className="mt-1 text-[12px] text-slate-400">{t("custSees", { a: timeLabel(startMin), b: timeLabel(Math.min(24 * 60 - 15, startMin + arrival)) })}</p>}
              </FormRow>
              <FormRow label={t("techs")} hint={t("techsHint")} alignTop width="max-w-[640px]">
                {techFirst.length === 0 ? <p className="pt-2 text-[13.5px] text-slate-500">{t("noCollabs")}</p> : (
                  <div className="flex flex-wrap gap-2">
                    {manyTechs && (
                      <input value={techQ} onChange={(e) => setTechQ(e.target.value)} placeholder={t("searchTechs", { n: techFirst.length })} className={`${inputClass} mb-1 w-full`} />
                    )}
                    {techShown.map((m) => {
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
                            ? <span className="rounded-full bg-white px-1.5 text-[10.5px] font-semibold" style={{ color: m.color }}>{t("lead")}</span>
                            : <button type="button" onClick={() => makeLead(m.user_id)} className="rounded-full px-1.5 text-[10.5px] font-semibold text-slate-400 hover:bg-white hover:text-[#0f766e]">{t("makeLead")}</button>)}
                        </div>
                      );
                    })}
                    {offHits.map((o) => {
                      const m = team.find((x) => x.user_id === o.user_id);
                      const s = new Date(o.starts_at), l = lastDay(o);
                      return (
                        <p key={o.id} role="alert" className="flex w-full items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900 animate-[bp-fade_0.2s_ease-out]">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: OFF_COLOR[o.kind] }} />
                          {t("offWarn", { name: m?.full_name ?? "", kind: t(`offKind.${o.kind}` as never), when: o.all_day ? (s.toDateString() === l.toDateString() ? jt.dayShort(s) : `${jt.dayShort(s)} – ${jt.dayShort(l)}`) : `${jt.time(s)} – ${jt.time(new Date(o.ends_at))}` })}
                        </p>
                      );
                    })}
                    <p className="w-full text-[12px] text-slate-400">{t.rich("assignLater", { b: (c) => <b className="font-semibold text-slate-500">{c}</b> })}</p>
                  </div>
                )}
              </FormRow>
            </div>
          )}
        </div>
      </div>

      {/* Checklist y notas */}
      <div className="px-5 py-7 sm:px-8">
        <div className="grid max-w-[1000px] grid-cols-[minmax(0,1fr)] gap-6">
          <SectionTitle>{t("checklist")}</SectionTitle>
          <div className="-mt-3 max-w-[640px] space-y-2">
            {checklist.length === 0 && <p className="text-[13.5px] text-slate-500">{t("checklistHint")}</p>}
            {checklist.map((c, i) => (
              <div key={c.id ?? `n${i}`} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${c.done ? "border-[#0f766e] bg-[#0f766e] text-white" : "border-slate-300"}`}>
                  {c.done && <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="m5 10.5 3 3 7-7" /></svg>}
                </span>
                <input value={c.label} onChange={(e) => setChecklist((l) => l.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="min-w-0 flex-1 bg-transparent text-[14.5px] text-[#0b1f3a] focus:outline-none" />
                <button type="button" onClick={() => setChecklist((l) => l.map((x, j) => (j === i ? { ...x, required: !x.required } : x)))}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.required ? "bg-[#fff1f2] text-[#be123c]" : "bg-slate-100 text-slate-500"}`}>{c.required ? tc("required") : tc("optional")}</button>
                <button type="button" onClick={() => setChecklist((l) => l.filter((_, j) => j !== i))} aria-label={t("removeTask")}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-all hover:rotate-90 hover:bg-red-50 hover:text-red-600">
                  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 5l10 10M15 5 5 15" /></svg>
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input value={newCheck} onChange={(e) => setNewCheck(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCheck(); } }}
                placeholder={t("addTaskPh")} className={inputClass} />
              <button type="button" onClick={addCheck} className="shrink-0 rounded-lg border border-slate-200 px-4 text-[14px] font-semibold text-[#0f766e] hover:border-[#0f766e] hover:bg-[#f3fbf8]">{tc("add")}</button>
            </div>
            {templates.length > 0 && (
              <div className="max-w-[300px]"><SelectMenu value="" ariaLabel={t("fromTpl")} placeholder={t("fromTplPh")} options={templates.map((x) => ({ value: x.id, label: x.name }))} onChange={addTemplate} /></div>
            )}
          </div>

          <SectionTitle>{t("notes")}</SectionTitle>
          <FormRow label={t("forTech")} htmlFor="j-tn" hint={t("forTechHint")} alignTop width="max-w-[560px]">
            <textarea id="j-tn" value={techNotes} onChange={(e) => setTechNotes(e.target.value)} rows={2} className={`${inputClass} resize-y`} />
          </FormRow>
          <FormRow label={t("officeOnly")} htmlFor="j-on" hint={t("officeOnlyHint")} alignTop width="max-w-[560px]">
            <textarea id="j-on" value={officeNotes} onChange={(e) => setOfficeNotes(e.target.value)} rows={2} className={`${inputClass} resize-y`} />
          </FormRow>
        </div>
      </div>

      {cancelAsk && (
        <div className="mx-5 mb-2 rounded-xl border border-red-200 bg-red-50/60 p-4 sm:mx-8 animate-[bp-pop-in_0.2s_ease-out]">
          <p className="text-[14px] font-semibold text-[#0b1f3a]">{t("cancelQ")}</p>
          <p className="text-[13px] text-slate-600">{t("cancelText")}</p>
          <textarea autoFocus value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={2} placeholder={t("reasonPh")} className={`${inputClass} mt-2.5 resize-y bg-white`} />
          <div className="mt-2.5 flex gap-2">
            <button type="button" onClick={cancelJob} disabled={saving} className="rounded-lg bg-[#be123c] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#9f1239] disabled:opacity-60">{t("cancelJob")}</button>
            <button type="button" onClick={() => setCancelAsk(false)} className="rounded-lg px-3 py-2 text-[14px] font-medium text-slate-600 hover:bg-white">{t("keep")}</button>
          </div>
        </div>
      )}
      {!modal && (
        <SaveBar saving={saving} cancelHref={closeHref} error={error} saveLabel={editing ? tc("save") : t("createJob")}
          onDelete={editing && !initial?.cancelled_at && initial?.status !== "completed" ? () => setCancelAsk(true) : undefined} deleteLabel={t("cancelJob")} />
      )}
    </form>
  );
}
