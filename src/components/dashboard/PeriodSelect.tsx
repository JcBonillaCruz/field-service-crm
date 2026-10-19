"use client";

import { useEffect, useRef, useState } from "react";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { PERIODS, Period } from "@/lib/dashboard-data";

// Selector de periodo con buscador (como Zoho). "field" = el Date Range general, "link" = el de cada tarjeta
export default function PeriodSelect({ value, onChange, variant = "link", ariaLabel }: {
  value: Period;
  onChange: (p: Period) => void;
  variant?: "field" | "link";
  ariaLabel?: string;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const list = PERIODS.filter((p) => p.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <Popover className="relative">
      <PopoverButton aria-label={ariaLabel ? `${ariaLabel}: ${value}` : undefined}
        onClick={() => { setQ(""); setActive(Math.max(0, PERIODS.indexOf(value))); }}
        className={variant === "field"
          ? "group flex h-10 min-w-[200px] items-center justify-between gap-3 rounded-r-lg bg-white px-3.5 text-[15px] text-slate-800 hover:bg-slate-50 focus:outline-none data-[open]:bg-white data-[open]:shadow-[inset_0_0_0_1.5px_#93c5fd]"
          : "group -mx-1.5 flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-1 text-sm text-slate-600 hover:text-[#0b1f3a] focus:outline-none data-[open]:text-[#0b1f3a]"}>
        {value}
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-data-[open]:rotate-180" fill="currentColor" aria-hidden="true">
          <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
        </svg>
      </PopoverButton>

      <PopoverPanel anchor={variant === "field" ? "bottom start" : "bottom end"} transition
        className="z-50 mt-1.5 w-60 origin-top rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_16px_44px_rgba(15,40,60,0.16)] transition duration-150 ease-out data-[closed]:scale-95 data-[closed]:opacity-0">
        {({ close }) => {
          const choose = (p: Period) => { onChange(p); setQ(""); close(); };
          return (
            <>
              <FocusOnOpen target={inputRef} />
              <div className="relative p-1">
                <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <circle cx="9" cy="9" r="5.5" /><path d="m13.5 13.5 3 3" />
                </svg>
                <input ref={inputRef} value={q} placeholder="Search" aria-label="Search periods" autoComplete="off" spellCheck={false}
                  onChange={(e) => { setQ(e.target.value); setActive(0); }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(list.length - 1, a + 1)); }
                    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
                    else if (e.key === "Enter" && list[active]) { e.preventDefault(); choose(list[active]); }
                  }}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#93c5fd] focus:outline-none focus:ring-4 focus:ring-[#3b82f6]/10" />
              </div>
              <ul role="listbox" aria-label="Periods" className="mt-1 max-h-64 overflow-y-auto">
                {list.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">No results.</li>}
                {list.map((p, i) => {
                  const sel = p === value;
                  return (
                    <li key={p} role="option" aria-selected={sel}>
                      <button type="button" onMouseEnter={() => setActive(i)} onClick={() => choose(p)}
                        className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm ${sel ? "bg-[#eaf2ff] font-medium text-[#1e40af]" : i === active ? "bg-slate-50 text-[#0b1f3a]" : "text-slate-700"}`}>
                        {p}
                        {sel && (
                          <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-[#3b82f6]" fill="currentColor" aria-hidden="true">
                            <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" />
                          </svg>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          );
        }}
      </PopoverPanel>
    </Popover>
  );
}

// Enfoca el buscador al abrir SIN mover la pantalla (antes brincaba hasta arriba)
function FocusOnOpen({ target }: { target: React.RefObject<HTMLInputElement> }) {
  useEffect(() => {
    const id = requestAnimationFrame(() => target.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(id);
  }, [target]);
  return null;
}
