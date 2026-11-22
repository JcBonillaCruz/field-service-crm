"use client";

import { useTranslations } from "next-intl";
import { useEquipText, useFormTitle, useFormTx } from "@/i18n/useFormTx";
import { useFmt, useJobError } from "@/i18n/useFmt";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import SelectMenu from "@/components/ui/SelectMenu";
import {
  Field, FormData, FormKind, JobFormRow, Ranges, cleanForm, displayValue, localizeSections, mergeRanges, rangeText, reviewForm, visibleSections,
} from "@/lib/job-forms";
import { TuneUpArt, WorkFormArt } from "@/components/jobs/forms/FormArt";

// =====================================================================
// Formularios del trabajo (Paso 5.5) — la misma pieza para el teléfono/iPad del técnico y la ficha de oficina.
//  · Work form: lo que encontró y lo que hizo.  · Tune-Up: lecturas; lo que sale de rango se pinta en rojo al escribir.
//  · Se guarda como borrador al cerrar. Al enviarlo, las lecturas fuera de rango le llegan a la oficina (campana).
//  · En el teléfono y el iPad se abre a pantalla completa; en la computadora, en un panel al centro.
// =====================================================================
type Equip = { id: string; kind: string; brand: string | null; model: string | null; serial: string | null; is_active: boolean };
export type Editing = { id: string | null; kind: FormKind; data: FormData; equipmentId: string; submitted: boolean; dirty: boolean };
export type FormsState = { tuneUpSubmitted: boolean; workSubmitted: boolean };

const X = "M5 5l10 10M15 5 5 15";

