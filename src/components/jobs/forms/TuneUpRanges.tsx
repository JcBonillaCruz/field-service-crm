"use client";

import { useState } from "react";
import { askConfirm } from "@/lib/confirm";
import { RANGE_DEFS, Range, Ranges, mergeRanges } from "@/lib/job-forms";

import { useTranslations } from "next-intl";
// Rangos del Tune-Up por compañía (Paso 5.5): una lectura fuera de estos números sale en rojo y le llega a la oficina.
type Row = { min: string; max: string };
const toRows = (r: Ranges): Record<string, Row> =>
  Object.fromEntries(RANGE_DEFS.map((d) => [d.key, { min: r[d.key]?.min != null ? String(r[d.key]!.min) : "", max: r[d.key]?.max != null ? String(r[d.key]!.max) : "" }]));

export default function TuneUpRanges({ value, onSave }: { value: unknown; onSave: (r: Ranges | null) => Promise<void> }) {
  const t = useTranslations("tuneRanges");
  const tc = useTranslations("common");
  const L = (d: { key: string; label: string }) => (t.has(`r.${d.key}.label` as never) ? t(`r.${d.key}.label` as never) : d.label);
  const H = (d: { key: string; help?: string }) => (d.help ? (t.has(`r.${d.key}.help` as never) ? t(`r.${d.key}.help` as never) : d.help) : "");
  const [rows, setRows] = useState(() => toRows(mergeRanges(value)));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (key: string, side: keyof Row, v: string) => { setErr(""); setDirty(true); setRows((x) => ({ ...x, [key]: { ...x[key], [side]: v.replace(/[^\d.]/g, "").slice(0, 7) } })); };

  async function save() {
    const out: Ranges = {};
    for (const d of RANGE_DEFS) {
      const r = rows[d.key], min = r.min === "" ? null : Number(r.min), max = r.max === "" ? null : Number(r.max);
      if ((min !== null && !Number.isFinite(min)) || (max !== null && !Number.isFinite(max))) return setErr(t("numbersOnly", { label: L(d) }));
      if (min !== null && max !== null && min > max) return setErr(t("lowHigh", { label: L(d) }));
      out[d.key] = { min, max } as Range;
    }
    setBusy(true);
    await onSave(out);
    setBusy(false); setDirty(false);
  }
  async function reset() {
    if (!(await askConfirm({ title: t("resetQ"), message: t("resetMsg"), confirmLabel: t("useStandard") }))) return;
    setBusy(true);
    await onSave(null);
    setRows(toRows(mergeRanges(null))); setBusy(false); setDirty(false); setErr("");
  }

  const inp = "shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-right text-[14.5px] font-semibold text-[#0b1f3a] outline-none transition-colors placeholder:font-normal placeholder:text-slate-300 focus:border-[#0f766e] focus:bg-white";
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold text-[#0b1f3a]">{t("title")}</h2>
          <p className="max-w-xl text-[13px] text-slate-500">{t("intro")}</p>
        </div>
        <button type="button" onClick={reset} disabled={busy} className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-50">{t("standard")}</button>
      </div>
      <div className="mt-4 grid gap-x-8 lg:grid-cols-2">
        {RANGE_DEFS.map((d) => (
          <div key={d.key} className="flex items-center gap-2 border-b border-slate-100 py-2">
            <span className="min-w-0 flex-1"><span className="block text-[14px] font-medium text-[#0b1f3a]">{L(d)}</span>{d.help && <span className="block text-[12px] leading-tight text-slate-400">{H(d)}</span>}</span>
            {d.key === "cap_tolerance" ? <span className="w-16 shrink-0 text-right text-[12px] text-slate-400">{t("upTo")}</span>
              : <input inputMode="decimal" aria-label={t("lowest", { label: L(d) })} placeholder={t("low")} value={rows[d.key].min} onChange={(e) => set(d.key, "min", e.target.value)} className={`${inp} w-16`} />}
            <input inputMode="decimal" aria-label={t("highest", { label: L(d) })} placeholder={t("high")} value={rows[d.key].max} onChange={(e) => set(d.key, "max", e.target.value)} className={`${inp} w-16`} />
            <span className="w-14 shrink-0 text-[12px] text-slate-400">{d.unit}</span>
          </div>
        ))}
      </div>
      {err && <p role="alert" className="mt-3 rounded-lg bg-[#fff1f2] px-3 py-2 text-[13px] font-medium text-[#be123c]">{err}</p>}
      <div className="mt-4 flex justify-end">
        <button type="button" onClick={save} disabled={!dirty || busy} className="rounded-lg bg-[#0f766e] px-4 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-[#0c5f59] disabled:bg-slate-200 disabled:text-slate-400">{busy ? tc("saving") : t("save")}</button>
      </div>
    </section>
  );
}
