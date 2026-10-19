"use client";

import { useState } from "react";
import Link from "next/link";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";

type Recent = { id: string; name: string };

export function readRecent(): Recent[] {
  try { return JSON.parse(localStorage.getItem("bp-recent-customers") || "[]"); } catch { return []; }
}

export default function RecentMenu() {
  const [items, setItems] = useState<Recent[]>([]);
  return (
    <Popover className="relative">
      <PopoverButton aria-label="Recent" onClick={() => setItems(readRecent())}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none data-[open]:bg-[#e9f7f4] data-[open]:text-[#0f766e]">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 2.6-6.3M3 4v4h4M12 7v5l3 2" /></svg>
      </PopoverButton>
      <PopoverPanel anchor="bottom start" transition
        className="z-50 mt-2 w-72 origin-top rounded-2xl border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,40,60,0.18)] transition duration-200 ease-out data-[closed]:scale-95 data-[closed]:opacity-0">
        <div className="border-b border-slate-100 px-5 py-3"><p className="font-semibold text-[#0b1f3a]">Recently viewed</p></div>
        {items.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-slate-500">Customers you open will appear here.</p>
        ) : (
          <ul className="max-h-80 overflow-y-auto py-1">
            {items.map((r) => (
              <li key={r.id}>
                <Link href={`/dashboard/customers/${r.id}`} className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-[#f0faf7]">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0 1 16 0" /></svg>
                  <span className="truncate text-slate-700">{r.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverPanel>
    </Popover>
  );
}
