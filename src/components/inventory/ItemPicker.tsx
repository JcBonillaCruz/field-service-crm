"use client";

import { useState } from "react";
import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions } from "@headlessui/react";
import { optionClass, panelClass } from "@/components/ui/SearchSelect";
import { inputClass } from "@/components/customers/ui";
import BarcodeScanner from "@/components/catalog/BarcodeScanner";
import { InvItem, qtyFmt } from "@/lib/inventory";

// Agregar un producto a la lista: buscar por nombre o SKU, o escanear su código
export default function ItemPicker({ items, onPick, available, placeholder = "Add an item: search by name or SKU", onNotFound }: {
  items: InvItem[]; onPick: (it: InvItem) => void; available?: (id: string) => number; placeholder?: string; onNotFound?: (code: string) => void;
}) {
  const [q, setQ] = useState("");
  const [scan, setScan] = useState(false);
  const t = q.trim().toLowerCase();
  const list = (t ? items.filter((i) => `${i.name} ${i.sku ?? ""}`.toLowerCase().includes(t)) : items).slice(0, 40);
  function scanned(code: string) {
    setScan(false);
    const it = items.find((i) => (i.sku ?? "").trim().toLowerCase() === code.trim().toLowerCase());
    if (it) onPick(it); else onNotFound?.(code);
  }
  return (
    <div className="flex gap-2">
      <div className="relative min-w-0 flex-1">
        <Combobox immediate value={null} onChange={(it: InvItem | null) => { if (it) { onPick(it); setQ(""); } }} onClose={() => setQ("")}>
          <ComboboxInput autoComplete="off" value={q} placeholder={placeholder} onChange={(e) => setQ(e.target.value)} className={inputClass} />
          <ComboboxOptions anchor="bottom start" transition className={`${panelClass} w-[var(--input-width)]`}>
            {list.length === 0 ? <div className="px-4 py-3 text-sm text-slate-500">No items match.</div> : list.map((it) => (
              <ComboboxOption key={it.id} value={it} className={optionClass}>
                <span className="min-w-0"><span className="block truncate">{it.name}</span><span className="block truncate font-mono text-[12px] text-slate-400">{it.sku}</span></span>
                {available && <span className={`shrink-0 text-[13px] tabular-nums ${available(it.id) > 0 ? "text-slate-500" : "text-[#be123c]"}`}>{qtyFmt(available(it.id))} here</span>}
              </ComboboxOption>
            ))}
          </ComboboxOptions>
        </Combobox>
      </div>
      <button type="button" onClick={() => setScan(true)} aria-label="Scan barcode" title="Scan barcode"
        className="flex h-[46px] w-12 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#0f766e] transition-colors hover:border-[#14a39a] hover:bg-[#e9f7f4]">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 8v8M10 8v8M13 8v8M16.5 8v8" /></svg>
      </button>
      <BarcodeScanner open={scan} everywhere onClose={() => setScan(false)} onCode={scanned} />
    </div>
  );
}
