"use client";

import { Address } from "@/lib/customers";
import { cleanPostal, postalLabel, postalPlaceholder, stateLabel, subdivisions } from "@/lib/geo";
import { CountryOptions } from "@/components/customers/CountrySelect";
import { useNoFill } from "@/components/customers/noFill";
import { inputClass, labelClass } from "@/components/customers/ui";

export default function AddressFields({
  value,
  onChange,
  idPrefix,
}: {
  value: Address;
  onChange: (a: Address) => void;
  idPrefix: string;
}) {
  const noFill = useNoFill();
  const states = subdivisions(value.country);
  const set = (k: keyof Address) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...value, [k]: e.target.value });

  return (
    <div className="grid gap-3 sm:grid-cols-6">
      <div className="sm:col-span-3">
        <label htmlFor={`${idPrefix}-label`} className={labelClass}>
          Name for this address <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input id={`${idPrefix}-label`} value={value.label} onChange={set("label")} {...noFill(`${idPrefix}-a1`)}
          placeholder="e.g. Home, Main office, Store #2" className={inputClass} />
      </div>
      <div className="sm:col-span-3">
        <label htmlFor={`${idPrefix}-country`} className={labelClass}>Country</label>
        <select id={`${idPrefix}-country`} value={value.country}
          onChange={(e) => onChange({ ...value, country: e.target.value, state: "", zip: cleanPostal(e.target.value, value.zip) })}
          className={inputClass}>
          <CountryOptions />
        </select>
      </div>
      <div className="sm:col-span-4">
        <label htmlFor={`${idPrefix}-street`} className={labelClass}>Street address</label>
        <input id={`${idPrefix}-street`} value={value.street} onChange={set("street")} {...noFill(`${idPrefix}-a2`)}
          placeholder={value.country === "US" ? "1200 Elm St" : "Street and number"} className={inputClass} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`${idPrefix}-unit`} className={labelClass}>
          Unit <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input id={`${idPrefix}-unit`} value={value.unit} onChange={set("unit")} {...noFill(`${idPrefix}-a3`)}
          placeholder="Apt 4B" className={inputClass} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`${idPrefix}-city`} className={labelClass}>City</label>
        <input id={`${idPrefix}-city`} value={value.city} onChange={set("city")} {...noFill(`${idPrefix}-a4`)}
          placeholder={value.country === "US" ? "Carrollton" : ""} className={inputClass} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`${idPrefix}-state`} className={labelClass}>
          {stateLabel(value.country)}
          {states.length === 0 && <span className="font-normal text-slate-400"> (optional)</span>}
        </label>
        {states.length > 0 ? (
          <select id={`${idPrefix}-state`} value={value.state} onChange={set("state")} className={inputClass}>
            <option value="">Select…</option>
            {states.map(([v, name]) => <option key={v} value={v}>{name}</option>)}
          </select>
        ) : (
          <input id={`${idPrefix}-state`} value={value.state} onChange={set("state")} {...noFill(`${idPrefix}-a5`)}
            className={inputClass} />
        )}
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`${idPrefix}-zip`} className={labelClass}>
          {postalLabel(value.country)} <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input id={`${idPrefix}-zip`} value={value.zip} {...noFill(`${idPrefix}-a6`)}
          inputMode={["US", "MX", "ES"].includes(value.country) ? "numeric" : "text"}
          onChange={(e) => onChange({ ...value, zip: cleanPostal(value.country, e.target.value) })}
          placeholder={postalPlaceholder(value.country)} className={inputClass} />
      </div>
    </div>
  );
}
