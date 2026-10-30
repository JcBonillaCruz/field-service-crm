"use client";

import { useMemo, useState } from "react";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { initials, softColor } from "@/lib/types";
import type { PayerOption } from "@/components/expenses/ExpensesWorkspace";

// Filtro "por cliente" de la lista de Gastos / Money In (busca en Customers)
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function CustomerFilter({ people, value, onChange }: { people: PayerOption[]; value: string | null; onChange: (id: string | null) => void }) {
  const [q, setQ] = useState("");
  const current = people.find((p) => p.id === value) ?? null;
  const list = useMemo(() => {
    const t = fold(q.trim());
    return (t ? people.filter((p) => fold(`${p.display_name} ${p.company_name ?? ""} ${p.email ?? ""} ${p.phone ?? ""}`).includes(t)) : people).slice(0, 60);
  }, [people, q]);

  return (
    <Popover className="relative">
      <PopoverButton aria-label="Filter by customer" title="Filter by customer"
        className={`group flex h-10 max-w-[11rem] items-center gap-2 rounded-lg border bg-white px-2.5 text-[14px] font-medium transition-all duration-150 hover:border-[#14a39a] focus:outline-none data-[open]:border-[#0f766e] sm:max-w-[15rem] sm:px-3 ${current ? "border-[#0f766e] text-[#0b1f3a]" : "border-slate-200 text-slate-600"}`}>
        {current ? (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: softColor(current.id).bg, color: softColor(current.id).text }}>{initials(current.display_name)}</span>
        ) : (
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 text-[#0f766e]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="12" cy="8" r="3.6" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
        )}
        <span className={`truncate ${current ? "" : "hidden sm:inline"}`}>{current ? current.display_name : "All customers"}</span>
        <svg viewBox="0 0 20 20" className="hidden h-4 w-4 shrink-0 text-slate-400 transition-transform group-data-[open]:rotate-180 sm:block" fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
      </PopoverButton>
      <PopoverPanel anchor={{ to: "bottom start", gap: 6 }} transition
        className="z-[80] w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-2 shadow-[0_16px_44px_rgba(15,40,60,0.16)] transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0 focus:outline-none">
        {({ close }) => (
          <>
            <div className="flex h-10 items-center gap-2 rounded-lg bg-slate-50 px-3">
              <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.9"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg>
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customers" className="min-w-0 flex-1 bg-transparent text-[15px] focus:outline-none" />
            </div>
            <div className="mt-1.5 max-h-72 overflow-y-auto">
              <button type="button" onClick={() => { onChange(null); setQ(""); close(); }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[14px] hover:bg-[#eef8f5] ${!current ? "font-semibold text-[#0f766e]" : "text-slate-700"}`}>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.4" /><path d="M3 19a6 6 0 0 1 12 0M15 19a4.5 4.5 0 0 1 6.5-4" /></svg></span>
                All customers
              </button>
              {list.map((p) => {
                const c = softColor(p.id); const on = p.id === value;
                return (
                  <button key={p.id} type="button" onClick={() => { onChange(p.id); setQ(""); close(); }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[14px] transition-colors hover:bg-[#eef8f5] ${on ? "bg-[#d7f1eb] font-semibold text-[#0b3f3b]" : "text-slate-700"}`}>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold" style={{ background: c.bg, color: c.text }}>{initials(p.display_name)}</span>
                    <span className="min-w-0 flex-1 truncate">{p.display_name}</span>
                  </button>
                );
              })}
              {list.length === 0 && <p className="px-3 py-3 text-[13px] text-slate-400">No customer matches “{q}”.</p>}
            </div>
          </>
        )}
      </PopoverPanel>
    </Popover>
  );
}
