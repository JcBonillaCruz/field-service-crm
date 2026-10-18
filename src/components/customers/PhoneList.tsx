"use client";

import { PHONE_LABELS, Phone, formatPhoneFor, newPhone, phoneError } from "@/lib/customers";
import { dialCode } from "@/lib/geo";
import LabelPicker from "@/components/customers/LabelPicker";
import { CountryOptions } from "@/components/customers/CountrySelect";
import { useNoFill } from "@/components/customers/noFill";
import { inputClass } from "@/components/customers/ui";

export default function PhoneList({
  phones,
  onChange,
  showErrors,
}: {
  phones: Phone[];
  onChange: (list: Phone[]) => void;
  showErrors: boolean;
}) {
  const noFill = useNoFill();
  const update = (i: number, p: Phone) => onChange(phones.map((x, j) => (j === i ? p : x)));

  function remove(i: number) {
    const next = phones.filter((_, j) => j !== i);
    if (next.length && !next.some((p) => p.is_primary)) next[0] = { ...next[0], is_primary: true };
    onChange(next.length ? next : [newPhone(true)]);
  }

  return (
    <div>
      <ul className="space-y-3">
        {phones.map((p, i) => {
          const err = showErrors ? phoneError(p) : "";
          return (
            <li key={i}>
              <div className="grid grid-cols-[1fr_auto] items-center gap-2 sm:grid-cols-[9.5rem_6.5rem_1fr_auto]">
                <div className="col-span-2 sm:col-span-1">
                  <LabelPicker id={`phone-label-${i}`} ariaLabel={`Phone ${i + 1} label`} options={PHONE_LABELS}
                    value={p.label} onChange={(label) => update(i, { ...p, label })} />
                </div>

                <div className="col-span-2 grid grid-cols-[6.5rem_1fr] gap-2 sm:col-span-2 sm:grid-cols-[6.5rem_1fr]">
                  {/* Código de país: se ve corto (US +1) pero al abrir muestra el nombre completo */}
                  <div className="relative">
                    <div className={`${inputClass} pointer-events-none flex items-center justify-between gap-1 whitespace-nowrap`} aria-hidden="true">
                      <span className="font-medium text-slate-700">{p.country}</span>
                      <span className="text-slate-500">{dialCode(p.country)}</span>
                    </div>
                    <select aria-label={`Phone ${i + 1} country`} value={p.country}
                      onChange={(e) => update(i, { ...p, country: e.target.value, number: formatPhoneFor(e.target.value, p.number) })}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0">
                      <CountryOptions withDial />
                    </select>
                  </div>
                  <input id={`phone-${i}`} type="text" inputMode="tel" aria-label={`Phone ${i + 1} number`} value={p.number}
                    {...noFill(`ph${i}`)}
                    placeholder={p.country === "US" || p.country === "CA" ? "(214) 555-0123" : "Phone number"}
                    onChange={(e) => update(i, { ...p, number: formatPhoneFor(p.country, e.target.value) })}
                    className={`${inputClass} ${err ? "border-red-300" : ""}`} />
                </div>

                <div className="col-span-2 flex items-center justify-between gap-4 sm:col-span-1 sm:justify-end">
                  <label className="flex items-center gap-1.5 text-sm text-slate-600" title="Primary phone">
                    <input type="radio" name="primary-phone" checked={p.is_primary}
                      onChange={() => onChange(phones.map((x, j) => ({ ...x, is_primary: j === i })))}
                      className="h-4 w-4 accent-[#0f766e]" />
                    <span className="sm:sr-only">Primary</span>
                  </label>
                  <button type="button" onClick={() => remove(i)} aria-label={`Remove phone ${i + 1}`} title="Remove"
                    className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <path d="m5 5 10 10M15 5 5 15" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>
              {err && <p className="mt-1 text-sm text-red-600">{err}</p>}
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={() => onChange([...phones, newPhone(phones.length === 0)])}
        className="mt-3 text-sm font-semibold text-[#0f766e] hover:underline">
        + Add another phone
      </button>
    </div>
  );
}
