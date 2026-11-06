"use client";

import Link from "next/link";
import { addressLine, fmtTime, sameDay } from "@/lib/jobs";
import { OPS_GROUPS, OpsGroup, OpsJob, STAGE_LABEL, delayOf, progressOf } from "@/lib/operations";
import { TechDots } from "@/components/jobs/EventBar";

export const GROUP_TONE = Object.fromEntries(OPS_GROUPS.map((g) => [g.id, g.tone])) as Record<OpsGroup, string>;

// Anillo de % de avance (se llena con animación cuando cambia)
export function ProgressRing({ pct, size = 42, color = "#0f766e", stroke = 4 }: { pct: number; size?: number; color?: string; stroke?: number }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} title={`${pct}% done`} aria-label={`${pct}% done`}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e8edf2" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} style={{ transition: "stroke-dashoffset 700ms cubic-bezier(.2,.8,.2,1)" }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-semibold tabular-nums text-[#0b1f3a]" style={{ fontSize: Math.max(9, size * 0.26) }}>
        {pct === 100 ? (
          <svg viewBox="0 0 20 20" className="h-1/2 w-1/2" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 10.5 3.2 3.2L15 7" /></svg>
        ) : `${pct}%`}
      </span>
    </span>
  );
}

// Etiqueta roja suave de "Retrasado" (con reloj que se mueve)
export function DelayTag({ job, now, small = false }: { job: OpsJob; now: number; small?: boolean }) {
  const d = delayOf(job, now);
  if (!d) return null;
  return (
    <span title={d.detail} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#fff1f2] font-semibold text-[#be123c] ring-1 ring-[#fecdd3] ${small ? "px-1.5 py-px text-[10.5px]" : "px-2 py-0.5 text-[11.5px]"}`}>
      <svg viewBox="0 0 20 20" className={`${small ? "h-3 w-3" : "h-3.5 w-3.5"} animate-[bp-wiggle_1.6s_ease-in-out_infinite] motion-reduce:animate-none`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="10" cy="11" r="6.5" /><path d="M10 7.5V11l2.2 1.6M8 2.5h4" /></svg>
      {d.label}
    </span>
  );
}

export function whenLabel(j: OpsJob, now = Date.now()) {
  const v = j.visit;
  if (!v?.starts_at) return "Not scheduled";
  const s = new Date(v.starts_at), e = v.ends_at ? new Date(v.ends_at) : null;
  const today = new Date(now), tomorrow = new Date(now + 86400000);
  const day = sameDay(s, today) ? "Today" : sameDay(s, tomorrow) ? "Tomorrow" : s.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return `${day} · ${fmtTime(s)}${e ? ` – ${fmtTime(e)}` : ""}`;
}

const STAGE_PILL: Record<OpsGroup, string> = {
  unassigned: "bg-slate-100 text-slate-600",
  assigned: "bg-[#eef4ff] text-[#2563eb]",
  in_progress: "bg-[#fff6e6] text-[#b45309]",
  delayed: "bg-[#fff1f2] text-[#be123c]",
  done: "bg-[#e7f6f1] text-[#0f766e]",
};

// Tarjeta de un trabajo (Operations). Toda la tarjeta abre la ficha completa.
export function OpsCard({ job, group, now, compact = false, innerRef, onHover, dim = false }: {
  job: OpsJob; group: OpsGroup; now: number; compact?: boolean;
  innerRef?: (el: HTMLAnchorElement | null) => void; onHover?: (on: boolean) => void; dim?: boolean;
}) {
  const pct = progressOf(job);
  const done = group === "done";
  return (
    <Link prefetch={false} href={`/dashboard/jobs/${job.id}`} ref={innerRef}
      onMouseEnter={() => onHover?.(true)} onMouseLeave={() => onHover?.(false)}
      className={`group relative block rounded-xl border bg-white transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_10px_24px_rgba(15,40,60,0.10)] ${done ? "border-slate-200 bg-[#fafbfc]" : "border-slate-200"} ${dim ? "opacity-35" : ""} ${compact ? "px-3 py-2" : "px-3.5 py-3"}`}
      style={{ borderLeft: `3px solid ${job.type_color ?? "#94a3b8"}` }}>
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-400">
            <span>#{job.number}</span>
            {job.type_name && <><span className="text-slate-300">·</span><span className="truncate" style={{ color: job.type_color ?? undefined }}>{job.type_name}</span></>}
            {(job.priority === "urgent" || job.priority === "high") && (
              <span className={`ml-auto shrink-0 rounded-full px-1.5 text-[9.5px] font-bold uppercase ${job.priority === "urgent" ? "bg-[#ffe4e6] text-[#be123c]" : "bg-[#fff4e0] text-[#b45309]"}`}>{job.priority}</span>
            )}
          </p>
          <p className={`truncate font-semibold text-[#0b1f3a] ${compact ? "text-[13.5px]" : "text-[14.5px]"} ${done ? "text-slate-600" : ""}`}>{job.customer_name || job.title || "No customer"}</p>
          {!compact && job.title && job.customer_name && <p className="truncate text-[12.5px] text-slate-500">{job.title}</p>}
          <p className="mt-0.5 truncate text-[12px] text-slate-500">{whenLabel(job, now)}</p>
          {!compact && addressLine(job.site_address) && <p className="truncate text-[12px] text-slate-400">{addressLine(job.site_address).split(",").slice(0, 2).join(",")}</p>}
        </div>
        <ProgressRing pct={pct} size={compact ? 34 : 42} color={GROUP_TONE[group]} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <TechDots techs={job.techs} size={compact ? 20 : 22} max={3} />
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STAGE_PILL[group]}`}>{STAGE_LABEL(job)}</span>
        <DelayTag job={job} now={now} small={compact} />
        {job.checklist_total > 0 && !compact && (
          <span title="Checklist" className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m4 10 3 3 7-7" /></svg>{job.checklist_done}/{job.checklist_total}
          </span>
        )}
      </div>
    </Link>
  );
}

// Íconos ilustrados de cada grupo (estilo de los íconos de las apps, se mueven al pasar el mouse)
export function GroupArt({ g, size = 44 }: { g: OpsGroup; size?: number }) {
  const ring = { unassigned: ["#f1f5f9", "#cbd5e1", "#64748b"], assigned: ["#eef4ff", "#bfd3fe", "#2563eb"], in_progress: ["#fff6e6", "#fcd9a1", "#d97706"], delayed: ["#fff1f2", "#fecdd3", "#e11d48"], done: ["#e7f6f1", "#a7dcc9", "#0f766e"] }[g];
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" className="shrink-0 drop-shadow-sm">
      <circle cx="24" cy="24" r="22.5" fill={ring[0]} stroke={ring[1]} strokeWidth="1.5" />
      <g className="origin-center transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" style={{ transformBox: "fill-box" }}
        fill="none" stroke={ring[2]} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        {g === "unassigned" && <><circle cx="21" cy="19" r="5" /><path d="M12.5 33a8.5 8.5 0 0 1 14.5-6" /><path d="M31.5 27.5a3 3 0 1 1 3.4 3c-.6.1-1 .6-1 1.2v.6M33.9 36h.01" /></>}
        {g === "assigned" && <><circle cx="20" cy="19" r="5" /><path d="M11.5 33a8.5 8.5 0 0 1 17 0" /><path d="m29 26 3 3 6-6" /></>}
        {g === "in_progress" && <path d="M29.5 14.5a6 6 0 0 0-7.6 7.6l-8.4 8.4a2.2 2.2 0 0 0 3.1 3.1l8.4-8.4a6 6 0 0 0 7.6-7.6l-3.6 3.6-3.1-.6-.6-3.1z" />}
        {g === "delayed" && <><circle cx="24" cy="25.5" r="10" /><path d="M24 20v5.5l3.5 2.4M21 12.5h6" /></>}
        {g === "done" && <path d="m15 24.5 6 6 12-12.5" />}
      </g>
    </svg>
  );
}
