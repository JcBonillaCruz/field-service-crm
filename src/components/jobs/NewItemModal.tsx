"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { askConfirm } from "@/lib/confirm";
import { inputClass } from "@/components/customers/ui";
import SelectMenu from "@/components/ui/SelectMenu";
import DatePicker from "@/components/ui/DatePicker";
import PayerPicker from "@/components/expenses/PayerPicker";
import type { PayerOption } from "@/components/expenses/ExpensesWorkspace";
import JobForm from "@/components/jobs/JobForm";
import { TechDot } from "@/components/jobs/EventBar";
import { useJobsTx } from "@/i18n/useJobsTx";
import {
  CalVisit, ChecklistTemplate, JobSettings, JobTag, JobType, TeamMember,
  addDays, atMinute, dayStart, fromIsoDay, isoDay, minutesOf, receivesJobs,
} from "@/lib/jobs";
import { OFF_COLOR, OFF_KINDS, OffKind, TimeOff, lastDay, overlaps } from "@/lib/time-off";

// =====================================================================
// Paso 6.5 — Modal grande con fondo gris (al arrastrar en el calendario o con "+ New job")
// Pestañas: Job (nuestro formulario de siempre, ya lleno) · Quote · Time off. Save / Cancel arriba.
// Abre al instante: todo lo que necesita ya viene cargado con el calendario.
// =====================================================================
export type NewTab = "job" | "quote" | "off";
export type NewSlot = { day: Date; startMin: number; endMin: number; techId: string | null; dragged: boolean };

const TIMES = Array.from({ length: 96 }, (_, i) => i * 15);

