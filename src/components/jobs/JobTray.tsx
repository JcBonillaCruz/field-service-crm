"use client";

import { useState } from "react";
import Link from "next/link";
import { JobRow, addressLine, holdLabel, tint } from "@/lib/jobs";

// Bandeja lateral: trabajos sin agendar y los que quedaron a medias. Se agarran y se sueltan en el calendario.
export default function JobTray({ jobs, trayRef, draggingId, dropActive, onDown, onClose }: {
  jobs: JobRow[]; trayRef: React.RefObject<HTMLDivElement>; draggingId: string | null; dropActive: boolean;
  onDown: (e: React.PointerEvent, j: JobRow) => void; onClose: () => void;
}) {
  const unsched = jobs.filter((j) => j.status === "unscheduled");
  const hold = jobs.filter((j) => j.status === "on_hold");
  const [tab, setTab] = useState<"unscheduled" | "on_hold">(unsched.length || !hold.length ? "unscheduled" : "on_hold");
  const list = tab === "unscheduled" ? unsched : hold;

  return (
    <div ref={trayRef} className={`flex h-full w-full flex-col bg-white transition-colors ${dropActive ? "bg-[#fff8eb] ring-2 ring-inset ring-[#f59e0b]" : ""}`}>
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
        <p className="text-[14px] font-semibold text-[#0b1f3a]">To schedule</p>
        <button type="button" onClick={onClose} aria-label="Hide panel" title="Hide panel"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m8 5 5 5-5 5" /></svg>
        </button>
      </div>
      <div className="flex gap-1 border-b border-slate-100 px-2 py-1.5">
        {([["unscheduled", "Unscheduled", unsched.length], ["on_hold", "On hold", hold.length]] as const).map(([k, label, n]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] font-semibold transition-colors ${tab === k ? "bg-[#e9f7f4] text-[#0f766e]" : "text-slate-500 hover:bg-slate-50"}`}>
            {label}
            <span className={`rounded-full px-1.5 text-[11px] ${tab === k ? "bg-[#0f766e] text-white" : k === "on_hold" && n ? "bg-[#ffe4e6] text-[#be123c]" : "bg-slate-100 text-slate-500"}`}>{n}</span>
          </button>
        ))}
      </div>

      <div data-tray-list className="flex-1 space-y-2 overflow-y-auto p-2.5">
        {dropActive && <p className="rounded-lg border-2 border-dashed border-[#f59e0b] bg-white px-3 py-3 text-center text-[12.5px] font-medium text-[#b45309]">Drop here to unschedule</p>}
        {list.length === 0 && !dropActive && (
          <div className="px-3 py-10 text-center">
            <p className="text-[13.5px] font-medium text-slate-600">{tab === "unscheduled" ? "Everything is on the calendar" : "No jobs on hold"}</p>
            <p className="mt-1 text-[12.5px] text-slate-400">{tab === "unscheduled" ? "New jobs without a date show up here." : "Jobs left for follow-up show up here to book the next visit."}</p>
          </div>
        )}
        {list.map((j) => {
          const color = j.type_color ?? "#94a3b8";
          return (
            <div key={j.id} role="button" tabIndex={0} onPointerDown={(e) => onDown(e, j)}
              className={`group cursor-grab select-none rounded-xl border border-slate-200 bg-white p-2.5 transition-[box-shadow,transform,border-color] duration-100 touch-manipulation hover:-translate-y-px hover:border-[#14a39a] hover:shadow-[0_8px_20px_rgba(15,40,60,0.10)] active:cursor-grabbing ${draggingId === j.id ? "opacity-40" : ""}`}
              style={{ borderLeft: `3px solid ${color}` }}>
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate text-[13.5px] font-semibold text-[#0b1f3a]">{j.customer_name || j.title || j.number}</p>
                <span className="shrink-0 text-[11px] font-medium text-slate-400">#{j.number}</span>
              </div>
              <p className="mt-0.5 truncate text-[12px] text-slate-600">{[j.type_name, j.title].filter(Boolean).join(" · ") || "Job"}</p>
              {j.site_address && <p className="truncate text-[11.5px] text-slate-400">{addressLine(j.site_address)}</p>}
              {j.status === "on_hold" && (
                <p className="mt-1.5 rounded-md px-2 py-1 text-[11.5px] font-medium text-[#be123c]" style={{ background: tint("#e11d48", 0.08) }}>
                  {holdLabel(j.hold_reason)}{j.hold_note ? ` — ${j.hold_note}` : ""}
                  <span className="block font-normal text-[#be123c]/70">Next visit will be #{j.visit_count + 1}</span>
                </p>
              )}
              {j.priority === "urgent" || j.priority === "high" ? (
                <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${j.priority === "urgent" ? "bg-[#ffe4e6] text-[#be123c]" : "bg-[#fff4e0] text-[#b45309]"}`}>{j.priority === "urgent" ? "Urgent" : "High priority"}</span>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="border-t border-slate-100 p-2.5">
        <Link prefetch={false} href="/dashboard/jobs/new?unscheduled=1" className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-2 text-[13px] font-semibold text-[#0f766e] transition-colors hover:border-[#0f766e] hover:bg-[#f3fbf8]">
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>
          Job without a date
        </Link>
      </div>
    </div>
  );
}
