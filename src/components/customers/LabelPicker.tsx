"use client";

import { useState } from "react";
import SelectMenu from "@/components/ui/SelectMenu";
import { inputClass } from "@/components/customers/ui";
import { useTranslations } from "next-intl";

// Etiqueta de un teléfono o correo: opciones comunes o una personalizada
export default function LabelPicker({
  value,
  options,
  onChange,
  id,
  ariaLabel,
  display = (o) => o,
}: {
  display?: (o: string) => string; // Paso 6.2b2: la etiqueta guardada (en inglés) escrita en el idioma
  value: string;
  options: string[];
  onChange: (v: string) => void;
  id: string;
  ariaLabel: string;
}) {
  const t = useTranslations("custUi");
  const [custom, setCustom] = useState(value !== "" && !options.includes(value));

  if (custom) {
    return (
      <div className="relative">
        <input id={id} aria-label={ariaLabel} value={value} maxLength={30} autoFocus autoComplete="bp-off"
          data-lpignore="true" data-1p-ignore="true" placeholder={t("label")}
          onChange={(e) => onChange(e.target.value)} className={`${inputClass} pr-9`} />
        <button type="button" title={t("fromList")} aria-label={t("fromList")}
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
    <SelectMenu id={id} ariaLabel={ariaLabel} value={options.includes(value) ? value : options[0]}
      options={[...options.map((o) => ({ value: o, label: display(o) })), { value: "__custom", label: t("customLabel"), divider: true }]}
      onChange={(v) => {
        if (v === "__custom") { setCustom(true); onChange(""); }
        else onChange(v);
      }} />
  );
}
