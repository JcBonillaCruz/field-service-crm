"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Módulos donde se puede buscar (hoy solo Customers; el resto llega después)
const MODULES = ["Customers", "Items", "Quotes", "Invoices", "Subscriptions", "Credit notes", "Expenses", "Projects", "Tasks"];
const ENABLED = new Set(["Customers"]);

export default function TopSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const onCustomers = pathname === "/dashboard/customers";

  const [module, setModule] = useState("Customers");
  const [q, setQ] = useState(onCustomers ? sp.get("q") ?? "" : "");
  const [focused, setFocused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [seed, setSeed] = useState("bp");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSeed("bp" + Math.random().toString(36).slice(2, 8)); }, []);

  // Buscar en vivo (con pequeña espera) mientras se escribe, sin borrar los filtros
  useEffect(() => {
    const id = setTimeout(() => {
      const term = q.trim();
      const currentQ = (onCustomers ? sp.get("q") ?? "" : "").trim();
      if (term === currentQ) return;               // nada cambió
      if (!onCustomers && term === "") return;
      if (onCustomers) {
        const params = new URLSearchParams(sp.toString());
        if (term) params.set("q", term); else params.delete("q");
        const qs = params.toString();
        router.replace(`/dashboard/customers${qs ? `?${qs}` : ""}`, { scroll: false });
      } else {
        router.push(term ? `/dashboard/customers?q=${encodeURIComponent(term)}` : "/dashboard/customers");
      }
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  function clearSearch() {
    setQ("");
    if (onCustomers) {
      const params = new URLSearchParams(sp.toString());
      params.delete("q");
      const qs = params.toString();
      router.replace(`/dashboard/customers${qs ? `?${qs}` : ""}`, { scroll: false });
    }
  }

  return (
    <div ref={wrapRef} className={`relative transition-all duration-300 ease-out ${focused ? "w-[30rem]" : "w-[22rem]"}`}>
      <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 focus-within:border-[#0f766e] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#14a39a]/15">
        {/* lupa + flechita (abre los módulos) */}
        <button type="button" onClick={() => setMenuOpen((v) => !v)} aria-label="Choose what to search"
          className="flex shrink-0 items-center gap-1 rounded-l-lg py-2 pl-3 pr-1.5 text-slate-400 hover:text-slate-600">
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg>
          <svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${menuOpen ? "rotate-180" : ""}`} fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
        </button>
        <input
          name={`${seed}-search`} autoComplete="off" data-lpignore="true" data-1p-ignore="true" data-form-type="other"
          value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
          placeholder={`Search in ${module}`} aria-label={`Search in ${module}`}
          className="w-full bg-transparent py-2 pr-1 text-sm placeholder:text-slate-400 focus:outline-none"
        />
        {q && (
          <button type="button" aria-label="Clear search" onClick={clearSearch}
            className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
          </button>
        )}
      </div>

      {menuOpen && (
        <div className="absolute left-0 z-50 mt-1 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-[0_12px_40px_rgba(15,40,60,0.16)]">
          {MODULES.map((m) => {
            const enabled = ENABLED.has(m);
            return (
              <button key={m} type="button" disabled={!enabled}
                onClick={() => { setModule(m); setMenuOpen(false); }}
                className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm ${enabled ? "text-slate-700 hover:bg-[#f0faf7]" : "cursor-not-allowed text-slate-300"} ${m === module ? "bg-[#f0faf7] font-medium text-[#0f766e]" : ""}`}>
                {m}
                {!enabled && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">Soon</span>}
                {enabled && m === module && <svg viewBox="0 0 20 20" className="h-4 w-4 text-[#0f766e]" fill="currentColor"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" /></svg>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
