"use client";

import Link from "next/link";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";

type Item = { label: string; href?: string };
const COLUMNS: { group: string; icon: string; items: Item[] }[] = [
  {
    group: "General",
    icon: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
    items: [{ label: "Add user" }, { label: "Item", href: "/dashboard/items/new" }, { label: "Log time" }, { label: "Weekly log" }],
  },
  {
    group: "Sales",
    icon: "M3 3h2l2.4 12.3a1 1 0 0 0 1 .7h8.7a1 1 0 0 0 1-.8L21 8H6M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM17 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
    items: [{ label: "Customer", href: "/dashboard/customers/new" }, { label: "Quote", href: "/dashboard/quotes/new" }, { label: "Invoice", href: "/dashboard/invoices/new" }, { label: "Subscription", href: "/dashboard/subscriptions/new" }, { label: "Customer payment" }],
  },
  {
    group: "Expenses",
    icon: "M4 3h16v18l-2.5-1.5L15 21l-3-1.5L9 21l-2.5-1.5L4 21zM8 8h8M8 12h8",
    items: [{ label: "Expense" }, { label: "Recurring expense" }],
  },
];

export default function QuickCreate() {
  return (
    <Popover className="relative">
      <PopoverButton aria-label="Quick create"
        className="group flex h-9 w-9 items-center justify-center rounded-lg bg-[#0f766e] text-white transition-transform hover:bg-[#0c5f58] focus:outline-none active:scale-95">
        <svg viewBox="0 0 24 24" className="h-5 w-5 transition-transform duration-300 group-data-[open]:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
      </PopoverButton>
      <PopoverPanel anchor="bottom end" transition
        className="z-50 mt-2 w-[38rem] max-w-[calc(100vw-1.5rem)] origin-top-right rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_16px_50px_rgba(15,40,60,0.18)] transition duration-200 ease-out data-[closed]:scale-95 data-[closed]:opacity-0">
        <div className="grid grid-cols-3 gap-5">
          {COLUMNS.map((col) => (
            <div key={col.group}>
              <div className="mb-2 flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e9f7f4] text-[#0f766e]">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={col.icon} /></svg>
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{col.group}</p>
              </div>
              <ul className="space-y-0.5">
                {col.items.map((it) => (
                  <li key={it.label}>
                    {it.href ? (
                      <Link prefetch={false} href={it.href} className="flex items-center gap-2 whitespace-nowrap rounded-lg px-2 py-1.5 text-[13px] text-slate-700 hover:bg-[#f0faf7] hover:text-[#0b1f3a]">
                        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-[#0f766e]" fill="currentColor"><path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm1 7h3v2h-3v3H9v-3H6V9h3V6h2z" /></svg>
                        {it.label}
                      </Link>
                    ) : (
                      <span title="Coming soon" className="flex items-center gap-2 whitespace-nowrap rounded-lg px-2 py-1.5 text-[13px] text-slate-400">
                        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-300" fill="currentColor"><path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm1 7h3v2h-3v3H9v-3H6V9h3V6h2z" /></svg>
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
