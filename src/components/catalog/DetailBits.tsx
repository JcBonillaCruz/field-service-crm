"use client";

import Link from "next/link";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";

// Lápiz animado (crece y se inclina al pasar el mouse)
export function PencilButton({ href, label = "Edit", withText = false }: { href: string; label?: string; withText?: boolean }) {
  return (
    <Link href={href} aria-label={label} title={label}
      className={`group/edit flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-[#14a39a] hover:bg-[#e9f7f4] hover:text-[#0f766e] hover:shadow-md active:translate-y-0 ${withText ? "h-9 px-3 text-sm font-medium" : "h-9 w-9"}`}>
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] transition-transform duration-300 ease-out group-hover/edit:-rotate-12 group-hover/edit:scale-110" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M12 20h9" strokeLinecap="round" strokeLinejoin="round" className="origin-left transition-transform duration-300 group-hover/edit:scale-x-110" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {withText && <span>{label}</span>}
    </Link>
  );
}

// X que gira y se pone roja
export function CloseButton({ href, red = false }: { href: string; red?: boolean }) {
  return (
    <Link href={href} aria-label="Close" title="Close"
      className={`group/x flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-red-50 hover:text-red-600 ${red ? "text-red-500" : "text-slate-500"}`}>
      <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform duration-300 group-hover/x:rotate-90" fill="currentColor" aria-hidden="true">
        <path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" />
      </svg>
    </Link>
  );
}

export type MenuAction = { label: string; onClick?: () => void; href?: string; danger?: boolean; icon?: string };

export function MoreMenu({ actions, label = "More", dots = false }: { actions: MenuAction[]; label?: string; dots?: boolean }) {
  return (
    <Menu>
      <MenuButton className={`flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 data-[open]:border-[#14a39a] data-[open]:bg-[#e9f7f4] data-[open]:text-[#0f766e] ${dots ? "w-9 justify-center" : "px-3"}`} aria-label={label}>
        {dots ? (
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true"><circle cx="4.5" cy="10" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="15.5" cy="10" r="1.6" /></svg>
        ) : (
          <>{label}<svg viewBox="0 0 20 20" className="h-4 w-4 text-slate-400" fill="currentColor" aria-hidden="true"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg></>
        )}
      </MenuButton>
      <MenuItems anchor="bottom end" transition
        className="z-[80] mt-1 w-52 rounded-xl border border-slate-200 bg-white py-1.5 shadow-[0_12px_40px_rgba(15,40,60,0.16)] transition duration-150 ease-out focus:outline-none data-[closed]:scale-95 data-[closed]:opacity-0">
        {actions.map((a) => (
          <MenuItem key={a.label}>
            {a.href ? (
              <Link href={a.href} className={`flex w-full items-center gap-2.5 px-4 py-2 text-sm ${a.danger ? "text-red-600 data-[focus]:bg-red-50" : "text-slate-700 data-[focus]:bg-[#0f766e] data-[focus]:text-white"}`}>
                {a.icon && <Ico d={a.icon} />}{a.label}
              </Link>
            ) : (
              <button type="button" onClick={a.onClick} className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm ${a.danger ? "text-red-600 data-[focus]:bg-red-50" : "text-slate-700 data-[focus]:bg-[#0f766e] data-[focus]:text-white"}`}>
                {a.icon && <Ico d={a.icon} />}{a.label}
              </button>
            )}
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
}

const Ico = ({ d }: { d: string }) => (
  <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 opacity-70" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d={d} strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const ICONS = {
  clone: "M7 7V4.5A1.5 1.5 0 0 1 8.5 3h7A1.5 1.5 0 0 1 17 4.5v7a1.5 1.5 0 0 1-1.5 1.5H13M4.5 7h7A1.5 1.5 0 0 1 13 8.5v7a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 15.5v-7A1.5 1.5 0 0 1 4.5 7z",
  trash: "M4 6h12M8 6V4.5h4V6M6 6l.7 10a1.5 1.5 0 0 0 1.5 1.4h3.6a1.5 1.5 0 0 0 1.5-1.4L14 6",
  off: "M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM7.5 7.5l5 5M12.5 7.5l-5 5",
  on: "M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM6.8 10.2l2.2 2.2 4.2-4.6",
};

export function Tabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div role="tablist" className="flex gap-7 overflow-x-auto border-b border-slate-200 px-5 sm:px-7">
      {tabs.map((t) => (
        <button key={t} type="button" role="tab" aria-selected={active === t} onClick={() => onChange(t)}
          className={`relative shrink-0 py-3 text-[15px] transition-colors ${active === t ? "font-semibold text-[#0f766e]" : "text-slate-600 hover:text-[#0b1f3a]"}`}>
          {t}
          <span className={`absolute inset-x-0 -bottom-px h-[3px] rounded-full bg-[#0f766e] transition-transform duration-200 ${active === t ? "scale-x-100" : "scale-x-0"}`} />
        </button>
      ))}
    </div>
  );
}

// Imagen vacía (cuando el item no tiene foto)
export function NoImage({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-300 ${className}`}>
      <svg viewBox="0 0 24 24" className="h-3/5 w-3/5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="15.5" cy="9.5" r="1.7" /><path d="m4 17 5-5 4 4 2.5-2.5L20 18" />
      </svg>
    </span>
  );
}

// Historial: "created by - Juan", "updated by - Juan (Selling Price)"
export function HistoryTable({ rows, fallbackCreated }: {
  rows: { id: string; action: string; actor_name: string | null; changes: string[] | null; created_at: string }[];
  fallbackCreated: string;
}) {
  const list = rows.length ? rows : [{ id: "c", action: "created", actor_name: null, changes: null, created_at: fallbackCreated }];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-[#fafbfc] text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <th className="w-64 px-5 py-2.5">Date</th><th className="px-5 py-2.5">Details</th>
          </tr>
        </thead>
        <tbody>
          {list.map((h) => (
            <tr key={h.id} className="border-b border-slate-100 transition-colors hover:bg-[#f6fbfa]">
              <td className="px-5 py-3 text-slate-500">
                {new Date(h.created_at).toLocaleString("en-US", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </td>
              <td className="px-5 py-3 text-slate-700">
                {h.action} by <span className="italic text-slate-500">- {h.actor_name || "a team member"}</span>
                {h.changes && h.changes.length > 0 && <span className="ml-2 text-xs text-slate-400">({h.changes.join(", ")})</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
