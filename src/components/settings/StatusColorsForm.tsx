"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import ColorPicker from "@/components/ui/ColorPicker";
import { useSetStatusColors } from "@/components/StatusColors";
import {
  DEFAULT_PALETTE, JOB_STATUS_KEYS, JobColorKey, PALETTE_CHOICES, QUOTE_STATUS_KEYS, QuoteColorKey, StatusPalette, StoredPalette,
  deep, diffPalette, mergePalette, pillStyle, soft,
} from "@/lib/status-colors";

// =====================================================================
// Paso 6.4: Settings → Status colors
// Un color por estado (trabajos y cotizaciones). Se guarda solo al cambiarlo y se ve al momento en todo el sistema.
// =====================================================================
type Group = "job" | "quote";

export default function StatusColorsForm({ companyId, stored }: { companyId: string; stored: StoredPalette }) {
  const t = useTranslations("statusColors");
  const ts = useTranslations("status");
  const router = useRouter();
  const setGlobal = useSetStatusColors();
  const [p, setP] = useState<StatusPalette>(() => mergePalette(stored));
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const say = (text: string, error = false) => { setMsg({ text, error }); setTimeout(() => setMsg((m) => (m?.text === text ? null : m)), 2600); };

  async function save(next: StatusPalette, prev: StatusPalette) {
    const { error } = await createClient().from("job_settings")
      .update({ status_colors: diffPalette(next), updated_at: new Date().toISOString() }).eq("company_id", companyId);
    if (error) {
      setP(prev); setGlobal(prev);
      return say(/status_colors/.test(`${error.message} ${error.hint ?? ""}`) ? t("needSql") : t("eSave"), true);
    }
    say(t("saved")); router.refresh();
  }
  // Cambia al momento (pantalla y resto del sistema); guarda cuando dejas de mover el color
  function change(g: Group, k: string, c: string, now = false) {
    const prev = p;
    const next: StatusPalette = g === "job" ? { ...p, job: { ...p.job, [k]: c.toLowerCase() } } : { ...p, quote: { ...p.quote, [k]: c.toLowerCase() } };
    setP(next); setGlobal(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save(next, prev), now ? 0 : 500);
  }
  function resetAll() {
    const prev = p, next = mergePalette(null);
    setP(next); setGlobal(next); clearTimeout(timer.current); save(next, prev);
  }

  const jobLabel = (k: JobColorKey) => (k === "on_hold" ? ts("hold") : ts(k));
  const quoteLabel = (k: QuoteColorKey) => t(`q.${k}`);
  const changed = JOB_STATUS_KEYS.some((k) => p.job[k] !== DEFAULT_PALETTE.job[k]) || QUOTE_STATUS_KEYS.some((k) => p.quote[k] !== DEFAULT_PALETTE.quote[k]);

  const row = (g: Group, k: string, label: string, hint: string, color: string, def: string) => (
    <li key={k} className="group/r flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-slate-50 sm:px-3">
      <Swatch value={color} onChange={(c, now) => change(g, k, c, now)} label={t("pickFor", { name: label })} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-semibold text-[#0b1f3a]">{label}</span>
        <span className="block truncate text-[12.5px] text-slate-500">{hint}</span>
      </span>
      <span className="hidden items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold sm:inline-flex" style={pillStyle(color)}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{label}
      </span>
      {color !== def && (
        <button type="button" onClick={() => change(g, k, def, true)} title={t("resetOne")} aria-label={t("resetOne")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-white hover:text-[#0f766e] hover:shadow-sm">
          <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform duration-300 group-hover/r:-rotate-45" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10a6 6 0 1 0 1.8-4.3M4 4v3.5h3.5" /></svg>
        </button>
      )}
    </li>
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f6f8f9] px-4 pb-24 pt-5 lg:px-8 lg:pb-10 lg:pt-7">
      <Link prefetch={false} href="/dashboard/settings" className="text-[13px] font-medium text-[#0f766e] hover:underline">← {t("all")}</Link>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <PaletteArt />
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-[#0b1f3a] lg:text-2xl">{t("title")}</h1>
            <p className="mt-0.5 text-[14px] text-slate-500">{t("subtitle")}</p>
          </div>
        </div>
        {changed && (
          <button type="button" onClick={resetAll}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[13.5px] font-semibold text-slate-700 transition-all hover:-translate-y-px hover:border-[#14a39a] hover:text-[#0f766e]">{t("resetAll")}</button>
        )}
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_22rem]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="text-[16px] font-semibold text-[#0b1f3a]">{t("jobs")}</h2>
          <p className="text-[13px] text-slate-500">{t("jobsText")}</p>
          <ul className="mt-3 -mx-1">{JOB_STATUS_KEYS.map((k) => row("job", k, jobLabel(k), t(`jh.${k}`), p.job[k], DEFAULT_PALETTE.job[k]))}</ul>
        </section>
        <section className="h-fit rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="text-[16px] font-semibold text-[#0b1f3a]">{t("quotes")}</h2>
          <p className="text-[13px] text-slate-500">{t("quotesText")}</p>
          <ul className="mt-3 -mx-1">{QUOTE_STATUS_KEYS.map((k) => row("quote", k, quoteLabel(k), t(`qh.${k}`), p.quote[k], DEFAULT_PALETTE.quote[k]))}</ul>
        </section>
        <Preview p={p} jobLabel={jobLabel} />
      </div>

      {msg && <div role="status" className={`fixed bottom-5 left-1/2 z-[95] max-w-[92vw] -translate-x-1/2 rounded-xl px-4 py-2.5 text-[13.5px] font-medium text-white shadow-lg animate-[bp-pop-in_0.2s_ease-out] ${msg.error ? "bg-[#be123c]" : "bg-[#0b1f3a]"}`}>{msg.text}</div>}
    </div>
  );
}

// Círculo del color + paleta para escoger (o color propio)
function Swatch({ value, onChange, label }: { value: string; onChange: (c: string, now?: boolean) => void; label: string }) {
  const t = useTranslations("statusColors");
  return (
    <Popover className="relative">
      <PopoverButton aria-label={label} title={label}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-150 hover:scale-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#14a39a]/25"
        style={{ background: soft(value, 0.16), boxShadow: `inset 0 0 0 1.5px ${soft(value, 0.4)}` }}>
        <span className="h-5 w-5 rounded-full shadow-sm ring-2 ring-white" style={{ background: value }} />
      </PopoverButton>
      <PopoverPanel anchor="bottom start" transition className="z-[100] mt-1 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_12px_40px_rgba(15,40,60,0.18)] transition data-[closed]:scale-95 data-[closed]:opacity-0">
        {({ close }) => (
          <>
            <p className="mb-2 text-[12.5px] font-semibold text-slate-500">{label}</p>
            <div className="grid grid-cols-8 gap-2">
              {PALETTE_CHOICES.map((c) => (
                <button key={c} type="button" onClick={() => { onChange(c, true); close(); }} aria-label={c}
                  className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${c === value.toLowerCase() ? "ring-2 ring-offset-2" : ""}`} style={{ background: c, ["--tw-ring-color" as string]: c }} />
              ))}
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3"><ColorPicker label={t("custom")} value={value} onChange={(c) => onChange(c)} /></div>
          </>
        )}
      </PopoverPanel>
    </Popover>
  );
}

// Vista previa: un día del calendario con una barra por estado + la leyenda (como queda en el Schedule)
function Preview({ p, jobLabel }: { p: StatusPalette; jobLabel: (k: JobColorKey) => string }) {
  const t = useTranslations("statusColors");
  const sample: { k: JobColorKey; time: string; who: string }[] = [
    { k: "scheduled", time: "8:00 AM", who: "Martinez" }, { k: "on_my_way", time: "9:30 AM", who: "Johnson" },
    { k: "in_progress", time: "10:00 AM", who: "Nguyen" }, { k: "paused", time: "11:30 AM", who: "Garcia" },
    { k: "on_hold", time: "1:00 PM", who: "Smith" }, { k: "completed", time: "2:30 PM", who: "Lopez" },
  ];
  return (
    <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 xl:sticky xl:top-5">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">{t("preview")}</p>
      <div className="mt-3 space-y-1.5 rounded-xl border border-slate-100 bg-[#fbfcfd] p-2.5">
        {sample.map((s, i) => {
          const c = p.job[s.k], done = s.k === "completed";
          return (
            <div key={s.k} className="flex items-center gap-2 rounded-[10px] border px-2.5 py-1.5 transition-colors duration-300 animate-[bp-fade_0.3s_ease-out]"
              style={{ animationDelay: `${i * 40}ms`, ...(done ? { background: "#f5f7f9", borderColor: "#e6eaef" } : { background: soft(c, 0.14), borderColor: soft(c, 0.28) }) }}>
              <span className="min-w-0 flex-1">
                <span className="block text-[10.5px] font-bold tracking-wide" style={{ color: done ? "#94a3b8" : deep(c) }}>{s.time}</span>
                <span className={`block truncate text-[12.5px] font-semibold ${done ? "text-slate-500" : "text-[#0b1f3a]"}`}>{s.who} · {jobLabel(s.k)}</span>
              </span>
              {done && <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ background: c }}>
                <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 10.5 3 3 7-7" /></svg></span>}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{t("legend")}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {JOB_STATUS_KEYS.filter((k) => k !== "unscheduled").map((k) => (
          <span key={k} className="flex items-center gap-1.5 rounded-full py-1 pl-1.5 pr-2.5 text-[11.5px] font-semibold text-slate-600" style={{ background: soft(p.job[k], 0.08) }}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.job[k] }} />{jobLabel(k)}
          </span>
        ))}
      </div>
      <p className="mt-4 text-[12.5px] leading-relaxed text-slate-500">{t("previewNote")}</p>
    </aside>
  );
}

function PaletteArt() {
  return (
    <svg viewBox="0 0 48 48" width={48} height={48} aria-hidden="true" className="shrink-0 transition-transform duration-300 hover:-rotate-6 hover:scale-105">
      <rect x="3" y="3" width="42" height="42" rx="12" fill="#e9f7f4" stroke="#bfe6de" strokeWidth="1.5" />
      <path d="M24 10c-8 0-14 6-14 13.5S16 37 23 37c2 0 3-1.5 2.4-3.1-.6-1.7.5-3.4 2.4-3.4H31a7 7 0 0 0 7-7C38 15.7 31.8 10 24 10z" fill="#fff" stroke="#14a39a" strokeWidth="1.6" />
      <circle cx="17" cy="21" r="2.6" fill="#3b82f6" /><circle cx="22.5" cy="15.8" r="2.6" fill="#8b5cf6" />
      <circle cx="29.5" cy="16.5" r="2.6" fill="#f59e0b" /><circle cx="32.5" cy="23" r="2.6" fill="#16a34a" /><circle cx="18" cy="28.5" r="2.6" fill="#e11d48" />
    </svg>
  );
}
