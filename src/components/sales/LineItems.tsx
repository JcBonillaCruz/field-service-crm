"use client";

import { useMemo, useState } from "react";
import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions, Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react";
import { DiscType, SalesLine, lineAmount, money, num2 } from "@/lib/sales";
import type { ItemOption } from "@/lib/sales-server";
import { NoImage } from "@/components/catalog/DetailBits";
import { Modal, btnGhost, btnPrimary, I, Ico } from "@/components/sales/SalesBits";
import { panelClass } from "@/components/ui/SearchSelect";

export const blankLine = (position = 0): SalesLine => ({
  position, item_id: null, name: "", description: "", quantity: 1, unit: null, rate: 0, discount: 0, discount_type: "percent", amount: 0, image_url: null,
});
const cell = "w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-right text-[15px] tabular-nums hover:border-slate-200 focus:border-[#0f766e] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15";

function ItemPicker({ line, items, onPick, onText }: { line: SalesLine; items: ItemOption[]; onPick: (it: ItemOption) => void; onText: (t: string) => void }) {
  const [query, setQuery] = useState("");
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (q ? items.filter((i) => `${i.name} ${i.sku ?? ""} ${i.description ?? ""}`.toLowerCase().includes(q)) : items).slice(0, 60);
  }, [items, query]);
  return (
    <Combobox immediate value={null as ItemOption | null} onChange={(it: ItemOption | null) => { if (it) onPick(it); setQuery(""); }} onClose={() => setQuery("")}>
      <ComboboxInput autoComplete="off" placeholder="Type or click to select an item." value={line.name}
        onChange={(e) => { setQuery(e.target.value); onText(e.target.value); }}
        className="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-[15px] text-[#0b1f3a] placeholder:text-slate-400 hover:border-slate-200 focus:border-[#0f766e] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15" />
      <ComboboxOptions anchor="bottom start" transition className={`${panelClass} w-[min(30rem,calc(100vw-2rem))] !max-h-80`}>
        {list.length === 0 ? (
          <div className="px-4 py-3 text-sm text-slate-500">{items.length ? "No items match. Keep typing to add it as a custom line." : "Your catalog is empty. Type a name to add a custom line."}</div>
        ) : list.map((it) => (
          <ComboboxOption key={it.id} value={it} className="flex cursor-pointer items-center gap-3 px-3 py-2 data-[focus]:bg-[#0f766e] data-[focus]:text-white group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {it.image_url ? <img src={it.image_url} alt="" className="h-9 w-9 shrink-0 rounded-md border border-slate-200 object-cover" /> : <NoImage />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium">{it.name}</span>
              <span className="block truncate text-xs text-slate-500 group-data-[focus]:text-white/80">{[it.sku && `SKU: ${it.sku}`, it.item_type === "goods" ? "Goods" : "Service"].filter(Boolean).join(" · ")}</span>
            </span>
            <span className="shrink-0 text-sm tabular-nums">{money(it.selling_price)}</span>
          </ComboboxOption>
        ))}
      </ComboboxOptions>
    </Combobox>
  );
}

function DiscUnit({ value, onChange }: { value: DiscType; onChange: (v: DiscType) => void }) {
  return (
    <Listbox value={value} onChange={onChange}>
      <ListboxButton className="flex h-8 items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 px-1.5 text-xs text-slate-600 hover:border-[#14a39a] focus:outline-none data-[open]:border-[#0f766e]">
        {value === "percent" ? "%" : "$"}<svg viewBox="0 0 20 20" className="h-3 w-3" fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
      </ListboxButton>
      <ListboxOptions anchor="bottom end" transition className={`${panelClass} w-24`}>
        <ListboxOption value="percent" className="cursor-pointer px-3 py-1.5 text-sm data-[focus]:bg-[#f0faf7] data-[selected]:font-semibold data-[selected]:text-[#0f766e]">%</ListboxOption>
        <ListboxOption value="flat" className="cursor-pointer px-3 py-1.5 text-sm data-[focus]:bg-[#f0faf7] data-[selected]:font-semibold data-[selected]:text-[#0f766e]">$</ListboxOption>
      </ListboxOptions>
    </Listbox>
  );
}

