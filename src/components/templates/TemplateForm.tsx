"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { confirmDelete } from "@/lib/confirm";
import { inputClass } from "@/components/customers/ui";
import { FormHeader, FormRow, SaveBar, SectionTitle } from "@/components/catalog/FormBits";
import SelectMenu from "@/components/ui/SelectMenu";
import LineItems, { blankLine } from "@/components/sales/LineItems";
import type { ItemOption } from "@/lib/sales-server";
import type { JobType, Priority } from "@/lib/jobs";
import { durationLabel } from "@/lib/jobs";
import { SalesLine, round2 } from "@/lib/sales";
import { useSalesTx } from "@/i18n/useSalesTx";
import { useJobsTx } from "@/i18n/useJobsTx";
import { TplCheck, TplUse, WorkTemplate, depositAmount, linesToTpl, tplError, tplToLines, tplTotal } from "@/lib/templates";

// =====================================================================
// Paso 6.10 · Nueva / editar plantilla: pantalla completa (menú + formulario)
//   Precios (líneas) · Para la cotización (asunto, notas, términos, depósito) · Para el trabajo (tipo, duración, checklist)
// =====================================================================
const DURATIONS = Array.from({ length: 32 }, (_, i) => (i + 1) * 15); // 15 min … 8 h

export default function TemplateForm({ companyId, actor, base, template, items, types, canEdit }: {
  companyId: string; actor: string; base: string; template?: WorkTemplate | null; items: ItemOption[]; types: JobType[]; canEdit: boolean;
}) {
  const t = useTranslations("templates");
  const sx = useSalesTx();
  const jt = useJobsTx();
  const router = useRouter();
  const src = template ?? null;
  const [name, setName] = useState(src?.name ?? "");
  const [description, setDescription] = useState(src?.description ?? "");
  const [use, setUse] = useState<TplUse>(src?.use_in ?? "both");
  const [lines, setLines] = useState<SalesLine[]>(src?.lines.length ? tplToLines(src) : [blankLine()]);
  const [subject, setSubject] = useState(src?.subject ?? "");
  const [notes, setNotes] = useState(src?.notes ?? "");
  const [terms, setTerms] = useState(src?.terms ?? "");
  const [depType, setDepType] = useState<"percent" | "flat">(src?.deposit_type === "flat" ? "flat" : "percent");
  const [depValue, setDepValue] = useState(src?.deposit_type && src.deposit_value ? String(+src.deposit_value) : "");
  const [typeId, setTypeId] = useState(src?.job_type_id ?? "");
  const [title, setTitle] = useState(src?.title ?? "");
  const [details, setDetails] = useState(src?.job_details ?? "");
  const [duration, setDuration] = useState(src?.duration_min ? String(src.duration_min) : "");
  const [priority, setPriority] = useState<Priority>(src?.priority ?? "normal");
  const [checklist, setChecklist] = useState<TplCheck[]>(src?.checklist ?? []);
  const [newCheck, setNewCheck] = useState("");
  const [active, setActive] = useState(src?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const total = tplTotal({ lines: linesToTpl(lines) });
  const showQuote = use !== "job", showJob = use !== "quote";

  function pickType(id: string) {
    setTypeId(id);
    const ty = types.find((x) => x.id === id);
    if (ty && !duration) setDuration(String(ty.default_duration_min));
  }
  function addCheck() { const v = newCheck.trim(); if (!v) return; setChecklist((l) => [...l, { label: v, required: true }]); setNewCheck(""); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return setError(t("ePerm"));
    if (!name.trim()) return setError(t("eName"));
    const tl = linesToTpl(lines);
    if (tl.some((l) => !l.name)) return setError(t("eLineName"));
    if (use === "quote" && !tl.length) return setError(t("eNoLines"));
    setSaving(true); setError("");
    const dep = showQuote && Number(depValue) > 0;
    const row = {
      name: name.trim(), description: description.trim() || null, use_in: use, lines: tl,
      subject: showQuote ? subject.trim() || null : null, notes: showQuote ? notes.trim() || null : null, terms: showQuote ? terms.trim() || null : null,
      deposit_type: dep ? depType : null, deposit_value: dep ? round2(Number(depValue)) : 0,
      job_type_id: showJob ? typeId || null : null, title: showJob ? title.trim() || null : null, job_details: showJob ? details.trim() || null : null,
      duration_min: showJob && Number(duration) ? Number(duration) : null, priority: showJob ? priority : "normal",
      checklist: showJob ? checklist.filter((c) => c.label.trim()).map((c) => ({ label: c.label.trim(), required: c.required })) : [],
      is_active: active, updated_at: new Date().toISOString(),
    };
    const sb = createClient();
    const { error: dbErr } = src
      ? await sb.from("work_templates").update(row).eq("id", src.id)
      : await sb.from("work_templates").insert({ ...row, company_id: companyId, created_by_name: actor });
    if (dbErr) { setSaving(false); const k = tplError(dbErr); return setError(k === "dup" ? t("eDup") : k === "sql" ? t("needsSql") : k === "perm" ? t("ePerm") : t("eSave")); }
    router.push(base); router.refresh();
  }

  async function remove() {
    if (!src || !(await confirmDelete({ title: t("delQ", { name: src.name }), message: t("delMsg"), download: { filename: `template-${src.name}`, data: src } }))) return;
    const { error: err } = await createClient().from("work_templates").delete().eq("id", src.id);
    if (err) return setError(t("eDel"));
    router.replace(base); router.refresh();
  }

  const useCards: { k: TplUse; title: string; sub: string }[] = [
    { k: "both", title: t("u.both"), sub: t("uSub.both") }, { k: "quote", title: t("u.quote"), sub: t("uSub.quote") }, { k: "job", title: t("u.job"), sub: t("uSub.job") },
  ];

  return (
    <form onSubmit={submit} noValidate autoComplete="off" className="flex min-h-[calc(100vh-4rem)] min-w-0 flex-col overflow-x-hidden bg-white">
      <FormHeader title={src ? t("editTitle") : t("newTitle")} closeHref={base} />

      <div className="space-y-6 border-b border-slate-200 px-5 py-7 sm:px-8">
        <div className="grid max-w-[1000px] grid-cols-[minmax(0,1fr)] gap-6">
          <FormRow label={t("name")} htmlFor="tp-name" required width="max-w-[460px]">
            <input id="tp-name" value={name} maxLength={80} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder={t("namePh")} className={inputClass} />
          </FormRow>
          <FormRow label={t("descr")} htmlFor="tp-desc" hint={t("descrHint")} width="max-w-[560px]">
            <input id="tp-desc" value={description} maxLength={160} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
          </FormRow>
          <FormRow label={t("useIn")} alignTop width="max-w-[680px]">
            <div className="grid gap-3 sm:grid-cols-3">
              {useCards.map((c) => (
                <button key={c.k} type="button" onClick={() => setUse(c.k)} aria-pressed={use === c.k}
                  className={`rounded-xl border p-3 text-left transition-all duration-150 hover:-translate-y-0.5 ${use === c.k ? "border-[#0f766e] bg-[#f3fbf8]" : "border-slate-200 hover:border-[#14a39a]"}`}>
                  <span className="block text-[15px] font-semibold text-[#0b1f3a]">{c.title}</span>
                  <span className="block text-[12.5px] text-slate-500">{c.sub}</span>
                </button>
              ))}
            </div>
          </FormRow>
          {src && (
            <FormRow label={t("status")} hint={t("statusHint")}>
              <button type="button" role="switch" aria-checked={active} onClick={() => setActive((v) => !v)} className="flex items-center gap-3 py-1.5">
                <span className={`relative h-6 w-11 rounded-full transition-colors ${active ? "bg-[#0f766e]" : "bg-slate-300"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${active ? "left-[22px]" : "left-0.5"}`} /></span>
                <span className="text-[15px] text-slate-700">{active ? t("active") : t("inactive")}</span>
              </button>
            </FormRow>
          )}
        </div>
      </div>

      {/* Precios */}
      <div className="border-b border-slate-200 px-5 py-7 sm:px-8">
        <div className="max-w-[1100px]">
          <SectionTitle>{t("secPrices")}</SectionTitle>
          <p className="-mt-3 mb-4 text-[13.5px] text-slate-500">{use === "job" ? t("pricesJob") : t("pricesHint")}</p>
          <LineItems lines={lines} setLines={setLines} items={items} />
          <div className="mt-4 flex justify-end text-[16px] font-semibold text-[#0b1f3a]"><span className="mr-6">{t("price")}</span><span className="tabular-nums">{sx.money(total)}</span></div>
        </div>
      </div>

      {showQuote && (
        <div className="space-y-6 border-b border-slate-200 px-5 py-7 sm:px-8">
          <SectionTitle>{t("secQuote")}</SectionTitle>
          <div className="grid max-w-[1000px] grid-cols-[minmax(0,1fr)] gap-6">
            <FormRow label={t("subject")} htmlFor="tp-subj" width="max-w-[560px]">
              <input id="tp-subj" value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} />
            </FormRow>
            <FormRow label={t("deposit")} hint={t("depositHint")} width="max-w-[420px]">
              <div className="flex items-center gap-2">
                <input inputMode="decimal" value={depValue} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setDepValue(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0" aria-label={t("deposit")} className={`${inputClass} text-right`} />
                <div className="w-[4.5rem] shrink-0"><SelectMenu value={depType} options={[{ value: "percent", label: "%" }, { value: "flat", label: "$" }]} onChange={(v) => setDepType(v === "flat" ? "flat" : "percent")} ariaLabel={t("depositType")} /></div>
              </div>
              {Number(depValue) > 0 && total > 0 && <p className="mt-1.5 text-[13px] text-slate-500">{t("depositEx", { amount: sx.money(depositAmount(total, depType, Number(depValue))), total: sx.money(total) })}</p>}
            </FormRow>
            <FormRow label={t("notes")} htmlFor="tp-notes" alignTop width="max-w-[560px]">
              <textarea id="tp-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} resize-y`} />
            </FormRow>
            <FormRow label={t("terms")} htmlFor="tp-terms" alignTop width="max-w-[560px]">
              <textarea id="tp-terms" rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} className={`${inputClass} resize-y`} />
            </FormRow>
          </div>
        </div>
      )}

      {showJob && (
        <div className="space-y-6 px-5 py-7 sm:px-8">
          <SectionTitle>{t("secJob")}</SectionTitle>
          <div className="grid max-w-[1000px] grid-cols-[minmax(0,1fr)] gap-6">
            <FormRow label={t("jobType")} width="max-w-[340px]">
              <SelectMenu value={typeId} ariaLabel={t("jobType")} placeholder={t("noType")}
                options={[{ value: "", label: t("noType") }, ...types.filter((x) => x.is_active || x.id === typeId).map((x) => ({ value: x.id, label: x.name }))]} onChange={pickType} />
            </FormRow>
            <FormRow label={t("jobTitle")} htmlFor="tp-title" width="max-w-[560px]">
              <input id="tp-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder={t("jobTitlePh")} className={inputClass} />
            </FormRow>
            <FormRow label={t("jobDetails")} htmlFor="tp-det" alignTop width="max-w-[560px]">
              <textarea id="tp-det" rows={3} value={details} onChange={(e) => setDetails(e.target.value)} className={`${inputClass} resize-y`} />
            </FormRow>
            <FormRow label={t("duration")} width="max-w-[220px]">
              <SelectMenu value={duration} ariaLabel={t("duration")} placeholder={t("noDuration")}
                options={[{ value: "", label: t("noDuration") }, ...DURATIONS.map((m) => ({ value: String(m), label: durationLabel(m) }))]} onChange={setDuration} />
            </FormRow>
            <FormRow label={t("priority")} width="max-w-[560px]">
              <div className="flex flex-wrap gap-2">
                {jt.priorities.map((p) => (
                  <button key={p.value} type="button" onClick={() => setPriority(p.value)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13.5px] font-medium transition-all ${priority === p.value ? "border-[#0f766e] bg-[#f3fbf8] text-[#0b1f3a]" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                    <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.label}
                  </button>
                ))}
              </div>
            </FormRow>
            <FormRow label={t("checklist")} alignTop width="max-w-[560px]">
              <div className="space-y-2">
                {checklist.length === 0 && <p className="text-[13.5px] text-slate-500">{t("checklistHint")}</p>}
                {checklist.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <span className="h-4 w-4 shrink-0 rounded border border-slate-300" />
                    <input value={c.label} onChange={(e) => setChecklist((l) => l.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="min-w-0 flex-1 bg-transparent text-[14.5px] text-[#0b1f3a] focus:outline-none" />
                    <button type="button" onClick={() => setChecklist((l) => l.map((x, j) => (j === i ? { ...x, required: !x.required } : x)))}
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.required ? "bg-[#fff4ec] text-[#c2410c]" : "bg-slate-100 text-slate-500"}`}>{c.required ? t("required") : t("optional")}</button>
                    <button type="button" onClick={() => setChecklist((l) => l.filter((_, j) => j !== i))} aria-label={t("removeTask")} className="group/x flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600">
                      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 transition-transform duration-200 group-hover/x:rotate-90" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6.5 6.5 7 7M13.5 6.5l-7 7" strokeLinecap="round" /></svg>
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input value={newCheck} onChange={(e) => setNewCheck(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCheck(); } }} placeholder={t("taskPh")} className={inputClass} />
                  <button type="button" onClick={addCheck} className="shrink-0 rounded-lg border border-[#0f766e]/30 bg-[#e9f7f4] px-3 text-[13.5px] font-semibold text-[#0f766e] transition-all hover:-translate-y-0.5 hover:border-[#0f766e]">{t("addTask")}</button>
                </div>
              </div>
            </FormRow>
          </div>
        </div>
      )}

      <div className="flex-1" />
      <SaveBar saving={saving} cancelHref={base} error={error} onDelete={src && canEdit ? remove : undefined} deleteLabel={t("delete")} />
    </form>
  );
}
