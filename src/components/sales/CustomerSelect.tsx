"use client";

import { useMemo, useState } from "react";
import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions } from "@headlessui/react";
import { initials, softColor } from "@/lib/types";
import type { CustomerOption } from "@/lib/sales-server";
import { Chevron, panelClass } from "@/components/ui/SearchSelect";

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

// Selector de cliente con iniciales, nombre y correo
export default function CustomerSelect({ id, value, customers, onChange }: { id?: string; value: string; customers: CustomerOption[]; onChange: (v: string) => void }) {
  const [query, setQuery] = useState("");
  const current = customers.find((c) => c.id === value);
  const list = useMemo(() => {
    const q = fold(query.trim());
    return (q ? customers.filter((c) => fold(`${c.display_name} ${c.company_name ?? ""} ${c.email ?? ""}`).includes(q)) : customers).slice(0, 200);
  }, [customers, query]);
  return (
    <Combobox immediate value={value} onChange={(v: string | null) => { if (v != null) onChange(v); setQuery(""); }} onClose={() => setQuery("")}>
      <div className="relative">
        {current && <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"><Initials name={current.display_name} seed={current.id} /></span>}
        <ComboboxInput id={id} aria-label="Customer" autoComplete="bp-off" data-lpignore="true" data-1p-ignore="true" spellCheck={false}
          placeholder="Select or add a customer" displayValue={(v: string) => customers.find((c) => c.id === v)?.display_name ?? ""}
          onFocus={(e) => e.currentTarget.select()} onChange={(e) => setQuery(e.target.value)}
          className={`w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pr-10 text-[15px] placeholder:text-slate-400 focus:border-[#0f766e] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15 ${current ? "pl-12" : "pl-4"}`} />
        <ComboboxButton className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600" aria-label="Show customers"><Chevron /></ComboboxButton>
      </div>
      <ComboboxOptions anchor="bottom start" transition className={`${panelClass} w-[var(--input-width)] !max-h-80`}>
        {list.length === 0 && <div className="px-4 py-3 text-sm text-slate-500">No customers found.</div>}
        {list.map((c) => (
          <ComboboxOption key={c.id} value={c.id} className="group flex cursor-pointer items-center gap-3 px-3 py-2 data-[focus]:bg-[#eef6ff] data-[selected]:bg-[#e8f0ff]">
            <Initials name={c.display_name} seed={c.id} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] text-[#0b1f3a] group-data-[selected]:font-semibold">{c.display_name}</span>
              {(c.email || (c.company_name && c.company_name !== c.display_name)) && <span className="block truncate text-[12px] text-slate-500">{[c.company_name !== c.display_name ? c.company_name : null, c.email].filter(Boolean).join(" · ")}</span>}
            </span>
            <svg viewBox="0 0 20 20" className="invisible h-4 w-4 shrink-0 text-[#2563eb] group-data-[selected]:visible" fill="currentColor"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" /></svg>
          </ComboboxOption>
        ))}
      </ComboboxOptions>
    </Combobox>
  );
}