export default function LineItems({ lines, setLines, items, showDiscount = true, priceLabel = "Rate" }: {
  lines: SalesLine[]; setLines: (fn: (l: SalesLine[]) => SalesLine[]) => void; items: ItemOption[]; showDiscount?: boolean; priceLabel?: string;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [bulk, setBulk] = useState(false);
  const set = (i: number, patch: Partial<SalesLine>) => setLines((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const pick = (i: number, it: ItemOption) => set(i, {
    item_id: it.id, name: it.name, description: it.description ?? "", rate: Number(it.selling_price), unit: it.unit, image_url: it.image_url,
  });
  function drop(at: number) {
    if (drag === null || drag === at) { setDrag(null); setOver(null); return; }
    setLines((l) => { const n = [...l]; const [m] = n.splice(drag, 1); n.splice(at, 0, m); return n; });
    setDrag(null); setOver(null);
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#fafbfc] px-4 py-3">
          <p className="font-semibold text-[#0b1f3a]">Item Table</p>
        </div>
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="w-8" /><th className="px-3 py-2.5">Item Details</th><th className="w-28 px-3 py-2.5 text-right">Quantity</th>
              <th className="w-32 px-3 py-2.5 text-right">{priceLabel}</th>{showDiscount && <th className="w-36 px-3 py-2.5 text-right">Discount</th>}
              <th className="w-32 px-3 py-2.5 text-right">Amount</th><th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} onDragOver={(e) => { e.preventDefault(); setOver(i); }} onDrop={() => drop(i)}
                className={`group/r border-b border-slate-100 align-top transition-colors ${over === i && drag !== null ? "bg-[#e9f7f4]" : ""} ${drag === i ? "opacity-50" : ""}`}>
                <td className="pl-2 pt-3">
                  <span draggable onDragStart={() => setDrag(i)} onDragEnd={() => { setDrag(null); setOver(null); }} title="Drag to reorder"
                    className="flex h-7 w-5 cursor-grab items-center justify-center text-slate-300 hover:text-slate-500 active:cursor-grabbing">
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor"><circle cx="7" cy="5" r="1.4" /><circle cx="13" cy="5" r="1.4" /><circle cx="7" cy="10" r="1.4" /><circle cx="13" cy="10" r="1.4" /><circle cx="7" cy="15" r="1.4" /><circle cx="13" cy="15" r="1.4" /></svg>
                  </span>
                </td>
                <td className="px-2 py-2">
                  <div className="flex gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {l.image_url ? <img src={l.image_url} alt="" className="mt-0.5 h-9 w-9 shrink-0 rounded-md border border-slate-200 object-cover" /> : <span className="mt-0.5"><NoImage /></span>}
                    <div className="min-w-0 flex-1">
                      <ItemPicker line={l} items={items} onPick={(it) => pick(i, it)} onText={(t) => set(i, { name: t, item_id: null })} />
                      {(l.name || l.description) && (
                        <textarea rows={Math.min(6, Math.max(1, (l.description ?? "").split("\n").length))} value={l.description ?? ""} onChange={(e) => set(i, { description: e.target.value })}
                          placeholder="Add a description" className="mt-1 w-full resize-y rounded-md border border-transparent bg-transparent px-2 py-1 text-[13px] text-slate-600 placeholder:text-slate-300 hover:border-slate-200 focus:border-[#0f766e] focus:bg-white focus:outline-none" />
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-2 py-2"><input inputMode="decimal" value={String(l.quantity)} onChange={(e) => set(i, { quantity: e.target.value.replace(/[^0-9.]/g, "") as unknown as number })} className={cell} />
                  {l.unit && <span className="block pr-2 text-right text-[11px] text-slate-400">{l.unit}</span>}</td>
                <td className="px-2 py-2"><input inputMode="decimal" value={String(l.rate)} onFocus={(e) => e.currentTarget.select()} onChange={(e) => set(i, { rate: e.target.value.replace(/[^0-9.]/g, "") as unknown as number })} className={cell} /></td>
                {showDiscount && (
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1">
                      <input inputMode="decimal" value={String(l.discount)} onFocus={(e) => e.currentTarget.select()} onChange={(e) => set(i, { discount: e.target.value.replace(/[^0-9.]/g, "") as unknown as number })} className={cell} />
                      <DiscUnit value={l.discount_type} onChange={(v) => set(i, { discount_type: v })} />
                    </div>
                  </td>
                )}
                <td className="px-3 py-3 text-right font-semibold tabular-nums text-[#0b1f3a]">{num2(lineAmount(l))}</td>
                <td className="py-2 pr-2">
                  <div className="flex flex-col items-center gap-1 opacity-60 transition-opacity group-hover/r:opacity-100">
                    <button type="button" title="Clone row" aria-label="Clone row" onClick={() => setLines((x) => { const n = [...x]; n.splice(i + 1, 0, { ...l, id: undefined }); return n; })}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-[#e9f7f4] hover:text-[#0f766e]"><Ico d={I.clone} className="h-3.5 w-3.5" /></button>
                    <button type="button" title="Remove row" aria-label="Remove row" onClick={() => setLines((x) => (x.length === 1 ? [blankLine()] : x.filter((_, j) => j !== i)))}
                      className="group/x flex h-7 w-7 items-center justify-center rounded-full text-red-400 hover:bg-red-50 hover:text-red-600">
                      <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform duration-300 group-hover/x:rotate-90" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10" cy="10" r="7.5" /><path d="m7.5 7.5 5 5M12.5 7.5l-5 5" strokeLinecap="round" /></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => setLines((l) => [...l, blankLine(l.length)])} className="flex items-center gap-1.5 rounded-lg bg-[#eef6ff] px-3 py-2 text-sm font-medium text-[#0b1f3a] hover:bg-[#e0edff]">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#2563eb] text-white"><svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M10 5v10M5 10h10" /></svg></span>Add New Row
        </button>
        <button type="button" onClick={() => setBulk(true)} className="flex items-center gap-1.5 rounded-lg bg-[#eef6ff] px-3 py-2 text-sm font-medium text-[#0b1f3a] hover:bg-[#e0edff]">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#2563eb] text-white"><svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M10 5v10M5 10h10" /></svg></span>Add Items in Bulk
        </button>
      </div>
      <BulkItems open={bulk} onClose={() => setBulk(false)} items={items}
        onAdd={(picked) => setLines((l) => {
          const keep = l.filter((x) => x.name.trim() || x.item_id);
          return [...keep, ...picked.map(({ it, qty }, k) => ({ ...blankLine(keep.length + k), item_id: it.id, name: it.name, description: it.description ?? "", rate: Number(it.selling_price), unit: it.unit, image_url: it.image_url, quantity: qty }))];
        })} />
    </div>
  );
}

function BulkItems({ open, onClose, items, onAdd }: { open: boolean; onClose: () => void; items: ItemOption[]; onAdd: (p: { it: ItemOption; qty: number }[]) => void }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Record<string, number>>({});
  const list = items.filter((i) => `${i.name} ${i.sku ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()));
  const count = Object.keys(sel).length;
  return (
    <Modal open={open} onClose={() => { setSel({}); onClose(); }} title="Add Items in Bulk" width="max-w-3xl"
      footer={<>
        <button type="button" disabled={!count} onClick={() => { onAdd(items.filter((i) => sel[i.id]).map((it) => ({ it, qty: sel[it.id] }))); setSel({}); onClose(); }} className={btnPrimary}>Add Items{count ? ` (${count})` : ""}</button>
        <button type="button" onClick={() => { setSel({}); onClose(); }} className={btnGhost}>Cancel</button>
      </>}>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type to search or scan the barcode of the item"
        className="mb-3 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-[15px] focus:border-[#0f766e] focus:bg-white focus:outline-none" />
      <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-slate-200">
        {list.length === 0 ? <p className="px-4 py-8 text-center text-sm text-slate-500">No items found.</p> : list.map((it) => {
          const on = sel[it.id] != null;
          return (
            <div key={it.id} className={`flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0 ${on ? "bg-[#f0faf7]" : "hover:bg-slate-50"}`}>
              <input type="checkbox" checked={on} onChange={() => setSel((s) => { const n = { ...s }; if (on) delete n[it.id]; else n[it.id] = 1; return n; })} className="h-4 w-4 accent-[#0f766e]" />
              <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-medium text-[#0b1f3a]">{it.name}</span><span className="block text-xs text-slate-500">{it.sku ? `SKU: ${it.sku} · ` : ""}{money(it.selling_price)}</span></span>
              {on && (
                <span className="flex items-center gap-1">
                  <button type="button" onClick={() => setSel((s) => ({ ...s, [it.id]: Math.max(1, s[it.id] - 1) }))} className="h-7 w-7 rounded-md border border-slate-200 bg-white text-slate-600">−</button>
                  <span className="w-8 text-center tabular-nums">{sel[it.id]}</span>
                  <button type="button" onClick={() => setSel((s) => ({ ...s, [it.id]: s[it.id] + 1 }))} className="h-7 w-7 rounded-md border border-slate-200 bg-white text-slate-600">+</button>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
