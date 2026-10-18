"use client";

import { useMemo } from "react";
import { COUNTRIES, PINNED_COUNTRIES, subdivisions } from "@/lib/geo";
import SearchSelect, { SelectOption } from "@/components/ui/SearchSelect";

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

export function CountrySelect({ id, value, onChange }: { id?: string; value: string; onChange: (v: string) => void }) {
  return <SearchSelect id={id} value={value} options={COUNTRY_OPTIONS} onChange={onChange} placeholder="Search country" />;
}

export function DialCodeSelect({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel: string }) {
  return (
    <SearchSelect compact value={value} options={DIAL_OPTIONS} onChange={onChange} ariaLabel={ariaLabel}
      placeholder="Code" panelWidth="w-72" />
  );
}

export function StateSelect({ id, country, value, onChange }: { id?: string; country: string; value: string; onChange: (v: string) => void }) {
  const options = useMemo(() => subdivisions(country).map(([v, label]) => ({ value: v, label, search: v })), [country]);
  return <SearchSelect id={id} value={value} options={options} onChange={onChange} placeholder="Search…" />;
}
