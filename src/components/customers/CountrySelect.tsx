"use client";

import { useMemo } from "react";
import { COUNTRIES, PINNED_COUNTRIES, subdivisions } from "@/lib/geo";
import SearchSelect, { SelectOption } from "@/components/ui/SearchSelect";
import { useLocale, useTranslations } from "next-intl";
import { intlTag } from "@/i18n/config";

function countryOptions(withDial: boolean): SelectOption[] {
  const list = withDial ? COUNTRIES.filter((c) => c.dial) : COUNTRIES;
  const make = (c: (typeof COUNTRIES)[number], group: string): SelectOption => ({
    value: c.code,
    label: c.name,
    short: withDial ? `${c.code} ${c.dial}` : undefined,
    hint: withDial ? c.dial : undefined,
    search: `${c.code} ${c.dial} ${c.dial.replace("+", "")}`,
    group,
  });
  const pinned = PINNED_COUNTRIES.map((code) => list.find((c) => c.code === code)!).filter(Boolean);
  return [...pinned.map((c) => make(c, "Common")), ...list.map((c) => make(c, "All countries"))];
}

const COUNTRY_OPTIONS = countryOptions(false);
const DIAL_OPTIONS = countryOptions(true);

// Paso 6.2b2: nombres de países y grupos en el idioma (la búsqueda acepta también el nombre en inglés)
function useCountryOptions(list: SelectOption[]) {
  const locale = useLocale();
  const t = useTranslations("custForm");
  return useMemo(() => {
    if (locale === "en") return list;
    let dn: Intl.DisplayNames | null = null;
    try { dn = new Intl.DisplayNames([intlTag(locale)], { type: "region" }); } catch { dn = null; }
    return list.map((o) => ({ ...o, label: dn?.of(o.value) ?? o.label, search: `${o.search ?? ""} ${o.label}`, group: o.group === "Common" ? t("gCommon") : t("gAll") }));
  }, [list, locale, t]);
}

export function CountrySelect({ id, value, onChange }: { id?: string; value: string; onChange: (v: string) => void }) {
  const t = useTranslations("custForm");
  const options = useCountryOptions(COUNTRY_OPTIONS);
  return <SearchSelect id={id} value={value} options={options} onChange={onChange} placeholder={t("searchCountry")} />;
}

export function DialCodeSelect({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel: string }) {
  const t = useTranslations("custForm");
  const options = useCountryOptions(DIAL_OPTIONS);
  return (
    <SearchSelect compact value={value} options={options} onChange={onChange} ariaLabel={ariaLabel}
      placeholder={t("code")} panelWidth="w-72" />
  );
}

export function StateSelect({ id, country, value, onChange }: { id?: string; country: string; value: string; onChange: (v: string) => void }) {
  const options = useMemo(() => subdivisions(country).map(([v, label]) => ({ value: v, label, search: v })), [country]);
  const t = useTranslations("custForm");
  return <SearchSelect id={id} value={value} options={options} onChange={onChange} placeholder={t("searchDots")} />;
}
