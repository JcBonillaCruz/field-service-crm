"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { StatusArt } from "@/components/jobs/EventBar";
import { CalVisit, PRIORITIES, STATUS_META, addMinutes, fmtDayShort, fmtRange, fmtTime, usd } from "@/lib/jobs";

const W = 300;
const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

// Tarjeta flotante sencilla (como Housecall Pro): cliente, teléfono, costo, urgencia, día y hora
export default function VisitPopover({ v, rect, pinned, onClose, onEnter, onLeave, onUnschedule, canSeeMoney }: {
  v: CalVisit; rect: DOMRect; pinned: boolean; onClose: () => void; onEnter: () => void; onLeave: () => void;
  onUnschedule: (v: CalVisit) => void; canSeeMoney: boolean;
}) {
  // Terminado: cuándo empezó y cuándo terminó de verdad
  const [times, setTimes] = useState<{ started_at: string | null; finished_at: string | null } | null>(null);
  useEffect(() => {
    if (v.visit_status !== "completed") return;
    createClient().from("job_visits").select("started_at, finished_at").eq("id", v.visit_id).maybeSingle().then(({ data }) => setTimes(data ?? null));
  }, [v.visit_id, v.visit_status]);
  if (typeof document === "undefined") return null;
  const vw = window.innerWidth, vh = window.innerHeight;
  const mobile = vw < 640;
  const left = mobile ? 12 : rect.right + 10 + W < vw ? rect.right + 10 : Math.max(12, rect.left - W - 10);
  const top = mobile ? undefined : Math.min(Math.max(12, rect.top - 6), vh - 300);
  const start = new Date(v.starts_at), end = new Date(v.ends_at);
  const pr = PRIORITIES.find((p) => p.value === v.priority) ?? PRIORITIES[1];
  const st = STATUS_META[v.job_status];

  const fmtAt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
  const completedCard = (
    <div role="dialog" aria-label={`Job ${v.number} completed`} onMouseEnter={onEnter} onMouseLeave={onLeave} onPointerDown={(e) => e.stopPropagation()}
      className={`fixed z-[90] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_18px_48px_rgba(15,40,60,0.2)] animate-[bp-pop-in_0.14s_ease-out] ${mobile ? "inset-x-3 bottom-3" : ""}`}
      style={mobile ? undefined : { left, top, width: W }}>
      <div className="flex items-center gap-3 bg-[#f0fdf4] px-4 py-3.5">
        <StatusArt s="completed" size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-[#15803d]">Completed successfully</p>
          <p className="text-[12.5px] text-slate-500">Job #{v.number}</p>
        </div>
        {(pinned || mobile) && (
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-all hover:rotate-90 hover:bg-red-50 hover:text-red-600">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
          </button>
        )}
      </div>
      <div className="space-y-2 px-4 py-3 text-[13.5px] text-slate-700">
        <div className="flex justify-between gap-3"><span className="text-slate-500">Customer</span><span className="truncate font-semibold text-[#0b1f3a]">{v.customer_name || "—"}</span></div>
        <div className="flex justify-between gap-3"><span className="text-slate-500">Started</span><span>{times ? fmtAt(times.started_at) : "…"}</span></div>
        <div className="flex justify-between gap-3"><span className="text-slate-500">Finished</span><span className="font-semibold text-[#15803d]">{times ? fmtAt(times.finished_at) : "…"}</span></div>
        {times?.started_at && times.finished_at && (
          <div className="flex justify-between gap-3"><span className="text-slate-500">Time on site</span>
            <span>{(() => { const m = Math.round((new Date(times.finished_at).getTime() - new Date(times.started_at).getTime()) / 60000); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`; })()}</span></div>
        )}
        {v.techs.length > 0 && <div className="flex justify-between gap-3"><span className="text-slate-500">Technician</span><span className="truncate">{v.techs.map((t) => t.name).join(", ")}</span></div>}
        {canSeeMoney && <div className="flex justify-between gap-3"><span className="text-slate-500">Amount</span><span className="font-semibold text-[#0b1f3a]">{usd(v.estimated_total)}</span></div>}
      </div>
    </div>
  );

  const card = (
    <div role="dialog" aria-label={`Job ${v.number}`} onMouseEnter={onEnter} onMouseLeave={onLeave} onPointerDown={(e) => e.stopPropagation()}
      className={`fixed z-[90] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_18px_48px_rgba(15,40,60,0.2)] animate-[bp-pop-in_0.14s_ease-out] ${mobile ? "inset-x-3 bottom-3" : ""}`}
      style={mobile ? undefined : { left, top, width: W }}>
      <div className="flex items-start gap-2 px-4 pb-2 pt-3">
        <div className="min-w-0 flex-1">
          <Link prefetch={false} href={`/dashboard/jobs/${v.job_id}/edit`} className="text-[15px] font-semibold text-[#0f766e] hover:underline">Job #{v.number}</Link>
          <p className="text-[12.5px] text-slate-500">{fmtDayShort(start)} · {fmtRange(start, end)}</p>
          {v.arrival_window_min > 0 && <p className="text-[12px] text-slate-400">Arrival {fmtTime(start)} – {fmtTime(addMinutes(start, v.arrival_window_min))}</p>}
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ${st.badge}`}>{st.label}</span>
        <Link prefetch={false} href={`/dashboard/jobs/${v.job_id}/edit`} aria-label="Edit job" title="Edit job"
          className="group/ed flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[12.5px] font-semibold text-[#0f766e] transition-colors hover:bg-[#e9f7f4]">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 transition-transform duration-200 group-hover/ed:-rotate-12 group-hover/ed:scale-110" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" /></svg>
          Edit
        </Link>
        {(pinned || mobile) && (
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-all hover:rotate-90 hover:bg-red-50 hover:text-red-600">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
          </button>
        )}
      </div>
      <div className="space-y-2 border-t border-slate-100 px-4 py-3 text-[13.5px] text-slate-700">
        <div className="flex items-center gap-2.5"><Icon d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" />
          <span className="truncate font-semibold text-[#0b1f3a]">{v.customer_name || "No customer"}</span></div>
        {v.customer_phone && (
          <div className="flex items-center gap-2.5"><Icon d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
            <a href={`tel:${v.customer_phone.replace(/[^\d+]/g, "")}`} className="hover:text-[#0f766e] hover:underline">{v.customer_phone}</a></div>
        )}
        {canSeeMoney && (
          <div className="flex items-center gap-2.5"><Icon d="M12 3v18M16.5 7.5c-.6-1.5-2.3-2.5-4.5-2.5-2.5 0-4.5 1.3-4.5 3.3 0 4.6 9 2.4 9 7.1 0 2-2 3.4-4.6 3.4-2.3 0-4.2-1-4.8-2.8" />
            <span className="font-semibold text-[#0b1f3a]">{usd(v.estimated_total)}</span></div>
        )}
        <div className="flex items-center gap-2.5"><Icon d="M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: pr.color }} />{pr.label} priority</span></div>
      </div>
      {v.visit_status === "scheduled" && pinned && (
        <div className="border-t border-slate-100 px-4 py-2">
          <button type="button" onClick={() => onUnschedule(v)} className="text-[12.5px] font-semibold text-slate-500 hover:text-[#b45309]">Move to Unscheduled</button>
        </div>
      )}
    </div>
  );
  return createPortal(v.visit_status === "completed" ? completedCard : card, document.body);
}
