"use client";

import { useLocale, useTranslations } from "next-intl";
import { intlTag } from "@/i18n/config";
import Link from "next/link";
import { KIND_META, RemovedTime, TimeEntry, fmtClock, hm, isStale, minutesOf } from "@/lib/timesheets";

// Íconos ilustrados (mismo estilo que los de las apps)
export function TimesheetArt({ size = 44 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <circle cx="24" cy="25" r="20" fill="#dff5ef" />
      <rect x="9" y="8" width="21" height="28" rx="2.8" fill="#fff" stroke="#8fd3c5" strokeWidth="1.2" />
      <rect x="15.5" y="6" width="8" height="4" rx="1.6" fill="#0f766e" />
      <rect x="12.5" y="14" width="10" height="1.9" rx=".95" fill="#14a39a" />
      <rect x="12.5" y="18.6" width="14" height="1.6" rx=".8" fill="#c9ece5" /><rect x="12.5" y="22.4" width="12" height="1.6" rx=".8" fill="#c9ece5" /><rect x="12.5" y="26.2" width="8" height="1.6" rx=".8" fill="#c9ece5" />
      <circle cx="32" cy="32" r="9.6" fill="#0f766e" stroke="#fff" strokeWidth="1.6" />
      <circle cx="32" cy="32" r="6.6" fill="#fff" />
      <path d="M32 27.8V32" stroke="#0b1f3a" strokeWidth="1.7" strokeLinecap="round" /><path d="M32 32l3 1.9" stroke="#e8713a" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="32" cy="32" r="1.2" fill="#0b1f3a" />
    </svg>
  );
}
export type KpiKind = "hours" | "site" | "travel" | "live" | "review";
// Íconos de las tarjetas: ilustrados a color, con varias capas, igual que los de All apps (una pieza se mueve al pasar el mouse)
export function KpiArt({ kind, size = 48 }: { kind: KpiKind; size?: number }) {
  const move = "transition-transform duration-300 ease-out";
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" className="shrink-0">
      {kind === "hours" && <>
        <circle cx="24" cy="25" r="20" fill="#dff5ef" />
        {/* hoja de tiempos detrás */}
        <rect x="7" y="9" width="19" height="25" rx="2.6" fill="#fff" stroke="#8fd3c5" strokeWidth="1.2" />
        <rect x="10" y="13" width="9" height="1.8" rx=".9" fill="#14a39a" />
        <rect x="10" y="17.4" width="13" height="1.5" rx=".75" fill="#c9ece5" /><rect x="10" y="21" width="11" height="1.5" rx=".75" fill="#c9ece5" /><rect x="10" y="24.6" width="7" height="1.5" rx=".75" fill="#c9ece5" />
        {/* reloj */}
        <circle cx="29" cy="28.5" r="12.6" fill="#0b5f59" />
        <circle cx="29" cy="28" r="12" fill="#0f766e" />
        <circle cx="29" cy="28" r="9.4" fill="#fff" />
        <path d="M29 20.4v1.6M29 34v1.6M21.4 28H23M35 28h1.6" stroke="#9ad9cd" strokeWidth="1.3" strokeLinecap="round" />
        <g className={`origin-[29px_28px] ${move} group-hover:rotate-[60deg]`}><path d="M29 28v-5.6" stroke="#0b1f3a" strokeWidth="1.9" strokeLinecap="round" /></g>
        <path d="M29 28l4.2 2.6" stroke="#e8713a" strokeWidth="1.9" strokeLinecap="round" />
        <circle cx="29" cy="28" r="1.5" fill="#0b1f3a" />
      </>}
      {kind === "site" && <>
        <circle cx="24" cy="25" r="20" fill="#fff1d6" />
        <ellipse cx="24" cy="39.5" rx="15" ry="2.2" fill="#f1d7a4" />
        {/* casa */}
        <rect x="27.5" y="12" width="3.6" height="7" rx=".6" fill="#b45309" />
        <path d="M12 23.5 24 13l12 10.5V38H12z" fill="#fff" />
        <path d="M12 23.5 24 13v25H12z" fill="#fdf3e0" />
        <path d="M9.5 24.6 24 11.8l14.5 12.8" fill="none" stroke="#d97706" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="21" y="28" width="6" height="10" rx="1" fill="#f59e0b" /><circle cx="25.4" cy="33.2" r=".7" fill="#7c3f00" />
        <rect x="14.6" y="26.5" width="4.4" height="4.4" rx=".7" fill="#bfe3f7" stroke="#d97706" strokeWidth=".9" />
        <rect x="29" y="26.5" width="4.4" height="4.4" rx=".7" fill="#bfe3f7" stroke="#d97706" strokeWidth=".9" />
        {/* llave de trabajo */}
        <g className={`origin-[36px_33px] ${move} group-hover:-rotate-[18deg] group-hover:scale-110`}>
          <circle cx="36" cy="33" r="7.2" fill="#0f766e" stroke="#fff" strokeWidth="1.6" />
          <path d="M38.9 30.2a2.7 2.7 0 0 1-3.4 3.4l-2.6 2.6a1 1 0 0 1-1.5-1.5l2.6-2.6a2.7 2.7 0 0 1 3.4-3.4l-1.6 1.6.4 1.5 1.5.4z" fill="#fff" />
        </g>
      </>}
      {kind === "travel" && <>
        <circle cx="24" cy="25" r="20" fill="#ece7ff" />
        {/* camino */}
        <rect x="5" y="36.4" width="38" height="3" rx="1.5" fill="#c9bef5" />
        <path d="M9 37.9h4M17 37.9h4M26 37.9h4M35 37.9h4" stroke="#fff" strokeWidth="1" strokeLinecap="round" />
        {/* pin de destino */}
        <path d="M38.5 9.5c-2.7 0-4.8 2-4.8 4.6 0 3.3 4.8 7.6 4.8 7.6s4.8-4.3 4.8-7.6c0-2.6-2.1-4.6-4.8-4.6z" fill="#e8713a" />
        <circle cx="38.5" cy="14.2" r="1.8" fill="#fff" />
        {/* van */}
        <g className={`${move} group-hover:translate-x-1`}>
          <path d="M4.5 19.8h3.4M3 23.4h3.6" stroke="#b9aaf2" strokeWidth="1.5" strokeLinecap="round" />
          <rect x="9" y="17" width="18" height="16" rx="2.2" fill="#6d28d9" />
          <path d="M27 21.5h5.4c.7 0 1.3.3 1.7.9l3 4.3c.3.4.4.8.4 1.3V33H27z" fill="#8b5cf6" />
          <path d="M28.6 23.4h3.5l2.6 3.8h-6.1z" fill="#d8ecfb" />
          <rect x="11.5" y="20" width="12.5" height="2" rx="1" fill="#a78bfa" />
          <rect x="8" y="31.6" width="30.6" height="2.4" rx="1.2" fill="#4c1d95" />
          <circle cx="15.5" cy="34.6" r="3.5" fill="#1e1b4b" /><circle cx="15.5" cy="34.6" r="1.4" fill="#c9bef5" />
          <circle cx="31" cy="34.6" r="3.5" fill="#1e1b4b" /><circle cx="31" cy="34.6" r="1.4" fill="#c9bef5" />
          <rect x="36.6" y="28.4" width="1.6" height="2" rx=".5" fill="#ffd25e" />
        </g>
      </>}
      {kind === "live" && <>
        <circle cx="24" cy="25" r="20" fill="#dcf7e6" />
        {/* persona con casco */}
        <path d="M9.5 41c0-7.2 5.4-11.6 12.5-11.6S34.5 33.8 34.5 41z" fill="#16a34a" />
        <path d="M18.4 29.9 22 34.4l3.6-4.5z" fill="#fff" />
        <circle cx="22" cy="21.5" r="6.6" fill="#f6c9a4" />
        <path d="M14.6 19.4c.3-4.3 3.4-7.2 7.4-7.2s7.1 2.9 7.4 7.2z" fill="#f5b52a" />
        <rect x="13.2" y="18.6" width="17.6" height="2.4" rx="1.2" fill="#e59a17" />
        <rect x="20.9" y="11.4" width="2.2" height="5" rx="1.1" fill="#ffd25e" />
        {/* punto verde "en vivo" con reloj */}
        <g className={`origin-[35px_33px] ${move} group-hover:scale-[1.18]`}>
          <circle cx="35" cy="33" r="8.4" fill="#22c55e" fillOpacity=".25" />
          <circle cx="35" cy="33" r="6.4" fill="#fff" stroke="#16a34a" strokeWidth="1.8" />
          <path d="M35 29.6V33l2.4 1.5" stroke="#0b1f3a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
      </>}
      {kind === "review" && <>
        <circle cx="24" cy="25" r="20" fill="#ffe7ea" />
        {/* reloj que se quedó corriendo */}
        <circle cx="21.5" cy="26.5" r="13.6" fill="#be123c" />
        <circle cx="21.5" cy="26" r="13" fill="#e11d48" />
        <circle cx="21.5" cy="26" r="10.2" fill="#fff" />
        <path d="M21.5 17.8v1.6M21.5 32.6v1.6M13.3 26h1.6M28.1 26h1.6" stroke="#fda4af" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M21.5 26v-6M21.5 26l-4.4 2.8" stroke="#0b1f3a" strokeWidth="1.9" strokeLinecap="round" />
        <circle cx="21.5" cy="26" r="1.5" fill="#0b1f3a" />
        <rect x="19.3" y="9.6" width="4.4" height="3" rx="1" fill="#be123c" />
        {/* aviso */}
        <g className={`origin-[35.5px_34px] ${move} group-hover:rotate-[-10deg] group-hover:scale-110`}>
          <path d="M35.5 25.4 44 40H27z" fill="#f5b52a" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M35.5 31v4" stroke="#7c3f00" strokeWidth="1.9" strokeLinecap="round" /><circle cx="35.5" cy="37.4" r="1.1" fill="#7c3f00" />
        </g>
      </>}
    </svg>
  );
}

