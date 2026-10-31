import Link from "next/link";
import { LOCATION_ICON } from "@/lib/inventory";

// Piezas comunes de las pantallas de Inventory (mismo estilo que la lista de Items)
export function PageHead({ title, subtitle, children, back }: { title: string; subtitle?: string; children?: React.ReactNode; back?: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-2">
        {back && (
          <Link prefetch={false} href={back} aria-label="Back" className="-ml-2 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor"><path d="M12.7 4.3a1 1 0 0 1 0 1.4L8.4 10l4.3 4.3a1 1 0 1 1-1.4 1.4l-5-5a1 1 0 0 1 0-1.4l5-5a1 1 0 0 1 1.4 0z" /></svg>
          </Link>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-[22px] font-semibold tracking-tight text-[#0b1f3a] lg:text-2xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-[13.5px] text-slate-500 lg:text-sm">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

const plus = <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform duration-200 group-hover/n:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M10 4.5v11M4.5 10h11" /></svg>;
export function NewButton({ href, label = "New" }: { href: string; label?: string }) {
  return (
    <Link prefetch={false} href={href} className="group/n inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#0f766e] px-4 text-[15px] font-semibold text-white shadow-sm shadow-[#0f766e]/30 transition-colors hover:bg-[#0c5f59]">{plus}{label}</Link>
  );
}
export function Fab({ href, label }: { href: string; label: string }) {
  return (
    <Link prefetch={false} href={href} aria-label={label}
      className="fixed bottom-6 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#0f766e] text-white shadow-lg shadow-[#0f766e]/30 active:scale-95 lg:hidden">
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
    </Link>
  );
}

export function LocIcon({ kind, size = "md" }: { kind: "warehouse" | "van"; size?: "md" | "lg" }) {
  const s = size === "lg" ? "h-12 w-12 rounded-2xl" : "h-9 w-9 rounded-xl";
  return (
    <span className={`flex ${s} shrink-0 items-center justify-center ${kind === "van" ? "bg-[#fff4ec] text-[#ea580c]" : "bg-[#e9f7f4] text-[#0f766e]"}`}>
      <svg viewBox="0 0 24 24" className={size === "lg" ? "h-6 w-6" : "h-[18px] w-[18px]"} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={LOCATION_ICON[kind]} /></svg>
    </span>
  );
}

export function EmptyBox({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#14a39a] to-[#0f766e] text-white shadow-[0_10px_24px_rgba(15,118,110,0.25)]">
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9zM4 7.5 12 12l8-4.5M12 12v9" /></svg>
      </span>
      <h2 className="mt-5 text-lg font-semibold text-[#0b1f3a]">{title}</h2>
      <p className="mt-1.5 max-w-sm text-[14.5px] text-slate-500">{text}</p>
      {children && <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}

export const card = "rounded-2xl border border-slate-200 bg-white";
export const pageWrap = "px-4 pb-24 pt-5 lg:px-8 lg:pb-10 lg:pt-7";
export const fmtWhen = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
export const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
