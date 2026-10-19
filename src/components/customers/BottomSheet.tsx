"use client";

import { useEffect, useState } from "react";

// Hoja que sube desde abajo (solo móvil), estilo app de Zoho
export default function BottomSheet({
  open, onClose, title, children, footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!open) { setShown(false); return; }
    const r = requestAnimationFrame(() => setShown(true));
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { cancelAnimationFrame(r); document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end lg:hidden">
      <button type="button" aria-label="Close" onClick={onClose}
        className={`absolute inset-0 bg-slate-900/40 transition-opacity duration-200 ${shown ? "opacity-100" : "opacity-0"}`} />
      <div className={`relative flex max-h-[82vh] w-full flex-col rounded-t-3xl bg-white transition-transform duration-200 ease-out ${shown ? "translate-y-0" : "translate-y-full"}`}>
        <div className="flex items-center justify-between rounded-t-3xl bg-[#e9f7f4] px-5 py-4">
          <span className="h-9 w-9" />
          <h2 className="text-lg font-semibold text-[#0b1f3a]">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm transition-all duration-200 hover:rotate-90 hover:text-red-600 active:rotate-90 active:bg-red-50 active:text-red-600">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
              <path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && <div className="border-t border-slate-100 px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}
