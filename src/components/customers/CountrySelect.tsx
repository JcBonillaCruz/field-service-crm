"use client";

import { COUNTRIES, PINNED_COUNTRIES } from "@/lib/geo";

const pinned = PINNED_COUNTRIES.map((c) => COUNTRIES.find((x) => x.code === c)!);

// Lista de países con los más usados arriba. withDial muestra el código telefónico.
export function CountryOptions({ withDial = false }: { withDial?: boolean }) {
  const label = (c: (typeof COUNTRIES)[number]) => (withDial ? `${c.name} (${c.dial})` : c.name);
  return (
    <>
      <optgroup label="Common">
        {pinned.map((c) => <option key={`p-${c.code}`} value={c.code}>{label(c)}</option>)}
      </optgroup>
      <optgroup label="All countries">
        {COUNTRIES.filter((c) => !withDial || c.dial).map((c) => <option key={c.code} value={c.code}>{label(c)}</option>)}
      </optgroup>
    </>
  );
}
