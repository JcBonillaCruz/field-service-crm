"use client";

import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react";
import { Check, Chevron, optionClass, panelClass } from "@/components/ui/SearchSelect";

// Selector corto sin buscador (etiquetas, tipos, etc.)
export default function SelectMenu({
  id,
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = "Select…",
}: {
  id?: string;
  value: string;
  options: { value: string; label: string; divider?: boolean }[];
  onChange: (v: string) => void;
  ariaLabel?: string;
  placeholder?: string;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <Listbox value={value} onChange={onChange}>
      <ListboxButton id={id} aria-label={ariaLabel}
        className="relative w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-4 pr-10 text-left text-[15px] text-slate-800 focus:border-[#0f766e] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15 data-[open]:border-[#0f766e] data-[open]:bg-white">
        <span className={`block truncate ${current ? "" : "text-slate-400"}`}>{current?.label ?? placeholder}</span>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400"><Chevron /></span>
      </ListboxButton>
      <ListboxOptions anchor="bottom start" transition className={`${panelClass} w-[max(var(--button-width),11rem)] focus:outline-none`}>
        {options.map((o) => (
          <ListboxOption key={o.value} value={o.value}
            className={`${optionClass} ${o.divider ? "mt-1 border-t border-slate-100 pt-2.5 text-[#0f766e]" : ""}`}>
            <span className="truncate">{o.label}</span>
            <Check />
          </ListboxOption>
        ))}
      </ListboxOptions>
    </Listbox>
  );
}
