"use client";

import { useState } from "react";
import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions } from "@headlessui/react";
import { createClient } from "@/lib/supabase/client";
import { Check, Chevron, optionClass, panelClass } from "@/components/ui/SearchSelect";
import { inputClass } from "@/components/customers/ui";
import { InvCategory } from "@/lib/inventory";

const NEW = "__new__";

// Categoría: busca o crea una nueva ahí mismo (\"+ Create ...\" siempre visible al escribir)
export default function CategoryPicker({ companyId, value, categories, onChange, onCreated, id }: {
  companyId: string; value: string | null; categories: InvCategory[]; id?: string;
  onChange: (id: string | null) => void; onCreated: (c: InvCategory) => void;
}) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const q = query.trim();
  const list = categories.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  const exact = categories.some((c) => c.name.toLowerCase() === q.toLowerCase());

  async function pick(v: string | null) {
    setErr("");
    if (v !== NEW) { onChange(v); return; }
    setBusy(true);
    const { data, error } = await createClient().from("item_categories").insert({ company_id: companyId, name: q }).select("id, name").single();
    setBusy(false);
    if (error || !data) return setErr(error?.code === "23505" ? "That category already exists." : "The category couldn't be created.");
    onCreated(data as InvCategory); onChange((data as InvCategory).id); setQuery("");
  }

  return (
    <div>
      <Combobox immediate value={value} onChange={pick} onClose={() => setQuery("")}>
        <div className="relative">
          <ComboboxInput id={id} autoComplete="off" placeholder="Search or create a category"
            displayValue={(v: string | null) => categories.find((c) => c.id === v)?.name ?? ""}
            onChange={(e) => setQuery(e.target.value)} className={`${inputClass} pr-10`} />
          <ComboboxButton aria-label="Show categories" className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400"><Chevron /></ComboboxButton>
        </div>
        <ComboboxOptions anchor="bottom start" transition className={`${panelClass} w-[var(--input-width)]`}>
          {!q && <ComboboxOption value={null} className={optionClass}><span className="text-slate-400">No category</span><Check /></ComboboxOption>}
          {list.map((c) => <ComboboxOption key={c.id} value={c.id} className={optionClass}><span className="truncate">{c.name}</span><Check /></ComboboxOption>)}
          {q && !exact && (
            <ComboboxOption value={NEW} className={`${optionClass} border-t border-slate-100 font-medium text-[#0f766e]`}>
              <span className="flex items-center gap-2">
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>
                {busy ? "Creating..." : <>Create &ldquo;{q}&rdquo;</>}
              </span>
            </ComboboxOption>
          )}
        </ComboboxOptions>
      </Combobox>
      {err && <p className="mt-1 text-[13px] text-red-600">{err}</p>}
    </div>
  );
}
