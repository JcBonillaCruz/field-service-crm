"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { Status, TONE_PILL, TONE_RIBBON, Tone } from "@/lib/sales";

export const I = {
  edit: "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4zM12 20h9",
  mail: "M3.5 6.5h17v11h-17zM3.5 7l8.5 6.5L20.5 7",
  share: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  pdf: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h1.5a1.5 1.5 0 0 1 0 3H9v-5M14 16v-5h2",
  print: "M7 9V3.5h10V9M7 17.5H5a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 5 9.5h14a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5h-2M7 14h10v6.5H7z",
  convert: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M12 10v6",
  clip: "M20 11.5 12.3 19.2a4.5 4.5 0 0 1-6.4-6.4l7.8-7.7a3 3 0 0 1 4.2 4.2l-7.7 7.8a1.5 1.5 0 0 1-2.1-2.1l7.1-7.1",
  comment: "M4 5.5h16v10.5H9l-5 4z",
  project: "M4 7.5A1.5 1.5 0 0 1 5.5 6H10l2 2h6.5A1.5 1.5 0 0 1 20 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5zM12 11v5M9.5 13.5h5",
  clone: "M8 8V5a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 20 5v9a1.5 1.5 0 0 1-1.5 1.5H16M5.5 8h9A1.5 1.5 0 0 1 16 9.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 18.5v-9A1.5 1.5 0 0 1 5.5 8z",
  trash: "M5 7h14M9 7V5h6v2M7 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h5.4a1.5 1.5 0 0 0 1.5-1.4L17 7",
  prefs: "M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1M15 5v4M9 10v4M17 15v4",
  check: "M5 12.5 9.5 17 19 7",
  x: "M6 6l12 12M18 6 6 18",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0",
  money: "M3.5 7h17v10h-17zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6.5 10v4M17.5 10v4",
  void: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8",
  send: "M4 12 20 4l-4 16-4-7zM12 13l8-9",
  calendar: "M5 6h14v14H5zM5 10h14M9 3.5V7M15 3.5V7",
  stop: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5h5v5h-5z",
  pause: "M9 6v12M15 6v12",
  play: "M8 5.5v13l10-6.5z",
  invoice: "M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21zM9 8h6M9 12h6M9 16h3",
  truck: "M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 19a1.8 1.8 0 1 0 0-3.6A1.8 1.8 0 0 0 7 19zM17 19a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z",
  box: "M12 3 20 7.5v9L12 21l-8-4.5v-9zM4 7.5 12 12l8-4.5M12 12v9",
  download: "M12 4v11m0 0-4-4m4 4 4-4M5 19h14",
};

export const Ico = ({ d, className = "h-4 w-4" }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
export const Chev = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4 text-slate-400 transition-transform group-data-[open]:rotate-180" fill="currentColor" aria-hidden="true"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
);

export function StatusPill({ s, small = false }: { s: Status; small?: boolean }) {
  return <span className={`inline-flex items-center rounded-full font-semibold uppercase tracking-wide ${TONE_PILL[s.tone]} ${small ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"}`}>{s.label}</span>;
}

// Cintita diagonal (esquina del documento), como Zoho
export function Ribbon({ label, tone }: { label: string; tone: Tone }) {
  return (
    <div className="pointer-events-none absolute -left-1.5 -top-1.5 z-10 h-28 w-28 overflow-hidden print:hidden" aria-hidden="true">
      <span className={`absolute left-[-46px] top-[26px] w-[170px] -rotate-45 py-1.5 text-center text-[12px] font-medium text-white shadow-md ${TONE_RIBBON[tone]}`}>{label}</span>
    </div>
  );
}

// Botón plano de la barra de herramientas (Edit, Share, Convert to Invoice…)
export function ToolButton({ icon, label, onClick, href, disabled }: { icon: string; label: string; onClick?: () => void; href?: string; disabled?: boolean }) {
  const cls = "group/tb flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[14px] text-slate-700 transition-colors hover:bg-[#e9f7f4] hover:text-[#0f766e] disabled:cursor-not-allowed disabled:opacity-40";
  const inner = <><span className="transition-transform duration-200 group-hover/tb:-translate-y-0.5"><Ico d={icon} /></span>{label}</>;
  if (href) return <Link href={href} className={cls}>{inner}</Link>;
  return <button type="button" onClick={onClick} disabled={disabled} className={cls}>{inner}</button>;
}

export type ToolItem = { label: string; icon?: string; onClick?: () => void; href?: string; danger?: boolean; soon?: boolean; divider?: boolean; hidden?: boolean };

