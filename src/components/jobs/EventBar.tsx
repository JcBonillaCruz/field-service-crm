"use client";

import { CalVisit, TechChip, barColor, fmtTime } from "@/lib/jobs";

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

// Ícono pequeño del estado de la visita (en camino, trabajando, pausado, terminado)
export function StatusGlyph({ s, className = "h-3.5 w-3.5" }: { s: CalVisit["visit_status"]; className?: string }) {
  if (s === "in_progress") return <span className="relative flex h-2.5 w-2.5" title="In progress"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#f59e0b] opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#f59e0b]" /></span>;
  const path = s === "on_my_way" ? "M3 12h11V6H3zM14 9h3l3 3v3h-6M7 18a1.6 1.6 0 1 0 0-3.2A1.6 1.6 0 0 0 7 18zM17 18a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2z"
    : s === "paused" || s === "on_hold" ? "M9 6v12M15 6v12" : s === "completed" ? "M5 12.5 9.5 17 19 7" : null;
  if (!path) return null;
  const color = s === "on_my_way" ? "#7c3aed" : s === "completed" ? "#0f766e" : "#e11d48";
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-label={s}><path d={path} /></svg>;
}

// Barra del trabajo en Day/Week (color sólido del técnico, letras blancas, como Housecall Pro)
export function EventBar({ v, start, end, compact, dragging, onDown, onResizeDown, onHover }: {
  v: CalVisit; start: Date; end: Date; compact: boolean; dragging: boolean;
  onDown: (e: React.PointerEvent) => void; onResizeDown: (e: React.PointerEvent) => void; onHover: (el: HTMLElement | null) => void;
}) {
  const color = barColor(v);
  const done = v.visit_status === "completed" || v.visit_status === "cancelled";
  return (
    <div role="button" tabIndex={0} aria-label={`${v.customer_name}, ${fmtTime(start)}`}
      onPointerDown={onDown}
      onMouseEnter={(e) => onHover(e.currentTarget)} onMouseLeave={() => onHover(null)}
      className={`group/bar absolute inset-0 flex cursor-grab select-none flex-col overflow-hidden rounded-md px-1.5 text-left text-white shadow-[0_1px_2px_rgba(15,40,60,0.18)] transition-[box-shadow,opacity,filter] duration-100 [touch-action:none] hover:z-10 hover:shadow-[0_8px_20px_rgba(15,40,60,0.25)] hover:brightness-105 active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1f3a] ${dragging ? "opacity-40" : ""} ${done ? "opacity-60" : ""}`}
      style={{ background: color }}>
      <div className={`flex min-w-0 items-start gap-1 ${compact ? "pt-0.5" : "pt-1"}`}>
        <div className="min-w-0 flex-1">
          <p className={`truncate font-semibold leading-tight ${compact ? "text-[11.5px]" : "text-[12.5px]"} ${v.visit_status === "cancelled" ? "line-through" : ""}`}>
            {v.customer_name || v.title || v.number}
          </p>
          {!compact && (
            <p className="truncate text-[11px] leading-tight text-white/85">
              {fmtTime(start)} – {fmtTime(end)}{v.visit_count > 1 ? ` · Visit ${v.visit_no}` : ""}
            </p>
          )}
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/90 p-0.5">
          <StatusGlyph s={v.visit_status} className="h-3 w-3" />
          <TechDots techs={v.techs} size={compact ? 15 : 18} max={1} />
        </span>
      </div>
      {!compact && v.type_name && <p className="mt-0.5 truncate text-[10.5px] text-white/80">{v.type_name}</p>}
      {/* Borde de abajo: estirar para cambiar la duración */}
      {!done && (
        <span onPointerDown={(e) => { e.stopPropagation(); onResizeDown(e); }} aria-hidden="true"
          className="absolute inset-x-0 bottom-0 flex h-2.5 cursor-ns-resize items-end justify-center [touch-action:none]">
          <span className="mb-0.5 h-1 w-6 rounded-full bg-white/0 transition-colors group-hover/bar:bg-white/60" />
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
      className={`flex w-full cursor-grab select-none items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11.5px] leading-snug text-white transition-shadow [touch-action:none] hover:shadow-[0_3px_10px_rgba(15,40,60,0.22)] ${dragging ? "opacity-40" : ""} ${v.visit_status === "completed" ? "opacity-60" : ""}`}
      style={{ background: color }}>
      <span className="shrink-0 text-white/80">{fmtTime(new Date(v.starts_at)).replace(":00", "").replace(" ", "").toLowerCase()}</span>
      <span className="min-w-0 truncate font-medium">{v.customer_name || v.number}</span>
    </div>
  );
}
