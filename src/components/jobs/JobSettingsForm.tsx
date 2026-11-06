"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { createClient } from "@/lib/supabase/client";
import { inputClass } from "@/components/customers/ui";
import SelectMenu from "@/components/ui/SelectMenu";
import ColorPicker from "@/components/ui/ColorPicker";
import { confirmDelete } from "@/lib/confirm";
import { TechDot } from "@/components/jobs/EventBar";
import { ChecklistTemplate, JobSettings, JobTag, JobType, TECH_COLORS, TeamMember, arrivalLabel, ARRIVAL_WINDOWS, durationLabel, fmtHour, jobError, receivesJobs } from "@/lib/jobs";

const card = "rounded-2xl border border-slate-200 bg-white";
const HOURS = Array.from({ length: 25 }, (_, h) => ({ value: `${String(h % 24).padStart(2, "0")}:00`, label: h === 24 ? "Midnight" : fmtHour(h * 60) }));
const DURS = [30, 45, 60, 90, 120, 180, 240, 360, 480].map((m) => ({ value: String(m), label: durationLabel(m) }));

function Switch({ on, onChange, label, text }: { on: boolean; onChange: (v: boolean) => void; label: string; text: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span><span className="block text-[15px] font-medium text-[#0b1f3a]">{label}</span><span className="block text-[13px] text-slate-500">{text}</span></span>
      <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-[#0f766e]" : "bg-slate-300"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-[1.375rem]" : "translate-x-0.5"}`} />
      </button>
    </label>
  );
}

function Swatch({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  // El color propio se guarda cuando dejas de moverlo (no en cada movimiento)
  const t = useRef<ReturnType<typeof setTimeout>>();
  const [live, setLive] = useState(value);
  useEffect(() => setLive(value), [value]);
  const custom = (c: string) => { setLive(c); clearTimeout(t.current); t.current = setTimeout(() => onChange(c), 450); };
  return (
    <Popover className="relative">
      <PopoverButton aria-label="Change color" className="h-7 w-7 rounded-full ring-2 ring-white transition-transform hover:scale-110 focus:outline-none" style={{ background: live, boxShadow: `0 0 0 1px ${live}55` }} />
      <PopoverPanel anchor="bottom start" transition className="z-[100] mt-1 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_12px_40px_rgba(15,40,60,0.18)] transition data-[closed]:scale-95 data-[closed]:opacity-0">
        {({ close }) => (
          <>
            <div className="grid grid-cols-6 gap-2.5">
              {TECH_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => { onChange(c); close(); }} aria-label={c}
                  className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${c.toLowerCase() === value.toLowerCase() ? "ring-2 ring-offset-2" : ""}`} style={{ background: c, ["--tw-ring-color" as string]: c }} />
              ))}
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3"><ColorPicker label="Custom color" value={live} onChange={custom} /></div>
          </>
        )}
      </PopoverPanel>
    </Popover>
  );
}

export default function JobSettingsForm({ companyId, settings, types: t0, tags: g0, team: m0, templates: c0 }: {
  companyId: string; settings: JobSettings; types: JobType[]; tags: JobTag[]; team: TeamMember[]; templates: ChecklistTemplate[];
}) {
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
    if (error) { setS(s); say(jobError(error), true); } else { say("Saved"); router.refresh(); }
  }
  async function saveType(id: string, p: Partial<JobType>) {
    setTypes((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)));
    const { error } = await sb.from("job_types").update(p).eq("id", id);
    if (error) say(jobError(error), true); else say("Saved");
  }
  async function addType() {
    const name = newType.trim(); if (!name) return;
    const { data, error } = await sb.from("job_types").insert({ company_id: companyId, name, color: TECH_COLORS[types.length % TECH_COLORS.length], position: types.length, default_duration_min: s.default_duration_min })
      .select("id, name, color, default_duration_min, form_kind, position, is_active").single();
    if (error || !data) return say(jobError(error), true);
    setTypes((l) => [...l, data as JobType]); setNewType(""); say("Job type added");
  }
  async function addTag() {
    const name = newTag.trim(); if (!name) return;
    const { data, error } = await sb.from("job_tags").insert({ company_id: companyId, name, color: TECH_COLORS[(tags.length + 3) % TECH_COLORS.length] }).select("id, name, color").single();
    if (error || !data) return say(jobError(error), true);
    setTags((l) => [...l, data as JobTag]); setNewTag(""); say("Tag added");
  }
  async function delTag(t: JobTag) {
    if (!(await confirmDelete({ title: `Delete the tag "${t.name}"?`, message: "It's removed from every job that has it." }))) return;
    const { error } = await sb.from("job_tags").delete().eq("id", t.id);
    if (error) return say(jobError(error), true);
    setTags((l) => l.filter((x) => x.id !== t.id));
  }
  async function setColor(m: TeamMember, color: string) {
    setTeam((l) => l.map((x) => (x.user_id === m.user_id ? { ...x, color } : x)));
    const { error } = await sb.rpc("job_set_color", { p_company: companyId, p_user: m.user_id, p_color: color });
    if (error) say(jobError(error), true); else say("Color saved");
  }
  async function saveTemplate() {
    if (!tplDraft) return;
    const items = tplDraft.items.split("\n").map((l) => l.trim()).filter(Boolean).map((label) => ({ label: label.replace(/^\*\s*/, ""), required: !label.startsWith("*") }));
    if (!tplDraft.name.trim() || !items.length) return say("Give it a name and at least one task.", true);
    const row = { company_id: companyId, name: tplDraft.name.trim(), items };
    const { data, error } = tplDraft.id
      ? await sb.from("job_checklist_templates").update(row).eq("id", tplDraft.id).select("id, name, job_type_id, items").single()
      : await sb.from("job_checklist_templates").insert(row).select("id, name, job_type_id, items").single();
    if (error || !data) return say(jobError(error), true);
    setTemplates((l) => (tplDraft.id ? l.map((x) => (x.id === tplDraft.id ? (data as ChecklistTemplate) : x)) : [...l, data as ChecklistTemplate]));
    setTplDraft(null); say("Checklist saved");
  }
  async function delTemplate(t: ChecklistTemplate) {
    if (!(await confirmDelete({ title: `Delete the checklist "${t.name}"?`, message: "Jobs that already used it keep their tasks." }))) return;
    await sb.from("job_checklist_templates").delete().eq("id", t.id);
    setTemplates((l) => l.filter((x) => x.id !== t.id));
  }

  return (
    <div className="px-4 pb-24 pt-5 lg:px-8 lg:pb-10 lg:pt-7">
      <h1 className="text-[22px] font-semibold tracking-tight text-[#0b1f3a] lg:text-2xl">Jobs settings</h1>
      <p className="mt-0.5 text-[13.5px] text-slate-500">How the schedule looks and what technicians can see and do.</p>

      <div className="mt-6 grid max-w-[920px] gap-5">
        <section className={`${card} divide-y divide-slate-100 px-5`}>
          <Switch on={s.tech_can_see_prices} onChange={(v) => patch({ tech_can_see_prices: v })} label="Technicians can see prices"
            text="On: they can quote and collect on site. Off: they only see names and quantities, never amounts." />
          <Switch on={s.require_gps_on_start} onChange={(v) => patch({ require_gps_on_start: v })} label="Require location to start a job"
            text="The start of every job saves where the technician was." />
          <Switch on={s.auto_clock_in} onChange={(v) => patch({ auto_clock_in: v })} label="Clock in automatically"
            text="Tapping On my way clocks the technician in for the day if they forgot." />
        </section>

        <section className={`${card} px-5 pt-4`}>
          <h2 className="text-[16px] font-semibold text-[#0b1f3a]">Notifications</h2>
          <div className="divide-y divide-slate-100">
            <Switch on={s.notify_tech_assign} onChange={(v) => patch({ notify_tech_assign: v })} label="Tell technicians about new jobs"
              text="When a job is assigned or moved, the technician gets an alert on the phone, in the app and by email." />
            <Switch on={s.notify_tech_agenda} onChange={(v) => patch({ notify_tech_agenda: v })} label="Send tomorrow's schedule every evening"
              text="Around 6 PM each technician gets the list of tomorrow's jobs (app alert and email)." />
            <div className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span><span className="block text-[15px] font-medium text-[#0b1f3a]">When a job's time changes</span><span className="block text-[13px] text-slate-500">Email the customer with the new date and arrival window.</span></span>
              <div className="w-56"><SelectMenu value={s.notify_customer} ariaLabel="Customer notification"
                options={[{ value: "ask", label: "Ask me every time" }, { value: "always", label: "Always notify" }, { value: "never", label: "Never notify" }]}
                onChange={(v) => patch({ notify_customer: v as JobSettings["notify_customer"] })} /></div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span><span className="block text-[15px] font-medium text-[#0b1f3a]">Time zone</span><span className="block text-[13px] text-slate-500">Used for the times in emails and the evening schedule.</span></span>
              <div className="w-56"><SelectMenu value={s.timezone} ariaLabel="Time zone"
                options={[["America/Chicago", "Central (Dallas)"], ["America/New_York", "Eastern"], ["America/Denver", "Mountain"], ["America/Phoenix", "Arizona"], ["America/Los_Angeles", "Pacific"], ["America/Anchorage", "Alaska"], ["Pacific/Honolulu", "Hawaii"], ["America/Mexico_City", "Mexico City"], ["America/Puerto_Rico", "Puerto Rico"]].map(([value, label]) => ({ value, label }))}
                onChange={(v) => patch({ timezone: v })} /></div>
            </div>
          </div>
        </section>

        <section className={`${card} p-5`}>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef0ff] text-[#4f46e5]">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
            </span>
            <div>
              <h2 className="text-[16px] font-semibold text-[#0b1f3a]">Business hours &amp; after hours</h2>
              <p className="text-[13px] text-slate-500">Jobs outside your business hours are marked with a moon 🌙. You get a notice and decide if you charge the after-hours fee — it&apos;s never added on its own.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-slate-600">Business hours open</span>
              <SelectMenu value={s.day_start} options={HOURS.slice(0, 24)} onChange={(v) => patch({ day_start: v })} /></label>
            <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-slate-600">Business hours close</span>
              <SelectMenu value={s.day_end} options={HOURS.slice(1).map((h) => (h.label === "Midnight" ? { value: "23:59", label: "Midnight" } : h))} onChange={(v) => patch({ day_end: v })} /></label>
          </div>
          <p className="mb-1.5 mt-4 text-[13px] font-medium text-slate-600">Business days</p>
          <div className="flex flex-wrap gap-1.5">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => {
              const on = (s.business_days ?? []).includes(i);
              return (
                <button key={d} type="button" onClick={() => { const next = on ? s.business_days.filter((x) => x !== i) : [...s.business_days, i].sort(); if (next.length) patch({ business_days: next }); }}
                  className={`h-10 min-w-[3.25rem] rounded-xl border px-3 text-[14px] font-semibold transition-all ${on ? "border-[#0f766e] bg-[#e9f7f4] text-[#0f766e]" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>{d}</button>
              );
            })}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-slate-600">Calendar shows from</span>
              <SelectMenu value={s.cal_start} options={HOURS.slice(0, 13)} onChange={(v) => patch({ cal_start: v })} />
              <span className="mt-1 block text-[12px] text-slate-400">Early hours for emergencies (e.g. 5 AM).</span></label>
            <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-slate-600">Calendar shows until</span>
              <SelectMenu value={s.cal_end} options={HOURS.slice(12).map((h) => (h.label === "Midnight" ? { value: "23:59", label: "Midnight (24 hours)" } : h))} onChange={(v) => patch({ cal_end: v })} />
              <span className="mt-1 block text-[12px] text-slate-400">Late hours for emergencies (e.g. 11 PM).</span></label>
            <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-slate-600">After-hours fee</span>
              <SelectMenu value={s.after_hours_fee_type} options={[{ value: "percent", label: "Percent of the job" }, { value: "flat", label: "Flat amount" }]} onChange={(v) => patch({ after_hours_fee_type: v as JobSettings["after_hours_fee_type"] })} /></label>
            <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-slate-600">{s.after_hours_fee_type === "percent" ? "Extra %" : "Extra amount"}</span>
              <div className="relative">
                {s.after_hours_fee_type === "flat" && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>}
                <input key={`${s.after_hours_fee_type}-${s.after_hours_fee}`} inputMode="decimal" defaultValue={s.after_hours_fee ? String(s.after_hours_fee) : ""} placeholder={s.after_hours_fee_type === "percent" ? "e.g. 25" : "e.g. 75.00"}
                  onBlur={(e) => { const v = Number(e.target.value.replace(/[^\d.]/g, "") || 0); if (Number.isFinite(v) && v !== Number(s.after_hours_fee)) patch({ after_hours_fee: v }); }}
                  className={`${inputClass} ${s.after_hours_fee_type === "flat" ? "pl-7" : "pr-8"}`} />
                {s.after_hours_fee_type === "percent" && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>}
              </div>
              <span className="mt-1 block text-[12px] text-slate-400">Leave empty if you set the price each time.</span></label>
          </div>
        </section>

        <section className={`${card} p-5`}>
          <h2 className="text-[16px] font-semibold text-[#0b1f3a]">Calendar</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-slate-600">Snap when dragging</span>
              <SelectMenu value={String(s.slot_minutes)} options={[{ value: "15", label: "Every 15 minutes" }, { value: "30", label: "Every 30 minutes" }, { value: "60", label: "Every hour" }]} onChange={(v) => patch({ slot_minutes: Number(v) as 15 | 30 | 60 })} /></label>
            <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-slate-600">Week starts on</span>
              <SelectMenu value={String(s.week_starts_on)} options={[{ value: "0", label: "Sunday" }, { value: "1", label: "Monday" }]} onChange={(v) => patch({ week_starts_on: Number(v) })} /></label>
            <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-slate-600">Default job length</span>
              <SelectMenu value={String(s.default_duration_min)} options={DURS} onChange={(v) => patch({ default_duration_min: Number(v) })} /></label>
            <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-slate-600">Default arrival window</span>
              <SelectMenu value={String(s.default_arrival_window_min)} options={ARRIVAL_WINDOWS.map((m) => ({ value: String(m), label: arrivalLabel(m) }))} onChange={(v) => patch({ default_arrival_window_min: Number(v) })} /></label>
            <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-slate-600">Job number prefix</span>
              <input defaultValue={s.job_prefix} maxLength={8} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.job_prefix) patch({ job_prefix: v }); }} className={inputClass} />
              <span className="mt-1 block text-[12px] text-slate-400">Next job: {s.job_prefix}{String(s.job_next).padStart(6, "0")}</span></label>
          </div>
        </section>

        <section className={`${card} p-5`}>
          <h2 className="text-[16px] font-semibold text-[#0b1f3a]">Technician colors</h2>
          <p className="text-[13px] text-slate-500">With &quot;Color by: Technician&quot;, each job bar uses the color of its lead technician.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {team.filter(receivesJobs).length === 0 && <p className="text-[13.5px] text-slate-500">No collaborators yet. Invite technicians in Team, or turn on “Can receive jobs” for someone.</p>}
            {team.filter(receivesJobs).map((m) => (
              <div key={m.user_id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2">
                <TechDot t={m} size={32} ring={false} />
                <span className="min-w-0 flex-1"><span className="block truncate text-[14.5px] font-medium text-[#0b1f3a]">{m.full_name}</span><span className="text-[12px] capitalize text-slate-500">{m.role}</span></span>
                <Swatch value={m.color} onChange={(c) => setColor(m, c)} />
              </div>
            ))}
          </div>
        </section>

        <section className={`${card} p-5`}>
          <h2 className="text-[16px] font-semibold text-[#0b1f3a]">Job types</h2>
          <p className="text-[13px] text-slate-500">Types with the Tune-Up form open the electrical readings checklist for the technician.</p>
          <div className="mt-4 space-y-2">
            {types.map((t) => (
              <div key={t.id} className={`flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 ${t.is_active ? "" : "opacity-60"}`}>
                <Swatch value={t.color} onChange={(c) => saveType(t.id, { color: c })} />
                <input defaultValue={t.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== t.name) saveType(t.id, { name: v }); }} className="min-w-[8rem] flex-1 rounded-lg px-2 py-1.5 text-[14.5px] font-medium text-[#0b1f3a] hover:bg-slate-50 focus:bg-slate-50 focus:outline-none" />
                <div className="w-28"><SelectMenu value={String(t.default_duration_min)} ariaLabel="Length" options={DURS} onChange={(v) => saveType(t.id, { default_duration_min: Number(v) })} /></div>
                <div className="w-36"><SelectMenu value={t.form_kind} ariaLabel="Form" options={[{ value: "work", label: "Work form" }, { value: "tune_up", label: "Tune-Up form" }]} onChange={(v) => saveType(t.id, { form_kind: v as JobType["form_kind"] })} /></div>
                <button type="button" onClick={() => saveType(t.id, { is_active: !t.is_active })} className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-slate-500 hover:bg-slate-100">{t.is_active ? "Hide" : "Show"}</button>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <input value={newType} onChange={(e) => setNewType(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addType(); } }} placeholder="New job type, e.g. Duct cleaning" className={inputClass} />
              <button type="button" onClick={addType} className="shrink-0 rounded-lg bg-[#0f766e] px-4 text-[14px] font-semibold text-white hover:bg-[#0c5f59]">Add</button>
            </div>
          </div>
        </section>

        <section className={`${card} p-5`}>
          <h2 className="text-[16px] font-semibold text-[#0b1f3a]">Tags</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((t) => (
              <span key={t.id} className="group flex items-center gap-1.5 rounded-full py-1 pl-1.5 pr-1 text-[13px] font-semibold" style={{ background: `${t.color}18`, color: t.color }}>
                <Swatch value={t.color} onChange={async (c) => { setTags((l) => l.map((x) => (x.id === t.id ? { ...x, color: c } : x))); await sb.from("job_tags").update({ color: c }).eq("id", t.id); }} />
                {t.name}
                <button type="button" onClick={() => delTag(t)} aria-label={`Delete ${t.name}`} className="flex h-5 w-5 items-center justify-center rounded-full opacity-50 transition-all hover:rotate-90 hover:bg-white hover:opacity-100">
                  <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 5l10 10M15 5 5 15" /></svg>
                </button>
              </span>
            ))}
          </div>
          <div className="mt-3 flex max-w-md gap-2">
            <input value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} maxLength={30} placeholder="New tag" className={inputClass} />
            <button type="button" onClick={addTag} className="shrink-0 rounded-lg bg-[#0f766e] px-4 text-[14px] font-semibold text-white hover:bg-[#0c5f59]">Add</button>
          </div>
        </section>

        <section className={`${card} p-5`}>
          <h2 className="text-[16px] font-semibold text-[#0b1f3a]">Saved checklists</h2>
          <p className="text-[13px] text-slate-500">Reuse the same tasks on new jobs (for example, a cleaning checklist or a safety walk-through).</p>
          <div className="mt-3 space-y-2">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2">
                <span className="min-w-0 flex-1"><span className="block truncate text-[14.5px] font-medium text-[#0b1f3a]">{t.name}</span><span className="text-[12px] text-slate-500">{t.items.length} task{t.items.length === 1 ? "" : "s"}</span></span>
                <button type="button" onClick={() => setTplDraft({ id: t.id, name: t.name, items: t.items.map((i) => `${i.required === false ? "* " : ""}${i.label}`).join("\n") })} className="rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-[#0f766e] hover:bg-[#f3fbf8]">Edit</button>
                <button type="button" onClick={() => delTemplate(t)} className="rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-red-600 hover:bg-red-50">Delete</button>
              </div>
            ))}
            {tplDraft ? (
              <div className="rounded-xl border border-[#bfe7de] bg-[#f6fbfa] p-3.5">
                <input autoFocus value={tplDraft.name} onChange={(e) => setTplDraft({ ...tplDraft, name: e.target.value })} placeholder="Checklist name" className={inputClass} />
                <textarea value={tplDraft.items} onChange={(e) => setTplDraft({ ...tplDraft, items: e.target.value })} rows={5} placeholder={"One task per line\n* Start a line with * to make it optional"} className={`${inputClass} mt-2 resize-y`} />
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={saveTemplate} className="rounded-lg bg-[#0f766e] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#0c5f59]">Save checklist</button>
                  <button type="button" onClick={() => setTplDraft(null)} className="rounded-lg px-3 py-2 text-[14px] font-medium text-slate-500 hover:bg-white">Cancel</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setTplDraft({ name: "", items: "" })} className="rounded-lg border border-dashed border-slate-300 px-4 py-2 text-[14px] font-semibold text-[#0f766e] hover:border-[#0f766e] hover:bg-[#f3fbf8]">+ New checklist</button>
            )}
          </div>
        </section>
      </div>

      {msg && <div role="status" className={`fixed bottom-5 left-1/2 z-[95] -translate-x-1/2 rounded-xl px-4 py-2.5 text-[13.5px] font-medium text-white shadow-lg animate-[bp-pop-in_0.2s_ease-out] ${msg.error ? "bg-[#be123c]" : "bg-[#0b1f3a]"}`}>{msg.text}</div>}
    </div>
  );
}
