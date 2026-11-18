"use client";

import Link from "next/link";
import { KIND_META, RemovedTime, TimeEntry, fmtClock, hm, isStale, minutesOf } from "@/lib/timesheets";

// Íconos ilustrados (mismo estilo que los de las apps)
export function TimesheetArt({ size = 44 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="#e9f7f4" />
      <rect x="11" y="10" width="20" height="26" rx="3.5" fill="#fff" stroke="#14a39a" strokeWidth="1.6" />
      <path d="M15.5 17h11M15.5 22h8M15.5 27h5" stroke="#9ad9cd" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="31.5" cy="31.5" r="8.5" fill="#0f766e" />
      <path d="M31.5 26.8v5l3.2 2" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
export type KpiKind = "hours" | "site" | "travel" | "live" | "review";
export function KpiArt({ kind, size = 40 }: { kind: KpiKind; size?: number }) {
  const bg = { hours: "#e9f7f4", site: "#fff6e6", travel: "#f3efff", live: "#e7f8ee", review: "#fff1f2" }[kind];
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" className="transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
      <rect x="2" y="2" width="44" height="44" rx="13" fill={bg} />
      {kind === "hours" && <><circle cx="24" cy="24" r="12" fill="#fff" stroke="#0f766e" strokeWidth="2" /><path d="M24 17v7.5l4.6 2.8" stroke="#14a39a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></>}
      {kind === "site" && <><path d="M13 34V22l11-8 11 8v12z" fill="#fff" stroke="#d97706" strokeWidth="2" strokeLinejoin="round" /><path d="M21 34v-7h6v7" stroke="#f59e0b" strokeWidth="2" strokeLinejoin="round" fill="#fde9c4" /></>}
      {kind === "travel" && <><path d="M11 20h15v11H11z" fill="#fff" stroke="#6d28d9" strokeWidth="2" strokeLinejoin="round" /><path d="M26 23h6l5 4.5V31H26z" fill="#ddd2fb" stroke="#6d28d9" strokeWidth="2" strokeLinejoin="round" /><circle cx="17" cy="32.5" r="3" fill="#6d28d9" /><circle cx="31.5" cy="32.5" r="3" fill="#6d28d9" /></>}
      {kind === "live" && <><circle cx="24" cy="19" r="5.5" fill="#fff" stroke="#16a34a" strokeWidth="2" /><path d="M13.5 36a10.5 10.5 0 0 1 21 0" fill="#fff" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" /><circle cx="35" cy="14" r="4.5" fill="#22c55e" stroke="#fff" strokeWidth="1.6" /></>}
      {kind === "review" && <><path d="M24 12 37 35H11z" fill="#fff" stroke="#e11d48" strokeWidth="2" strokeLinejoin="round" /><path d="M24 20.5v7" stroke="#e11d48" strokeWidth="2.4" strokeLinecap="round" /><circle cx="24" cy="31" r="1.5" fill="#e11d48" /></>}
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
  const dot = (c: string, l: string) => <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</span>;
  return <p className={`flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-500 ${className}`}>{dot(KIND_META.on_site.color, "On site")}{dot(KIND_META.travel.color, "Travel")}{dot("#9ad9cd", "Other time")}</p>;
}

// Un registro: qué fue, de qué hora a qué hora, cuánto duró y si la oficina lo corrigió (con el motivo a la vista)
export function EntryLine({ e, now, jobHref, onEdit }: { e: TimeEntry; now: number; jobHref?: (jobId: string) => string; onEdit?: (e: TimeEntry) => void }) {
  const meta = KIND_META[e.kind];
  const stale = isStale(e, now);
  const open = !e.ended_at;
  const job = e.job_number ? `${e.job_number}${e.customer_name ? ` · ${e.customer_name}` : ""}` : "";
  return (
    <li className="group flex items-start gap-2.5 py-2">
      <span className="mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full ring-4" style={{ background: meta.color, ["--tw-ring-color" as string]: meta.soft }} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 text-[13.5px] leading-snug text-[#0b1f3a]">
          <span className="font-semibold">{meta.label}</span>
          {job && (e.job_id && jobHref
            ? <Link prefetch={false} href={jobHref(e.job_id)} className="min-w-0 truncate text-slate-600 hover:text-[#0f766e] hover:underline">{job}</Link>
            : <span className="min-w-0 truncate text-slate-600">{job}</span>)}
          {e.is_manual && <span className="rounded-full bg-[#eef4ff] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#2563eb]">Added by office</span>}
          {!e.is_manual && e.edited_at && <span className="rounded-full bg-[#fff6e6] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#b45309]">Corrected</span>}
        </p>
        <p className="text-[12.5px] tabular-nums text-slate-500">
          {fmtClock(e.started_at)} – {open ? (stale ? <span className="font-semibold text-[#be123c]">no clock-out</span> : <span className="font-semibold text-[#0f766e]">now</span>) : fmtClock(e.ended_at)}
        </p>
        {(e.edited_at || e.is_manual) && (
          <p className="mt-0.5 text-[12px] leading-snug text-slate-500">
            {e.is_manual ? "Added" : "Corrected"} by {e.edited_by_name || "the office"}{e.fix_reason ? <> — <span className="text-slate-700">{e.fix_reason}</span></> : null}
            {!e.is_manual && e.orig_started_at && <span className="text-slate-400"> · was {fmtClock(e.orig_started_at)} – {e.orig_ended_at ? fmtClock(e.orig_ended_at) : "open"}</span>}
          </p>
        )}
        {stale && <p className="mt-0.5 text-[12px] font-medium text-[#be123c]">Looks like the clock-out was missed. These hours don&apos;t count until the office fixes it.</p>}
      </div>
      <span className={`shrink-0 pt-0.5 text-[13px] font-semibold tabular-nums ${stale ? "text-[#be123c]" : "text-slate-700"}`}>{stale ? "?" : hm(minutesOf(e, now), "0m")}</span>
      {onEdit && (
        <button type="button" onClick={() => onEdit(e)} aria-label="Correct this time" title="Correct this time"
          className="group/edit -my-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition-all duration-200 hover:scale-110 hover:border-[#14a39a] hover:bg-[#e9f7f4] hover:text-[#0f766e] lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100">
          <svg viewBox="0 0 24 24" className="h-[15px] w-[15px] transition-transform duration-200 group-hover/edit:-rotate-12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
        </button>
      )}
    </li>
  );
}

// Registro que el dueño/manager borró: sigue a la vista, tachado, con quién y por qué
export function RemovedLine({ r }: { r: RemovedTime }) {
  return (
    <li className="flex items-start gap-2.5 py-2">
      <span className="mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full bg-slate-300 ring-4 ring-slate-100" />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] leading-snug text-slate-400 line-through">{KIND_META[r.kind]?.label ?? "Time"} · {fmtClock(r.old_started_at)} – {r.old_ended_at ? fmtClock(r.old_ended_at) : "open"}</p>
        <p className="text-[12px] leading-snug text-slate-500">Removed by {r.actor_name || "the office"} — <span className="text-slate-700">{r.reason}</span></p>
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
