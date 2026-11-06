"use client";

import { CalVisit, TechChip, barColor, fmtTime, tint } from "@/lib/jobs";

// Circulito con las iniciales del técnico en su color (con foto si tiene)
export function TechDot({ t, size = 22, ring = true }: { t: TechChip | { initials: string; color: string; avatar_url?: string | null; name?: string }; size?: number; ring?: boolean }) {
  return (
    <span title={"name" in t ? t.name : undefined}
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white ${ring ? "ring-2 ring-white" : ""}`}
      style={{ width: size, height: size, background: t.color, fontSize: Math.max(9, size * 0.4) }}>
      {t.avatar_url ? <img src={t.avatar_url} alt="" className="h-full w-full object-cover" /> : t.initials || "?"}
    </span>
  );
}

export function TechDots({ techs, size = 22, max = 2 }: { techs: TechChip[]; size?: number; max?: number }) {
  if (!techs.length) return (
    <span title="Unassigned" className="flex shrink-0 items-center justify-center rounded-full border border-dashed border-slate-400 bg-white text-slate-400" style={{ width: size, height: size }}>
      <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10" cy="7" r="3" /><path d="M4.5 17a5.5 5.5 0 0 1 11 0" strokeLinecap="round" /></svg>
    </span>
  );
  const shown = techs.slice(0, max);
  return (
    <span className="flex shrink-0 -space-x-1.5">
      {shown.map((t) => <TechDot key={t.user_id} t={t} size={size} />)}
      {techs.length > max && <span className="flex items-center justify-center rounded-full bg-slate-700 text-[9px] font-semibold text-white ring-2 ring-white" style={{ width: size, height: size }}>+{techs.length - max}</span>}
    </span>
  );
}

// Íconos ilustrados del estado (estilo de los íconos de las apps): camioneta en camino, llave trabajando, pausa y palomita de terminado
export function StatusArt({ s, size = 30 }: { s: CalVisit["visit_status"]; size?: number }) {
  if (s === "on_my_way") return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-label="On my way" className="shrink-0 drop-shadow-sm">
      <title>On my way</title>
      <circle cx="24" cy="24" r="23" fill="#f3efff" stroke="#c4b5fd" strokeWidth="1.5" />
      <g className="animate-[bp-drive_1s_ease-in-out_infinite] motion-reduce:animate-none">
        {/* líneas de velocidad */}
        <path d="M5 21h6M3 26h7M6 31h5" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" />
        {/* camioneta */}
        <path d="M13 17a3 3 0 0 1 3-3h13a2 2 0 0 1 2 2v15H13z" fill="#7c3aed" />
        <path d="M31 20h5.5a2 2 0 0 1 1.7 1l3.3 5.3V31H31z" fill="#6d28d9" />
        <path d="M33 22h3.6l2.6 4.2H33z" fill="#e0f2fe" />
        <rect x="16" y="17" width="6" height="5" rx="1.2" fill="#ede9fe" />
        <rect x="23.5" y="17" width="5" height="5" rx="1.2" fill="#ede9fe" />
        <rect x="13" y="26" width="18" height="2.2" fill="#e8713a" />
        <circle cx="19" cy="32" r="3.6" fill="#1f2937" /><circle cx="19" cy="32" r="1.4" fill="#e5e7eb" />
        <circle cx="35" cy="32" r="3.6" fill="#1f2937" /><circle cx="35" cy="32" r="1.4" fill="#e5e7eb" />
      </g>
    </svg>
  );
  if (s === "in_progress") return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-label="Working" className="shrink-0 drop-shadow-sm">
      <title>Working</title>
      <circle cx="24" cy="24" r="23" fill="#fff7e6" stroke="#fcd38d" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="23" fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="10 134" className="origin-center animate-[spin_2.4s_linear_infinite] motion-reduce:animate-none" />
      <g className="origin-[24px_24px] animate-[bp-wrench_1.4s_ease-in-out_infinite] motion-reduce:animate-none">
        <path d="M30.5 12.5a7 7 0 0 0-8.6 9.1L13 30.5a2.6 2.6 0 0 0 3.7 3.7l8.9-8.9a7 7 0 0 0 9.1-8.6l-4.2 4.2-3.7-.9-.9-3.7z" fill="#f59e0b" stroke="#b45309" strokeWidth="1.3" strokeLinejoin="round" />
        <circle cx="15.2" cy="32" r="1.2" fill="#fff7e6" />
      </g>
    </svg>
  );
  if (s === "paused" || s === "on_hold") return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-label={s === "paused" ? "Paused" : "On hold"} className="shrink-0 drop-shadow-sm">
      <title>{s === "paused" ? "Paused" : "Needs follow-up"}</title>
      <circle cx="24" cy="24" r="23" fill="#fff1f2" stroke="#fecdd3" strokeWidth="1.5" />
      <rect x="16.5" y="14" width="5.5" height="20" rx="2" fill="#e11d48" /><rect x="26" y="14" width="5.5" height="20" rx="2" fill="#e11d48" />
    </svg>
  );
  if (s === "completed") return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-label="Completed" className="shrink-0 animate-[bp-pop-in_0.3s_ease-out] drop-shadow-sm">
      <title>Completed</title>
      <circle cx="24" cy="24" r="23" fill="#16a34a" />
      <circle cx="24" cy="24" r="19" fill="none" stroke="#bbf7d0" strokeWidth="1.5" opacity=".6" />
      <path d="M14 24.5l6.5 6.5L34 17.5" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  return null;
}
// Compatibilidad: versión chica para lugares apretados
export function StatusGlyph({ s, className = "" }: { s: CalVisit["visit_status"]; className?: string }) {
  return <span className={className}><StatusArt s={s} size={18} /></span>;
}

// Barra del trabajo en Day/Week (color suave del técnico; terminado = gris con palomita verde grande)
export function EventBar({ v, start, end, compact, dragging, onDown, onResizeDown, onHover }: {
  v: CalVisit; start: Date; end: Date; compact: boolean; dragging: boolean;
  onDown: (e: React.PointerEvent) => void; onResizeDown: (e: React.PointerEvent) => void; onHover: (el: HTMLElement | null) => void;
}) {
  const color = barColor(v);
  const completed = v.visit_status === "completed";
  const done = completed || v.visit_status === "cancelled";
  const art = ["on_my_way", "in_progress", "paused", "on_hold", "completed"].includes(v.visit_status);
  return (
    <div role="button" tabIndex={0} aria-label={`${v.customer_name}, ${fmtTime(start)}${completed ? ", completed" : ""}`}
      onPointerDown={onDown}
      onMouseEnter={(e) => onHover(e.currentTarget)} onMouseLeave={() => onHover(null)}
      className={`group/bar absolute inset-0 flex cursor-grab select-none flex-col overflow-hidden rounded-lg border-l-[3px] pl-1.5 pr-1 text-left transition-[box-shadow,opacity] duration-100 touch-manipulation hover:z-10 hover:shadow-[0_6px_18px_rgba(15,40,60,0.14)] active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f766e] ${dragging ? "opacity-40" : ""} ${done ? "text-slate-500" : "text-[#0b1f3a]"}`}
      style={done ? { background: "#f1f5f9", borderLeftColor: completed ? "#16a34a" : "#cbd5e1" } : { background: tint(color, 0.13), borderLeftColor: color }}>
      <div className={`flex min-w-0 items-start gap-1 ${compact ? "pt-0.5" : "pt-1"}`}>
        <div className="min-w-0 flex-1">
          <p className={`truncate font-semibold leading-tight ${compact ? "text-[11.5px]" : "text-[12.5px]"} ${v.visit_status === "cancelled" ? "line-through" : ""}`}>
            {v.customer_name || v.title || v.number}
          </p>
          {!compact && (
            <p className="truncate text-[11px] leading-tight text-slate-500">
              {fmtTime(start)} – {fmtTime(end)}{v.visit_count > 1 ? ` · Visit ${v.visit_no}` : ""}
            </p>
          )}
        </div>
        <span className="flex shrink-0 items-center gap-1">
          {v.after_hours && !done && <AfterHoursMoon size={compact ? 15 : 18} />}
          {art && <StatusArt s={v.visit_status} size={compact ? 20 : 30} />}
          {!completed && <TechDots techs={v.techs} size={compact ? 15 : 18} max={1} />}
        </span>
      </div>
      {!compact && (completed
        ? <p className="mt-0.5 flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-[#16a34a]">Completed</p>
        : v.type_name && <p className="mt-0.5 truncate text-[10.5px] text-slate-500">{v.type_name}</p>)}
      {/* Borde de abajo: estirar para cambiar la duración */}
      {!done && (
        <span onPointerDown={(e) => { e.stopPropagation(); onResizeDown(e); }} aria-hidden="true"
          className="absolute inset-x-0 bottom-0 flex h-2.5 cursor-ns-resize items-end justify-center [touch-action:none]">
          <span className="mb-0.5 h-1 w-6 rounded-full bg-slate-500/0 transition-colors group-hover/bar:bg-slate-500/40" />
        </span>
      )}
    </div>
  );
}

// Chip compacto para la vista de Mes
export function EventChip({ v, dragging, onDown, onHover }: { v: CalVisit; dragging: boolean; onDown: (e: React.PointerEvent) => void; onHover: (el: HTMLElement | null) => void }) {
  const color = barColor(v);
  return (
    <div role="button" tabIndex={0} onPointerDown={onDown} onMouseEnter={(e) => onHover(e.currentTarget)} onMouseLeave={() => onHover(null)}
      className={`flex w-full cursor-grab select-none items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-left text-[11.5px] leading-snug text-[#0b1f3a] transition-shadow touch-manipulation hover:shadow-[0_3px_10px_rgba(15,40,60,0.12)] ${dragging ? "opacity-40" : ""} ${v.visit_status === "completed" ? "text-slate-500" : ""}`}
      style={{ background: v.visit_status === "completed" ? "#f1f5f9" : tint(color, 0.13) }}>
      {v.visit_status === "completed" || v.visit_status === "on_my_way" || v.visit_status === "in_progress"
        ? <StatusArt s={v.visit_status} size={14} />
        : <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />}
      <span className="shrink-0 text-slate-500">{fmtTime(new Date(v.starts_at)).replace(":00", "").replace(" ", "").toLowerCase()}</span>
      <span className="min-w-0 truncate font-medium">{v.customer_name || v.number}</span>
    </div>
  );
}

// Luna: trabajo fuera del horario de oficina (se puede cobrar extra)
export function AfterHoursMoon({ size = 18, withText = false }: { size?: number; withText?: boolean }) {
  const icon = (
    <span title="After hours — outside business hours" className="flex shrink-0 items-center justify-center rounded-full bg-[#eef0ff] ring-1 ring-[#c7d2fe]" style={{ width: size, height: size }}>
      <svg viewBox="0 0 20 20" style={{ width: size * 0.62, height: size * 0.62 }} fill="#4f46e5"><path d="M15.5 12.6A6.5 6.5 0 0 1 7.4 4.5a6.5 6.5 0 1 0 8.1 8.1z" /></svg>
    </span>
  );
  if (!withText) return icon;
  return <span className="inline-flex items-center gap-1 rounded-full bg-[#eef0ff] py-0.5 pl-0.5 pr-2 text-[11px] font-semibold text-[#4338ca] ring-1 ring-[#c7d2fe]">{icon}After hours</span>;
}
