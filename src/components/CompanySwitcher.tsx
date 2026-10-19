"use client";

import { useEffect, useRef, useState } from "react";
import CompanyBadge from "@/components/CompanyBadge";
import { CompanySummary, ROLE_LABEL } from "@/lib/types";

export default function CompanySwitcher({
  companies, currentId, onSwitch, onNewCompany,
}: {
  companies: CompanySummary[];
  currentId: string | null;
  onSwitch: (id: string) => void;
  onNewCompany: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = companies.find((c) => c.id === currentId) ?? null;

  useEffect(() => {
    function close(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (companies.length === 0) return null;

  return (
    <div ref={ref} className="relative min-w-0 max-w-full sm:max-w-[260px]">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-slate-200 py-1.5 pl-1.5 pr-3 text-sm hover:bg-slate-50">
        {current && <CompanyBadge id={current.id} name={current.name} index={companies.indexOf(current)} size={28} />}
        <span className="min-w-0 flex-1 truncate text-left font-medium text-slate-800">{current?.name}</span>
        <svg viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="currentColor" aria-hidden="true">
          <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(18rem,calc(100vw-1.5rem))] origin-top overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,40,60,0.14)]">
          <p className="px-4 pb-1 pt-3 text-xs font-medium text-slate-500">Your companies</p>
          <ul className="max-h-72 overflow-y-auto py-1">
            {companies.map((c, i) => (
              <li key={c.id}>
                <button type="button" onClick={() => { onSwitch(c.id); setOpen(false); }}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 ${c.id === currentId ? "bg-[#f0faf7]" : ""}`}>
                  <CompanyBadge id={c.id} name={c.name} index={i} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">{c.name}</span>
                    <span className="block text-xs text-slate-500">{c.industry ?? "Business"} · {ROLE_LABEL[c.role]}</span>
                  </span>
                  {c.id === currentId && (
                    <svg viewBox="0 0 20 20" className="h-4 w-4 text-[#0f766e]" fill="currentColor" aria-hidden="true"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" /></svg>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => { setOpen(false); onNewCompany(); }}
            className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-3 text-sm font-semibold text-[#0f766e] hover:bg-slate-50">
            <span className="text-lg leading-none">+</span> New company
          </button>
        </div>
      )}
    </div>
  );
}
