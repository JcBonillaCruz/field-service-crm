"use client";

import { useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { CalVisit, addDays, fmtHour, fmtTime, minutesOf, sameDay, tint } from "@/lib/jobs";
import { Col, GridApi, Handlers, Preview } from "@/components/jobs/cal-shared";
import { EventBar, TechDot } from "@/components/jobs/EventBar";

export const PX = 1; // 1 px por minuto → 60 px por hora

type Placed = { v: CalVisit; s: number; e: number; start: Date; end: Date; lane: number; lanes: number };

// Acomoda las visitas que se enciman en carriles lado a lado
function layout(items: { v: CalVisit; s: number; e: number; start: Date; end: Date }[]): Placed[] {
  const sorted = [...items].sort((a, b) => a.s - b.s || b.e - a.e);
  const out: Placed[] = [];
  let group: Placed[] = [], groupEnd = -1;
  const flush = () => { const n = Math.max(1, ...group.map((g) => g.lane + 1)); group.forEach((g) => { g.lanes = n; }); out.push(...group); group = []; };
  for (const it of sorted) {
    if (group.length && it.s >= groupEnd) { flush(); groupEnd = -1; }
    const used = new Set(group.filter((g) => g.e > it.s).map((g) => g.lane));
    let lane = 0; while (used.has(lane)) lane++;
    group.push({ ...it, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, it.e);
  }
  if (group.length) flush();
  return out;
}

export default function TimeGrid({ cols, visits, visStart, visEnd, workStart, workEnd, slot, preview, handlers, apiRef, now, dispatch, scrollTo }: {
  cols: Col[]; visits: CalVisit[]; visStart: number; visEnd: number; workStart: number; workEnd: number; slot: number;
  preview: Preview; handlers: Handlers; apiRef: React.MutableRefObject<GridApi | null>; now: Date; dispatch: boolean; scrollTo: number;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const height = (visEnd - visStart) * PX;

  useImperativeHandle(apiRef, () => ({
    scroller: () => scroller.current,
    hit: (x, y) => {
      const r = area.current?.getBoundingClientRect();
      if (!r || x < r.left || x > r.right || y < r.top - 4 || y > r.bottom + 4) return null;
      const i = Math.min(cols.length - 1, Math.max(0, Math.floor((x - r.left) / (r.width / cols.length))));
      const c = cols[i];
      return { colKey: c.key, day: c.day, techId: c.techId, minute: Math.min(visEnd, Math.max(visStart, visStart + (y - r.top) / PX)) };
    },
  }), [cols, visStart, visEnd]);

  // Al abrir: baja hasta la hora de trabajo (o la hora actual si es hoy)
  useEffect(() => {
    const el = scroller.current; if (!el) return;
    el.scrollTop = Math.max(0, (scrollTo - visStart) * PX - 24);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTo]);

  // Visitas de cada columna (por día, y en Dispatch por técnico)
  const byCol = useMemo(() => {
    const map = new Map<string, Placed[]>();
    for (const c of cols) {
      const d0 = c.day, d1 = addDays(c.day, 1);
      const items = visits.filter((v) => {
        const s = new Date(v.starts_at), e = new Date(v.ends_at);
        if (!(s < d1 && e > d0)) return false;
        if (!dispatch) return true;
        return c.techId ? v.tech_ids.includes(c.techId) : v.tech_ids.length === 0;
      }).map((v) => {
        const start = new Date(v.starts_at), end = new Date(v.ends_at);
        const s = Math.max(visStart, sameDay(start, d0) ? minutesOf(start) : 0);
        const e = Math.min(visEnd, sameDay(end, d0) ? minutesOf(end) || 24 * 60 : 24 * 60);
        return { v, s, e: Math.max(e, s + 15), start, end };
      });
      map.set(c.key, layout(items));
    }
    return map;
  }, [cols, visits, visStart, visEnd, dispatch]);

  const hours: number[] = [];
  for (let m = Math.ceil(visStart / 60) * 60; m < visEnd; m += 60) hours.push(m);
  const minCol = dispatch ? "min-w-[10rem]" : cols.length > 1 ? "min-w-[7.5rem]" : "min-w-0";
  const nowMin = minutesOf(now);

  return (
    <div ref={scroller} className="relative h-full overflow-auto overscroll-contain">
      {/* Encabezado de columnas (fijo arriba) */}
      <div className="sticky top-0 z-20 flex border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="sticky left-0 z-10 w-14 shrink-0 bg-white/95" />
        {cols.map((c) => {
          const n = byCol.get(c.key)?.length ?? 0;
          const mins = (byCol.get(c.key) ?? []).reduce((a, p) => a + (p.e - p.s), 0);
          return (
            <div key={c.key} className={`flex flex-1 ${minCol} items-center gap-2 border-l border-slate-100 px-2 py-2 ${dispatch ? "" : "justify-center"}`}>
              {dispatch ? (
                <>
                  {c.initials ? <TechDot t={{ initials: c.initials, color: c.color ?? "#94a3b8", avatar_url: c.avatar ?? null }} size={30} ring={false} />
                    : <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400"><svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10" cy="7" r="3" /><path d="M4.5 17a5.5 5.5 0 0 1 11 0" strokeLinecap="round" /></svg></span>}
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-[#0b1f3a]">{c.label}</span>
                    <span className="block text-[11px] text-slate-500">{n} job{n === 1 ? "" : "s"}{mins ? ` · ${Math.round(mins / 6) / 10}h` : ""}</span>
                  </span>
                </>
              ) : (
                <span className="flex items-baseline gap-1.5">
                  <span className="text-[12px] font-medium uppercase text-slate-500">{c.label}</span>
                  <span className={`flex h-7 min-w-[1.75rem] items-center justify-center rounded-full px-1 text-[15px] font-semibold ${c.today ? "bg-[#0f766e] text-white" : "text-[#0b1f3a]"}`}>{c.sub}</span>
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex" style={{ height }}>
        {/* Horas a la izquierda */}
        <div className="sticky left-0 z-10 w-14 shrink-0 bg-white">
          {hours.map((m) => (
            <span key={m} className="absolute right-2 -translate-y-1/2 text-[11px] text-slate-400" style={{ top: (m - visStart) * PX }}>{m === visStart ? "" : fmtHour(m)}</span>
          ))}
        </div>

        <div ref={area} className="relative flex flex-1">
          {cols.map((c) => {
            const placed = byCol.get(c.key) ?? [];
            const isToday = sameDay(c.day, now);
            return (
              <div key={c.key} className={`relative flex-1 ${minCol} border-l border-slate-100`}
                onPointerDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  const r = e.currentTarget.getBoundingClientRect();
                  handlers.onEmptyDown(e, c, visStart + (e.clientY - r.top) / PX);
                }}
                style={{
                  // Líneas de cada hora y media hora; fuera del horario de trabajo, fondo gris clarito
                  backgroundImage: `linear-gradient(to bottom, rgba(241,245,249,.75) 0, rgba(241,245,249,.75) ${(workStart - visStart) * PX}px, transparent ${(workStart - visStart) * PX}px, transparent ${(workEnd - visStart) * PX}px, rgba(241,245,249,.75) ${(workEnd - visStart) * PX}px), repeating-linear-gradient(to bottom, #e9eef3 0, #e9eef3 1px, transparent 1px, transparent ${30 * PX}px)`,
                  backgroundPositionY: `0, ${(Math.ceil(visStart / 30) * 30 - visStart) * PX}px`,
                }}>
                {placed.map((p) => (
                  <div key={`${p.v.visit_id}-${c.key}`} className="absolute px-[2px]"
                    style={{ top: (p.s - visStart) * PX + 1, height: Math.max(22, (p.e - p.s) * PX - 2),
                      // En Día la barra no se estira por toda la pantalla (máx. 22rem por carril)
                      left: cols.length === 1 ? `min(${(p.lane / p.lanes) * 100}%, ${p.lane * 22}rem)` : `${(p.lane / p.lanes) * 100}%`,
                      width: cols.length === 1 ? `min(${100 / p.lanes}%, 22rem)` : `${100 / p.lanes}%` }}>
                    <EventBar v={p.v} start={p.start} end={p.end} compact={(p.e - p.s) * PX < 46} dragging={handlers.draggingId === p.v.visit_id}
                      onDown={(e) => handlers.onVisitDown(e, p.v, c, "move")}
                      onResizeDown={(e) => handlers.onVisitDown(e, p.v, c, "resize")}
                      onHover={(el) => handlers.onVisitHover(el ? p.v : null, el)} />
                  </div>
                ))}

                {/* Fantasma mientras arrastras */}
                {preview && preview.colKey === c.key && (
                  <div className="pointer-events-none absolute inset-x-1 z-30 rounded-lg border-2 border-dashed px-2 py-1 shadow-[0_10px_24px_rgba(15,40,60,0.18)]"
                    style={{ top: (preview.startMin - visStart) * PX, height: Math.max(20, (preview.endMin - preview.startMin) * PX), borderColor: preview.color, background: tint(preview.color, 0.22) }}>
                    <p className="truncate text-[12px] font-semibold text-[#0b1f3a]">{preview.label}</p>
                    <p className="text-[11px] text-slate-600">
                      {fmtTime(new Date(2000, 0, 1, 0, preview.startMin))} – {fmtTime(new Date(2000, 0, 1, 0, preview.endMin))}
                    </p>
                  </div>
                )}

                {/* Línea de la hora actual */}
                {isToday && nowMin >= visStart && nowMin <= visEnd && (
                  <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: (nowMin - visStart) * PX }}>
                    <div className="relative h-[2px] bg-[#e11d48]"><span className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-[#e11d48]" /></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {slot < 30 && <div className="sr-only">Snaps every {slot} minutes</div>}
    </div>
  );
}
