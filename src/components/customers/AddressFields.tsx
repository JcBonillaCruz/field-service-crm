"use client";

import { Address } from "@/lib/customers";
import { cleanPostal, postalPlaceholder, subdivisions } from "@/lib/geo";
import { CountrySelect, StateSelect } from "@/components/customers/CountrySelect";
import { useNoFill } from "@/components/customers/noFill";
import { inputClass, labelClass } from "@/components/customers/ui";
import { useTranslations } from "next-intl";
import { useCustTx } from "@/i18n/useCustTx";

export default function AddressFields({
  value,
  onChange,
  idPrefix,
  hideLabel = false,
}: {
  value: Address;
  onChange: (a: Address) => void;
  idPrefix: string;
  hideLabel?: boolean;
}) {
  const t = useTranslations("custForm");
  const cx = useCustTx();
  const noFill = useNoFill();
  const states = subdivisions(value.country);
  const set = (k: keyof Address) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [k]: e.target.value });

  return (
    <div className="grid gap-3 sm:grid-cols-6">
      {!hideLabel && <div className="sm:col-span-3">
        <label htmlFor={`${idPrefix}-label`} className={labelClass}>
          {t("addrName")} <span className="font-normal text-slate-400">({t("optional")})</span>
        </label>
        <input id={`${idPrefix}-label`} value={value.label} onChange={set("label")} {...noFill(`${idPrefix}-a1`)}
          placeholder={t("addrNamePh")} className={inputClass} />
      </div>}
      <div className={hideLabel ? "sm:col-span-6" : "sm:col-span-3"}>
        <label htmlFor={`${idPrefix}-country`} className={labelClass}>{t("country")}</label>
        <CountrySelect id={`${idPrefix}-country`} value={value.country}
          onChange={(country) => onChange({ ...value, country, state: country === value.country ? value.state : "", zip: cleanPostal(country, value.zip) })} />
      </div>
      <div className="sm:col-span-4">
        <label htmlFor={`${idPrefix}-street`} className={labelClass}>{t("street")}</label>
        <input id={`${idPrefix}-street`} value={value.street} onChange={set("street")} {...noFill(`${idPrefix}-a2`)}
          placeholder={value.country === "US" ? "1200 Elm St" : t("streetPh")} className={inputClass} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`${idPrefix}-unit`} className={labelClass}>
          {t("unit")} <span className="font-normal text-slate-400">({t("optional")})</span>
        </label>
        <input id={`${idPrefix}-unit`} value={value.unit} onChange={set("unit")} {...noFill(`${idPrefix}-a3`)}
          placeholder={t("unitPh")} className={inputClass} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`${idPrefix}-city`} className={labelClass}>{t("city")}</label>
        <input id={`${idPrefix}-city`} value={value.city} onChange={set("city")} {...noFill(`${idPrefix}-a4`)}
          placeholder={value.country === "US" ? "Carrollton" : ""} className={inputClass} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`${idPrefix}-state`} className={labelClass}>
          {cx.stateLabel(value.country)}
          {states.length === 0 && <span className="font-normal text-slate-400"> ({t("optional")})</span>}
        </label>
        {states.length > 0 ? (
          <StateSelect id={`${idPrefix}-state`} country={value.country} value={value.state}
            onChange={(state) => onChange({ ...value, state })} />
        ) : (
          <input id={`${idPrefix}-state`} value={value.state} onChange={set("state")} {...noFill(`${idPrefix}-a5`)}
            className={inputClass} />
        )}
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`${idPrefix}-zip`} className={labelClass}>
          {cx.postalLabel(value.country)} <span className="font-normal text-slate-400">({t("optional")})</span>
        </label>
        <input id={`${idPrefix}-zip`} value={value.zip} {...noFill(`${idPrefix}-a6`)}
          inputMode={["US", "MX", "ES"].includes(value.country) ? "numeric" : "text"}
          onChange={(e) => onChange({ ...value, zip: cleanPostal(value.country, e.target.value) })}
          placeholder={postalPlaceholder(value.country)} className={inputClass} />
      </div>
    </div>
  );
}
