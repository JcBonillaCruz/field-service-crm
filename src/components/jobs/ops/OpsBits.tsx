"use client";

import { useRouter } from "next/navigation";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { VisitStatus, addressLine, fmtTime, sameDay } from "@/lib/jobs";
import { OPS_GROUPS, OpsGroup, OpsJob, STAGE_LABEL, delayOf, progressOf } from "@/lib/operations";
import { AfterHoursMoon, StatusArt, TechDots } from "@/components/jobs/EventBar";

export const GROUP_TONE = Object.fromEntries(OPS_GROUPS.map((g) => [g.id, g.tone])) as Record<OpsGroup, string>;

// Anillo de % de avance (se llena con animación cuando cambia)
export function ProgressRing({ pct, size = 42, color = "#0f766e", stroke = 4, track = "#e8edf2", fill, text = "#0b1f3a" }: { pct: number; size?: number; color?: string; stroke?: number; track?: string; fill?: string; text?: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} title={`${pct}% done`} aria-label={`${pct}% done`}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="-rotate-90">
        {/* fill = disco por dentro (con un aire blanco entre el disco y el anillo que va creciendo afuera) */}
        {fill && <circle cx={size / 2} cy={size / 2} r={r - stroke / 2 - 1.5} fill={fill} />}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} style={{ transition: "stroke-dashoffset 700ms cubic-bezier(.2,.8,.2,1)" }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-bold tabular-nums" style={{ fontSize: Math.max(9, size * (fill ? 0.3 : 0.26)), color: text, letterSpacing: fill ? "-0.02em" : undefined }}>
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

// ¿Qué está pasando AHORA en el trabajo? (camioneta en camino · llave trabajando · pausa)
export function liveStatus(j: OpsJob): VisitStatus | null {
  const s = j.visit?.status;
  if (s === "on_my_way" || s === "in_progress" || s === "paused") return s;
  if (j.status === "on_hold") return "on_hold";
  return null;
}
const LIVE_TEXT: Record<string, string> = { on_my_way: "On the way", in_progress: "Working now", paused: "Paused", on_hold: "Left for follow-up" };

export type CardMenu = { label: string; onClick: () => void; danger?: boolean; icon: string; divider?: boolean }[];

// Tarjeta de un trabajo (Operations) — chiquita, como las de Assign jobs.
// Toque = ficha completa (o Assign jobs si no tiene a nadie) · ⋯ = acciones · se arrastra entre columnas
export function OpsCard({ job, group, now, innerRef, onHover, dim = false, menu, drag, dragging = false, afterHours = false, href, tiny = false, ports, tint }: {
  job: OpsJob; group: OpsGroup; now: number; compact?: boolean; afterHours?: boolean; href?: string;
  tint?: { bg: string; border: string }; // Conexiones: toda la tarjeta de un color suave (sin la rayita de arriba)
  tiny?: boolean; ports?: string[]; // tiny = 30% más chica (Conexiones) · ports = colores de las personas conectadas
  innerRef?: (el: HTMLDivElement | null) => void; onHover?: (on: boolean) => void; dim?: boolean;
  menu?: CardMenu; drag?: React.HTMLAttributes<HTMLDivElement> & { draggable?: boolean }; dragging?: boolean;
}) {
  const router = useRouter();
  const pct = progressOf(job);
  const done = group === "done";
  const live = liveStatus(job);
  const delay = delayOf(job, now);
  const addr = addressLine(job.site_address).split(",")[0];
  const color = job.type_color ?? "#94a3b8";
  const open = () => router.push(href ?? `/dashboard/jobs/${job.id}`);
  const when = done && job.completed_at
    ? `Done ${new Date(job.completed_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
    : whenLabel(job, now);
  return (
    <div ref={innerRef} role="link" tabIndex={0} onClick={open} onKeyDown={(e) => { if (e.key === "Enter") open(); }}
      onMouseEnter={() => onHover?.(true)} onMouseLeave={() => onHover?.(false)} {...drag}
      title={delay ? `${delay.label} · ${delay.detail}` : live ? LIVE_TEXT[live] : undefined}
      className={`group/card relative cursor-pointer select-none rounded-xl border ${tiny ? "px-2 py-1.5" : "px-2.5 py-2"} transition-all duration-100 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f766e]
        ${tint ? "hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(15,40,60,0.10)] hover:brightness-[0.98]" : done ? "border-[#e2e8f0] bg-[#f1f5f9]" : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-[#14a39a] hover:shadow-[0_8px_18px_rgba(15,40,60,0.09)]"}
        ${drag?.draggable ? "active:cursor-grabbing" : ""} ${dim ? "opacity-35" : ""} ${dragging ? "opacity-40" : ""}`}
      style={tint ? { background: tint.bg, borderColor: tint.border, ...(delay && !done ? { borderTop: "3px solid #e11d48" } : {}) }
        : { borderTop: `3px solid ${done ? "#16a34a" : delay ? "#e11d48" : color}` }}>
      {ports && ports.length > 0 && (
        <span className="pointer-events-none absolute -left-[5px] top-1/2 flex -translate-y-1/2 flex-col gap-0.5">
          {ports.map((c, i) => <span key={i} className="h-2 w-2 rounded-full ring-2 ring-white" style={{ background: c }} />)}
        </span>
      )}
      <div className="flex items-center gap-1.5">
        <span className={`min-w-0 flex-1 truncate ${tiny ? "text-[10.5px]" : "text-[11.5px]"} font-semibold ${delay ? "text-[#be123c]" : "text-slate-500"}`}>{delay ? delay.label : when}</span>
        {!done && (job.priority === "urgent" || job.priority === "high") && (
          <span className={`shrink-0 rounded-full px-1.5 text-[9.5px] font-bold uppercase ${job.priority === "urgent" ? "bg-[#ffe4e6] text-[#be123c]" : "bg-[#fff4e0] text-[#b45309]"}`}>{job.priority}</span>
        )}
        {afterHours && !done && <AfterHoursMoon size={16} />}
        {menu && menu.length > 0 && <CardActions items={menu} />}
      </div>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className={`truncate ${tiny ? "text-[12px]" : "text-[13.5px]"} font-semibold leading-snug ${done ? (tint ? "text-slate-500" : "text-slate-600") : "text-[#0b1f3a]"}`}>{job.customer_name || job.title || `#${job.number}`}</p>
          <p className={`truncate ${tiny ? "text-[10.5px]" : "text-[11.5px]"} text-slate-500`}>
            {[job.type_name ?? job.title, addr].filter(Boolean).join(" · ") || `#${job.number}`}
          </p>
        </div>
        {done ? <StatusArt s="completed" size={tiny ? 18 : 24} />
          : live ? <span className="relative"><StatusArt s={live} size={tiny ? 20 : 26} /></span>
          : tint
            // Conexiones (tarjeta de color): anillo naranja fuerte sobre fondo blanco para que se lea bien
            ? <ProgressRing pct={pct} size={tiny ? 34 : 38} stroke={3.5} color={delay ? "#e11d48" : "#f97316"} track="#ffffff" fill="#0b1f3a" text="#ffffff" />
            : <ProgressRing pct={pct} size={tiny ? 22 : 28} stroke={3} color={GROUP_TONE[group]} />}
      </div>
      <div className={`${tiny ? "mt-0.5" : "mt-1"} flex items-center gap-1.5`}>
        <span className={`flex ${done && tint ? "opacity-60 grayscale" : ""}`}><TechDots techs={job.techs} size={tiny ? 15 : 18} max={3} /></span>
        {job.techs.length === 1 && !tiny && <span className="truncate text-[11px] font-medium text-slate-500">{job.techs[0].name.split(" ")[0]}</span>}
        <span className="ml-auto flex items-center gap-1.5">
          {done ? <span className={`text-[10px] font-semibold uppercase tracking-wide ${tint ? "text-slate-400" : "text-[#16a34a]"}`}>{STAGE_LABEL(job)}</span>
            : group === "unassigned" && !job.techs.length ? (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#0f766e]">Assign
                <svg viewBox="0 0 20 20" className="h-3 w-3 transition-transform group-hover/card:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M7.5 5 12.5 10l-5 5" /></svg></span>
            ) : live ? <span className="text-[10.5px] font-semibold" style={{ color: live === "on_my_way" ? "#6d28d9" : live === "in_progress" ? "#b45309" : "#be123c" }}>{LIVE_TEXT[live]} · {pct}%</span>
            : <span className={`rounded-full px-1.5 py-px text-[10.5px] font-semibold ${STAGE_PILL[group === "delayed" ? "assigned" : group]}`}>{STAGE_LABEL(job)}</span>}
        </span>
      </div>
    </div>
  );
}

function CardActions({ items }: { items: CardMenu }) {
  return (
    <Menu>
      <MenuButton onClick={(e: React.MouseEvent) => e.stopPropagation()} aria-label="Job actions"
        className="-my-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#0b1f3a] data-[open]:bg-slate-100 data-[open]:text-[#0b1f3a] focus:outline-none">
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor"><circle cx="4.5" cy="10" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="15.5" cy="10" r="1.6" /></svg>
      </MenuButton>
      <MenuItems anchor="bottom end" transition onClick={(e: React.MouseEvent) => e.stopPropagation()}
        className="z-[100] mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_40px_rgba(15,40,60,0.16)] transition duration-100 data-[closed]:scale-95 data-[closed]:opacity-0 focus:outline-none">
        {items.map((a) => (
          <div key={a.label}>
            {a.divider && <div className="my-1 border-t border-slate-100" />}
            <MenuItem>
              <button type="button" onClick={(e) => { e.stopPropagation(); a.onClick(); }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] ${a.danger ? "text-red-600 data-[focus]:bg-red-50" : "text-slate-700 data-[focus]:bg-[#eef4ff] data-[focus]:text-[#0b1f3a]"}`}>
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={a.icon} /></svg>{a.label}
              </button>
            </MenuItem>
          </div>
        ))}
      </MenuItems>
    </Menu>
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
