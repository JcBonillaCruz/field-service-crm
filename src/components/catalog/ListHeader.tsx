import Link from "next/link";

export default function ListHeader({ title, newHref, newLabel, count }: { title: string; newHref: string; newLabel: string; count: number }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4 sm:px-8">
      <h1 className="text-xl font-semibold tracking-tight text-[#0b1f3a]">{title} <span className="text-base font-normal text-slate-400">({count})</span></h1>
      <Link href={newHref} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f766e] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0c5f59]">
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M10 4.5v11M4.5 10h11" /></svg>
        {newLabel}
      </Link>
    </div>
  );
}

export function EmptyList({ title, text, href, label }: { title: string; text: string; href: string; label: string }) {
  return (
    <div className="px-6 py-20 text-center">
      <p className="text-lg font-semibold text-[#0b1f3a]">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-[15px] text-slate-500">{text}</p>
      <Link href={href} className="mt-5 inline-flex rounded-lg bg-[#0f766e] px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-[#0c5f59]">{label}</Link>
    </div>
  );
}
