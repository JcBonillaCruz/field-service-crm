"use client";

import { Address } from "@/lib/customers";
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
  const set = (k: keyof Address) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [k]: e.target.value });

  return (
    <div className="grid gap-3 sm:grid-cols-6">
      <div className="sm:col-span-6">
        <label htmlFor={`${idPrefix}-label`} className={labelClass}>
          Name for this address <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input id={`${idPrefix}-label`} value={value.label} onChange={set("label")} autoComplete="off"
          placeholder="e.g. Home, Main office, Store #2" className={inputClass} />
      </div>
      <div className="sm:col-span-4">
        <label htmlFor={`${idPrefix}-street`} className={labelClass}>Street address</label>
        <input id={`${idPrefix}-street`} value={value.street} onChange={set("street")} autoComplete="off"
          placeholder="1200 Elm St" className={inputClass} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`${idPrefix}-unit`} className={labelClass}>
          Unit <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input id={`${idPrefix}-unit`} value={value.unit} onChange={set("unit")} autoComplete="off"
          placeholder="Apt 4B" className={inputClass} />
      </div>
      <div className="sm:col-span-3">
        <label htmlFor={`${idPrefix}-city`} className={labelClass}>City</label>
        <input id={`${idPrefix}-city`} value={value.city} onChange={set("city")} autoComplete="off"
          placeholder="Carrollton" className={inputClass} />
      </div>
      <div className="sm:col-span-1">
        <label htmlFor={`${idPrefix}-state`} className={labelClass}>State</label>
        <input id={`${idPrefix}-state`} value={value.state} maxLength={2} autoComplete="off"
          onChange={(e) => onChange({ ...value, state: e.target.value.replace(/[^A-Za-z]/g, "").toUpperCase() })}
          className={`${inputClass} uppercase`} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`${idPrefix}-zip`} className={labelClass}>ZIP</label>
        <input id={`${idPrefix}-zip`} value={value.zip} inputMode="numeric" maxLength={5} autoComplete="off"
          onChange={(e) => onChange({ ...value, zip: e.target.value.replace(/\D/g, "").slice(0, 5) })}
          placeholder="75006" className={inputClass} />
      </div>
    </div>
  );
}
