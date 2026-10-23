"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListParams, SORTS } from "@/lib/customer-list";

const Ico = ({ d }: { d: string }) => (
  <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <path d={d} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Caret = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-400" fill="currentColor" aria-hidden="true"><path d="M7.5 5 12.5 10l-5 5" /></svg>
);

const panel =
  "rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_40px_rgba(15,40,60,0.16)] " +
  "transition duration-150 ease-out data-[closed]:scale-95 data-[closed]:opacity-0";
const row = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-[#e3f4ef] hover:text-[#0b3f3b]";
const parentRow = "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-[#e3f4ef] hover:text-[#0b3f3b]";
const heading = "px-4 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400";

// Una fila del menú que abre un submenú a la izquierda al pasar el ratón
function Flyout({ icon, label, side, children }: { icon: string; label: string; side: "left" | "right"; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const show = () => { clearTimeout(timer.current); setOpen(true); };
  const hide = () => { timer.current = setTimeout(() => setOpen(false), 120); };
  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={hide}>
      <button type="button" className={`${parentRow} ${open ? "bg-[#d7f1eb] text-[#0b1f3a]" : ""}`} onClick={() => setOpen((v) => !v)}>
        <span className="flex items-center gap-3"><Ico d={icon} />{label}</span>
        <Caret />
      </button>
      {open && (
        <div className={`absolute top-[-6px] w-60 ${side === "right" ? "left-full ml-1" : "right-full mr-1"} ${panel}`} onMouseEnter={show} onMouseLeave={hide}>
          {children}
        </div>
      )}
    </div>
  );
}

export default function CustomersActionsMenu({
  params,
  basePath,
  canImport,
  canExport,
  onExport,
  submenuSide = "left",
}: {
  params: ListParams;
  basePath: string;        // la ruta actual, para no perder el cliente abierto
  canImport: boolean;
  canExport: boolean;
  onExport: () => void;    // abre el pop-up de exportar
  submenuSide?: "left" | "right";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  function applySort(value: string) {
    const active = params.sort === value;
    const dir = active ? (params.dir === "asc" ? "desc" : "asc") : value === "created" ? "desc" : "asc";
    const q = new URLSearchParams();
    if (params.q) q.set("q", params.q);
    if (params.view !== "all") q.set("view", params.view);
    if (value !== "name") q.set("sort", value);
    if (dir === "desc") q.set("dir", "desc");
    const s = q.toString();
    router.replace(`${basePath}${s ? `?${s}` : ""}`, { scroll: false });
    setOpen(false);
  }

  return (
    <div ref={wrap} className="relative">
      <button type="button" aria-label="More actions" onClick={() => setOpen((v) => !v)}
        className={`flex h-[42px] w-[42px] items-center justify-center rounded-lg border bg-white text-slate-600 hover:bg-slate-50 focus:outline-none ${open ? "border-[#0f766e] text-[#0f766e]" : "border-slate-200"}`}>
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
          <circle cx="4.5" cy="10" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="15.5" cy="10" r="1.6" />
        </svg>
      </button>

      {open && (
        <div className={`absolute right-0 z-50 mt-2 w-56 origin-top ${panel}`}>
          {/* Sort by */}
          <Flyout side={submenuSide} icon="M7 4v12m0 0-3-3m3 3 3-3M13 16V4m0 0-3 3m3-3 3 3" label="Sort by">
            <p className={heading}>Sort by</p>
            {SORTS.map((s) => {
              const active = params.sort === s.value;
              return (
                <button key={s.value} type="button" onClick={() => applySort(s.value)}
                  className={`${parentRow} ${active ? "font-semibold text-[#0f766e]" : ""}`}>
                  {s.label}
                  {active && (
                    <svg viewBox="0 0 20 20" className={`h-4 w-4 ${params.dir === "desc" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <path d="M10 15V5m0 0-4 4m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              );
            })}
          </Flyout>

          {canImport && (
            <Flyout side={submenuSide} icon="M10 3v10m0 0-4-4m4 4 4-4M4 15v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1" label="Import">
              <p className={heading}>Import</p>
              <Link prefetch={false} href="/dashboard/customers/import" className={row} onClick={() => setOpen(false)}>
                <Ico d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                Import customers
              </Link>
            </Flyout>
          )}

          {canExport && (
            <Flyout side={submenuSide} icon="M10 13V3m0 0L6 7m4-4 4 4M4 15v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1" label="Export">
              <p className={heading}>Export</p>
              <button type="button" onClick={() => { onExport(); setOpen(false); }} className={row}>
                <Ico d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                Export customers…
              </button>
            </Flyout>
          )}

          <div className="my-1.5 h-px bg-slate-100" />
          <button type="button" onClick={() => { router.refresh(); setOpen(false); }} className={row}>
            <Ico d="M16 10a6 6 0 1 1-1.8-4.3M16 4v3.5h-3.5" />
            Refresh list
          </button>
        </div>
      )}
    </div>
  );
}
