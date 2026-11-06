"use client";

import { useImperativeHandle, useMemo, useRef } from "react";
import { CalVisit, addDays, barColor, fmtHour, fmtTime, isoDay, minutesOf, sameDay, tint } from "@/lib/jobs";
import { Col, GridApi, Handlers, Preview } from "@/components/jobs/cal-shared";
import { StatusArt, TechDot, TechDots } from "@/components/jobs/EventBar";

// =====================================================================
// Dispatch (como Housecall Pro): una FILA por técnico, las horas de lado a lado y los 7 días de la semana.
// Se arrastra a la derecha/izquierda para cambiar la hora o el día, y arriba/abajo para cambiar de técnico.
// =====================================================================
const HOUR_W = 76;      // ancho de una hora
const LANE_H = 40;      // alto de cada barra
const NAME_W = 168;     // columna de nombres
const PXM = HOUR_W / 60;

type Row = Col; // fila = técnico (techId) o "Unassigned" (techId null)
type Placed = { v: CalVisit; dayIdx: number; s: number; e: number; lane: number };

export default function DispatchGrid({ days, rows, visits, dStart, dEnd, preview, handlers, apiRef, now }: {
  days: Date[]; rows: Row[]; visits: CalVisit[]; dStart: number; dEnd: number; preview: Preview; handlers: Handlers;
  apiRef: React.MutableRefObject<GridApi | null>; now: Date;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const dayW = ((dEnd - dStart) / 60) * HOUR_W;

  // Cada fila: sus visitas acomodadas en carriles (si se enciman, una debajo de otra)
  const layout = useMemo(() => rows.map((r) => {
    const items: Placed[] = [];
    visits.forEach((v) => {
      if (r.techId ? !v.tech_ids.includes(r.techId) : v.tech_ids.length > 0) return;
      const s0 = new Date(v.starts_at), e0 = new Date(v.ends_at);
      days.forEach((d, i) => {
        const d1 = addDays(d, 1);
        if (!(s0 < d1 && e0 > d)) return;
        const s = Math.max(dStart, sameDay(s0, d) ? minutesOf(s0) : dStart);
        const e = Math.min(dEnd, sameDay(e0, d) ? minutesOf(e0) || 24 * 60 : dEnd);
        if (e <= dStart || s >= dEnd) return;
        items.push({ v, dayIdx: i, s, e: Math.max(e, s + 20), lane: 0 });
      });
    });
    items.sort((a, b) => a.dayIdx - b.dayIdx || a.s - b.s);
    const laneEnd: number[] = [];
    items.forEach((it) => {
      const x = it.dayIdx * 10000 + it.s;
      let l = laneEnd.findIndex((end) => end <= x);
      if (l < 0) { l = laneEnd.length; laneEnd.push(0); }
      laneEnd[l] = it.dayIdx * 10000 + it.e;
      it.lane = l;
    });
    const lanes = Math.max(1, laneEnd.length);
    return { row: r, items, height: lanes * LANE_H + 14 };
  }), [rows, visits, days, dStart, dEnd]);

  const offsets = useMemo(() => { let y = 0; return layout.map((l) => { const top = y; y += l.height; return top; }); }, [layout]);
  const keyFor = (r: Row, d: Date) => `${r.key}@${isoDay(d)}`;

  useImperativeHandle(apiRef, () => ({
    scroller: () => scroller.current,
    hit: (x, y) => {
      const r = area.current?.getBoundingClientRect();
      if (!r || x < r.left || x > r.right || y < r.top || y > r.bottom) return null;
      const px = x - r.left, py = y - r.top;
      const dayIdx = Math.min(days.length - 1, Math.max(0, Math.floor(px / dayW)));
      let ri = offsets.findIndex((top, i) => py >= top && py < top + layout[i].height);
      if (ri < 0) ri = layout.length - 1;
      const row = layout[ri].row, day = days[dayIdx];
      return { colKey: keyFor(row, day), day, techId: row.techId, minute: Math.min(dEnd, Math.max(dStart, dStart + (px - dayIdx * dayW) / PXM)) };
    },
  }), [days, dayW, offsets, layout, dStart, dEnd]);

  const hours: number[] = [];
  for (let m = dStart; m < dEnd; m += 60) hours.push(m);

  return (
    <div ref={scroller} className="relative h-full touch-manipulation overflow-auto overscroll-contain bg-white">
      <div style={{ width: NAME_W + dayW * days.length }}>
        {/* Encabezado: días y horas */}
        <div className="sticky top-0 z-20 flex border-b border-slate-200 bg-white">
          <div className="sticky left-0 z-10 shrink-0 border-r border-slate-200 bg-white" style={{ width: NAME_W }} />
          {days.map((d) => {
            const today = sameDay(d, now);
            return (
              <div key={isoDay(d)} className="shrink-0 border-r border-slate-200" style={{ width: dayW }}>
                <div className="flex items-baseline gap-1.5 px-3 pb-1 pt-2">
                  <span className={`text-[17px] font-semibold ${today ? "text-[#0f766e]" : "text-[#0b1f3a]"}`}>{String(d.getDate()).padStart(2, "0")}</span>
                  <span className="text-[12px] text-slate-500">{d.toLocaleDateString("en-US", { weekday: "short" })}</span>
                  {today && <span className="rounded-full bg-[#0f766e] px-1.5 text-[10px] font-semibold text-white">Today</span>}
                </div>
                <div className="flex">
                  {hours.map((m) => <span key={m} className="shrink-0 border-l border-slate-100 pb-1.5 pl-1 text-[10.5px] text-slate-400" style={{ width: HOUR_W }}>{fmtHour(m)}</span>)}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex">
          {/* Nombres de los técnicos (fijos a la izquierda) */}
          <div className="sticky left-0 z-10 shrink-0 border-r border-slate-200 bg-white" style={{ width: NAME_W }}>
            {layout.map(({ row, height, items }) => (
              <div key={row.key} className="flex items-center gap-2.5 border-b border-slate-100 px-3" style={{ height }}>
                {row.initials ? <TechDot t={{ initials: row.initials, color: row.color ?? "#94a3b8", avatar_url: row.avatar ?? null }} size={32} ring={false} />
                  : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400"><svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10" cy="7" r="3" /><path d="M4.5 17a5.5 5.5 0 0 1 11 0" strokeLinecap="round" /></svg></span>}
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-[#0b1f3a]">{row.label}</span>
                  <span className="block text-[11px] text-slate-500">{new Set(items.map((i) => i.v.visit_id)).size} this week</span>
                </span>
              </div>
            ))}
          </div>

          {/* Carriles */}
          <div ref={area} className="relative" style={{ width: dayW * days.length }}>
            {layout.map(({ row, items, height }) => (
              <div key={row.key} className="relative border-b border-slate-100"
                style={{ height, backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${dayW - 1}px, #e2e8f0 ${dayW - 1}px, #e2e8f0 ${dayW}px), repeating-linear-gradient(to right, #f1f5f9 0, #f1f5f9 1px, transparent 1px, transparent ${HOUR_W}px)` }}
                onPointerDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  const r = e.currentTarget.getBoundingClientRect();
                  const px = e.clientX - r.left, i = Math.min(days.length - 1, Math.floor(px / dayW));
                  handlers.onEmptyDown(e, { ...row, key: keyFor(row, days[i]), day: days[i] }, dStart + (px - i * dayW) / PXM);
                }}
>
                {items.map((p) => {
                  const color = barColor(p.v);
                  const left = p.dayIdx * dayW + (p.s - dStart) * PXM;
                  const width = Math.max(26, (p.e - p.s) * PXM - 3);
                  const col: Col = { ...row, key: keyFor(row, days[p.dayIdx]), day: days[p.dayIdx] };
                  const done = p.v.visit_status === "completed" || p.v.visit_status === "cancelled";
                  return (
                    <div key={`${p.v.visit_id}-${p.dayIdx}`} role="button" tabIndex={0}
                      onPointerDown={(e) => handlers.onVisitDown(e, p.v, col, "move")}
                      onMouseEnter={(e) => handlers.onVisitHover(p.v, e.currentTarget)} onMouseLeave={() => handlers.onVisitHover(null, null)}
                      className={`group/bar absolute flex cursor-grab select-none items-center gap-1.5 overflow-hidden rounded-md border-l-[3px] px-2 text-left text-[#0b1f3a] transition-[box-shadow,opacity] duration-100 touch-manipulation hover:z-10 hover:shadow-[0_6px_16px_rgba(15,40,60,0.14)] active:cursor-grabbing ${handlers.draggingId === p.v.visit_id ? "opacity-40" : ""} ${p.v.visit_status === "cancelled" ? "opacity-60" : ""}`}
                      style={{ left: left + 1, width, top: p.lane * LANE_H + 7, height: LANE_H - 6, ...(p.v.visit_status === "completed" ? { background: "#f1f5f9", borderLeftColor: "#16a34a", color: "#64748b" } : { background: tint(color, 0.13), borderLeftColor: color }) }}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-semibold leading-tight">{p.v.customer_name || p.v.number}</span>
                        {width > 90 && <span className="block truncate text-[10.5px] leading-tight text-slate-500">{fmtTime(new Date(p.v.starts_at))} · {p.v.type_name ?? "Job"}</span>}
                      </span>
                      <span className="flex shrink-0 items-center gap-1"><StatusArt s={p.v.visit_status} size={26} />{width > 90 && p.v.visit_status !== "completed" && <TechDots techs={p.v.techs} size={16} max={1} />}</span>
                      {!done && (
                        <span onPointerDown={(e) => { e.stopPropagation(); handlers.onVisitDown(e, p.v, col, "resize"); }} aria-hidden="true"
                          className="absolute inset-y-0 right-0 w-2 cursor-ew-resize [touch-action:none] hover:bg-slate-500/15" />
                      )}
                    </div>
                  );
                })}

                {/* Fantasma mientras arrastras */}
                {preview && preview.colKey.startsWith(`${row.key}@`) && (() => {
                  const i = days.findIndex((d) => preview.colKey === keyFor(row, d));
                  if (i < 0) return null;
                  return (
                    <div className="pointer-events-none absolute z-30 rounded-md border-2 border-dashed px-2 py-0.5"
                      style={{ left: i * dayW + (Math.max(dStart, preview.startMin) - dStart) * PXM, width: Math.max(24, (Math.min(dEnd, preview.endMin) - Math.max(dStart, preview.startMin)) * PXM), top: 6, height: LANE_H - 4, borderColor: preview.color, background: tint(preview.color, 0.22) }}>
                      <p className="truncate text-[11.5px] font-semibold text-[#0b1f3a]">{preview.label}</p>
                      <p className="truncate text-[10.5px] text-slate-600">{fmtTime(new Date(2000, 0, 1, 0, preview.startMin))} – {fmtTime(new Date(2000, 0, 1, 0, preview.endMin))}</p>
                    </div>
                  );
                })()}
              </div>
            ))}

            {/* Línea de la hora actual */}
            {days.map((d, i) => sameDay(d, now) && minutesOf(now) >= dStart && minutesOf(now) <= dEnd ? (
              <div key="now" className="pointer-events-none absolute inset-y-0 z-20 w-[2px] bg-[#e11d48]" style={{ left: i * dayW + (minutesOf(now) - dStart) * PXM }} />
            ) : null)}
          </div>
        </div>
      </div>
    </div>
  );
}
