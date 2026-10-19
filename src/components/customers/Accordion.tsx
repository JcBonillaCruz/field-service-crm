"use client";

import { useState } from "react";

// Sección plegable (acordeón), estilo Zoho pero con nuestros colores
export default function Accordion({
  title,
  count,
  action,
  defaultOpen = true,
  children,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 px-5 py-4">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex min-w-0 items-center gap-2 text-left">
          <svg viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "" : "-rotate-90"}`} fill="currentColor" aria-hidden="true">
            <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
          </svg>
          <h2 className="truncate text-base font-semibold text-[#0b1f3a]">{title}</h2>
          {count != null && <span className="text-sm font-normal text-slate-400">({count})</span>}
        </button>
        {action}
      </div>
      {open && <div className="border-t border-slate-100 px-5 py-4 sm:px-6">{children}</div>}
    </div>
  );
}

export function PencilLink({ href, label = "Edit" }: { href: string; label?: string }) {
  return (
    <a href={href} aria-label={label} title={label}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-[#0f766e]">
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <path d="M4 13.5V16h2.5l7-7L11 6.5zM12.5 5l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}
