"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function SearchBox({ initial, autoFocus }: { initial: string; autoFocus?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(initial);

  useEffect(() => {
    const t = setTimeout(() => {
      if (q === initial) return;
      const next = new URLSearchParams(searchParams.toString());
      if (q) next.set("q", q); else next.delete("q");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }, 300);
    return () => clearTimeout(t);
  }, [q, initial, pathname, router, searchParams]);

  return (
    <div className="relative">
      <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" />
      </svg>
      <label htmlFor="customer-search" className="sr-only">Search customers</label>
      <input id="customer-search" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" autoFocus={autoFocus}
        placeholder="Search by name, phone or email"
        className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-11 pr-4 text-[15px] placeholder:text-slate-400 focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15" />
    </div>
  );
}
