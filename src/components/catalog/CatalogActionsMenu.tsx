"use client";

import { useEffect, useRef, useState } from "react";

// Menú "..." de la lista (Sort by, Import, Export, Preferences, Refresh, Reset Column Width)
const Ico = ({ d }: { d: string }) => (
  <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-[#0f766e] group-hover/row:text-white" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <path d={d} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Caret = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-400 group-hover/row:text-white" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m8 5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const panel = "rounded-xl border border-slate-200 bg-white py-1.5 shadow-[0_12px_40px_rgba(15,40,60,0.16)] animate-[bp-fade_0.15s_ease-out]";
const rowCls = "group/row flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-[#0f766e] hover:text-white";

export type ActionGroup =
  | { kind: "item"; label: string; icon: string; onClick: () => void }
  | { kind: "sub"; label: string; icon: string; items: { label: string; onClick: () => void; active?: boolean; dir?: "asc" | "desc" }[] }
  | { kind: "divider" };

function Flyout({ g, side, onDone }: { g: Extract<ActionGroup, { kind: "sub" }>; side: "left" | "right"; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout>>();
  const show = () => { clearTimeout(t.current); setOpen(true); };
  const hide = () => { t.current = setTimeout(() => setOpen(false), 140); };
  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={hide}>
      <button type="button" onClick={() => setOpen((v) => !v)} className={`${rowCls} justify-between ${open ? "bg-[#0f766e] text-white" : ""}`}>
        <span className="flex items-center gap-3"><Ico d={g.icon} />{g.label}</span><Caret />
      </button>
      {open && (
        <div onMouseEnter={show} onMouseLeave={hide} className={`absolute top-[-6px] z-10 w-56 ${side === "left" ? "right-full mr-1" : "left-full ml-1"} ${panel}`}>
          {g.items.map((it) => (
            <button key={it.label} type="button" onClick={() => { it.onClick(); onDone(); }}
              className={`${rowCls} justify-between ${it.active ? "bg-[#0f766e] font-medium text-white" : ""}`}>
              {it.label}
              {it.active && (
                <svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${it.dir === "asc" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M10 4v12m0 0-4-4m4 4 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CatalogActionsMenu({ groups, side = "left" }: { groups: ActionGroup[]; side?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", down); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <button type="button" aria-label="More actions" aria-expanded={open} onClick={() => setOpen((v) => !v)}
        className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${open ? "border-[#14a39a] bg-[#e9f7f4] text-[#0f766e]" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true"><circle cx="4.5" cy="10" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="15.5" cy="10" r="1.6" /></svg>
      </button>
      {open && (
        <div className={`absolute right-0 top-full z-50 mt-1 w-60 ${panel}`}>
          {groups.map((g, i) =>
            g.kind === "divider" ? <div key={i} className="my-1 border-t border-slate-100" />
              : g.kind === "sub" ? <Flyout key={g.label} g={g} side={side} onDone={() => setOpen(false)} />
                : (
                  <button key={g.label} type="button" onClick={() => { g.onClick(); setOpen(false); }} className={rowCls}>
                    <Ico d={g.icon} />{g.label}
                  </button>
                ),
          )}
        </div>
      )}
    </div>
  );
}

export const ACTION_ICONS = {
  sort: "M6 4v12m0 0-3-3m3 3 3-3M14 16V4m0 0-3 3m3-3 3 3",
  import: "M10 3v9m0 0-3.5-3.5M10 12l3.5-3.5M4 14v1.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V14",
  export: "M10 12V3m0 0L6.5 6.5M10 3l3.5 3.5M4 14v1.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V14",
  prefs: "M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM16.2 11.9l1.3 1-1.5 2.6-1.6-.6a6 6 0 0 1-1.6.9l-.3 1.7h-3l-.3-1.7a6 6 0 0 1-1.6-.9l-1.6.6L2.5 12.9l1.3-1a6 6 0 0 1 0-1.8l-1.3-1L4 6.5l1.6.6a6 6 0 0 1 1.6-.9L7.5 4.5h3l.3 1.7a6 6 0 0 1 1.6.9l1.6-.6 1.5 2.6-1.3 1a6 6 0 0 1 0 1.8z",
  refresh: "M16 10a6 6 0 1 1-1.8-4.3M16 4v3.5h-3.5",
  reset: "M4 10a6 6 0 1 0 1.8-4.3M4 4v3.5h3.5",
};
