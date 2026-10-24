"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import CompanyBadge from "@/components/CompanyBadge";
import OrganizationList, { NewOrgButton } from "@/components/OrganizationList";
import { CompanySummary } from "@/lib/types";

// Selector de organizaciones. El panel se dibuja directo en <body> (portal) para quedar
// SIEMPRE por encima de todo (antes quedaba detrás de la vista del QR en QR Studio).
export default function CompanySwitcher({
  companies, currentId, userId, onSwitch, onNewCompany,
}: {
  companies: CompanySummary[];
  currentId: string | null;
  userId: string;
  onSwitch: (id: string) => void;
  onNewCompany: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const current = companies.find((c) => c.id === currentId) ?? null;

  useEffect(() => {
    if (!open) { setShown(false); return; }
    const r = requestAnimationFrame(() => setShown(true));
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { cancelAnimationFrame(r); document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);

  if (companies.length === 0) return null;
  const close = () => setOpen(false);

  return (
    <div className="min-w-0 max-w-full sm:max-w-[260px]">
      <button type="button" onClick={() => setOpen(true)} aria-expanded={open}
        className="flex w-full min-w-0 items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-2 text-sm hover:bg-slate-100">
        {current && <CompanyBadge id={current.id} name={current.name} index={companies.indexOf(current)} size={28} logoUrl={current.logoUrl} />}
        <span className="min-w-0 flex-1 truncate text-left font-medium text-slate-800">{current?.name}</span>
        <svg viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[85]">
          <button type="button" aria-label="Close" onClick={close}
            className={`absolute inset-0 bg-slate-900/40 transition-opacity duration-300 ${shown ? "opacity-100" : "opacity-0"}`} />
          <aside className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${shown ? "translate-x-0" : "translate-x-full"}`}>
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-xl font-semibold text-[#0b1f3a]">Organizations</h2>
              <button type="button" onClick={close} aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-all duration-200 hover:rotate-90 hover:bg-red-50 hover:text-red-600">
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
              </button>
            </div>
            <p className="px-6 pb-2 pt-4 text-sm font-semibold text-slate-700">My organizations</p>
            <div className="min-h-0 flex-1 overflow-y-auto px-3">
              <OrganizationList companies={companies} currentId={currentId} userId={userId} onOpen={(id) => { onSwitch(id); close(); }} />
            </div>
            <div className="border-t border-slate-200 p-3">
              <NewOrgButton onClick={() => { close(); onNewCompany(); }} />
            </div>
          </aside>
        </div>,
        document.body,
      )}
    </div>
  );
}