// Barra del día: en sitio · traslado · otro (crece con animación)
export function SplitBar({ site, travel, other, max, height = 6 }: { site: number; travel: number; other: number; max: number; height?: number }) {
  const w = (v: number) => `${max > 0 ? Math.min(100, (v / max) * 100) : 0}%`;
  return (
    <span className="flex w-full overflow-hidden rounded-full bg-slate-100" style={{ height }} aria-hidden="true">
      <span className="origin-left animate-[bp-grow-x_0.6s_ease-out] transition-[width] duration-500" style={{ width: w(site), background: KIND_META.on_site.color }} />
      <span className="origin-left animate-[bp-grow-x_0.6s_ease-out] transition-[width] duration-500" style={{ width: w(travel), background: KIND_META.travel.color }} />
      <span className="origin-left animate-[bp-grow-x_0.6s_ease-out] transition-[width] duration-500" style={{ width: w(other), background: "#9ad9cd" }} />
    </span>
  );
}
export function Legend({ className = "" }: { className?: string }) {
  const t = useTranslations("timesheet");
  const dot = (c: string, l: string) => <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</span>;
  return <p className={`flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-500 ${className}`}>{dot(KIND_META.on_site.color, t("onSite"))}{dot(KIND_META.travel.color, t("travel"))}{dot("#9ad9cd", t("other"))}</p>;
}

