"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { createClient } from "@/lib/supabase/client";
import { inputClass } from "@/components/customers/ui";
import PhaseTemplates from "@/components/jobs/PhaseTemplates";
import TuneUpRanges from "@/components/jobs/forms/TuneUpRanges";
import CustomerNoticeSettings from "@/components/jobs/CustomerNoticeSettings";
import SelectMenu from "@/components/ui/SelectMenu";
import ColorPicker from "@/components/ui/ColorPicker";
import { confirmDelete } from "@/lib/confirm";
import { TechDot } from "@/components/jobs/EventBar";
import { ChecklistTemplate, JobSettings, JobTag, JobType, TECH_COLORS, TeamMember, ARRIVAL_WINDOWS, durationLabel, receivesJobs } from "@/lib/jobs";

import { useTranslations } from "next-intl";
import { useJobsTx } from "@/i18n/useJobsTx";
import { useJobError } from "@/i18n/useFmt";
const card = "rounded-2xl border border-slate-200 bg-white";
const DURS = [30, 45, 60, 90, 120, 180, 240, 360, 480].map((m) => ({ value: String(m), label: durationLabel(m) }));

function Switch({ on, onChange, label, text }: { on: boolean; onChange: (v: boolean) => void; label: string; text: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span><span className="block text-[15px] font-medium text-[#0b1f3a]">{label}</span><span className="block text-[13px] text-slate-500">{text}</span></span>
      <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-[#0f766e]" : "bg-slate-300"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${on ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

function Swatch({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  // El color propio se guarda cuando dejas de moverlo (no en cada movimiento)
  const T = useTranslations("jobSettings");
  const t = useRef<ReturnType<typeof setTimeout>>();
  const [live, setLive] = useState(value);
  useEffect(() => setLive(value), [value]);
  const custom = (c: string) => { setLive(c); clearTimeout(t.current); t.current = setTimeout(() => onChange(c), 450); };
  return (
    <Popover className="relative">
      <PopoverButton aria-label={T("changeColor")} className="h-7 w-7 rounded-full ring-2 ring-white transition-transform hover:scale-110 focus:outline-none" style={{ background: live, boxShadow: `0 0 0 1px ${live}55` }} />
      <PopoverPanel anchor="bottom start" transition className="z-[100] mt-1 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_12px_40px_rgba(15,40,60,0.18)] transition data-[closed]:scale-95 data-[closed]:opacity-0">
        {({ close }) => (
          <>
            <div className="grid grid-cols-6 gap-2.5">
              {TECH_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => { onChange(c); close(); }} aria-label={c}
                  className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${c.toLowerCase() === value.toLowerCase() ? "ring-2 ring-offset-2" : ""}`} style={{ background: c, ["--tw-ring-color" as string]: c }} />
              ))}
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3"><ColorPicker label={T("customColor")} value={live} onChange={custom} /></div>
          </>
        )}
      </PopoverPanel>
    </Popover>
  );
}

export default function JobSettingsForm({ companyId, settings, types: t0, tags: g0, team: m0, templates: c0 }: {
  companyId: string; settings: JobSettings; types: JobType[]; tags: JobTag[]; team: TeamMember[]; templates: ChecklistTemplate[];
}) {
  const T = useTranslations("jobSettings");
  const tc = useTranslations("common");
  const tr = useTranslations("roles");
  const jt = useJobsTx();
  const jobError = useJobError();
  const { arrival: arrivalLabel } = jt;
  const HOURS = Array.from({ length: 25 }, (_, h) => ({ value: `${String(h % 24).padStart(2, "0")}:00`, label: h === 24 ? T("midnight") : jt.hour(h * 60) }));
  const DAYS = jt.dayNames("short");
  const router = useRouter();
  const [s, setS] = useState(settings);
  const [types, setTypes] = useState(t0);
  const [tags, setTags] = useState(g0);
  const [team, setTeam] = useState(m0);
  const [templates, setTemplates] = useState(c0);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [newType, setNewType] = useState("");
  const [newTag, setNewTag] = useState("");
  const [tplDraft, setTplDraft] = useState<{ id?: string; name: string; items: string } | null>(null);
  const sb = createClient();
  const say = (text: string, error = false) => { setMsg({ text, error }); setTimeout(() => setMsg((m) => (m?.text === text ? null : m)), 2500); };

  async function patch(p: Partial<JobSettings>) {
    const next = { ...s, ...p };
    setS(next);
    const { error } = await sb.from("job_settings").update({ ...p, updated_at: new Date().toISOString() }).eq("company_id", companyId);
    if (error) { setS(s); say(jobError(error), true); } else { say(T("saved")); router.refresh(); }
  }
  async function saveType(id: string, p: Partial<JobType>) {
    setTypes((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)));
    const { error } = await sb.from("job_types").update(p).eq("id", id);
    if (error) say(jobError(error), true); else say(T("saved"));
  }
  async function addType() {
    const name = newType.trim(); if (!name) return;
    const { data, error } = await sb.from("job_types").insert({ company_id: companyId, name, color: TECH_COLORS[types.length % TECH_COLORS.length], position: types.length, default_duration_min: s.default_duration_min })
      .select("id, name, color, default_duration_min, form_kind, position, is_active").single();
    if (error || !data) return say(jobError(error), true);
    setTypes((l) => [...l, data as JobType]); setNewType(""); say(T("typeAdded"));
  }
  async function addTag() {
    const name = newTag.trim(); if (!name) return;
    const { data, error } = await sb.from("job_tags").insert({ company_id: companyId, name, color: TECH_COLORS[(tags.length + 3) % TECH_COLORS.length] }).select("id, name, color").single();
    if (error || !data) return say(jobError(error), true);
    setTags((l) => [...l, data as JobTag]); setNewTag(""); say(T("tagAdded"));
  }
  async function delTag(t: JobTag) {
    if (!(await confirmDelete({ title: T("delTagQ", { name: t.name }), message: T("delTagMsg") }))) return;
    const { error } = await sb.from("job_tags").delete().eq("id", t.id);
    if (error) return say(jobError(error), true);
    setTags((l) => l.filter((x) => x.id !== t.id));
  }
  async function setColor(m: TeamMember, color: string) {
    setTeam((l) => l.map((x) => (x.user_id === m.user_id ? { ...x, color } : x)));
    const { error } = await sb.rpc("job_set_color", { p_company: companyId, p_user: m.user_id, p_color: color });
    if (error) say(jobError(error), true); else say(T("colorSaved"));
  }
  async function saveTemplate() {
    if (!tplDraft) return;
    const items = tplDraft.items.split("\n").map((l) => l.trim()).filter(Boolean).map((label) => ({ label: label.replace(/^\*\s*/, ""), required: !label.startsWith("*") }));
    if (!tplDraft.name.trim() || !items.length) return say(T("tplNeed"), true);
    const row = { company_id: companyId, name: tplDraft.name.trim(), items };
    const { data, error } = tplDraft.id
      ? await sb.from("job_checklist_templates").update(row).eq("id", tplDraft.id).select("id, name, job_type_id, items").single()
      : await sb.from("job_checklist_templates").insert(row).select("id, name, job_type_id, items").single();
    if (error || !data) return say(jobError(error), true);
    setTemplates((l) => (tplDraft.id ? l.map((x) => (x.id === tplDraft.id ? (data as ChecklistTemplate) : x)) : [...l, data as ChecklistTemplate]));
    setTplDraft(null); say(T("tplSaved"));
  }
  async function delTemplate(t: ChecklistTemplate) {
    if (!(await confirmDelete({ title: T("delTplQ", { name: t.name }), message: T("delTplMsg") }))) return;
    await sb.from("job_checklist_templates").delete().eq("id", t.id);
    setTemplates((l) => l.filter((x) => x.id !== t.id));
  }

  return (
    <div className="px-4 pb-24 pt-5 lg:px-8 lg:pb-10 lg:pt-7">
      <h1 className="text-[22px] font-semibold tracking-tight text-[#0b1f3a] lg:text-2xl">{T("title")}</h1>
      <p className="mt-0.5 text-[13.5px] text-slate-500">{T("intro")}</p>

      <div className="mt-6 grid max-w-[920px] gap-5">
        <section className={`${card} divide-y divide-slate-100 px-5`}>
          <Switch on={s.tech_can_see_prices} onChange={(v) => patch({ tech_can_see_prices: v })} label={T("prices")}
            text={T("pricesText")} />
          <Switch on={s.require_gps_on_start} onChange={(v) => patch({ require_gps_on_start: v })} label={T("gps")}
            text={T("gpsText")} />
          <Switch on={s.track_location !== false} onChange={(v) => patch({ track_location: v })} label={T("live")}
            text={T("liveText")} />
          <Switch on={s.auto_clock_in} onChange={(v) => patch({ auto_clock_in: v })} label={T("autoClock")}
            text={T("autoClockText")} />
        </section>

        <section className={`${card} px-5 pt-4`}>
          <h2 className="text-[16px] font-semibold text-[#0b1f3a]">{T("notifications")}</h2>
          <div className="divide-y divide-slate-100">
            <Switch on={s.notify_tech_assign} onChange={(v) => patch({ notify_tech_assign: v })} label={T("nAssign")}
              text={T("nAssignText")} />
            <Switch on={s.notify_tech_agenda} onChange={(v) => patch({ notify_tech_agenda: v })} label={T("nAgenda")}
              text={T("nAgendaText")} />
            <div className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span><span className="block text-[15px] font-medium text-[#0b1f3a]">{T("timeChanges")}</span><span className="block text-[13px] text-slate-500">{T("timeChangesText")}</span></span>
              <div className="w-56"><SelectMenu value={s.notify_customer} ariaLabel={T("custNotif")}
                options={[{ value: "ask", label: T("askEvery") }, { value: "always", label: T("always") }, { value: "never", label: T("neverN") }]}
                onChange={(v) => patch({ notify_customer: v as JobSettings["notify_customer"] })} /></div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span><span className="block text-[15px] font-medium text-[#0b1f3a]">{T("tzLabel")}</span><span className="block text-[13px] text-slate-500">{T("tzText")}</span></span>
              <div className="w-56"><SelectMenu value={s.timezone} ariaLabel={T("tzLabel")}
                options={[["America/Chicago", "chicago"], ["America/New_York", "ny"], ["America/Denver", "denver"], ["America/Phoenix", "phoenix"], ["America/Los_Angeles", "la"], ["America/Anchorage", "anchorage"], ["Pacific/Honolulu", "hawaii"], ["America/Mexico_City", "mx"], ["America/Puerto_Rico", "pr"]].map(([value, k]) => ({ value, label: T(`tz.${k}` as never) }))}
                onChange={(v) => patch({ timezone: v })} /></div>
            </div>
          </div>
        </section>

        {/* Paso 5.8: avisos al cliente (va en camino, recordatorio, reseña en Google) */}
        <CustomerNoticeSettings s={s} patch={patch} />

        <section className={`${card} p-5`}>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef0ff] text-[#4f46e5]">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
            </span>
            <div>
              <h2 className="text-[16px] font-semibold text-[#0b1f3a]">{T("hours")}</h2>
              <p className="text-[13px] text-slate-500">{T("hoursText")}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-slate-600">{T("open")}</span>
              <SelectMenu value={s.day_start} options={HOURS.slice(0, 24)} onChange={(v) => patch({ day_start: v })} /></label>
            <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-slate-600">{T("close")}</span>
              <SelectMenu value={s.day_end} options={HOURS.slice(1).map((h) => (h.label === T("midnight") ? { value: "23:59", label: T("midnight") } : h))} onChange={(v) => patch({ day_end: v })} /></label>
          </div>
          <p className="mb-1.5 mt-4 text-[13px] font-medium text-slate-600">{T("days")}</p>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d, i) => {
              const on = (s.business_days ?? []).includes(i);
              return (
                <button key={d} type="button" onClick={() => { const next = on ? s.business_days.filter((x) => x !== i) : [...s.business_days, i].sort(); if (next.length) patch({ business_days: next }); }}
                  className={`h-10 min-w-[3.25rem] rounded-xl border px-3 text-[14px] font-semibold transition-all ${on ? "border-[#0f766e] bg-[#e9f7f4] text-[#0f766e]" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>{d}</button>
              );
            })}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-slate-600">{T("calFrom")}</span>
              <SelectMenu value={s.cal_start} options={HOURS.slice(0, 13)} onChange={(v) => patch({ cal_start: v })} />
              <span className="mt-1 block text-[12px] text-slate-400">{T("calFromHint")}</span></label>
            <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-slate-600">{T("calTo")}</span>
              <SelectMenu value={s.cal_end} options={HOURS.slice(12).map((h) => (h.label === T("midnight") ? { value: "23:59", label: T("midnight24") } : h))} onChange={(v) => patch({ cal_end: v })} />
              <span className="mt-1 block text-[12px] text-slate-400">{T("calToHint")}</span></label>
            <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-slate-600">{T("fee")}</span>
              <SelectMenu value={s.after_hours_fee_type} options={[{ value: "percent", label: T("pctJob") }, { value: "flat", label: T("flat") }]} onChange={(v) => patch({ after_hours_fee_type: v as JobSettings["after_hours_fee_type"] })} /></label>
            <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-slate-600">{s.after_hours_fee_type === "percent" ? T("extraPct") : T("extraAmt")}</span>
              <div className="relative">
                {s.after_hours_fee_type === "flat" && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>}
                <input key={`${s.after_hours_fee_type}-${s.after_hours_fee}`} inputMode="decimal" defaultValue={s.after_hours_fee ? String(s.after_hours_fee) : ""} placeholder={s.after_hours_fee_type === "percent" ? T("eg25") : T("eg75")}
                  onBlur={(e) => { const v = Number(e.target.value.replace(/[^\d.]/g, "") || 0); if (Number.isFinite(v) && v !== Number(s.after_hours_fee)) patch({ after_hours_fee: v }); }}
                  className={`${inputClass} ${s.after_hours_fee_type === "flat" ? "pl-7" : "pr-8"}`} />
                {s.after_hours_fee_type === "percent" && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>}
              </div>
              <span className="mt-1 block text-[12px] text-slate-400">{T("feeEmpty")}</span></label>
          </div>
        </section>

        <section className={`${card} p-5`}>
          <h2 className="text-[16px] font-semibold text-[#0b1f3a]">{T("calendar")}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-slate-600">{T("snap")}</span>
              <SelectMenu value={String(s.slot_minutes)} options={[{ value: "15", label: T("s15") }, { value: "30", label: T("s30") }, { value: "60", label: T("s60") }]} onChange={(v) => patch({ slot_minutes: Number(v) as 15 | 30 | 60 })} /></label>
            <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-slate-600">{T("weekStart")}</span>
              <SelectMenu value={String(s.week_starts_on)} options={[{ value: "0", label: T("sunday") }, { value: "1", label: T("monday") }]} onChange={(v) => patch({ week_starts_on: Number(v) })} /></label>
            <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-slate-600">{T("defLen")}</span>
              <SelectMenu value={String(s.default_duration_min)} options={DURS} onChange={(v) => patch({ default_duration_min: Number(v) })} /></label>
            <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-slate-600">{T("defArrival")}</span>
              <SelectMenu value={String(s.default_arrival_window_min)} options={ARRIVAL_WINDOWS.map((m) => ({ value: String(m), label: arrivalLabel(m) }))} onChange={(v) => patch({ default_arrival_window_min: Number(v) })} /></label>
            <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-slate-600">{T("prefix")}</span>
              <input defaultValue={s.job_prefix} maxLength={8} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.job_prefix) patch({ job_prefix: v }); }} className={inputClass} />
              <span className="mt-1 block text-[12px] text-slate-400">{T("nextJob", { n: `${s.job_prefix}${String(s.job_next).padStart(6, "0")}` })}</span></label>
          </div>
        </section>

        <section className={`${card} p-5`}>
          <h2 className="text-[16px] font-semibold text-[#0b1f3a]">{T("techColors")}</h2>
          <p className="text-[13px] text-slate-500">{T("techColorsText")}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {team.filter(receivesJobs).length === 0 && <p className="text-[13.5px] text-slate-500">{T("noCollabs")}</p>}
            {team.filter(receivesJobs).map((m) => (
              <div key={m.user_id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2">
                <TechDot t={m} size={32} ring={false} />
                <span className="min-w-0 flex-1"><span className="block truncate text-[14.5px] font-medium text-[#0b1f3a]">{m.full_name}</span><span className="text-[12px] capitalize text-slate-500">{tr.has(m.role as never) ? tr(m.role as never) : m.role}</span></span>
                <Swatch value={m.color} onChange={(c) => setColor(m, c)} />
              </div>
            ))}
          </div>
        </section>

        <section className={`${card} p-5`}>
          <h2 className="text-[16px] font-semibold text-[#0b1f3a]">{T("types")}</h2>
          <p className="text-[13px] text-slate-500">{T("typesText")}</p>
          <div className="mt-4 space-y-2">
            {types.map((t) => (
              <div key={t.id} className={`flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 ${t.is_active ? "" : "opacity-60"}`}>
                <Swatch value={t.color} onChange={(c) => saveType(t.id, { color: c })} />
                <input defaultValue={t.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== t.name) saveType(t.id, { name: v }); }} className="min-w-[8rem] flex-1 rounded-lg px-2 py-1.5 text-[14.5px] font-medium text-[#0b1f3a] hover:bg-slate-50 focus:bg-slate-50 focus:outline-none" />
                <div className="w-28"><SelectMenu value={String(t.default_duration_min)} ariaLabel={T("length")} options={DURS} onChange={(v) => saveType(t.id, { default_duration_min: Number(v) })} /></div>
                <div className="w-36"><SelectMenu value={t.form_kind} ariaLabel={T("form")} options={[{ value: "work", label: T("workForm") }, { value: "tune_up", label: T("tuneForm") }]} onChange={(v) => saveType(t.id, { form_kind: v as JobType["form_kind"] })} /></div>
                <button type="button" onClick={() => saveType(t.id, { is_active: !t.is_active })} className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-slate-500 hover:bg-slate-100">{t.is_active ? T("hide") : T("show")}</button>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <input value={newType} onChange={(e) => setNewType(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addType(); } }} placeholder={T("newTypePh")} className={inputClass} />
              <button type="button" onClick={addType} className="shrink-0 rounded-lg bg-[#0f766e] px-4 text-[14px] font-semibold text-white hover:bg-[#0c5f59]">{tc("add")}</button>
            </div>
          </div>
        </section>

        {/* Paso 5.4: fases con peso por tipo de trabajo */}
        <PhaseTemplates types={types} onSaved={(m, err) => say(m, err)} />

        {/* Paso 5.5: rangos del Tune-Up (lo que sale en rojo) */}
        <TuneUpRanges value={s.tuneup_ranges} onSave={(r) => patch({ tuneup_ranges: r })} />

        <section className={`${card} p-5`}>
          <h2 className="text-[16px] font-semibold text-[#0b1f3a]">{T("tags")}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((t) => (
              <span key={t.id} className="group flex items-center gap-1.5 rounded-full py-1 pl-1.5 pr-1 text-[13px] font-semibold" style={{ background: `${t.color}18`, color: t.color }}>
                <Swatch value={t.color} onChange={async (c) => { setTags((l) => l.map((x) => (x.id === t.id ? { ...x, color: c } : x))); await sb.from("job_tags").update({ color: c }).eq("id", t.id); }} />
                {t.name}
                <button type="button" onClick={() => delTag(t)} aria-label={T("deleteX", { name: t.name })} className="flex h-5 w-5 items-center justify-center rounded-full opacity-50 transition-all hover:rotate-90 hover:bg-white hover:opacity-100">
                  <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 5l10 10M15 5 5 15" /></svg>
                </button>
              </span>
            ))}
          </div>
          <div className="mt-3 flex max-w-md gap-2">
            <input value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} maxLength={30} placeholder={T("newTag")} className={inputClass} />
            <button type="button" onClick={addTag} className="shrink-0 rounded-lg bg-[#0f766e] px-4 text-[14px] font-semibold text-white hover:bg-[#0c5f59]">{tc("add")}</button>
          </div>
        </section>

        <section className={`${card} p-5`}>
          <h2 className="text-[16px] font-semibold text-[#0b1f3a]">{T("checklists")}</h2>
          <p className="text-[13px] text-slate-500">{T("checklistsText")}</p>
          <div className="mt-3 space-y-2">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2">
                <span className="min-w-0 flex-1"><span className="block truncate text-[14.5px] font-medium text-[#0b1f3a]">{t.name}</span><span className="text-[12px] text-slate-500">{T("tasks", { n: t.items.length })}</span></span>
                <button type="button" onClick={() => setTplDraft({ id: t.id, name: t.name, items: t.items.map((i) => `${i.required === false ? "* " : ""}${i.label}`).join("\n") })} className="rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-[#0f766e] hover:bg-[#f3fbf8]">{tc("edit")}</button>
                <button type="button" onClick={() => delTemplate(t)} className="rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-red-600 hover:bg-red-50">{tc("delete")}</button>
              </div>
            ))}
            {tplDraft ? (
              <div className="rounded-xl border border-[#bfe7de] bg-[#f6fbfa] p-3.5">
                <input autoFocus value={tplDraft.name} onChange={(e) => setTplDraft({ ...tplDraft, name: e.target.value })} placeholder={T("tplName")} className={inputClass} />
                <textarea value={tplDraft.items} onChange={(e) => setTplDraft({ ...tplDraft, items: e.target.value })} rows={5} placeholder={T("tplItems")} className={`${inputClass} mt-2 resize-y`} />
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={saveTemplate} className="rounded-lg bg-[#0f766e] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#0c5f59]">{T("saveTpl")}</button>
                  <button type="button" onClick={() => setTplDraft(null)} className="rounded-lg px-3 py-2 text-[14px] font-medium text-slate-500 hover:bg-white">{tc("cancel")}</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setTplDraft({ name: "", items: "" })} className="rounded-lg border border-dashed border-slate-300 px-4 py-2 text-[14px] font-semibold text-[#0f766e] hover:border-[#0f766e] hover:bg-[#f3fbf8]">{T("newTpl")}</button>
            )}
          </div>
        </section>
      </div>

      {msg && <div role="status" className={`fixed bottom-5 left-1/2 z-[95] -translate-x-1/2 rounded-xl px-4 py-2.5 text-[13.5px] font-medium text-white shadow-lg animate-[bp-pop-in_0.2s_ease-out] ${msg.error ? "bg-[#be123c]" : "bg-[#0b1f3a]"}`}>{msg.text}</div>}
    </div>
  );
}
