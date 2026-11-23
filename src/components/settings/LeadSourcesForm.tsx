"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { confirmDelete } from "@/lib/confirm";
import { LeadSource, leadLabel } from "@/lib/lead-sources";
import { inputClass } from "@/components/customers/ui";

// =====================================================================
// Paso 6.8 · Settings → Lead sources
// De fábrica: se pueden ocultar y ordenar (no borrar). Propias: también cambiar nombre y borrar.
// =====================================================================
const TONES = ["#14a39a", "#2563eb", "#e8713a", "#8b5cf6", "#e11d48", "#d97706", "#0891b2", "#16a34a"];
const tone = (s: LeadSource, i: number) => (s.code?.startsWith("google") ? "#2563eb" : s.code === "referral" ? "#e8713a" : TONES[i % TONES.length]);

export default function LeadSourcesForm({ companyId, initial, counts, needsSql }: {
  companyId: string; initial: LeadSource[]; counts: Record<string, number>; needsSql: boolean;
}) {
  const t = useTranslations("lead");
  const router = useRouter();
  const [list, setList] = useState<LeadSource[]>(initial);
  const [name, setName] = useState("");
  const [edit, setEdit] = useState<{ id: string; name: string } | null>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const say = (text: string, error = false) => { setMsg({ text, error }); setTimeout(() => setMsg((m) => (m?.text === text ? null : m)), 2600); };
  const sb = () => createClient().from("lead_sources");
  const total = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    if (list.some((s) => leadLabel(t, s).toLowerCase() === clean.toLowerCase())) return say(t("eDup"), true);
    const pos = Math.max(0, ...list.filter((s) => s.code !== "other").map((s) => s.position)) + 1;
    const { data, error } = await sb().insert({ company_id: companyId, name: clean, position: pos }).select("id, code, name, is_active, position").single();
    if (error || !data) return say(/duplicate|unique/i.test(error?.message ?? "") ? t("eDup") : t("eAdd"), true);
    setList((l) => [...l, data as LeadSource].sort((a, b) => a.position - b.position)); setName(""); say(t("added"));
  }
  async function patch(id: string, row: Partial<LeadSource>, ok = t("saved")) {
    const prev = list;
    setList((l) => l.map((s) => (s.id === id ? { ...s, ...row } : s)));
    const { error } = await sb().update(row).eq("id", id);
    if (error) { setList(prev); return say(/duplicate|unique/i.test(error.message) ? t("eDup") : t("eSave"), true); }
    say(ok);
  }
  async function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    const renum = next.map((s, k) => ({ ...s, position: k + 1 }));
    setList(renum);
    const a = renum[i], b = renum[j];
    const [r1, r2] = await Promise.all([sb().update({ position: a.position }).eq("id", a.id), sb().update({ position: b.position }).eq("id", b.id)]);
    if (r1.error || r2.error) say(t("eSave"), true);
  }
  async function remove(s: LeadSource) {
    const n = counts[s.id] ?? 0;
    if (!(await confirmDelete({ title: t("delTitle", { name: leadLabel(t, s) }), message: n ? t("delUsed", { n }) : undefined, confirmLabel: t("delete") }))) return;
    const { error } = await sb().delete().eq("id", s.id);
    if (error) return say(t("eSave"), true);
    setList((l) => l.filter((x) => x.id !== s.id)); say(t("deleted")); router.refresh();
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f6f8f9] px-4 pb-24 pt-5 lg:px-8 lg:pb-10 lg:pt-7">
      <Link prefetch={false} href="/dashboard/settings" className="text-[13px] font-medium text-[#0f766e] hover:underline">← {t("allSettings")}</Link>
      <div className="mt-1 flex items-center gap-3.5">
        <MegaphoneArt />
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[#0b1f3a] lg:text-2xl">{t("title")}</h1>
          <p className="mt-0.5 text-[14px] text-slate-500">{t("subtitle")}</p>
        </div>
      </div>

      {needsSql ? (
        <p className="mt-6 max-w-2xl rounded-xl bg-amber-50 px-4 py-3 text-[14px] text-amber-800">{t("needSql")}</p>
      ) : (
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,44rem)_20rem]">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <form onSubmit={add} className="flex gap-2">
              <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={t("newPh")} autoComplete="bp-off" className={`${inputClass} min-w-0 flex-1`} />
              <button type="submit" disabled={!name.trim()}
                className="shrink-0 rounded-lg bg-[#0f766e] px-4 text-[14px] font-semibold text-white transition-all hover:-translate-y-px hover:bg-[#0c5f59] disabled:opacity-50">{t("add")}</button>
            </form>
            <ul className="mt-4 divide-y divide-slate-100">
              {list.map((s, i) => {
                const label = leadLabel(t, s), n = counts[s.id] ?? 0, c = tone(s, i);
                return (
                  <li key={s.id} className={`group/r flex items-center gap-3 py-2.5 transition-opacity ${s.is_active ? "" : "opacity-55"}`}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[13px] font-bold transition-transform duration-200 group-hover/r:scale-105"
                      style={{ background: `${c}1a`, color: c }}>{label.slice(0, 1).toUpperCase()}</span>
                    <span className="min-w-0 flex-1">
                      {edit?.id === s.id ? (
                        <form onSubmit={(e) => { e.preventDefault(); const v = edit.name.trim(); if (v && v !== s.name) patch(s.id, { name: v }); setEdit(null); }} className="flex gap-1.5">
                          <input autoFocus value={edit.name} maxLength={60} onChange={(e) => setEdit({ ...edit, name: e.target.value })} onKeyDown={(e) => e.key === "Escape" && setEdit(null)}
                            autoComplete="bp-off" className={`${inputClass} py-1.5`} />
                          <button type="submit" className="rounded-lg bg-[#0f766e] px-3 text-[13px] font-semibold text-white">{t("save")}</button>
                        </form>
                      ) : (
                        <>
                          <span className="block text-[14.5px] font-semibold leading-snug text-[#0b1f3a] sm:truncate">{label}</span>
                          <span className="block text-[12.5px] text-slate-500">
                            {s.code ? t("builtIn") : t("custom")} · {t("customers", { n })}{!s.is_active && ` · ${t("hidden")}`}
                          </span>
                        </>
                      )}
                    </span>
                    {edit?.id !== s.id && (
                      <span className="flex shrink-0 items-center gap-0.5">
                        <IconBtn label={t("up")} onClick={() => move(i, -1)} disabled={i === 0} d="M10 15V5M5.5 9.5 10 5l4.5 4.5" />
                        <IconBtn label={t("down")} onClick={() => move(i, 1)} disabled={i === list.length - 1} d="M10 5v10M5.5 10.5 10 15l4.5-4.5" />
                        {!s.code && <IconBtn label={t("rename")} onClick={() => setEdit({ id: s.id, name: s.name ?? "" })} d="M12.5 4.5l3 3L7 16H4v-3zM11 6l3 3" />}
                        {!s.code && <IconBtn label={t("delete")} danger onClick={() => remove(s)} d="M4.5 6h11M8 6V4.5h4V6M6 6l.7 9.5h6.6L14 6" />}
                        <button type="button" role="switch" aria-checked={s.is_active} title={s.is_active ? t("hide") : t("show")}
                          onClick={() => patch(s.id, { is_active: !s.is_active }, s.is_active ? t("nowHidden") : t("nowShown"))}
                          className={`ml-1.5 flex h-6 w-11 items-center rounded-full p-0.5 transition-colors duration-200 ${s.is_active ? "bg-[#14a39a]" : "bg-slate-300"}`}>
                          <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${s.is_active ? "translate-x-5" : ""}`} />
                        </button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
          <aside className="h-fit space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 xl:sticky xl:top-5">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">{t("howTitle")}</p>
            <p className="text-[13.5px] leading-relaxed text-slate-600">{t("how1")}</p>
            <p className="text-[13.5px] leading-relaxed text-slate-600">{t("how2")}</p>
            <p className="text-[13.5px] leading-relaxed text-slate-600">{t("how3")}</p>
            <div className="rounded-xl bg-[#f6fbfa] px-3.5 py-3 text-[13px] text-[#0f766e]">{t("tagged", { n: total })}</div>
          </aside>
        </div>
      )}
      {msg && <div role="status" className={`fixed bottom-5 left-1/2 z-[95] max-w-[92vw] -translate-x-1/2 rounded-xl px-4 py-2.5 text-[13.5px] font-medium text-white shadow-lg animate-[bp-pop-in_0.2s_ease-out] ${msg.error ? "bg-[#be123c]" : "bg-[#0b1f3a]"}`}>{msg.text}</div>}
    </div>
  );
}

function IconBtn({ label, onClick, d, disabled, danger }: { label: string; onClick: () => void; d: string; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label}
      className={`flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all duration-150 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-30 ${danger ? "hover:text-red-500" : "hover:text-[#0f766e]"}`}>
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
    </button>
  );
}

function MegaphoneArt() {
  return (
    <svg viewBox="0 0 48 48" width={48} height={48} aria-hidden="true" className="shrink-0 transition-transform duration-300 hover:-rotate-6 hover:scale-105">
      <rect x="3" y="3" width="42" height="42" rx="12" fill="#fff4ec" stroke="#f9d3bd" strokeWidth="1.5" />
      <path d="M13 21.5v6a2 2 0 0 0 2 2h3l9 6V13.5l-9 6h-3a2 2 0 0 0-2 2z" fill="#fff" stroke="#e8713a" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M18 29.5l1.8 6.5h3.2l-1.5-6.5" fill="#fde3d3" stroke="#e8713a" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M31.5 19.5a6 6 0 0 1 0 9" stroke="#14a39a" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M34.5 16a11 11 0 0 1 0 16" stroke="#14a39a" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".55" />
    </svg>
  );
}