// Un registro: qué fue, de qué hora a qué hora, cuánto duró y si la oficina lo corrigió (con el motivo a la vista)
export function EntryLine({ e, now, jobHref, onEdit }: { e: TimeEntry; now: number; jobHref?: (jobId: string) => string; onEdit?: (e: TimeEntry) => void }) {
  const t = useTranslations("timesheet");
  const tag = intlTag(useLocale());
  const meta = KIND_META[e.kind];
  const stale = isStale(e, now);
  const open = !e.ended_at;
  const job = e.job_number ? `${e.job_number}${e.customer_name ? ` · ${e.customer_name}` : ""}` : "";
  return (
    <li className="group flex items-start gap-2.5 py-2">
      <span className="mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full ring-4" style={{ background: meta.color, ["--tw-ring-color" as string]: meta.soft }} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 text-[13.5px] leading-snug text-[#0b1f3a]">
          <span className="font-semibold">{t(`kind.${e.kind}`)}</span>
          {job && (e.job_id && jobHref
            ? <Link prefetch={false} href={jobHref(e.job_id)} className="min-w-0 truncate text-slate-600 hover:text-[#0f766e] hover:underline">{job}</Link>
            : <span className="min-w-0 truncate text-slate-600">{job}</span>)}
          {e.is_manual && <span className="rounded-full bg-[#eef4ff] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#2563eb]">{t("addedByOffice")}</span>}
          {!e.is_manual && e.edited_at && <span className="rounded-full bg-[#fff6e6] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#b45309]">{t("corrected")}</span>}
        </p>
        <p className="text-[12.5px] tabular-nums text-slate-500">
          {fmtClock(e.started_at, tag)} – {open ? (stale ? <span className="font-semibold text-[#be123c]">{t("noClockOut")}</span> : <span className="font-semibold text-[#0f766e]">{t("now")}</span>) : fmtClock(e.ended_at, tag)}
        </p>
        {(e.edited_at || e.is_manual) && (
          <p className="mt-0.5 text-[12px] leading-snug text-slate-500">
            {t(e.is_manual ? "addedBy" : "correctedBy", { name: e.edited_by_name || t("theOffice") })}{e.fix_reason ? <> — <span className="text-slate-700">{e.fix_reason}</span></> : null}
            {!e.is_manual && e.orig_started_at && <span className="text-slate-400"> · {t("was", { from: fmtClock(e.orig_started_at, tag), to: e.orig_ended_at ? fmtClock(e.orig_ended_at, tag) : t("open") })}</span>}
          </p>
        )}
        {stale && <p className="mt-0.5 text-[12px] font-medium text-[#be123c]">{t("staleHint")}</p>}
      </div>
      <span className={`shrink-0 pt-0.5 text-[13px] font-semibold tabular-nums ${stale ? "text-[#be123c]" : "text-slate-700"}`}>{stale ? "?" : hm(minutesOf(e, now), "0m")}</span>
      {onEdit && (
        <button type="button" onClick={() => onEdit(e)} aria-label={t("correct")} title={t("correct")}
          className="group/edit -my-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition-all duration-200 hover:scale-110 hover:border-[#14a39a] hover:bg-[#e9f7f4] hover:text-[#0f766e] lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100">
          <svg viewBox="0 0 24 24" className="h-[15px] w-[15px] transition-transform duration-200 group-hover/edit:-rotate-12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
        </button>
      )}
    </li>
  );
}

// Registro que el dueño/manager borró: sigue a la vista, tachado, con quién y por qué
export function RemovedLine({ r }: { r: RemovedTime }) {
  const t = useTranslations("timesheet");
  const tag = intlTag(useLocale());
  return (
    <li className="flex items-start gap-2.5 py-2">
      <span className="mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full bg-slate-300 ring-4 ring-slate-100" />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] leading-snug text-slate-400 line-through">{KIND_META[r.kind] ? t(`kind.${r.kind}`) : t("time")} · {fmtClock(r.old_started_at, tag)} – {r.old_ended_at ? fmtClock(r.old_ended_at, tag) : t("open")}</p>
        <p className="text-[12px] leading-snug text-slate-500">{t("removedBy", { name: r.actor_name || t("theOffice") })} — <span className="text-slate-700">{r.reason}</span></p>
      </div>
    </li>
  );
}

export const Chevron = ({ open }: { open: boolean }) => (
  <svg viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 8 5 5 5-5" /></svg>
);
export const Arrow = ({ dir }: { dir: "left" | "right" }) => (
  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={dir === "left" ? "m12 5-5 5 5 5" : "m8 5 5 5-5 5"} /></svg>
);

export function TimeNeedSql() {
  return (
    <section className="mx-auto max-w-lg px-5 py-16 text-center">
      <span className="inline-flex"><TimesheetArt size={56} /></span>
      <h1 className="mt-3 text-xl font-semibold text-[#0b1f3a]">Timesheets aren&apos;t set up yet</h1>
      <p className="mt-2 text-slate-500">Run <b>paso-5.7-timesheets.sql</b> in Supabase → SQL Editor, then reload this page.</p>
    </section>
  );
}
