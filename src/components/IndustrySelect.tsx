"use client";

import { useMemo, useState } from "react";
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";
import { INDUSTRY_GROUPS } from "@/lib/types";

export default function IndustrySelect({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
}) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return INDUSTRY_GROUPS;
    return INDUSTRY_GROUPS.map((g) => ({
      group: g.group,
      items: g.items.filter((i) => i.toLowerCase().includes(q)),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  return (
    <Combobox value={value} onChange={(v: string | null) => { onChange(v ?? ""); setQuery(""); }} onClose={() => setQuery("")}>
      <div className="relative">
        <ComboboxInput
          id={id}
          autoComplete="off"
          placeholder="Search or choose a type of business"
          displayValue={(v: string) => v}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-4 pr-10 text-[15px] placeholder:text-slate-400 focus:bg-white focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15"
        />
        <ComboboxButton className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600" aria-label="Show all types">
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
            <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
          </svg>
        </ComboboxButton>
      </div>

      <ComboboxOptions
        anchor="bottom start"
        className="z-[100] mt-1 max-h-72 w-[var(--input-width)] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-[0_12px_40px_rgba(15,40,60,0.14)] empty:invisible"
      >
        {groups.length === 0 && (
          <div className="px-4 py-3 text-sm text-slate-500">
            No match. Choose <span className="font-medium text-slate-700">Other</span> and continue.
          </div>
        )}
        {groups.map((g) => (
          <div key={g.group}>
            <div className="px-4 pb-1 pt-3 text-xs font-medium text-slate-400">{g.group}</div>
            {g.items.map((item) => (
              <ComboboxOption
                key={item}
                value={item}
                className="group flex cursor-pointer items-center justify-between px-4 py-2 text-[15px] text-slate-700 data-[focus]:bg-[#f0faf7] data-[focus]:text-[#0b1f3a]"
              >
                <span>{item}</span>
                <svg viewBox="0 0 20 20" className="invisible h-4 w-4 text-[#0f766e] group-data-[selected]:visible" fill="currentColor" aria-hidden="true">
                  <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" />
                </svg>
              </ComboboxOption>
            ))}
          </div>
        ))}
      </ComboboxOptions>
    </Combobox>
  );
}
