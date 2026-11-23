"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { intlTag } from "@/i18n/config";
import { inputClass } from "@/components/customers/ui";

// =====================================================================
// Paso 6.8 · Settings → Address autocomplete (Google)
// Encender/apagar, límite de direcciones por día, aviso al llegar a cierto %, uso de 30 días y guía de Google Cloud.
// =====================================================================
export type UsageDay = { day: string; searches: number; picks: number };
type Cfg = { enabled: boolean; dailyLimit: number; alertPct: number };

export default function PlacesSettingsForm({ companyId, needsSql, hasKey, systemCap, initial, usage, today }: {
  companyId: string; needsSql: boolean; hasKey: boolean; systemCap: number; initial: Cfg; usage: UsageDay[]; today: string;
}) {
  const t = useTranslations("places");
  const tag = intlTag(useLocale());
  const router = useRouter();
  const [cfg, setCfg] = useState<Cfg>(initial);
  const [saved, setSaved] = useState<Cfg>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const say = (text: string, error = false) => { setMsg({ text, error }); setTimeout(() => setMsg((m) => (m?.text === text ? null : m)), 2600); };
  const dirty = cfg.enabled !== saved.enabled || cfg.dailyLimit !== saved.dailyLimit || cfg.alertPct !== saved.alertPct;

  const now = usage.find((u) => u.day === today) ?? { day: today, searches: 0, picks: 0 };
  const pct = saved.dailyLimit ? Math.min(100, Math.round((now.picks / saved.dailyLimit) * 100)) : 0;
  const days = useMemo(() => {
    const map = new Map(usage.map((u) => [u.day, u]));
    const end = new Date(`${today}T12:00:00Z`);
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(end.getTime() - (29 - i) * 864e5).toISOString().slice(0, 10);
      return map.get(d) ?? { day: d, searches: 0, picks: 0 };
    });
  }, [usage, today]);
  const month = days.reduce((a, d) => ({ picks: a.picks + d.picks, searches: a.searches + d.searches }), { picks: 0, searches: 0 });
  const peak = Math.max(1, ...days.map((d) => d.picks));
  const status = !hasKey ? "nokey" : needsSql ? "sql" : !saved.enabled ? "off" : pct >= 100 ? "limit" : "on";

  async function save() {
    const limit = Math.max(0, Math.min(5000, Math.round(cfg.dailyLimit || 0)));
    setBusy(true);
    const { error } = await createClient().rpc("places_settings_save", { p_company: companyId, p_enabled: cfg.enabled, p_daily_limit: limit, p_alert_pct: cfg.alertPct });
    setBusy(false);
    if (error) return say(t("eSave"), true);
    const next = { ...cfg, dailyLimit: limit };
    setCfg(next); setSaved(next); say(t("saved")); router.refresh();
  }

  const STATUS: Record<string, { text: string; cls: string; dot: string }> = {
    on: { text: t("stOn"), cls: "bg-[#e9f7f4] text-[#0f766e]", dot: "bg-[#14a39a] animate-pulse" },
    off: { text: t("stOff"), cls: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
    limit: { text: t("stLimit"), cls: "bg-amber-50 text-amber-800", dot: "bg-amber-500" },
    nokey: { text: t("stNoKey"), cls: "bg-amber-50 text-amber-800", dot: "bg-amber-500" },
    sql: { text: t("stSql"), cls: "bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  };
  const st = STATUS[status];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f6f8f9] px-4 pb-24 pt-5 lg:px-8 lg:pb-10 lg:pt-7">
      <Link prefetch={false} href="/dashboard/settings" className="text-[13px] font-medium text-[#0f766e] hover:underline">← {t("allSettings")}</Link>
      <div className="mt-1 flex flex-wrap items-center gap-3.5">
        <PinArt />
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold tracking-tight text-[#0b1f3a] lg:text-2xl">{t("title")}</h1>
          <p className="mt-0.5 text-[14px] text-slate-500">{t("subtitle")}</p>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold ${st.cls}`}><span className={`h-2 w-2 rounded-full ${st.dot}`} />{st.text}</span>
      </div>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          {/* Hoy */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">{t("today")}</p>
                <p className="mt-1 text-[28px] font-semibold leading-none tracking-tight text-[#0b1f3a] tabular-nums">{now.picks}<span className="text-[16px] font-medium text-slate-400"> / {saved.dailyLimit}</span></p>
                <p className="mt-1 text-[13px] text-slate-500">{t("todayText", { searches: now.searches })}</p>
              </div>
              <span className={`text-[13px] font-semibold tabular-nums ${pct >= saved.alertPct ? "text-amber-700" : "text-[#0f766e]"}`}>{pct}%</span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full transition-[width] duration-700 ease-out ${pct >= 100 ? "bg-[#e11d48]" : pct >= saved.alertPct ? "bg-[#f59e0b]" : "bg-[#14a39a]"}`} style={{ width: `${Math.max(pct, now.picks ? 3 : 0)}%` }} />
            </div>
            <p className="mt-5 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{t("last30")}</p>
            <div className="mt-2 flex h-24 items-end gap-[3px]" role="img" aria-label={t("last30")}>
              {days.map((d) => (
                <span key={d.day} title={`${new Date(`${d.day}T12:00:00Z`).toLocaleDateString(tag, { month: "short", day: "numeric", timeZone: "UTC" })} · ${t("picksN", { n: d.picks })}`}
                  className={`flex-1 rounded-t-[3px] transition-all duration-300 hover:opacity-80 ${d.day === today ? "bg-[#e8713a]" : "bg-[#14a39a]/70"}`}
                  style={{ height: `${d.picks ? Math.max(6, (d.picks / peak) * 100) : 2}%` }} />
              ))}
            </div>
            <p className="mt-2 text-[13px] text-slate-500">{t("monthText", { picks: month.picks, searches: month.searches })}</p>
          </section>

          {/* Ajustes */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-[#0b1f3a]">{t("enable")}</span>
                <span className="block text-[13px] text-slate-500">{t("enableText")}</span>
              </span>
              <button type="button" role="switch" aria-checked={cfg.enabled} onClick={() => setCfg({ ...cfg, enabled: !cfg.enabled })} disabled={needsSql}
                className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 disabled:opacity-50 ${cfg.enabled ? "bg-[#14a39a]" : "bg-slate-300"}`}>
                <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${cfg.enabled ? "translate-x-5" : ""}`} />
              </button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">{t("limit")}</span>
                <input type="number" min={0} max={5000} value={cfg.dailyLimit} disabled={needsSql}
                  onChange={(e) => setCfg({ ...cfg, dailyLimit: Number(e.target.value) })} className={inputClass} />
                <span className="mt-1 block text-[12.5px] text-slate-500">{t("limitHint")}</span>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">{t("alert")}</span>
                <select value={cfg.alertPct} disabled={needsSql} onChange={(e) => setCfg({ ...cfg, alertPct: Number(e.target.value) })} className={inputClass}>
                  {[50, 70, 80, 90, 100].map((v) => <option key={v} value={v}>{v}%</option>)}
                </select>
                <span className="mt-1 block text-[12.5px] text-slate-500">{t("alertHint")}</span>
              </label>
            </div>
            {systemCap > 0 && <p className="mt-3 text-[12.5px] text-slate-500">{t("capNote", { n: systemCap })}</p>}
            <div className="mt-5 flex items-center gap-3">
              <button type="button" onClick={save} disabled={!dirty || busy || needsSql}
                className="rounded-lg bg-[#0f766e] px-5 py-2.5 text-[14.5px] font-semibold text-white transition-all hover:-translate-y-px hover:bg-[#0c5f59] disabled:translate-y-0 disabled:opacity-50">{busy ? t("saving") : t("save")}</button>
              {needsSql && <span className="text-[13px] text-amber-700">{t("needSql")}</span>}
            </div>
          </section>
        </div>

        {/* Guía de Google Cloud */}
        <section className="h-fit rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="text-[16px] font-semibold text-[#0b1f3a]">{t("guideTitle")}</h2>
          <p className="text-[13px] text-slate-500">{t("guideText")}</p>
          <ol className="mt-4 space-y-3">
            {(["g1", "g2", "g3", "g4", "g5", "g6"] as const).map((k, i) => {
              const done = k === "g4" && hasKey;
              return (
                <li key={k} className="flex gap-3">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12.5px] font-bold ${done ? "bg-[#14a39a] text-white" : "bg-[#fff4ec] text-[#e8713a]"}`}>
                    {done ? <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 10.5 3 3 7-7" /></svg> : i + 1}
                  </span>
                  <span className="min-w-0 pt-0.5">
                    <span className="block text-[14px] font-semibold text-[#0b1f3a]">{t(`${k}t`)}</span>
                    <span className="block text-[13px] leading-relaxed text-slate-600">{t(`${k}d`)}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 rounded-xl bg-[#f6fbfa] px-3.5 py-3 text-[12.5px] leading-relaxed text-[#0f766e]">{t("guideNote")}</p>
        </section>
      </div>
      {msg && <div role="status" className={`fixed bottom-5 left-1/2 z-[95] max-w-[92vw] -translate-x-1/2 rounded-xl px-4 py-2.5 text-[13.5px] font-medium text-white shadow-lg animate-[bp-pop-in_0.2s_ease-out] ${msg.error ? "bg-[#be123c]" : "bg-[#0b1f3a]"}`}>{msg.text}</div>}
    </div>
  );
}

function PinArt() {
  return (
    <svg viewBox="0 0 48 48" width={48} height={48} aria-hidden="true" className="shrink-0 transition-transform duration-300 hover:-translate-y-0.5 hover:scale-105">
      <rect x="3" y="3" width="42" height="42" rx="12" fill="#eef6ff" stroke="#cfe2fb" strokeWidth="1.5" />
      <path d="M9 33l9-4 12 4 9-4v-14l-9 4-12-4-9 4z" fill="#fff" stroke="#93b8ea" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M18 15v14M30 19v14" stroke="#cfe2fb" strokeWidth="1.4" />
      <path d="M24 33s7-6.4 7-11.6a7 7 0 0 0-14 0C17 26.6 24 33 24 33z" fill="#e8713a" stroke="#c95a26" strokeWidth="1.2" />
      <circle cx="24" cy="22.2" r="2.6" fill="#fff" />
    </svg>
  );
}