export default function JobForms({ jobId, companyId, addressId, formKind, visitId = null, variant = "office", readOnly = false, jobLabel = "", onToast, onState }: {
  jobId: string; companyId: string; addressId: string | null; formKind: string | null; visitId?: string | null;
  variant?: "tech" | "office"; readOnly?: boolean; jobLabel?: string; onToast?: (m: string, err?: boolean) => void; onState?: (s: FormsState) => void;
}) {
  const t = useTranslations("forms");
  const fmt = useFmt();
  const formTitle = useFormTitle();
  const when = (iso: string | null) => (iso ? fmt.dateTime(new Date(iso)) : "");
  const eq = useEquipText();
  const [forms, setForms] = useState<JobFormRow[] | null>(null);
  const [off, setOff] = useState(false);
  const [ranges, setRanges] = useState<Ranges>(() => mergeRanges(null));
  const [equip, setEquip] = useState<Equip[]>([]);
  const [ed, setEd] = useState<Editing | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const stateCb = useRef(onState); stateCb.current = onState;
  const tech = variant === "tech";

  const load = useCallback(async () => {
    const { data, error } = await createClient().from("job_forms")
      .select("id, kind, data, alerts, equipment_id, submitted_by_name, submitted_at, created_at, updated_at").eq("job_id", jobId).order("created_at");
    if (error) { setOff(true); return; }
    setOff(false);
    setForms(((data ?? []) as JobFormRow[]).map((f) => ({ ...f, data: (f.data ?? {}) as FormData, alerts: f.alerts ?? [] })));
  }, [jobId]);
  const loadEquip = useCallback(async () => {
    if (!addressId) { setEquip([]); return; }
    const { data } = await createClient().from("customer_equipment").select("id, kind, brand, model, serial, is_active").eq("address_id", addressId).order("created_at");
    setEquip((data ?? []) as Equip[]);
  }, [addressId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadEquip(); }, [loadEquip]);
  useEffect(() => {
    createClient().from("job_settings").select("tuneup_ranges").eq("company_id", companyId).maybeSingle()
      .then(({ data }) => setRanges(mergeRanges((data as { tuneup_ranges?: unknown } | null)?.tuneup_ranges)));
  }, [companyId]);
  // En vivo: la oficina ve el formulario en cuanto el técnico lo envía (si el SQL del paso 5.5 está corrido)
  useEffect(() => {
    const sb = createClient();
    let t: ReturnType<typeof setTimeout>;
    const ch = sb.channel(`job-forms-${jobId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "job_forms", filter: `job_id=eq.${jobId}` }, () => { clearTimeout(t); t = setTimeout(load, 500); })
      .subscribe();
    return () => { clearTimeout(t); sb.removeChannel(ch); };
  }, [jobId, load]);
  useEffect(() => {
    if (forms) stateCb.current?.({ tuneUpSubmitted: forms.some((f) => f.kind === "tune_up" && f.submitted_at), workSubmitted: forms.some((f) => f.kind === "work" && f.submitted_at) });
  }, [forms]);

  if (off || !forms) return null;

  const tuneUps = forms.filter((f) => f.kind === "tune_up"), works = forms.filter((f) => f.kind === "work");
  const wantsTuneUp = formKind === "tune_up";
  // Filas: los formularios que existen + los que faltan por empezar (si todavía se puede escribir)
  const rows: { key: string; kind: FormKind; form: JobFormRow | null }[] = [
    ...tuneUps.map((f) => ({ key: f.id, kind: "tune_up" as FormKind, form: f })),
    ...(wantsTuneUp && !tuneUps.length && !readOnly ? [{ key: "new-tune", kind: "tune_up" as FormKind, form: null }] : []),
    ...works.map((f) => ({ key: f.id, kind: "work" as FormKind, form: f })),
    ...(!works.length && !readOnly ? [{ key: "new-work", kind: "work" as FormKind, form: null }] : []),
  ];
  if (!rows.length) return null;

  const start = (kind: FormKind, f: JobFormRow | null) => {
    if (kind === "tune_up") loadEquip();
    const only = equip.filter((e) => e.is_active);
    setEd({ id: f?.id ?? null, kind, data: { ...(f?.data ?? (kind === "tune_up" ? { mode: "cooling" } : {})) }, equipmentId: f?.equipment_id ?? (kind === "tune_up" && !f && only.length === 1 ? only[0].id : ""), submitted: Boolean(f?.submitted_at), dirty: false });
  };
  const eqName = (id: string | null) => { const e = equip.find((x) => x.id === id); return e ? eq.equipmentName(e) : ""; };

  const box = tech ? "mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3" : "rounded-2xl border border-slate-200 bg-white p-5";
  const title = tech ? "text-[15px] font-semibold text-[#0b1f3a]" : "text-[16px] font-semibold text-[#0b1f3a]";

  return (
    <section className={box}>
      <div className="flex items-center justify-between gap-3">
        <h2 className={title}>{t("heading")}</h2>
        {wantsTuneUp && tuneUps.length > 0 && !readOnly && (
          <button type="button" onClick={() => start("tune_up", null)} className="rounded-lg px-2 py-1 text-[12.5px] font-semibold text-[#0f766e] transition-colors hover:bg-[#e9f7f4]">+ {t("anotherSystem")}</button>
        )}
      </div>
      <div className="mt-2 space-y-2">
        {rows.map(({ key, kind, form }) => {
          const n = form?.alerts.length ?? 0, shown = open[key] ?? !tech;
          const status = !form ? (kind === "tune_up" ? t("notStartedTune") : t("notStartedWork"))
            : form.submitted_at ? t("submittedBy", { name: form.submitted_by_name ?? t("member"), when: when(form.submitted_at) }) : t("draftSaved", { when: when(form.updated_at ?? form.created_at) });
          return (
            <div key={key} className="rounded-xl border border-slate-100">
              <div className="flex items-center gap-1 pr-2">
                <button type="button" onClick={() => start(kind, form)} className="group flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 hover:bg-slate-50">
                  {kind === "tune_up" ? <TuneUpArt size={38} className="shrink-0" /> : <WorkFormArt size={38} className="shrink-0" />}
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-[14.5px] font-semibold text-[#0b1f3a]">{formTitle(kind)}</span>
                      {form?.equipment_id && eqName(form.equipment_id) && <span className="truncate text-[12.5px] text-slate-500">{eqName(form.equipment_id)}</span>}
                      {form && !form.submitted_at && <span className="rounded-full bg-[#fff6e6] px-2 py-0.5 text-[11px] font-semibold text-[#b45309]">{t("draft")}</span>}
                      {n > 0 && <span className="rounded-full bg-[#fff1f2] px-2 py-0.5 text-[11px] font-semibold text-[#be123c]">{t("toReview", { count: n })}</span>}
                      {form?.submitted_at && n === 0 && <span className="rounded-full bg-[#e7f6f1] px-2 py-0.5 text-[11px] font-semibold text-[#0f766e]">{t("allGood")}</span>}
                    </span>
                    <span className="block truncate text-[12.5px] text-slate-500">{status}</span>
                  </span>
                  {!form && <span className="shrink-0 rounded-lg bg-[#0f766e] px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors group-hover:bg-[#0c5f59]">{t("start")}</span>}
                </button>
                {form && (
                  <button type="button" onClick={() => setOpen((o) => ({ ...o, [key]: !shown }))} aria-label={shown ? t("hideDetails") : t("showDetails")} aria-expanded={shown}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
                    <svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform duration-150 ${shown ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 8 5 5 5-5" /></svg>
                  </button>
                )}
              </div>
              {form && shown && <Readings form={form} ranges={ranges} />}
            </div>
          );
        })}
      </div>

      {ed && (
        <FormEditor ed={ed} setEd={setEd} jobId={jobId} visitId={visitId} ranges={ranges} equip={equip} readOnly={readOnly} jobLabel={jobLabel}
          onSaved={(m) => { onToast?.(m); load(); }} />
      )}
    </section>
  );
}

// ---------- Lecturas a la vista (ficha de oficina, o al abrir la flecha en el teléfono) ----------
export function Readings({ form, ranges }: { form: JobFormRow; ranges: Ranges }) {
  const t = useTranslations("forms");
  const tc = useTranslations("common");
  const tx = useFormTx();
  const rv = useMemo(() => reviewForm(form.kind, form.data, ranges, tx), [form, ranges, tx]);
  const sections = localizeSections(form.kind, visibleSections(form.kind, form.data), tx).map((s) => ({ ...s, fields: s.fields.filter((f) => displayValue(f, form.data[f.key]) !== "") })).filter((s) => s.fields.length);
  const alerts = form.alerts.length ? form.alerts : rv.alerts;
  if (!sections.length) return <p className="border-t border-slate-100 px-3.5 py-3 text-[13px] text-slate-400">{t("nothingYet")}</p>;
  return (
    <div className="border-t border-slate-100 px-3.5 pb-3 pt-2.5">
      {alerts.length > 0 && <div className="mb-2 flex flex-wrap gap-1.5">{alerts.map((a) => <span key={a} className="rounded-full bg-[#fff1f2] px-2 py-0.5 text-[12px] font-semibold text-[#be123c]">{a}</span>)}</div>}
      {sections.map((s) => {
        const long = s.fields.filter((f) => f.type === "textarea"), short = s.fields.filter((f) => f.type !== "textarea");
        return (
          <div key={s.id} className="mt-2 first:mt-0">
            {s.title && <p className="mb-1 flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-wide text-slate-400"><span className="h-1.5 w-1.5 rounded-full bg-[#e8713a]" />{s.title}</p>}
            {short.length > 0 && (
              <dl className="grid gap-x-6 text-[13px] sm:grid-cols-2">
                {short.map((f) => (
                  <div key={f.key} className="flex items-baseline justify-between gap-3 border-b border-slate-50 py-1">
                    <dt className="text-slate-500">{f.label}</dt>
                    <dd className={`text-right font-semibold ${rv.bad[f.key] ? "text-[#be123c]" : "text-[#0b1f3a]"}`}>{displayValue(f, form.data[f.key], tc("yes"))}</dd>
                  </div>
                ))}
                {s.id === "air" && rv.delta && (
                  <div className="flex items-baseline justify-between gap-3 border-b border-slate-50 py-1">
                    <dt className="text-slate-500">{rv.delta.label}</dt><dd className={`text-right font-semibold ${rv.delta.bad ? "text-[#be123c]" : "text-[#0f766e]"}`}>{rv.delta.value} °F</dd>
                  </div>
                )}
              </dl>
            )}
            {long.map((f) => (
              <div key={f.key} className="mt-1.5"><p className="text-[12px] text-slate-500">{f.label}</p><p className="whitespace-pre-wrap break-words text-[13.5px] text-[#0b1f3a]">{String(form.data[f.key])}</p></div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ---------- Llenar el formulario ----------
export function FormEditor({ ed, setEd, jobId, visitId, ranges, equip, readOnly, jobLabel, onSaved }: {
  ed: Editing; setEd: (e: Editing | null) => void; jobId: string; visitId: string | null; ranges: Ranges; equip: Equip[]; readOnly: boolean; jobLabel: string; onSaved: (msg: string) => void;
}) {
  const t = useTranslations("forms");
  const tc = useTranslations("common");
  const tx = useFormTx();
  const formTitle = useFormTitle();
  const jobErr = useJobError();
  const eq = useEquipText();
  const [busy, setBusy] = useState<"" | "draft" | "submit">("");
  const [err, setErr] = useState("");
  const [showMissing, setShowMissing] = useState(false);
  const rv = useMemo(() => reviewForm(ed.kind, ed.data, ranges, tx), [ed.kind, ed.data, ranges, tx]);
  const sections = localizeSections(ed.kind, visibleSections(ed.kind, ed.data), tx);
  const set = (key: string, v: string | boolean) => { setErr(""); setEd({ ...ed, data: { ...ed.data, [key]: v }, dirty: true }); };
  const empty = Object.keys(cleanForm(ed.kind, ed.data)).filter((k) => k !== "mode").length === 0;

  // Sin desplazar la página de atrás mientras el formulario está abierto
  useEffect(() => { const o = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = o; }; }, []);

  async function save(submit: boolean) {
    if (busy) return false;
    if (submit && rv.missing.length) { setShowMissing(true); setErr(t("stillMissing", { list: rv.missing.join(", ") })); return false; }
    setBusy(submit ? "submit" : "draft"); setErr("");
    const { error } = await createClient().rpc("tech_save_form", {
      p_job: jobId, p_kind: ed.kind, p_data: cleanForm(ed.kind, ed.data), p_alerts: rv.alerts, p_visit: visitId, p_equipment: ed.equipmentId || null, p_form: ed.id, p_submit: submit,
    });
    setBusy("");
    if (error) { setErr(jobErr(error)); return false; }
    const n = rv.alerts.length;
    onSaved(!submit ? t("draftSavedToast") : ed.submitted ? t("changesSaved") : n ? t("submittedReview", { form: formTitle(ed.kind), count: n }) : t("submitted", { form: formTitle(ed.kind) }));
    setEd(null);
    return true;
  }
  // Cerrar: lo escrito no se pierde (se guarda como borrador; si ya estaba enviado, se guardan los cambios)
  async function close() {
    if (readOnly || !ed.dirty || empty) return setEd(null);
    if (!(await save(ed.submitted && rv.missing.length === 0))) return; // si falla, se queda abierto con el error
  }

  const lab = "mb-1 flex min-h-[2.25em] items-end text-[12px] font-medium leading-tight text-slate-500";
  const req = <span className="ml-0.5 text-[#e8713a]">*</span>;
  const isMissing = (f: Field) => showMissing && f.required && (ed.data[f.key] === undefined || ed.data[f.key] === null || ed.data[f.key] === "");

  const field = (f: Field) => {
    const v = ed.data[f.key], bad = rv.bad[f.key], miss = isMissing(f);
    if (f.type === "number") {
      const r = f.range ? rangeText(ranges[f.range], f.unit, tx.words) : "";
      return (
        <label key={f.key} className="block">
          <span className={lab}><span>{f.label}{f.required && req}</span></span>
          <span className={`flex items-center rounded-lg border transition-colors ${bad ? "border-[#e11d48] bg-[#fff1f2]" : miss ? "border-[#f59e0b] bg-[#fffaf0]" : "border-slate-200 bg-slate-50 focus-within:border-[#0f766e] focus-within:bg-white"}`}>
            <input inputMode="decimal" disabled={readOnly} value={typeof v === "string" ? v : ""} onChange={(e) => set(f.key, e.target.value.replace(/[^\d.,-]/g, "").slice(0, 8))}
              className={`min-w-0 flex-1 bg-transparent py-2 pl-3 pr-1 text-[16px] font-semibold outline-none ${bad ? "text-[#be123c]" : "text-[#0b1f3a]"}`} />
            {f.unit && <span className={`shrink-0 pr-2.5 text-[12px] ${bad ? "text-[#be123c]" : "text-slate-400"}`}>{f.unit}</span>}
          </span>
          {bad ? <span role="alert" className="mt-1 block text-[11.5px] font-semibold leading-tight text-[#be123c]">{bad}</span>
            : r ? <span className="mt-1 block text-[11px] leading-tight text-slate-400">{r}</span> : null}
        </label>
      );
    }
    if (f.type === "choice") {
      return (
        <div key={f.key} className="col-span-2 sm:col-span-1">
          <span className={lab}><span>{f.label}{f.required && req}</span></span>
          <div className={`rounded-lg ${bad ? "ring-2 ring-[#e11d48]/70" : miss ? "ring-2 ring-[#f59e0b]/70" : ""} ${readOnly ? "pointer-events-none opacity-80" : ""}`}>
            <SelectMenu value={typeof v === "string" ? v : ""} ariaLabel={f.label} options={(f.options ?? []).map((o) => ({ value: o.value, label: o.label }))} onChange={(x) => set(f.key, x)} />
          </div>
          {bad && <span role="alert" className="mt-1 block text-[11.5px] font-semibold text-[#be123c]">{bad}</span>}
        </div>
      );
    }
    if (f.type === "check") {
      return (
        <button key={f.key} type="button" role="checkbox" aria-checked={Boolean(v)} disabled={readOnly} onClick={() => set(f.key, !v)} className="col-span-full flex items-center gap-2.5 rounded-lg py-1 text-left">
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors duration-150 ${v ? "border-[#0f766e] bg-[#0f766e] text-white" : "border-slate-300"}`}>
            {v && <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7" /></svg>}
          </span>
          <span className="text-[14.5px] text-[#0b1f3a]">{f.label}</span>
        </button>
      );
    }
    const cls = `w-full rounded-lg border px-3 py-2 text-[16px] text-[#0b1f3a] outline-none transition-colors placeholder:text-slate-400 ${miss ? "border-[#f59e0b] bg-[#fffaf0]" : "border-slate-200 bg-slate-50 focus:border-[#0f766e] focus:bg-white"}`;
    return (
      <label key={f.key} className={f.type === "textarea" || f.wide ? "col-span-full block" : "block"}>
        <span className={f.type === "textarea" ? "mb-1 block text-[12px] font-medium text-slate-500" : lab}><span>{f.label}{f.required && req}</span></span>
        {f.type === "textarea"
          ? <textarea rows={3} maxLength={3000} disabled={readOnly} value={typeof v === "string" ? v : ""} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} className={`${cls} resize-y`} />
          : <input maxLength={60} disabled={readOnly} value={typeof v === "string" ? v : ""} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} className={cls} />}
      </label>
    );
  };

  const active = equip.filter((e) => e.is_active || e.id === ed.equipmentId);
  return (
    <div className="fixed inset-0 z-[96] flex items-stretch justify-center bg-white lg:items-center lg:bg-slate-900/40 lg:p-6" role="dialog" aria-modal="true" aria-label={formTitle(ed.kind)}>
      <div className="flex h-full w-full flex-col bg-white animate-[bp-fade_0.15s_ease-out] lg:h-auto lg:max-h-[92vh] lg:max-w-3xl lg:overflow-hidden lg:rounded-3xl lg:shadow-[0_30px_80px_rgba(15,40,60,0.3)]">
        {/* Encabezado */}
        <div className="flex items-center gap-2 border-b border-slate-200 px-3 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))]">
          <button type="button" onClick={close} disabled={Boolean(busy)} aria-label={tc("close")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-all duration-200 hover:rotate-90 hover:bg-red-50 hover:text-red-600">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d={X} /></svg>
          </button>
          {ed.kind === "tune_up" ? <TuneUpArt size={34} className="shrink-0" /> : <WorkFormArt size={34} className="shrink-0" />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold leading-tight text-[#0b1f3a]">{formTitle(ed.kind)}</p>
            {jobLabel && <p className="truncate text-[12.5px] text-slate-500">{jobLabel}</p>}
          </div>
          {rv.alerts.length > 0 && <span className="shrink-0 rounded-full bg-[#fff1f2] px-2.5 py-1 text-[12px] font-semibold text-[#be123c]">{t("toReview", { count: rv.alerts.length })}</span>}
        </div>

        {/* Campos */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-3">
          {ed.kind === "tune_up" && active.length > 0 && (
            <div className="mb-4 sm:max-w-sm">
              <span className="mb-1 block text-[12px] font-medium text-slate-500">{t("equipment")}</span>
              <div className={readOnly ? "pointer-events-none opacity-80" : ""}>
                <SelectMenu value={ed.equipmentId} ariaLabel={t("equipment")} placeholder={t("chooseEquipment")}
                  options={[{ value: "", label: t("wholeSystem") }, ...active.map((e) => ({ value: e.id, label: `${eq.equipmentName(e)}${e.serial ? ` · S/N ${e.serial}` : ""}` }))]}
                  onChange={(v) => setEd({ ...ed, equipmentId: v, dirty: true })} />
              </div>
            </div>
          )}
          {sections.map((s) => (
            <section key={s.id} className="mb-5 last:mb-0">
              {s.title && <h3 className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold uppercase tracking-wide text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-[#e8713a]" />{s.title}</h3>}
              <div className="grid grid-cols-2 items-start gap-x-3 gap-y-3 sm:grid-cols-3">
                {s.fields.map(field)}
                {s.id === "air" && rv.delta && (
                  <p className={`col-span-full flex items-center justify-between rounded-lg px-3 py-2 text-[13.5px] font-semibold ${rv.delta.bad ? "bg-[#fff1f2] text-[#be123c]" : "bg-[#e9f7f4] text-[#0f766e]"}`}>
                    <span>{rv.delta.label}{rv.delta.bad ? ` · ${rv.delta.bad}` : ` · ${t("inRange")}`}</span><span className="text-[16px]">{rv.delta.value} °F</span>
                  </p>
                )}
              </div>
            </section>
          ))}
          {rv.alerts.length > 0 && (
            <div className="mt-5 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-3.5 py-3">
              <p className="text-[13px] font-semibold text-[#9f1239]">{t("officeWillSee")}</p>
              <ul className="mt-1 space-y-0.5 text-[13px] text-[#be123c]">{rv.alerts.map((a) => <li key={a}>• {a}</li>)}</ul>
            </div>
          )}
        </div>

        {/* Acciones (pequeñas, del ancho de su texto) */}
        <div className="border-t border-slate-200 bg-white px-3 pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2.5">
          {err && <p role="alert" className="mb-2 rounded-lg bg-[#fff1f2] px-3 py-2 text-[13px] font-medium text-[#be123c]">{err}</p>}
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-[12px] text-slate-400">{readOnly ? t("jobClosed") : ed.submitted ? t("alreadySubmitted") : rv.missing.length ? t("requiredLeft", { count: rv.missing.length }) : t("ready")}</span>
            {readOnly ? (
              <button type="button" onClick={() => setEd(null)} className="h-10 rounded-xl border border-slate-200 px-4 text-[13.5px] font-semibold text-slate-700 transition-colors hover:bg-slate-50">{tc("close")}</button>
            ) : ed.submitted ? (
              <button type="button" onClick={() => save(true)} disabled={Boolean(busy)} className="h-10 rounded-xl bg-[#0f766e] px-5 text-[14px] font-semibold text-white transition-all duration-150 hover:bg-[#0c5f59] active:scale-[0.98] disabled:opacity-60">{busy ? tc("saving") : tc("saveChanges")}</button>
            ) : (
              <>
                <button type="button" onClick={() => save(false)} disabled={Boolean(busy) || empty} className="h-10 rounded-xl border border-slate-200 px-3.5 text-[13.5px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50">{busy === "draft" ? tc("saving") : t("saveDraft")}</button>
                <button type="button" onClick={() => save(true)} disabled={Boolean(busy)} className="h-10 rounded-xl bg-[#0f766e] px-5 text-[14px] font-semibold text-white transition-all duration-150 hover:bg-[#0c5f59] active:scale-[0.98] disabled:opacity-60">{busy === "submit" ? t("sending") : t("submit")}</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
