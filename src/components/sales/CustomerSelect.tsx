"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { initials, softColor } from "@/lib/types";
import type { CustomerOption } from "@/lib/sales-server";
import { Chevron } from "@/components/ui/SearchSelect";

const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Circulito con las iniciales en color suavecito (como en Customers)
export function Initials({ name, seed, size = 28 }: { name: string; seed: string; size?: number }) {
  const c = softColor(seed);
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full font-semibold" style={{ width: size, height: size, background: c.bg, color: c.text, fontSize: size * 0.38 }}>
      {initials(name)}
    </span>
  );
}

// Selector de cliente: botón con iniciales + panel con buscador arriba y "+ New Customer" abajo (mint, no azul)
export default function CustomerSelect({ id, value, customers, onChange }: { id?: string; value: string; customers: CustomerOption[]; onChange: (v: string) => void }) {
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(0);
  const current = customers.find((c) => c.id === value);
  const list = useMemo(() => {
    const q = fold(query.trim());
    return (q ? customers.filter((c) => fold(`${c.display_name} ${c.company_name ?? ""} ${c.email ?? ""}`).includes(q)) : customers).slice(0, 300);
  }, [customers, query]);
  return (
    <Popover className="relative">
      {({ close }) => (
        <>
          <PopoverButton id={id} aria-label="Customer"
            className="group flex w-full items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 py-2 pl-2.5 pr-3 text-left text-[15px] transition-colors hover:border-[#14a39a] focus:outline-none data-[open]:border-[#0f766e] data-[open]:bg-white data-[open]:ring-4 data-[open]:ring-[#14a39a]/15">
            {current ? <Initials name={current.display_name} seed={current.id} /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-400"><svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10" cy="7" r="3" /><path d="M4 17a6 6 0 0 1 12 0" strokeLinecap="round" /></svg></span>}
            <span className={`min-w-0 flex-1 truncate ${current ? "text-[#0b1f3a]" : "text-slate-400"}`}>{current?.display_name ?? "Select or add a customer"}</span>
            <Chevron />
          </PopoverButton>
          <PopoverPanel anchor="bottom start" transition
            className="z-[100] mt-1 flex w-[var(--button-width)] min-w-[18rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_16px_44px_rgba(15,40,60,0.16)] transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0">
            <div className="border-b border-slate-100 p-2">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 focus-within:border-[#0f766e] focus-within:bg-white">
                <svg viewBox="0 0 20 20" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg>
                <input autoFocus value={query} placeholder="Search by name, company or email" autoComplete="off"
                  onChange={(e) => { setQuery(e.target.value); setHi(0); }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(list.length - 1, h + 1)); }
                    if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
                    if (e.key === "Enter" && list[hi]) { e.preventDefault(); onChange(list[hi].id); setQuery(""); close(); }
                  }}
                  className="w-full bg-transparent py-2 text-[15px] focus:outline-none" />
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto p-1.5">
              {list.length === 0 && <div className="px-3 py-4 text-center text-sm text-slate-500">No customers found.</div>}
              {list.map((c, i) => {
                const on = c.id === value;
                return (
                  <button key={c.id} type="button" onMouseEnter={() => setHi(i)} onClick={() => { onChange(c.id); setQuery(""); close(); }}
                    className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${on ? "bg-[#d7f1eb]" : i === hi ? "bg-[#eef8f5]" : ""}`}>
                    <Initials name={c.display_name} seed={c.id} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[15px] text-[#0b1f3a] ${on ? "font-semibold" : ""}`}>{c.display_name}</span>
                      {(c.email || (c.company_name && c.company_name !== c.display_name)) && <span className="block truncate text-[12px] text-slate-500">{[c.company_name !== c.display_name ? c.company_name : null, c.email].filter(Boolean).join(" · ")}</span>}
                    </span>
                    {on && <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-[#0f766e]" fill="currentColor"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" /></svg>}
                  </button>
                );
              })}
            </div>
            <Link href="/dashboard/customers/new" target="_blank" className="flex items-center gap-2 border-t border-slate-100 px-4 py-3 text-sm font-medium text-[#0f766e] hover:bg-[#f3fbf8]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0f766e] text-white"><svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M10 5v10M5 10h10" /></svg></span>
              New Customer
            </Link>
          </PopoverPanel>
        </>
      )}
    </Popover>
  );
}
