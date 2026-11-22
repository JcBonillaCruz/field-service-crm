"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { CalVisit, addDays, barColor, isoDay, minutesOf, sameDay, tint } from "@/lib/jobs";
import { Col, GridApi, Handlers, Preview } from "@/components/jobs/cal-shared";
import { StatusArt, TechDot, TechDots } from "@/components/jobs/EventBar";

import { useTranslations } from "next-intl";
import { useJobsTx } from "@/i18n/useJobsTx";
// =====================================================================
// Dispatch (como Housecall Pro): una FILA por técnico, las horas de lado a lado y los 7 días de la semana.
// Se arrastra a la derecha/izquierda para cambiar la hora o el día, y arriba/abajo para cambiar de técnico.
// =====================================================================
// Tamaños: Dispatch (semana, compacto) · Day (un solo día, grande: una fila por persona como tablero de despacho)
const SIZE = {
  week: { HOUR_W: 76, LANE_H: 40, NAME_W: 168, PAD: 7 },
  big: { HOUR_W: 132, LANE_H: 62, NAME_W: 212, PAD: 10 },
  bigSmall: { HOUR_W: 104, LANE_H: 54, NAME_W: 118, PAD: 8 }, // celular
};

type Row = Col; // fila = técnico (techId) o "Unassigned" (techId null)
type Placed = { v: CalVisit; dayIdx: number; s: number; e: number; lane: number };

