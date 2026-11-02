"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { CalVisit, STATUS_META, VISIT_LABEL, addressLine, arrivalLabel, addMinutes, fmtDayShort, fmtRange, fmtTime, holdLabel, mapsLink, usd } from "@/lib/jobs";
import { TechDot } from "@/components/jobs/EventBar";

const W = 320;
const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

// Tarjeta flotante al pasar el mouse (o tocar) una barra del calendario
export default function VisitPopover({ v, rect, pinned, onClose, onEnter, onLeave, onUnschedule, canSeeMoney }: {
  v: CalVisit; rect: DOMRect; pinned: boolean; onClose: () => void; onEnter: () => void; onLeave: () => void;
  onUnschedule: (v: CalVisit) => void; canSeeMoney: boolean;
}) {
  if (typeof document === "undefined") return null;
  const vw = window.innerWidth, vh = window.innerHeight;
  const mobile = vw < 640;
  const left = mobile ? 12 : rect.right + 10 + W < vw ? rect.right + 10 : Math.max(12, rect.left - W - 10);
  const top = mobile ? undefined : Math.min(Math.max(12, rect.top - 8), vh - 420);
  const start = new Date(v.starts_at), end = new Date(v.ends_at);
  const st = STATUS_META[v.job_status];
  const addr = addressLine(v.site_address);
  const maps = mapsLink(v.site_address);

  const card = (
    <div role="dialog" aria-label={`Job ${v.number}`} onMouseEnter={onEnter} onMouseLeave={onLeave} onPointerDown={(e) => e.stopPropagation()}
      className={`fixed z-[90] max-h-[min(30rem,calc(100vh-1.5rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,40,60,0.22)] animate-[bp-pop-in_0.16s_ease-out] ${mobile ? "inset-x-3 bottom-3" : ""}`}
      style={mobile ? undefined : { left, top, width: W }}>
      <div className="flex items-start gap-2 border-b border-slate-100 px-4 pb-3 pt-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-semibold text-slate-500">#{v.number}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${st.badge}`}>{st.label}</span>
            {v.visit_count > 1 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">Visit {v.visit_no} of {v.visit_count}</span>}
          </div>
          <p className="mt-1 truncate text-[16px] font-semibold text-[#0b1f3a]">{v.customer_name || "No customer"}</p>
          {(v.title || v.description) && <p className="mt-0.5 line-clamp-2 text-[13px] text-slate-600">{v.title || v.description}</p>}
        </div>
        {(pinned || mobile) && (
          <button type="button" onClick={onClose} aria-label="Close"
            className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-all hover:rotate-90 hover:bg-red-50 hover:text-red-600">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
          </button>
        )}
      </div>

      <div className="space-y-2.5 px-4 py-3 text-[13.5px] text-slate-700">
        <div className="flex gap-2.5">
          <Icon d="M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />
          <div>
            <p className="font-medium text-[#0b1f3a]">{fmtDayShort(start)} · {fmtRange(start, end)}</p>
            <p className="text-[12.5px] text-slate-500">
              Arrival: {v.arrival_window_min ? `${fmtTime(start)} – ${fmtTime(addMinutes(start, v.arrival_window_min))} (${arrivalLabel(v.arrival_window_min)})` : "exact time"}
            </p>
            {v.visit_status !== "scheduled" && <p className="text-[12.5px] text-slate-500">This visit: {VISIT_LABEL[v.visit_status]}</p>}
            {v.job_status === "on_hold" && <p className="text-[12.5px] font-medium text-[#be123c]">{holdLabel(v.hold_reason)}</p>}
          </div>
        </div>
        {v.type_name && (
          <div className="flex gap-2.5"><Icon d="M4 7h16M4 12h16M4 17h10" />
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: v.type_color ?? "#94a3b8" }} />{v.type_name}</span>
          </div>
        )}
        <div className="flex gap-2.5">
          <Icon d="M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20a6.5 6.5 0 0 1 13 0M17 11a3 3 0 1 0 0-6M21 20a5.5 5.5 0 0 0-4-5.3" />
          {v.techs.length ? (
            <div className="flex flex-wrap gap-x-3 gap-y-1.5">
              {v.techs.map((t) => <span key={t.user_id} className="flex items-center gap-1.5"><TechDot t={t} size={20} ring={false} />{t.name}{t.is_lead && v.techs.length > 1 && <span className="text-[11px] text-slate-400">lead</span>}</span>)}
            </div>
          ) : <span className="text-slate-400">No technician yet</span>}
        </div>
        {addr && (
          <div className="flex gap-2.5"><Icon d="M12 21s7-6.2 7-11.5a7 7 0 1 0-14 0C5 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
            {maps ? <a href={maps} target="_blank" rel="noreferrer" className="hover:text-[#0f766e] hover:underline">{addr}</a> : <span>{addr}</span>}
          </div>
        )}
        {v.customer_phone && (
          <div className="flex gap-2.5"><Icon d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
            <a href={`tel:${v.customer_phone.replace(/[^\d+]/g, "")}`} className="hover:text-[#0f766e] hover:underline">{v.customer_phone}</a>
          </div>
        )}
        {canSeeMoney && (
          <div className="flex gap-2.5"><Icon d="M12 3v18M16.5 7.5c-.6-1.5-2.3-2.5-4.5-2.5-2.5 0-4.5 1.3-4.5 3.3 0 4.6 9 2.4 9 7.1 0 2-2 3.4-4.6 3.4-2.3 0-4.2-1-4.8-2.8" />
            <span>Estimate <b className="font-semibold text-[#0b1f3a]">{usd(v.estimated_total)}</b></span>
          </div>
        )}
        {v.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {v.tags.map((t) => <span key={t.id} className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${t.color}1f`, color: t.color }}>{t.name}</span>)}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-3">
        <Link prefetch={false} href={`/dashboard/jobs/${v.job_id}/edit`} className="rounded-lg bg-[#0f766e] px-3.5 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#0c5f59]">Open job</Link>
        {v.visit_status === "scheduled" && (
          <button type="button" onClick={() => onUnschedule(v)} className="rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-medium text-slate-700 transition-colors hover:border-[#f59e0b] hover:bg-[#fff8eb]">Move to Unscheduled</button>
        )}
        {maps && <a href={maps} target="_blank" rel="noreferrer" aria-label="Directions" title="Directions" className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-[#e9f7f4] hover:text-[#0f766e]"><svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M3 11 21 3l-8 18-2-8z" /></svg></a>}
      </div>
    </div>
  );
  return createPortal(card, document.body);
}
