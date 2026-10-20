"use client";

import Link from "next/link";

// Globito de ayuda (como Zoho): aparece al pasar el mouse por el nombre del campo o por la (i)
export function Tip({ text, children, side = "right" }: { text: string; children: React.ReactNode; side?: "right" | "top" }) {
  return (
    <span className="group/tip relative inline-flex items-center">
      {children}
      <span role="tooltip"
        className={`pointer-events-none absolute z-[70] w-max max-w-[17rem] rounded-lg bg-[#0b1f3a] px-3 py-2 text-left text-[13px] font-normal leading-snug text-white opacity-0 shadow-[0_10px_30px_rgba(11,31,58,0.28)] transition-all duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 ${
          side === "right"
            ? "bottom-full left-0 mb-2 translate-y-1 group-hover/tip:translate-y-0 lg:bottom-auto lg:left-full lg:top-1/2 lg:mb-0 lg:ml-3 lg:-translate-y-1/2 lg:translate-x-1 lg:group-hover/tip:-translate-y-1/2 lg:group-hover/tip:translate-x-0"
            : "bottom-full left-1/2 mb-2 -translate-x-1/2 translate-y-1 group-hover/tip:translate-y-0"
        }`}>
        {text}
        <span className={`absolute h-2.5 w-2.5 rotate-45 bg-[#0b1f3a] ${side === "right" ? "left-4 top-full -mt-1.5 lg:-left-1 lg:top-1/2 lg:mt-0 lg:-translate-y-1/2" : "left-1/2 top-full -mt-1.5 -translate-x-1/2"}`} />
      </span>
    </span>
  );
}

export const InfoIcon = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4 text-slate-400 transition-colors group-hover/tip:text-[#0f766e]" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="10" cy="10" r="7.5" /><path d="M10 9v4.5M10 6.5v.01" strokeLinecap="round" /></svg>
);

// Fila del formulario. Si tiene ayuda, el nombre lleva subrayado punteado + (i) y al hacer clic NO salta al campo.
export function FormRow({ label, htmlFor, required, hint, alignTop, children, width = "max-w-[460px]" }: {
  label: string; htmlFor?: string; required?: boolean; hint?: string; alignTop?: boolean; children: React.ReactNode; width?: string;
}) {
  const text = <>{label}{required && "*"}</>;
  return (
    <div className={`grid gap-1.5 lg:grid-cols-[10.5rem_minmax(0,1fr)] lg:gap-6 ${alignTop ? "lg:items-start" : "lg:items-center"}`}>
      <div className={`flex items-center text-[15px] ${alignTop ? "lg:pt-2.5" : ""} ${required ? "text-red-600" : "text-slate-700"}`}>
        {hint ? (
          <Tip text={hint}>
            <label htmlFor={htmlFor} onClick={(e) => e.preventDefault()} tabIndex={0}
              className="flex cursor-help items-center gap-1.5 focus:outline-none">
              <span className="border-b border-dotted border-current pb-px">{text}</span>
              <InfoIcon />
            </label>
          </Tip>
        ) : (
          <label htmlFor={htmlFor}>{text}</label>
        )}
      </div>
      <div className={width}>{children}</div>
    </div>
  );
}

export function FormHeader({ title, closeHref }: { title: string; closeHref: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-8">
      <h1 className="text-2xl font-semibold tracking-tight text-[#0b1f3a]">{title}</h1>
      <Link href={closeHref} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800">
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
      </Link>
    </div>
  );
}

export function SaveBar({ saving, cancelHref, error, onDelete, deleteLabel = "Delete" }: {
  saving: boolean; cancelHref: string; error?: string; onDelete?: () => void; deleteLabel?: string;
}) {
  return (
    <div className="sticky bottom-0 z-10 mt-10 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white px-5 py-3 sm:px-8">
      <button type="submit" disabled={saving} className="rounded-lg bg-[#0f766e] px-5 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#0c5f59] disabled:opacity-60">{saving ? "Saving..." : "Save"}</button>
      <Link href={cancelHref} className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-[15px] font-medium text-slate-700 hover:bg-slate-50">Cancel</Link>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {onDelete && <button type="button" onClick={onDelete} className="ml-auto text-sm font-medium text-red-600 hover:underline">{deleteLabel}</button>}
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-5 text-[17px] font-semibold text-[#0b1f3a]">{children}</h2>;
}
