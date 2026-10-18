"use client";

import { useState } from "react";
import { inputClass } from "@/components/customers/ui";

// Etiqueta de un teléfono o correo: opciones comunes o una personalizada
export default function LabelPicker({
  value,
  options,
  onChange,
  id,
  ariaLabel,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  id: string;
  ariaLabel: string;
}) {
  const [custom, setCustom] = useState(value !== "" && !options.includes(value));

  if (custom) {
    return (
      <div className="relative">
        <input id={id} aria-label={ariaLabel} value={value} maxLength={30} autoFocus autoComplete="bp-off"
          data-lpignore="true" data-1p-ignore="true" placeholder="Label"
          onChange={(e) => onChange(e.target.value)} className={`${inputClass} pr-9`} />
        <button type="button" title="Choose from list" aria-label="Choose from list"
          onClick={() => { setCustom(false); onChange(options[0]); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700">
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <select id={id} aria-label={ariaLabel} value={options.includes(value) ? value : options[0]}
      onChange={(e) => {
        if (e.target.value === "__custom") { setCustom(true); onChange(""); }
        else onChange(e.target.value);
      }}
      className={`${inputClass} pr-8`}>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
      <option value="__custom">Custom label…</option>
    </select>
  );
}
