"use client";

import Link from "next/link";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";

type Item = { label: string; href?: string };
const COLUMNS: { group: string; items: Item[] }[] = [
  { group: "General", items: [{ label: "Add user" }, { label: "Item" }, { label: "Log time" }, { label: "Weekly log" }] },
  { group: "Sales", items: [{ label: "Customer", href: "/dashboard/customers/new" }, { label: "Quote" }, { label: "Invoice" }, { label: "Subscription" }, { label: "Customer payment" }] },
  { group: "Expenses", items: [{ label: "Expense" }, { label: "Recurring expense" }] },
];

export default function QuickCreate() {
  return (
    <Popover className="relative">
      <PopoverButton aria-label="Quick create"
        className="group flex h-9 w-9 items-center justify-center rounded-lg bg-[#0f766e] text-white transition-transform hover:bg-[#0c5f58] focus:outline-none active:scale-95">
        <svg viewBox="0 0 24 24" className="h-5 w-5 transition-transform duration-300 group-data-[open]:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
      </PopoverButton>
      <PopoverPanel anchor="bottom end" transition
        className="z-50 mt-2 w-[30rem] origin-top-right rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_16px_50px_rgba(15,40,60,0.18)] transition duration-200 ease-out data-[closed]:scale-95 data-[closed]:opacity-0">
        <div className="grid grid-cols-3 gap-4">
          {COLUMNS.map((col) => (
            <div key={col.group}>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{col.group}</p>
              <ul className="space-y-0.5">
                {col.items.map((it) => (
                  <li key={it.label}>
                    {it.href ? (
                      <Link href={it.href} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-[#f0faf7] hover:text-[#0b1f3a]">
                        <svg viewBox="0 0 20 20" className="h-4 w-4 text-[#0f766e]" fill="currentColor"><path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm1 7h3v2h-3v3H9v-3H6V9h3V6h2z" /></svg>
                        {it.label}
                      </Link>
                    ) : (
                      <span title="Coming soon" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-400">
                        <svg viewBox="0 0 20 20" className="h-4 w-4 text-slate-300" fill="currentColor"><path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm1 7h3v2h-3v3H9v-3H6V9h3V6h2z" /></svg>
                        {it.label}
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium">Soon</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </PopoverPanel>
    </Popover>
  );
}
