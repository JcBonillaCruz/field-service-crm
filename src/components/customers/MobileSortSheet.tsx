"use client";

import { useState } from "react";
import BottomSheet from "@/components/customers/BottomSheet";
import { SORTS } from "@/lib/customer-list";

export default function MobileSortSheet({
  open, onClose, sort, dir, onApply, options = SORTS,
}: {
  options?: readonly { value: string; label: string }[];
  open: boolean;
  onClose: () => void;
  sort: string;
  dir: "asc" | "desc";
  onApply: (sort: string, dir: "asc" | "desc") => void;
}) {
  const [sel, setSel] = useState(sort);
  const [selDir, setSelDir] = useState<"asc" | "desc">(dir);

  function tap(value: string) {
    if (value === sel) setSelDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSel(value); setSelDir(value === "created" || value === "updated" || value === "date" ? "desc" : "asc"); }
  }

  const current = options.find((s) => s.value === sel)?.label ?? "Name";

  return (
    <BottomSheet open={open} onClose={onClose} title="Sort by"
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-slate-500">Sort selected: <span className="font-semibold text-[#0b1f3a]">{current}</span> ({selDir === "asc" ? "Ascending" : "Descending"})</div>
          <button type="button" onClick={() => onApply(sel, selDir)}
            className="rounded-lg bg-[#0f766e] px-6 py-2.5 text-[15px] font-semibold text-white hover:bg-[#0c5f58]">Sort</button>
        </div>
      }>
      <ul className="space-y-2">
        {options.map((s) => {
          const active = s.value === sel;
          return (
            <li key={s.value}>
              <button type="button" onClick={() => tap(s.value)}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-left ${active ? "border-[#0f766e] bg-[#f6fbfa]" : "border-slate-200"}`}>
                <span className="flex items-center gap-3">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${active ? "border-[#0f766e]" : "border-slate-300"}`}>
                    {active && <span className="h-2.5 w-2.5 rounded-full bg-[#0f766e]" />}
                  </span>
                  <span className={active ? "font-medium text-[#0b1f3a]" : "text-slate-700"}>{s.label}</span>
                </span>
                {active && (
                  <span className="flex items-center gap-1 text-sm font-medium text-[#0f766e]">
                    {selDir === "asc" ? "Ascending" : "Descending"}
                    <svg viewBox="0 0 20 20" className={`h-4 w-4 ${selDir === "desc" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 15V5m0 0-4 4m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 flex items-start gap-2 rounded-xl bg-[#eef6ff] px-4 py-3 text-sm text-slate-600">
        <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" fill="currentColor"><path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 4a1 1 0 110 2 1 1 0 010-2zm1 8H9v-5h2z" /></svg>
        Tap the selected option again to switch between ascending and descending.
      </p>
    </BottomSheet>
  );
}
