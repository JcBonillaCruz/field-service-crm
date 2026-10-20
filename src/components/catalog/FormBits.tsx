"use client";

import Link from "next/link";

// Piezas compartidas de los formularios del catálogo (mismo diseño que New Customer)
export function FormRow({ label, htmlFor, required, hint, alignTop, children, width = "max-w-[460px]" }: {
  label: string; htmlFor?: string; required?: boolean; hint?: string; alignTop?: boolean; children: React.ReactNode; width?: string;
}) {
  return (
    <div className={`grid gap-1.5 lg:grid-cols-[10.5rem_minmax(0,1fr)] lg:gap-6 ${alignTop ? "lg:items-start" : "lg:items-center"}`}>
      <label htmlFor={htmlFor} className={`flex items-center gap-1.5 text-[15px] ${alignTop ? "lg:pt-2.5" : ""} ${required ? "text-red-600" : "text-slate-700"}`}>
        {label}{required && "*"}
        {hint && (
          <span title={hint} className="text-slate-400">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="10" cy="10" r="7.5" /><path d="M10 9v4.5M10 6.5v.01" strokeLinecap="round" /></svg>
            <span className="sr-only">{hint}</span>
          </span>
        )}
      </label>
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
