"use client";

import { useState } from "react";
import { Address, EMPTY_ADDRESS, addressIsEmpty, cityLine } from "@/lib/customers";
import { cleanPostal, countryName, postalPlaceholder, stateLabel, subdivisions } from "@/lib/geo";
import { CountrySelect, StateSelect } from "@/components/customers/CountrySelect";
import { useNoFill } from "@/components/customers/noFill";
import { inputClass } from "@/components/customers/ui";
import { confirmDelete } from "@/lib/confirm";
import RowActions from "@/components/ui/RowActions";

// Job sites compactos: cada dirección es UNA línea (nombre + dirección) con ✏️ y 🗑️.
// Al editar se abre una sola fila de campos (nombre · calle · unidad · ciudad · estado · ZIP). Solo una abierta a la vez.
export default function JobSitesEditor({ sites, onChange, defaultCountry = "US", defaultState = "" }: {
  sites: Address[]; onChange: (list: Address[]) => void; defaultCountry?: string; defaultState?: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const noFill = useNoFill();

  // Cerrar la que está abierta: si quedó vacía, se quita
  function close(list = sites) {
    if (open !== null && list[open] && addressIsEmpty(list[open]) && !list[open].label.trim()) {
      onChange(list.filter((_, i) => i !== open));
    }
    setOpen(null);
  }
  // Abrir otra fila: si la abierta quedó vacía se quita (y se corrige el número de la fila)
  function openRow(i: number) {
    if (open !== null && open !== i && sites[open] && addressIsEmpty(sites[open]) && !sites[open].label.trim()) {
      onChange(sites.filter((_, j) => j !== open));
      setOpen(open < i ? i - 1 : i);
    } else setOpen(i);
  }
  function add() {
    let list = sites;
    if (open !== null && list[open] && addressIsEmpty(list[open]) && !list[open].label.trim()) list = list.filter((_, i) => i !== open);
    const next = [...list, { ...EMPTY_ADDRESS, country: defaultCountry || "US", state: defaultState }];
    onChange(next); setOpen(next.length - 1);
  }
  async function remove(i: number) {
    const s = sites[i];
    const empty = addressIsEmpty(s) && !s.label.trim();
    if (!empty && !(await confirmDelete({ title: `Remove ${s.label.trim() || `job site ${i + 1}`}?`, message: "It's removed from this customer when you save." }))) return;
    onChange(sites.filter((_, j) => j !== i));
    setOpen((o) => (o === null ? null : o === i ? null : o > i ? o - 1 : o));
  }
  const set = (i: number, patch: Partial<Address>) => onChange(sites.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const line = (a: Address) => [a.street, a.unit, cityLine(a), a.country && a.country !== "US" ? countryName(a.country) : ""].filter((x) => x && x.trim()).join(", ");
  const small = `${inputClass} !py-2 text-[14.5px]`;
  const lab = "mb-1 block text-[12px] font-medium text-slate-500";

  return (
    <div>
      {sites.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-[14px] text-slate-500">No job sites yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {sites.map((s, i) => open === i ? (
            <li key={i} className="bg-[#f8fbfa] px-4 py-4">
              <div className="grid gap-3 sm:grid-cols-6 xl:grid-cols-12">
                <div className="sm:col-span-3 xl:col-span-2">
                  <label className={lab} htmlFor={`js-${i}-label`}>Name</label>
                  <input id={`js-${i}-label`} autoFocus value={s.label} onChange={(e) => set(i, { label: e.target.value })} {...noFill(`js${i}a`)} placeholder="e.g. Casa Drenaje" className={small} />
                </div>
                <div className="sm:col-span-3 xl:col-span-3">
                  <label className={lab} htmlFor={`js-${i}-street`}>Street address</label>
                  <input id={`js-${i}-street`} value={s.street} onChange={(e) => set(i, { street: e.target.value })} {...noFill(`js${i}b`)} placeholder="1200 Elm St" className={small} />
                </div>
                <div className="sm:col-span-2 xl:col-span-1">
                  <label className={lab} htmlFor={`js-${i}-unit`}>Unit</label>
                  <input id={`js-${i}-unit`} value={s.unit} onChange={(e) => set(i, { unit: e.target.value })} {...noFill(`js${i}c`)} placeholder="Apt 4B" className={small} />
                </div>
                <div className="sm:col-span-2 xl:col-span-2">
                  <label className={lab} htmlFor={`js-${i}-city`}>City</label>
                  <input id={`js-${i}-city`} value={s.city} onChange={(e) => set(i, { city: e.target.value })} {...noFill(`js${i}d`)} placeholder="Carrollton" className={small} />
                </div>
                <div className="sm:col-span-2 xl:col-span-2">
                  <label className={lab} htmlFor={`js-${i}-state`}>{stateLabel(s.country)}</label>
                  {subdivisions(s.country).length ? (
                    <StateSelect id={`js-${i}-state`} country={s.country} value={s.state} onChange={(state) => set(i, { state })} />
                  ) : (
                    <input id={`js-${i}-state`} value={s.state} onChange={(e) => set(i, { state: e.target.value })} {...noFill(`js${i}e`)} className={small} />
                  )}
                </div>
                <div className="sm:col-span-2 xl:col-span-2">
                  <label className={lab} htmlFor={`js-${i}-zip`}>ZIP</label>
                  <div className="flex gap-2">
                    <input id={`js-${i}-zip`} value={s.zip} inputMode="numeric" onChange={(e) => set(i, { zip: cleanPostal(s.country, e.target.value) })} {...noFill(`js${i}f`)} placeholder={postalPlaceholder(s.country)} className={small} />
                    <button type="button" onClick={() => close()} title="Done" aria-label="Done"
                      className="flex h-[42px] w-11 shrink-0 items-center justify-center rounded-lg bg-[#0f766e] text-white transition-colors hover:bg-[#0c5f59]">
                      <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" /></svg>
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[13px] text-slate-500">
                  <span>Country:</span>
                  <div className="w-56"><CountrySelect id={`js-${i}-country`} value={s.country}
                    onChange={(country) => set(i, { country, state: country === s.country ? s.state : "", zip: cleanPostal(country, s.zip) })} /></div>
                </div>
                <button type="button" onClick={() => remove(i)} className="text-[13px] font-medium text-red-600 hover:underline">Remove</button>
              </div>
            </li>
          ) : (
            <li key={i} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[#f6fbfa]">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e9f7f4] text-[#0f766e]">
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
              </span>
              <button type="button" onClick={() => openRow(i)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[14.5px] font-semibold text-[#0b1f3a]">{s.label.trim() || `Job site ${i + 1}`}</span>
                <span className="block truncate text-[13px] text-slate-500">{line(s) || "No address yet — tap to add it"}</span>
              </button>
              <RowActions label={s.label || `job site ${i + 1}`} onEdit={() => openRow(i)} onDelete={() => remove(i)} />
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={add} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0f766e] hover:underline">
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>
        Add job site
      </button>
    </div>
  );
}