export default function NewItemModal({
  companyId, settings, types, tags, team, templates, customers, offs, visits, canQuote, offReady,
  slot, tab: tab0, editOff, onClose, onSaved,
}: {
  companyId: string; settings: JobSettings; types: JobType[]; tags: JobTag[]; team: TeamMember[]; templates: ChecklistTemplate[];
  customers: PayerOption[]; offs: TimeOff[]; visits: CalVisit[]; canQuote: boolean; offReady: boolean;
  slot: NewSlot; tab?: NewTab; editOff?: TimeOff | null;
  onClose: () => void; onSaved: (msg: string, date?: string) => void;
}) {
  const t = useTranslations("newItem");
  const tc = useTranslations("common");
  const jt = useJobsTx();
  const [tab, setTab] = useState<NewTab>(editOff ? "off" : tab0 ?? "job");
  const [state, setState] = useState<Record<NewTab, { saving: boolean; error: string }>>({
    job: { saving: false, error: "" }, quote: { saving: false, error: "" }, off: { saving: false, error: "" },
  });
  const [custId, setCustId] = useState<string | null>(null);
  const setJobState = useCallback((s: { saving: boolean; error: string }) => setState((x) => ({ ...x, job: s })), []);
  const setOffState = useCallback((s: { saving: boolean; error: string }) => setState((x) => ({ ...x, off: s })), []);
  const setQuoteState = useCallback((s: { saving: boolean; error: string }) => setState((x) => ({ ...x, quote: s })), []);

  // Esc cierra (si un menú abierto no lo usó antes) · sin desplazar la página de atrás
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) onClose(); };
    window.addEventListener("keydown", esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = prev; };
  }, [onClose]);

  const s = atMinute(slot.day, slot.startMin), e = atMinute(slot.day, slot.endMin);
  const techName = slot.techId ? team.find((m) => m.user_id === slot.techId)?.full_name ?? null : null;
  const jobDefaults = useMemo(() => ({ start: s.toISOString(), end: e.toISOString(), tech: slot.techId ?? undefined }),
    [slot]); // eslint-disable-line react-hooks/exhaustive-deps

  const TABS: { id: NewTab; label: string }[] = editOff ? [{ id: "off", label: t("tabOff") }] : [
    { id: "job", label: t("tabJob") },
    ...(canQuote ? [{ id: "quote" as const, label: t("tabQuote") }] : []),
    { id: "off", label: t("tabOff") },
  ];
  const cur = state[tab];
  const saveLabel = tab === "job" ? t("createJob") : tab === "quote" ? t("toQuote") : editOff ? tc("saveChanges") : t("saveOff");

  return (
    <div className="fixed inset-0 z-[97] flex items-stretch justify-center bg-slate-900/45 backdrop-blur-[2px] animate-[bp-fade_0.15s_ease-out] sm:items-center sm:p-6"
      onPointerDown={(ev) => ev.stopPropagation()}>
      <div role="dialog" aria-modal="true" aria-labelledby="new-item-title"
        className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-[0_30px_80px_rgba(15,40,60,0.35)] animate-[bp-pop-in_0.18s_ease-out] sm:h-[min(92dvh,56rem)] sm:max-w-[68rem] sm:rounded-2xl">
        {/* Encabezado: título, cuándo/quién, Cancel y Save arriba */}
        <div className="shrink-0 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-3 px-4 pb-2 pt-3 sm:px-6 sm:pt-4">
            <div className="min-w-0 flex-1">
              <h2 id="new-item-title" className="truncate text-[19px] font-semibold tracking-tight text-[#0b1f3a] sm:text-[21px]">
                {editOff ? t("editOff") : t("title")}
              </h2>
              {!editOff && (
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-slate-500 sm:text-[13px]">
                  <span className="inline-flex items-center gap-1">
                    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-[#0f766e]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="14" height="13" rx="2" /><path d="M3 8h14M7 2.5v3M13 2.5v3" /></svg>
                    {jt.dayShort(s)} · {jt.time(s)} – {jt.time(e)}
                  </span>
                  {techName && <span className="inline-flex items-center gap-1">· {techName}</span>}
                </p>
              )}
            </div>
            <button type="button" onClick={onClose}
              className="hidden h-10 rounded-xl border border-slate-200 bg-white px-4 text-[14px] font-semibold text-slate-700 transition-all duration-150 hover:-translate-y-px hover:border-slate-300 hover:bg-slate-50 sm:inline-flex sm:items-center">{tc("cancel")}</button>
            <button type="submit" form={`new-${tab}`} disabled={cur.saving}
              className="hidden h-10 items-center gap-1.5 rounded-xl bg-[#0f766e] px-4 sm:inline-flex text-[14px] font-semibold text-white shadow-sm shadow-[#0f766e]/25 transition-all duration-150 hover:-translate-y-px hover:bg-[#0c5f59] hover:shadow-md disabled:translate-y-0 disabled:opacity-60 sm:px-5">
              {cur.saving ? tc("saving") : saveLabel}
            </button>
            <button type="button" onClick={onClose} aria-label={tc("close")}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 transition-all duration-150 hover:rotate-90 hover:bg-slate-100 hover:text-slate-800">
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9" /></svg>
            </button>
          </div>
          {cur.error && <p role="alert" className="mx-4 mb-2 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700 sm:mx-6">{cur.error}</p>}
          {/* Pestañas */}
          <div className="flex gap-1 overflow-x-auto px-3 sm:px-5" role="tablist">
            {TABS.map((x) => {
              const on = tab === x.id;
              return (
                <button key={x.id} type="button" role="tab" aria-selected={on} onClick={() => setTab(x.id)}
                  className={`group relative flex shrink-0 items-center gap-2 rounded-t-lg px-3 pb-2.5 pt-2 text-[14px] font-semibold transition-colors ${on ? "text-[#0b1f3a]" : "text-slate-500 hover:text-[#0b1f3a]"}`}>
                  <TabArt id={x.id} on={on} />
                  {x.label}
                  <span className={`absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-[#0f766e] transition-transform duration-200 ${on ? "scale-x-100" : "scale-x-0"}`} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Cuerpo: las pestañas se quedan montadas para no perder lo escrito al cambiar */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white">
          {!editOff && (
            <div hidden={tab !== "job"}>
              <JobForm companyId={companyId} settings={settings} types={types} tags={tags} team={team} templates={templates} customers={customers}
                defaults={jobDefaults}
                modal={{ formId: "new-job", onState: setJobState, onCustomer: setCustId, offs, onSaved: (date, scheduled) => onSaved(scheduled ? t("jobCreated") : t("jobUnscheduled"), date) }} />
            </div>
          )}
          {!editOff && canQuote && (
            <div hidden={tab !== "quote"}>
              <QuoteTab companyId={companyId} customers={customers} jobCustomer={custId} onState={setQuoteState} />
            </div>
          )}
          <div hidden={tab !== "off"}>
            <TimeOffForm companyId={companyId} team={team} slot={slot} offs={offs} visits={visits} editOff={editOff ?? null} ready={offReady}
              onState={setOffState} onSaved={(msg) => onSaved(msg)} />
          </div>
        </div>

        {/* Celular: Cancel abajo, al alcance del dedo */}
        <div className="flex shrink-0 gap-2 border-t border-slate-200 bg-white px-4 py-2.5 sm:hidden">
          <button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl border border-slate-200 text-[14.5px] font-semibold text-slate-700">{tc("cancel")}</button>
          <button type="submit" form={`new-${tab}`} disabled={cur.saving} className="h-11 flex-[2] rounded-xl bg-[#0f766e] text-[14.5px] font-semibold text-white disabled:opacity-60">
            {cur.saving ? tc("saving") : saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// Íconos ilustrados de las pestañas
function TabArt({ id, on }: { id: NewTab; on: boolean }) {
  const cls = `h-[22px] w-[22px] transition-transform duration-200 group-hover:-translate-y-px ${on ? "" : "opacity-70 grayscale-[35%]"}`;
  if (id === "job") return (
    <svg viewBox="0 0 24 24" className={cls} aria-hidden="true">
      <rect x="4" y="4" width="16" height="17" rx="3" fill="#d9f2ec" stroke="#0f766e" strokeWidth="1.5" />
      <rect x="8.5" y="2.5" width="7" height="4" rx="1.5" fill="#0f766e" />
      <path d="m8.5 13 2.3 2.3 4.7-4.8" fill="none" stroke="#0f766e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  if (id === "quote") return (
    <svg viewBox="0 0 24 24" className={cls} aria-hidden="true">
      <path d="M6 3h8.5L19 7.5V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="#fff1e8" stroke="#e8713a" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14.5 3v4.5H19" fill="none" stroke="#e8713a" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M11.5 10v7M13.4 11.5c-.4-.6-1.1-.9-1.9-.9-1 0-1.8.5-1.8 1.3 0 1.8 3.8.9 3.8 2.8 0 .8-.9 1.4-2 1.4-.9 0-1.7-.4-2-1" fill="none" stroke="#e8713a" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
  return (
    <svg viewBox="0 0 24 24" className={cls} aria-hidden="true">
      <circle cx="17" cy="6.5" r="3" fill="#fde68a" stroke="#f59e0b" strokeWidth="1.3" />
      <path d="M3 20.5h18" stroke="#0ea5e9" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9.5 20.5c.3-4.5 1.2-8 2.6-10.8" fill="none" stroke="#a16207" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12.1 9.7c-1.6-1.8-4.4-2-6.3-.6 2-.2 3.6.5 4.6 1.6M12.1 9.7c.4-2.3-.9-4.4-3-5.2 1.2 1.4 1.6 3.1 1.3 4.6M12.1 9.7c2-.9 4.4-.2 5.6 1.6-1.7-.6-3.4-.4-4.6.4" fill="#86efac" stroke="#16a34a" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

// ---------- Pestaña Quote: elige cliente y sigue en el editor completo de cotizaciones ----------
function QuoteTab({ companyId, customers: initial, jobCustomer, onState }: {
  companyId: string; customers: PayerOption[]; jobCustomer: string | null; onState: (s: { saving: boolean; error: string }) => void;
}) {
  const t = useTranslations("newItem");
  const router = useRouter();
  const [customers, setCustomers] = useState(initial);
  const [customerId, setCustomerId] = useState<string | null>(jobCustomer);
  const [typed, setTyped] = useState("");
  const [touched, setTouched] = useState(false);
  // Si ya elegiste cliente en la pestaña Job, aquí sale el mismo
  useEffect(() => { if (!touched) setCustomerId(jobCustomer); }, [jobCustomer, touched]);
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) { onState({ saving: false, error: t("eQuoteCustomer") }); return; }
    onState({ saving: true, error: "" });
    router.push(`/dashboard/quotes/new?customer=${customerId}`);
  }
  return (
    <form id="new-quote" onSubmit={submit} noValidate autoComplete="off" className="px-5 py-7 sm:px-8">
      <div className="grid max-w-[640px] gap-5">
        <div>
          <p className="mb-1.5 text-[14px] font-semibold text-[#0b1f3a]">{t("quoteCustomer")}</p>
          <PayerPicker companyId={companyId} people={customers} customerId={customerId} name={typed}
            onPick={(c) => { setTouched(true); setCustomerId(c?.id ?? null); onState({ saving: false, error: "" }); }} onType={setTyped}
            onCreated={(c) => { setCustomers((l) => [c, ...l]); setTouched(true); setCustomerId(c.id); }} hint={t("quotePickerHint")} />
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-[#fde3d3] bg-[#fff8f3] px-4 py-3.5">
          <TabArt id="quote" on />
          <p className="text-[13.5px] leading-relaxed text-slate-700">{t("quoteHow")}</p>
        </div>
      </div>
    </form>
  );
}

// ---------- Pestaña Time off: días libres de una o varias personas ----------
function TimeOffForm({ companyId, team, slot, offs, visits, editOff, ready, onState, onSaved }: {
  companyId: string; team: TeamMember[]; slot: NewSlot; offs: TimeOff[]; visits: CalVisit[]; editOff: TimeOff | null; ready: boolean;
  onState: (s: { saving: boolean; error: string }) => void; onSaved: (msg: string) => void;
}) {
  const t = useTranslations("newItem");
  const tj = useTranslations("jobForm");
  const tc = useTranslations("common");
  const jt = useJobsTx();
  const timeLabel = (m: number) => jt.time(new Date(2000, 0, 1, 0, m));
  // Primero los colaboradores, luego el resto del equipo
  const people = useMemo(() => [...team].sort((a, b) => Number(receivesJobs(b)) - Number(receivesJobs(a)) || a.full_name.localeCompare(b.full_name)), [team]);
  const s0 = editOff ? new Date(editOff.starts_at) : null;
  const [ids, setIds] = useState<string[]>(editOff ? [editOff.user_id] : slot.techId ? [slot.techId] : []);
  const [kind, setKind] = useState<OffKind>(editOff?.kind ?? "vacation");
  const [allDay, setAllDay] = useState(editOff ? editOff.all_day : !slot.dragged);
  const [from, setFrom] = useState(isoDay(s0 ? dayStart(s0) : slot.day));
  const [to, setTo] = useState(isoDay(editOff ? lastDay(editOff) : slot.day));
  // Por horas: la hora donde tocaste (o lo que arrastraste); si solo tocaste, 4 horas
  const [startMin, setStartMin] = useState(s0 && !editOff?.all_day ? minutesOf(s0) : slot.startMin);
  const [endMin, setEndMin] = useState(editOff && !editOff.all_day ? (minutesOf(new Date(editOff.ends_at)) || 24 * 60 - 15) : slot.dragged ? slot.endMin : Math.min(24 * 60 - 15, slot.startMin + 4 * 60));
  const [note, setNote] = useState(editOff?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const many = people.length > 10;
  const shown = many ? [...people.filter((m) => ids.includes(m.user_id)), ...people.filter((m) => !ids.includes(m.user_id) && (!q.trim() || m.full_name.toLowerCase().includes(q.trim().toLowerCase()))).slice(0, 8)] : people;

  const range = useMemo(() => {
    if (allDay) { const a = fromIsoDay(from), b = addDays(fromIsoDay(to < from ? from : to), 1); return [a, b] as const; }
    const d = fromIsoDay(from); return [atMinute(d, startMin), atMinute(d, endMin)] as const;
  }, [allDay, from, to, startMin, endMin]);

  // Avisos: trabajos que ya tiene esa persona y días libres que se enciman
  const clashes = useMemo(() => ids.map((id) => {
    const m = team.find((x) => x.user_id === id);
    const jobs = visits.filter((v) => v.tech_ids.includes(id) && v.visit_status !== "cancelled" && v.visit_status !== "completed" && overlaps(v, range[0], range[1]));
    const dup = offs.some((o) => o.user_id === id && o.id !== editOff?.id && overlaps(o, range[0], range[1]));
    return { id, name: m?.full_name ?? "", jobs: jobs.length, dup };
  }).filter((c) => c.jobs || c.dup), [ids, team, visits, offs, range, editOff]);

  function toggle(id: string) { if (editOff) return; setIds((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id])); onState({ saving, error: "" }); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return onState({ saving: false, error: t("eOffSql") });
    if (!ids.length) return onState({ saving: false, error: t("eOffWho") });
    if (allDay && to < from) return onState({ saving: false, error: t("eOffDates") });
    if (!allDay && endMin <= startMin) return onState({ saving: false, error: tj("eTime") });
    setSaving(true); onState({ saving: true, error: "" });
    const sb = createClient();
    const row = { kind, all_day: allDay, starts_at: range[0].toISOString(), ends_at: range[1].toISOString(), note: note.trim() || null };
    const { error } = editOff
      ? await sb.from("team_time_off").update(row).eq("id", editOff.id)
      : await sb.from("team_time_off").insert(ids.map((user_id) => ({ ...row, company_id: companyId, user_id })));
    setSaving(false);
    if (error) return onState({ saving: false, error: t("eOffSave") });
    onState({ saving: false, error: "" });
    const names = ids.map((id) => team.find((m) => m.user_id === id)?.full_name ?? "").filter(Boolean);
    onSaved(editOff ? t("offUpdated") : t("offSaved", { names: names.length > 2 ? t("nPeople", { n: names.length }) : names.join(" & ") }));
  }

  async function remove() {
    if (!editOff) return;
    const name = team.find((m) => m.user_id === editOff.user_id)?.full_name ?? "";
    if (!(await askConfirm({ title: t("delOffQ", { name }), message: t("delOffMsg"), confirmLabel: tc("delete"), tone: "danger" }))) return;
    setSaving(true); onState({ saving: true, error: "" });
    const { error } = await createClient().from("team_time_off").delete().eq("id", editOff.id);
    setSaving(false);
    if (error) return onState({ saving: false, error: t("eOffSave") });
    onState({ saving: false, error: "" });
    onSaved(t("offDeleted"));
  }

  const timeOpts = TIMES.map((m) => ({ value: String(m), label: timeLabel(m) }));
  const label = "text-[14px] font-semibold text-[#0b1f3a] sm:pt-2";
  const row = "grid gap-2 sm:grid-cols-[10.5rem_minmax(0,1fr)] sm:gap-6";

  return (
    <form id="new-off" onSubmit={submit} noValidate autoComplete="off" className="px-5 py-7 sm:px-8">
      {!ready && (
        <p className="mb-6 max-w-[760px] rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13.5px] text-amber-900">{t("offNeedsSql")}</p>
      )}
      <div className="grid max-w-[1000px] gap-6">
        <div className={row}>
          <p className={label}>{t("who")}</p>
          <div className="flex flex-wrap gap-2">
            {many && !editOff && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPeople", { n: people.length })} className={`${inputClass} mb-1 w-full max-w-[420px]`} />}
            {(editOff ? people.filter((m) => m.user_id === editOff.user_id) : shown).map((m) => {
              const on = ids.includes(m.user_id);
              return (
                <button key={m.user_id} type="button" onClick={() => toggle(m.user_id)} aria-pressed={on}
                  className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-[13.5px] font-medium transition-all duration-150 hover:-translate-y-px ${on ? "border-transparent text-[#0b1f3a] shadow-sm" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
                  style={on ? { background: `${m.color}18`, boxShadow: `inset 0 0 0 1.5px ${m.color}` } : undefined}>
                  <TechDot t={m} size={26} ring={false} />{m.full_name}
                </button>
              );
            })}
            {editOff && <p className="w-full text-[12px] text-slate-400">{t("onePerson")}</p>}
          </div>
        </div>

        <div className={row}>
          <p className={label}>{t("reason")}</p>
          <div className="flex flex-wrap gap-2">
            {OFF_KINDS.map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13.5px] font-medium transition-all duration-150 hover:-translate-y-px ${kind === k ? "border-[#0f766e] bg-[#f3fbf8] text-[#0b1f3a]" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                <span className="h-2 w-2 rounded-full" style={{ background: OFF_COLOR[k] }} />{tj(`offKind.${k}` as never)}
              </button>
            ))}
          </div>
        </div>

        <div className={row}>
          <p className={label}>{t("when")}</p>
          <div className="grid max-w-[560px] gap-3">
            <div className="flex w-fit rounded-lg bg-slate-100 p-0.5">
              {[[true, t("allDay")], [false, t("someHours")]].map(([v, l]) => (
                <button key={String(v)} type="button" onClick={() => setAllDay(v as boolean)}
                  className={`rounded-md px-3.5 py-1.5 text-[13.5px] font-semibold transition-all ${allDay === v ? "bg-white text-[#0f766e] shadow-sm" : "text-slate-500 hover:text-[#0b1f3a]"}`}>{l as string}</button>
              ))}
            </div>
            {allDay ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div><p className="mb-1 text-[12.5px] font-medium text-slate-500">{t("from")}</p><DatePicker value={from} onChange={(v) => { setFrom(v); if (to < v) setTo(v); }} /></div>
                <div><p className="mb-1 text-[12.5px] font-medium text-slate-500">{t("to")}</p><DatePicker value={to} minDate={from} onChange={setTo} /></div>
              </div>
            ) : (
              <>
                <div className="max-w-[260px]"><p className="mb-1 text-[12.5px] font-medium text-slate-500">{tj("date")}</p><DatePicker value={from} onChange={setFrom} /></div>
                <div className="flex items-center gap-2">
                  <div className="flex-1"><SelectMenu value={String(startMin)} ariaLabel={tj("startTime")} options={timeOpts} onChange={(v) => { const n = Number(v); const d = endMin - startMin; setStartMin(n); setEndMin(Math.min(24 * 60 - 15, n + Math.max(15, d))); }} /></div>
                  <span className="text-slate-400">{tj("to")}</span>
                  <div className="flex-1"><SelectMenu value={String(endMin)} ariaLabel={tj("endTime")} options={timeOpts.filter((o) => Number(o.value) > startMin)} onChange={(v) => setEndMin(Number(v))} /></div>
                </div>
              </>
            )}
            {clashes.map((c) => (
              <p key={c.id} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900 animate-[bp-fade_0.2s_ease-out]">
                <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" fill="currentColor"><path d="M8.6 3.2a1.6 1.6 0 0 1 2.8 0l6.3 11.3A1.6 1.6 0 0 1 16.3 17H3.7a1.6 1.6 0 0 1-1.4-2.5zM10 7a.9.9 0 0 0-.9.9v3.3a.9.9 0 0 0 1.8 0V7.9A.9.9 0 0 0 10 7zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" /></svg>
                <span>{c.jobs ? t("hasJobs", { name: c.name, n: c.jobs }) : ""}{c.jobs && c.dup ? " " : ""}{c.dup ? t("alreadyOff", { name: c.name }) : ""}</span>
              </p>
            ))}
          </div>
        </div>

        <div className={row}>
          <label htmlFor="off-note" className={label}>{t("note")}</label>
          <textarea id="off-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder={t("notePh")} className={`${inputClass} max-w-[560px] resize-y`} />
        </div>

        {editOff && (
          <div className="border-t border-slate-100 pt-5">
            <button type="button" onClick={remove} disabled={saving} className="rounded-lg px-3 py-2 text-[14px] font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60">{t("deleteOff")}</button>
          </div>
        )}
      </div>
    </form>
  );
}
