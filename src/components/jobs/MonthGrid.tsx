"use client";

import { useImperativeHandle, useMemo, useRef } from "react";
import { CalVisit, isoDay, sameDay, tint } from "@/lib/jobs";
import { Col, GridApi, Handlers, Preview } from "@/components/jobs/cal-shared";
import { EventChip } from "@/components/jobs/EventBar";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Vista de Mes: 6 semanas; cada día muestra hasta 3 trabajos y "+N more"
export default function MonthGrid({ days, month, visits, preview, handlers, apiRef, now, onOpenDay }: {
  days: Date[]; month: number; visits: CalVisit[]; preview: Preview; handlers: Handlers; apiRef: React.MutableRefObject<GridApi | null>;
  now: Date; onOpenDay: (d: Date) => void;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const cols: Col[] = useMemo(() => days.map((d) => ({ key: isoDay(d), day: d, techId: null, label: "" })), [days]);

  useImperativeHandle(apiRef, () => ({
    scroller: () => grid.current,
    hit: (x, y) => {
      const r = grid.current?.getBoundingClientRect();
      if (!r || x < r.left || x > r.right || y < r.top || y > r.bottom) return null;
      const c = Math.min(6, Math.floor((x - r.left) / (r.width / 7)));
      const row = Math.min(5, Math.floor((y - r.top) / (r.height / 6)));
      const col = cols[row * 7 + c];
      return col ? { colKey: col.key, day: col.day, techId: null, minute: null } : null;
    },
  }), [cols]);

  const byDay = useMemo(() => {
    const m = new Map<string, CalVisit[]>();
    for (const v of visits) {
      const k = isoDay(new Date(v.starts_at));
      m.set(k, [...(m.get(k) ?? []), v]);
    }
    m.forEach((list) => list.sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
    return m;
  }, [visits]);

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-white">
        {days.slice(0, 7).map((d) => <div key={d.getDay()} className="px-2 py-2 text-center text-[12px] font-medium uppercase text-slate-500">{DOW[d.getDay()]}</div>)}
      </div>
      <div ref={grid} className="grid flex-1 grid-cols-7 grid-rows-6 overflow-hidden">
        {cols.map((c) => {
          const list = byDay.get(c.key) ?? [];
          const out = c.day.getMonth() !== month;
          const today = sameDay(c.day, now);
          const target = preview?.colKey === c.key;
          return (
            <div key={c.key}
              onPointerDown={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.cell) handlers.onEmptyDown(e, c, null); }}
              className={`relative flex min-h-0 flex-col gap-0.5 overflow-hidden border-b border-l border-slate-100 p-1 transition-colors ${out ? "bg-slate-50/70" : "bg-white"}`}
              style={target ? { background: tint(preview!.color, 0.12), boxShadow: `inset 0 0 0 2px ${preview!.color}` } : undefined}>
              <button type="button" data-cell="1" onPointerDown={(e) => e.stopPropagation()} onClick={() => onOpenDay(c.day)}
                className={`mb-0.5 flex h-6 min-w-[1.5rem] items-center justify-center self-start rounded-full px-1 text-[12.5px] font-semibold transition-colors hover:bg-[#e9f7f4] ${today ? "bg-[#0f766e] text-white hover:bg-[#0c5f59]" : out ? "text-slate-400" : "text-[#0b1f3a]"}`}>
                {c.day.getDate()}
              </button>
              {list.slice(0, 3).map((v) => (
                <EventChip key={v.visit_id} v={v} dragging={handlers.draggingId === v.visit_id}
                  onDown={(e) => handlers.onVisitDown(e, v, c, "move")} onHover={(el) => handlers.onVisitHover(el ? v : null, el)} />
              ))}
              {list.length > 3 && (
                <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => onOpenDay(c.day)}
                  className="self-start rounded px-1.5 text-[11.5px] font-semibold text-[#0f766e] hover:bg-[#e9f7f4]">+{list.length - 3} more</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