export default function DispatchGrid({ days, rows, visits, dStart, dEnd, preview, handlers, apiRef, now, big = false, scrollTo }: {
  days: Date[]; rows: Row[]; visits: CalVisit[]; dStart: number; dEnd: number; preview: Preview; handlers: Handlers;
  apiRef: React.MutableRefObject<GridApi | null>; now: Date; big?: boolean; scrollTo?: number;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const tc = useTranslations("common");
  const ts = useTranslations("sched");
  const { hour: fmtHour, time: fmtTime } = useJobsTx();
  const [small, setSmall] = useState(false);
  useEffect(() => { const f = () => setSmall(window.innerWidth < 640); f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  const { HOUR_W, LANE_H, NAME_W, PAD } = big ? (small ? SIZE.bigSmall : SIZE.big) : SIZE.week;
  const PXM = HOUR_W / 60;
  // Day: al abrir, se corre de lado hasta la hora de trabajo (o la hora actual si es hoy)
  useEffect(() => {
    if (!big || scrollTo == null || !scroller.current) return;
    scroller.current.scrollLeft = Math.max(0, (scrollTo - dStart) * PXM - 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [big, scrollTo, PXM, isoDay(days[0])]);
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
    return { row: r, items, height: lanes * LANE_H + PAD * 2 };
  }), [rows, visits, days, dStart, dEnd, LANE_H, PAD]);

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
  }), [days, dayW, offsets, layout, dStart, dEnd, PXM]);

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
                <div className={`items-baseline gap-1.5 px-3 pb-1 pt-2 ${big && days.length === 1 ? "hidden" : "flex"}`}>
                  <span className={`text-[17px] font-semibold ${today ? "text-[#0f766e]" : "text-[#0b1f3a]"}`}>{String(d.getDate()).padStart(2, "0")}</span>
                  <span className="text-[12px] text-slate-500">{d.toLocaleDateString("en-US", { weekday: "short" })}</span>
                  {today && <span className="rounded-full bg-[#0f766e] px-1.5 text-[10px] font-semibold text-white">{tc("today")}</span>}
                </div>
                <div className="flex">
                  {hours.map((m) => <span key={m} className={`shrink-0 border-l border-slate-100 ${big ? "flex h-11 items-center pl-3 text-[12.5px] font-medium text-slate-500" : "pb-1.5 pl-1 text-[10.5px] text-slate-400"}`} style={{ width: HOUR_W }}>{fmtHour(m)}</span>)}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex">
          {/* Nombres de los técnicos (fijos a la izquierda) */}
          <div className="sticky left-0 z-10 shrink-0 border-r border-slate-200 bg-white" style={{ width: NAME_W }}>
            {layout.map(({ row, height, items }) => (
              <div key={row.key} className={`flex items-center border-b border-slate-100 ${big ? "gap-2 px-2.5 sm:gap-3 sm:px-4" : "gap-2.5 px-3"}`} style={{ height }}>
                {row.initials ? <TechDot t={{ initials: row.initials, color: row.color ?? "#94a3b8", avatar_url: row.avatar ?? null }} size={big ? (small ? 30 : 42) : 32} ring={false} />
                  : big ? null : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400"><svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10" cy="7" r="3" /><path d="M4.5 17a5.5 5.5 0 0 1 11 0" strokeLinecap="round" /></svg></span>}
                <span className="min-w-0">
                  <span className={`block truncate font-semibold ${big ? (row.initials ? "text-[12.5px] text-[#0b1f3a] sm:text-[14.5px]" : "text-[12.5px] text-slate-500 sm:text-[14.5px]") : "text-[13px] text-[#0b1f3a]"}`}>{row.label}</span>
                  <span className={`block text-slate-500 ${big ? "text-[11px] sm:text-[12px]" : "text-[11px]"}`}>{(() => { const n = new Set(items.map((i) => i.v.visit_id)).size; return big ? `${n} job${n === 1 ? "" : "s"}` : `${n} this week`; })()}</span>
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
                      className={`group/bar absolute flex cursor-grab select-none items-center gap-1.5 overflow-hidden text-left text-[#0b1f3a] transition-[box-shadow,opacity,transform] duration-150 touch-manipulation hover:z-10 hover:shadow-[0_8px_20px_rgba(15,40,60,0.14)] active:cursor-grabbing ${big ? "rounded-[10px] border-l-4 px-3 hover:-translate-y-px" : "rounded-md border-l-[3px] px-2"} ${handlers.draggingId === p.v.visit_id ? "opacity-40" : ""} ${p.v.visit_status === "cancelled" ? "opacity-60" : ""}`}
                      style={{ left: left + 1, width, top: p.lane * LANE_H + PAD, height: LANE_H - (big ? 8 : 6), ...(p.v.visit_status === "completed" ? { background: "#f1f5f9", borderLeftColor: "#16a34a", color: "#64748b" } : { background: tint(color, big ? 0.16 : 0.13), borderLeftColor: color }) }}>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate font-semibold leading-tight ${big ? "text-[13px] sm:text-[14px]" : "text-[12px]"}`}>{p.v.customer_name || p.v.number}</span>
                        {width > 90 && <span className={`block truncate leading-tight text-slate-500 ${big ? "mt-0.5 text-[11.5px] sm:text-[12px]" : "text-[10.5px]"}`}>{fmtTime(new Date(p.v.starts_at))} · {p.v.type_name ?? ts("job")}</span>}
                      </span>
                      <span className="flex shrink-0 items-center gap-1"><StatusArt s={p.v.visit_status} size={big ? 30 : 26} />{width > 90 && p.v.visit_status !== "completed" && (!big || p.v.techs.length > 1) && <TechDots techs={big ? p.v.techs.filter((t) => t.user_id !== row.techId) : p.v.techs} size={big ? 20 : 16} max={big ? 2 : 1} />}</span>
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
                    <div className={`pointer-events-none absolute z-30 border-2 border-dashed px-2 ${big ? "flex flex-col justify-center rounded-[10px]" : "rounded-md py-0.5"}`}
                      style={{ left: i * dayW + (Math.max(dStart, preview.startMin) - dStart) * PXM, width: Math.max(24, (Math.min(dEnd, preview.endMin) - Math.max(dStart, preview.startMin)) * PXM), top: PAD - 1, height: LANE_H - (big ? 6 : 4), borderColor: preview.color, background: tint(preview.color, 0.22) }}>
                      <p className="truncate text-[11.5px] font-semibold text-[#0b1f3a]">{preview.label}</p>
                      <p className="truncate text-[10.5px] text-slate-600">{fmtTime(new Date(2000, 0, 1, 0, preview.startMin))} – {fmtTime(new Date(2000, 0, 1, 0, preview.endMin))}</p>
                    </div>
                  );
                })()}
              </div>
            ))}

            {/* Línea de la hora actual */}
            {days.map((d, i) => sameDay(d, now) && minutesOf(now) >= dStart && minutesOf(now) <= dEnd ? (
              <div key="now" className={`pointer-events-none absolute inset-y-0 z-20 ${big ? "w-[1.5px] bg-[#e8713a]" : "w-[2px] bg-[#e11d48]"}`} style={{ left: i * dayW + (minutesOf(now) - dStart) * PXM }} />
            ) : null)}
          </div>
        </div>
      </div>
    </div>
  );
}