// Botón con menú (Mails ▾, PDF/Print ▾, Record Payment ▾, ⋯)
export function ToolMenu({ icon, label, items, dots = false, align = "start" }: { icon?: string; label?: string; items: ToolItem[]; dots?: boolean; align?: "start" | "end" }) {
  const list = items.filter((i) => !i.hidden);
  return (
    <Menu>
      <MenuButton aria-label={label ?? "More"}
        className={`group flex h-9 shrink-0 items-center gap-1.5 rounded-md text-[14px] text-slate-700 transition-colors hover:bg-[#e9f7f4] hover:text-[#0f766e] data-[open]:bg-[#e9f7f4] data-[open]:text-[#0f766e] focus:outline-none ${dots ? "w-9 justify-center border border-slate-200" : "px-2.5"}`}>
        {dots ? (
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true"><circle cx="4.5" cy="10" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="15.5" cy="10" r="1.6" /></svg>
        ) : (<>{icon && <Ico d={icon} />}{label}<Chev /></>)}
      </MenuButton>
      <MenuItems anchor={align === "end" ? "bottom end" : "bottom start"} transition
        className="z-[80] mt-1 min-w-[12rem] rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_40px_rgba(15,40,60,0.16)] transition duration-150 ease-out focus:outline-none data-[closed]:scale-95 data-[closed]:opacity-0">
        {list.map((a, i) => (
          <div key={`${a.label}-${i}`}>
            {a.divider && <div className="my-1 border-t border-slate-100" />}
            <MenuItem disabled={a.soon}>
              {a.href ? (
                <Link href={a.href} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 data-[focus]:bg-[#0f766e] data-[focus]:text-white">
                  {a.icon && <Ico d={a.icon} />}{a.label}
                </Link>
              ) : (
                <button type="button" onClick={a.onClick}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm data-[disabled]:cursor-not-allowed data-[disabled]:text-slate-300 ${a.danger ? "text-red-600 data-[focus]:bg-red-50" : "text-slate-700 data-[focus]:bg-[#0f766e] data-[focus]:text-white"}`}>
                  {a.icon && <Ico d={a.icon} />}<span className="flex-1">{a.label}</span>
                  {a.soon && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">Soon</span>}
                </button>
              )}
            </MenuItem>
          </div>
        ))}
      </MenuItems>
    </Menu>
  );
}

export const Divider = () => <span className="mx-0.5 h-5 w-px shrink-0 bg-slate-200" aria-hidden="true" />;

function useEsc(open: boolean, onClose: () => void, lock = true) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!open) { setShown(false); return; }
    const r = requestAnimationFrame(() => setShown(true));
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    if (lock) document.body.style.overflow = "hidden";
    return () => { cancelAnimationFrame(r); document.removeEventListener("keydown", onKey); if (lock) document.body.style.overflow = ""; };
  }, [open, onClose, lock]);
  return shown;
}

export function XButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label="Close" title="Close"
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition-all duration-300 hover:rotate-90 hover:bg-red-50 hover:text-red-600 ${className}`}>
      <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
    </button>
  );
}

// Pop-up centrado
export function Modal({ open, onClose, title, children, footer, width = "max-w-lg" }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; width?: string;
}) {
  const shown = useEsc(open, onClose);
  if (!open) return null;
  return (
    <div className={`fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 transition-opacity duration-200 sm:p-8 ${shown ? "opacity-100" : "opacity-0"}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`w-full ${width} rounded-2xl bg-white shadow-2xl transition-transform duration-200 ${shown ? "translate-y-0 scale-100" : "translate-y-2 scale-[0.98]"}`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-[#0b1f3a]">{title}</h2>
          <XButton onClick={onClose} />
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

// Panel que entra desde la derecha (comentarios, preferencias, cliente)
export function SlideOver({ open, onClose, title, children, width = "max-w-[460px]", header }: {
  open: boolean; onClose: () => void; title?: string; children: React.ReactNode; width?: string; header?: React.ReactNode;
}) {
  const shown = useEsc(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[85]">
      <button type="button" aria-label="Close" onClick={onClose} className={`absolute inset-0 bg-slate-900/30 transition-opacity duration-200 ${shown ? "opacity-100" : "opacity-0"}`} />
      <aside className={`absolute inset-y-0 right-0 flex w-full ${width} flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${shown ? "translate-x-0" : "translate-x-full"}`}>
        {header ?? (
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-[#0b1f3a]">{title}</h2>
            <XButton onClick={onClose} />
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>
  );
}

export const btnPrimary = "rounded-lg bg-[#0f766e] px-5 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#0c5f59] disabled:opacity-60";
export const btnGhost = "rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-[15px] font-medium text-slate-700 transition-colors hover:bg-slate-50";

export function Toast({ text }: { text: string }) {
  if (!text) return null;
  return <div role="status" className="fixed bottom-6 left-1/2 z-[95] -translate-x-1/2 rounded-xl bg-[#0b1f3a] px-4 py-2.5 text-sm text-white shadow-xl animate-[bp-fade_0.2s_ease-out]">{text}</div>;
}
