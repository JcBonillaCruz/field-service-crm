"use client";

import { useMemo, useState } from "react";
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";

export type SelectOption = {
  value: string;
  label: string;   // lo que se ve en la lista
  short?: string;  // lo que se ve en el campo cerrado (ej. "US +1")
  hint?: string;   // texto gris a la derecha (ej. "+52")
  group?: string;  // título de sección (ej. "Common")
  search?: string; // palabras extra para el buscador
};

const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const Check = () => (
  <svg viewBox="0 0 20 20" className="invisible h-4 w-4 shrink-0 text-[#0f766e] group-data-[selected]:visible" fill="currentColor" aria-hidden="true">
    <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" />
  </svg>
);

export const Chevron = () => (
  <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
    <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
  </svg>
);

export const panelClass =
  "z-[60] mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-[0_12px_40px_rgba(15,40,60,0.14)] " +
  "origin-top transition duration-150 ease-out data-[closed]:scale-95 data-[closed]:opacity-0 empty:invisible";

export const optionClass =
  "group flex cursor-pointer items-center justify-between gap-3 px-4 py-2 text-[15px] text-slate-700 data-[focus]:bg-[#f0faf7] data-[focus]:text-[#0b1f3a]";

// Selector con buscador (países, estados, códigos de teléfono...)
export default function SearchSelect({
  id,
  value,
  options,
  onChange,
  placeholder = "Search or choose",
  ariaLabel,
  compact = false,
  panelWidth,
}: {
  id?: string;
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  compact?: boolean;
  panelWidth?: string;
}) {
  const [query, setQuery] = useState("");
  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return options;
    const seen = new Set<string>();
    return options.filter((o) => {
      if (seen.has(o.value)) return false; // sin grupos repetidos al buscar
      const hit = fold(`${o.label} ${o.short ?? ""} ${o.hint ?? ""} ${o.search ?? ""}`).includes(q);
      if (hit) seen.add(o.value);
      return hit;
    }).map((o) => ({ ...o, group: undefined }));
  }, [query, options]);

  const display = (v: string) => {
    const o = byValue.get(v);
    return o ? (compact && o.short ? o.short : o.label) : "";
  };

  return (
    <Combobox immediate value={value} onChange={(v: string | null) => { if (v != null) onChange(v); setQuery(""); }} onClose={() => setQuery("")}>
      <div className="relative">
        <ComboboxInput
          id={id}
          aria-label={ariaLabel}
          autoComplete="bp-off"
          data-lpignore="true"
          data-1p-ignore="true"
          spellCheck={false}
          placeholder={placeholder}
          displayValue={display}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setQuery(e.target.value)}
          className={`w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 text-[15px] placeholder:text-slate-400 focus:border-[#0f766e] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15 ${compact ? "pl-3 pr-7" : "pl-4 pr-10"}`}
        />
        <ComboboxButton className={`absolute inset-y-0 right-0 flex items-center text-slate-400 hover:text-slate-600 ${compact ? "px-1.5" : "px-3"}`} aria-label="Show all options">
          <Chevron />
        </ComboboxButton>
      </div>

      <ComboboxOptions anchor="bottom start" transition
        className={`${panelClass} ${panelWidth ?? "w-[var(--input-width)]"}`}>
        {filtered.length === 0 && <div className="px-4 py-3 text-sm text-slate-500">No results.</div>}
        {filtered.map((o, i) => (
          <div key={`${o.group ?? ""}-${o.value}-${i}`}>
            {o.group && o.group !== filtered[i - 1]?.group && (
              <div className={`px-4 pb-1 pt-3 text-xs font-medium text-slate-400 ${i > 0 ? "mt-1 border-t border-slate-100" : ""}`}>{o.group}</div>
            )}
            <ComboboxOption value={o.value} className={optionClass}>
              <span className="truncate">{o.label}</span>
              <span className="flex shrink-0 items-center gap-2">
                {o.hint && <span className="text-sm text-slate-400">{o.hint}</span>}
                <Check />
              </span>
            </ComboboxOption>
          </div>
        ))}
      </ComboboxOptions>
    </Combobox>
  );
}

export { Check };
