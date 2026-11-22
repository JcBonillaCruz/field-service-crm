"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PhaseTpl, cleanTpl } from "@/lib/phases";

import { useTranslations } from "next-intl";
// =====================================================================
// Job settings → Phases (Paso 5.4)
// Plantilla de fases de cada tipo de trabajo. Los trabajos NUEVOS de ese tipo nacen con estas fases;
// los que ya existen conservan las suyas (se editan desde la ficha del trabajo).
// =====================================================================
type TypeLite = { id: string; name: string; color: string; is_active: boolean };
type Row = { name: string; weight: string; key: string };
let seq = 0;
const key = () => `p${++seq}`;

export default function PhaseTemplates({ types, onSaved }: { types: TypeLite[]; onSaved?: (m: string, err?: boolean) => void }) {
  const t = useTranslations("phaseTpl");
  const tc = useTranslations("common");
  const [tpl, setTpl] = useState<Record<string, PhaseTpl[]> | null>(null);
  const [missing, setMissing] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const ids = types.map((t) => t.id).join(",");

  const load = useCallback(async () => {
    if (!ids) { setTpl({}); return; }
    const { data, error } = await createClient().from("job_types").select("id, phases").in("id", ids.split(","));
    if (error) { setMissing(true); return; }
    const m: Record<string, PhaseTpl[]> = {};
    ((data ?? []) as { id: string; phases: unknown }[]).forEach((r) => { m[r.id] = cleanTpl(r.phases); });
    setMissing(false); setTpl(m);
  }, [ids]);
  useEffect(() => { load(); }, [load]);

  const edit = (id: string) => { setOpen(id); setRows((tpl?.[id] ?? []).map((p) => ({ name: p.name, weight: String(p.weight), key: key() }))); };
  const move = (i: number, d: number) => setRows((l) => { const n = [...l]; const k = i + d; if (k < 0 || k >= n.length) return l; [n[i], n[k]] = [n[k], n[i]]; return n; });
  async function save() {
    if (!open) return;
    const phases = rows.map((r) => ({ name: r.name.trim().slice(0, 80), weight: Math.max(Number(r.weight) || 0, 0) })).filter((r) => r.name);
    setSaving(true);
    const { error } = await createClient().from("job_types").update({ phases }).eq("id", open);
    setSaving(false);
    if (error) { onSaved?.(t("saveFail"), true); return; }
    setTpl((m) => ({ ...(m ?? {}), [open]: phases })); setOpen(null); onSaved?.(t("saved"));
  }
  const total = rows.reduce((a, r) => a + (Number(r.weight) || 0), 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-[16px] font-semibold text-[#0b1f3a]">{t("title")}</h2>
      <p className="text-[13px] text-slate-500">{t("intro")}</p>
      {missing && <p className="mt-3 rounded-lg bg-[#fff6e6] px-3 py-2 text-[13px] font-medium text-[#b45309]">{t("runSql")}</p>}
      {!missing && (
        <div className="mt-4 space-y-2">
          {types.filter((ty) => ty.is_active || (tpl?.[ty.id]?.length ?? 0) > 0).map((ty) => {
            const list = tpl?.[ty.id] ?? [];
            const sum = list.reduce((a, p) => a + p.weight, 0);
            return (
              <div key={ty.id} className="rounded-xl border border-slate-100 px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: ty.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-medium text-[#0b1f3a]">{ty.name}</p>
                    {open !== ty.id && (
                      <p className="mt-0.5 flex flex-wrap gap-x-1.5 gap-y-1 text-[12.5px] text-slate-500">
                        {tpl === null ? "…" : list.length === 0 ? t("noPhases") : list.map((p, i) => (
                          <span key={i} className="rounded-md bg-slate-50 px-1.5 py-0.5">{p.name} <span className="font-semibold text-[#e8713a]">{sum ? Math.round((100 * p.weight) / sum) : 0}%</span></span>
                        ))}
                      </p>
                    )}
                  </div>
                  {open !== ty.id && <button type="button" onClick={() => edit(ty.id)} className="shrink-0 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-[#0f766e] transition-colors hover:bg-[#e9f7f4]">{list.length ? tc("edit") : t("addPhases")}</button>}
                </div>
                {open === ty.id && (
                  <div className="mt-3">
                    <div className="space-y-2">
                      {rows.map((r, i) => (
                        <div key={r.key} className="flex items-center gap-2">
                          <div className="flex flex-col">
                            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t("moveUp")} className="rounded px-1 text-slate-400 hover:text-[#0f766e] disabled:opacity-30"><svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5-5 5 5" /></svg></button>
                            <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={t("moveDown")} className="rounded px-1 text-slate-400 hover:text-[#0f766e] disabled:opacity-30"><svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 8 5 5 5-5" /></svg></button>
                          </div>
                          <input value={r.name} onChange={(e) => setRows((l) => l.map((x) => (x.key === r.key ? { ...x, name: e.target.value } : x)))} maxLength={80} placeholder={t("namePh")} aria-label={t("name")}
                            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-[14px] text-[#0b1f3a] outline-none focus:border-[#14a39a]" />
                          <input value={r.weight} onChange={(e) => setRows((l) => l.map((x) => (x.key === r.key ? { ...x, weight: e.target.value.replace(/[^\d.]/g, "") } : x)))} inputMode="decimal" aria-label={t("weight")}
                            className="w-16 rounded-lg border border-slate-200 px-2 py-2 text-center text-[14px] tabular-nums text-[#0b1f3a] outline-none focus:border-[#14a39a]" />
                          <span className="w-10 text-right text-[12.5px] tabular-nums text-slate-400">{total ? Math.round((100 * (Number(r.weight) || 0)) / total) : 0}%</span>
                          <button type="button" onClick={() => setRows((l) => l.filter((x) => x.key !== r.key))} aria-label={t("remove")} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-[#fff1f2] hover:text-[#e11d48]"><svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 5l10 10M15 5 5 15" /></svg></button>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[12.5px] text-slate-400">{t("weightsHint")}</p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <button type="button" onClick={() => setRows((l) => [...l, { name: "", weight: "1", key: key() }])} className="rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-[#0f766e] hover:bg-[#e9f7f4]">{t("add")}</button>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setOpen(null)} className="rounded-lg px-3.5 py-2 text-[13.5px] font-semibold text-slate-500 hover:bg-slate-100">{tc("cancel")}</button>
                        <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-[#0f766e] px-4 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#0c5f59] disabled:opacity-60">{saving ? tc("saving") : t("save")}</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {types.length === 0 && <p className="text-[13.5px] text-slate-500">{t("addTypeFirst")}</p>}
        </div>
      )}
    </section>
  );
}
