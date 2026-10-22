"use client";

import { useMemo, useState } from "react";
import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions, Listbox, ListboxButton, ListboxOption, ListboxOptions, Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { DiscType, INCOME_ACCOUNTS, SalesLine, lineAmount, money, num2 } from "@/lib/sales";
import type { ItemOption } from "@/lib/sales-server";
import { NoImage } from "@/components/catalog/DetailBits";
import { Modal, btnGhost, btnPrimary } from "@/components/sales/SalesBits";
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
          <ComboboxOption key={it.id} value={it} className="flex cursor-pointer items-center gap-3 px-3 py-2 data-[focus]:bg-[#e9f7f4] group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {it.image_url ? <img src={it.image_url} alt="" className="h-9 w-9 shrink-0 rounded-md border border-slate-200 object-cover" /> : <NoImage />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium">{it.name}</span>
              <span className="block truncate text-xs text-slate-500 ">{[it.sku && `SKU: ${it.sku}`, it.item_type === "goods" ? "Goods" : "Service"].filter(Boolean).join(" · ")}</span>
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
  const [bulkAt, setBulkAt] = useState<number | null>(null);
  const set = (i: number, patch: Partial<SalesLine>) => setLines((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const pick = (i: number, it: ItemOption) => set(i, {
    item_id: it.id, name: it.name, description: it.description ?? "", rate: Number(it.selling_price), unit: it.unit, image_url: it.image_url,
  });
  function drop(at: number) {
    if (drag === null || drag === at) { setDrag(null); setOver(null); return; }
    setLines((l) => { const n = [...l]; const [m] = n.splice(drag, 1); n.splice(at, 0, m); return n; });
    setDrag(null); setOver(null);
  }

  const [sheet, setSheet] = useState<number | "new" | null>(null);
  const insertAt = (i: number, rows: SalesLine[]) => setLines((x) => { const n = [...x]; n.splice(i + 1, 0, ...rows); return n; });
  const td = "border-b border-slate-200 bg-white";
  return (
    <div>
      {/* Celular: lista compacta como Zoho; "Add Line Item" abre una hoja completa */}
      <div className="sm:hidden">
        {lines.some((l) => l.name.trim()) && (
          <div className="mb-2 flex justify-between border-b border-slate-200 pb-2 text-[13px] font-medium text-slate-500"><span>Items</span><span>Amount</span></div>
        )}
        <ul className="divide-y divide-slate-100">
          {lines.map((l, i) => l.name.trim() ? (
            <li key={i} className="flex items-start gap-3 py-3">
              <button type="button" aria-label="Remove item" onClick={() => setLines((x) => (x.length === 1 ? [blankLine()] : x.filter((_, j) => j !== i)))}
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-red-300 text-red-500 active:bg-red-50">
                <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="m6.5 6.5 7 7M13.5 6.5l-7 7" strokeLinecap="round" /></svg>
              </button>
              <button type="button" onClick={() => setSheet(i)} className="min-w-0 flex-1 text-left">
                <span className="block text-[15px] font-medium text-[#0b1f3a]">{l.name}</span>
                <span className="text-[13px] text-slate-500 tabular-nums">{num2(l.quantity)} × {num2(l.rate)}{Number(l.discount) ? ` · ${l.discount_type === "percent" ? `${+l.discount}%` : money(l.discount)} off` : ""}</span>
              </button>
              <span className="shrink-0 text-[15px] font-semibold tabular-nums text-[#0b1f3a]">{num2(lineAmount(l))}</span>
            </li>
          ) : null)}
        </ul>
        {lines.some((l) => l.name.trim()) ? (
          <button type="button" onClick={() => setSheet("new")} className="mt-1 flex items-center gap-2 py-2 text-[15px] font-semibold text-[#0f766e] active:opacity-70">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0f766e] text-white"><svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M10 5v10M5 10h10" /></svg></span>Add Line Item
          </button>
        ) : (
          <button type="button" onClick={() => setSheet("new")}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#0f766e] bg-white py-3.5 text-[16px] font-semibold text-[#0f766e] transition-transform active:scale-[0.98]">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0f766e] text-white"><svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M10 5v10M5 10h10" /></svg></span>
            Add Line Item
          </button>
        )}
        <LineSheet open={sheet !== null} line={typeof sheet === "number" ? lines[sheet] : null} items={items} showDiscount={showDiscount} priceLabel={priceLabel}
          onClose={() => setSheet(null)}
          onSave={(ln, again) => {
            setLines((x) => {
              const clean = x.filter((r) => r.name.trim());
              if (typeof sheet === "number") return x.map((r, j) => (j === sheet ? ln : r));
              return [...clean, { ...ln, position: clean.length }];
            });
            if (again) setSheet("new"); else setSheet(null);
          }} />
      </div>

      {/* Computadora: la tabla lleva su caja; los botones ⋯ y X quedan AFUERA, a la derecha (como Zoho) */}
      <div className="hidden overflow-x-auto pb-1 sm:block">
        <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr><th colSpan={showDiscount ? 6 : 5} className="rounded-t-xl border border-slate-200 bg-[#fafbfc] px-4 py-3 text-left text-[15px] font-semibold text-[#0b1f3a]">Item Table</th><th className="w-[72px]" /></tr>
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="w-8 border-b border-l border-slate-200 bg-white" /><th className="border-b border-slate-200 bg-white px-3 py-2.5">Item Details</th>
              <th className="w-28 border-b border-slate-200 bg-white px-3 py-2.5 text-right">Quantity</th>
              <th className="w-32 border-b border-slate-200 bg-white px-3 py-2.5 text-right">{priceLabel}</th>
              {showDiscount && <th className="w-36 border-b border-slate-200 bg-white px-3 py-2.5 text-right">Discount</th>}
              <th className="w-32 border-b border-r border-slate-200 bg-white px-3 py-2.5 text-right">Amount</th><th />
            </tr>
          </thead>
          <tbody className="[&>tr:last-child>td:first-child]:rounded-bl-xl [&>tr:last-child>td:nth-last-child(2)]:rounded-br-xl">
            {lines.map((l, i) => (
              <tr key={i} onDragOver={(e) => { e.preventDefault(); setOver(i); }} onDrop={() => drop(i)}
                className={`group/r align-top transition-colors ${over === i && drag !== null ? "[&>td.cellbg]:bg-[#e9f7f4]" : ""} ${drag === i ? "opacity-50" : ""}`}>
                <td className={`cellbg ${td} border-l pl-2 pt-3`}>
                  <span draggable onDragStart={() => setDrag(i)} onDragEnd={() => { setDrag(null); setOver(null); }} title="Drag to reorder"
                    className="flex h-7 w-5 cursor-grab items-center justify-center text-slate-300 hover:text-slate-500 active:cursor-grabbing">
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor"><circle cx="7" cy="5" r="1.4" /><circle cx="13" cy="5" r="1.4" /><circle cx="7" cy="10" r="1.4" /><circle cx="13" cy="10" r="1.4" /><circle cx="7" cy="15" r="1.4" /><circle cx="13" cy="15" r="1.4" /></svg>
                  </span>
                </td>
                <td className={`cellbg ${td} px-2 py-2`}>
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
                <td className={`cellbg ${td} px-2 py-2`}><input inputMode="decimal" value={String(l.quantity)} onChange={(e) => set(i, { quantity: e.target.value.replace(/[^0-9.]/g, "") as unknown as number })} className={cell} />
                  {l.unit && <span className="block pr-2 text-right text-[11px] text-slate-400">{l.unit}</span>}</td>
                <td className={`cellbg ${td} px-2 py-2`}><input inputMode="decimal" value={String(l.rate)} onFocus={(e) => e.currentTarget.select()} onChange={(e) => set(i, { rate: e.target.value.replace(/[^0-9.]/g, "") as unknown as number })} className={cell} /></td>
                {showDiscount && (
                  <td className={`cellbg ${td} px-2 py-2`}>
                    <div className="flex items-center gap-1">
                      <input inputMode="decimal" value={String(l.discount)} onFocus={(e) => e.currentTarget.select()} onChange={(e) => set(i, { discount: e.target.value.replace(/[^0-9.]/g, "") as unknown as number })} className={cell} />
                      <DiscUnit value={l.discount_type} onChange={(v) => set(i, { discount_type: v })} />
                    </div>
                  </td>
                )}
                <td className={`cellbg ${td} border-r px-3 py-3 text-right font-semibold tabular-nums text-[#0b1f3a]`}>{num2(lineAmount(l))}</td>
                <td className="py-2.5 pl-2">
                  <div className="flex items-center gap-1.5">
                    <Menu>
                      <MenuButton aria-label="Row options" title="Row options"
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-[#93c5fd] text-[#2563eb] transition-colors hover:bg-[#2563eb] hover:text-white data-[open]:bg-[#2563eb] data-[open]:text-white focus:outline-none">
                        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor"><circle cx="5" cy="10" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="15" cy="10" r="1.5" /></svg>
                      </MenuButton>
                      <MenuItems anchor="bottom end" transition className="z-[100] mt-1 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_40px_rgba(15,40,60,0.16)] transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0 focus:outline-none">
                        {([["Clone", () => insertAt(i, [{ ...l, id: undefined }])], ["Insert New Row", () => insertAt(i, [blankLine()])], ["Insert Items in Bulk", () => { setBulkAt(i); setBulk(true); }]] as [string, () => void][]).map(([label, fn]) => (
                          <MenuItem key={label}><button type="button" onClick={fn} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 data-[focus]:bg-[#e9f7f4] data-[focus]:text-[#0b1f3a]">{label}</button></MenuItem>
                        ))}
                      </MenuItems>
                    </Menu>
                    <button type="button" title="Remove row" aria-label="Remove row" onClick={() => setLines((x) => (x.length === 1 ? [blankLine()] : x.filter((_, j) => j !== i)))}
                      className="group/x flex h-6 w-6 items-center justify-center rounded-full text-red-400 hover:bg-red-50 hover:text-red-600">
                      <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform duration-300 group-hover/x:rotate-90" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m6.5 6.5 7 7M13.5 6.5l-7 7" strokeLinecap="round" /></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 hidden flex-wrap gap-2 sm:flex">
        <button type="button" onClick={() => setLines((l) => [...l, blankLine(l.length)])} className="flex items-center gap-1.5 rounded-lg bg-[#eef6ff] px-3 py-2 text-sm font-medium text-[#0b1f3a] hover:bg-[#e0edff]">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#2563eb] text-white"><svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M10 5v10M5 10h10" /></svg></span>Add New Row
        </button>
        <button type="button" onClick={() => { setBulkAt(null); setBulk(true); }} className="flex items-center gap-1.5 rounded-lg bg-[#eef6ff] px-3 py-2 text-sm font-medium text-[#0b1f3a] hover:bg-[#e0edff]">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#2563eb] text-white"><svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M10 5v10M5 10h10" /></svg></span>Add Items in Bulk
        </button>
      </div>
      <BulkItems open={bulk} onClose={() => setBulk(false)} items={items}
        onAdd={(picked) => {
          const rows = picked.map(({ it, qty }, k) => ({ ...blankLine(k), item_id: it.id, name: it.name, description: it.description ?? "", rate: Number(it.selling_price), unit: it.unit, image_url: it.image_url, quantity: qty }));
          if (bulkAt !== null) insertAt(bulkAt, rows);
          else setLines((l) => [...l.filter((x) => x.name.trim() || x.item_id), ...rows]);
        }} />
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

// Hoja completa (celular) para agregar o editar un artículo: elegir del catálogo con buscador,
// descripción, cuenta, cantidad, precio y descuento (% o $). "Save and New" sigue agregando sin salir.
function LineSheet({ open, line, items, showDiscount, priceLabel, onClose, onSave }: {
  open: boolean; line: SalesLine | null; items: ItemOption[]; showDiscount: boolean; priceLabel: string;
  onClose: () => void; onSave: (l: SalesLine, again: boolean) => void;
}) {
  const [d, setD] = useState<SalesLine>(blankLine());
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [key, setKey] = useState("");
  const k = `${open}-${line ? "edit" : "new"}-${line?.name ?? ""}`;
  if (open && key !== k) { setKey(k); setD(line ? { ...line } : blankLine()); setPicking(!line); setQ(""); setErr(""); }
  if (!open && key) setKey("");
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (t ? items.filter((i) => `${i.name} ${i.sku ?? ""} ${i.description ?? ""}`.toLowerCase().includes(t)) : items).slice(0, 100);
  }, [items, q]);
  if (!open) return null;
  const set = (p: Partial<SalesLine>) => setD((x) => ({ ...x, ...p }));
  const save = (again: boolean) => {
    if (!d.name.trim()) return setErr("Choose an item or type a name.");
    if (!(Number(d.quantity) > 0)) return setErr("Enter the quantity.");
    onSave({ ...d, quantity: Number(d.quantity) || 1, rate: Number(d.rate) || 0, discount: Number(d.discount) || 0, account: d.account ?? "Sales" }, again);
    setD(blankLine()); setPicking(again); setQ(""); setErr("");
  };
  const lbl = "mb-1 block text-[13px] font-medium text-slate-500";
  const inp = "w-full border-0 border-b border-slate-200 bg-transparent px-0 py-2 text-[17px] text-[#0b1f3a] placeholder:text-slate-300 focus:border-[#0f766e] focus:outline-none focus:ring-0";
  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-[#f4f6f8] animate-[bp-sheet_0.28s_cubic-bezier(.2,.8,.2,1)] sm:hidden">
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={picking && d.name ? () => setPicking(false) : onClose} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-full active:bg-slate-100">
          <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#0b1f3a]" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M11 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <p className="text-[18px] font-semibold text-[#0b1f3a]">{picking ? "Select an Item" : line ? "Edit Line Item" : "Add Line Item"}</p>
      </div>
      {picking ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="bg-white px-4 pb-3 pt-2">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-[#0f766e] focus-within:bg-white">
              <svg viewBox="0 0 20 20" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg>
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items or type a new one" className="w-full bg-transparent py-3 text-[16px] focus:outline-none" />
            </div>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto bg-white">
            {q.trim() && (
              <li><button type="button" onClick={() => { set({ ...blankLine(), name: q.trim(), quantity: d.quantity || 1 }); setPicking(false); }} className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left active:bg-[#e9f7f4]">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#eef8f5] text-[#0f766e]"><svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 5v10M5 10h10" /></svg></span>
                <span className="text-[15px] text-[#0b1f3a]">Add &quot;{q.trim()}&quot; as a custom line</span>
              </button></li>
            )}
            {list.map((it) => (
              <li key={it.id}><button type="button" onClick={() => {
                set({ item_id: it.id, name: it.name, description: it.description ?? "", rate: Number(it.selling_price), unit: it.unit, image_url: it.image_url });
                setPicking(false); setErr("");
              }} className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left active:bg-[#e9f7f4]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {it.image_url ? <img src={it.image_url} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 object-cover" /> : <NoImage />}
                <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-medium text-[#0b1f3a]">{it.name}</span><span className="block truncate text-[12px] text-slate-500">{[it.sku && `SKU: ${it.sku}`, it.item_type === "goods" ? "Goods" : "Service"].filter(Boolean).join(" · ")}</span></span>
                <span className="shrink-0 text-[14px] font-semibold tabular-nums text-[#0b1f3a]">{money(it.selling_price)}</span>
              </button></li>
            ))}
            {list.length === 0 && !q.trim() && <li className="px-4 py-10 text-center text-sm text-slate-500">Your catalog is empty. Type a name above to add a custom line.</li>}
          </ul>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="space-y-5 rounded-2xl bg-white p-4 shadow-[0_1px_4px_rgba(15,40,60,0.06)]">
              <div>
                <span className={lbl}>Item</span>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setPicking(true)} className="min-w-0 flex-1 border-b border-slate-200 py-2 text-left text-[17px] text-[#0b1f3a]">{d.name || <span className="text-slate-300">Select an item</span>}</button>
                  {d.name && <button type="button" aria-label="Clear item" onClick={() => { setD(blankLine()); setPicking(true); }} className="text-slate-400"><svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg></button>}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {d.image_url && <img src={d.image_url} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />}
                </div>
              </div>
              <label className="block"><span className={lbl}>Description</span>
                <textarea rows={3} value={d.description ?? ""} onChange={(e) => set({ description: e.target.value })} placeholder="Add a description" className={`${inp} resize-none`} /></label>
              <label className="block"><span className={lbl}>Account</span>
                <select value={d.account ?? "Sales"} onChange={(e) => set({ account: e.target.value })} className={`${inp} appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22><path fill=%22%2394a3b8%22 d=%22M5 7l5 6 5-6z%22/></svg>')] bg-[length:16px] bg-[right_4px_center] bg-no-repeat`}>
                  {INCOME_ACCOUNTS.map((a) => <option key={a}>{a}</option>)}
                </select></label>
              <label className="block"><span className={lbl}>Quantity <span className="text-red-500">*</span></span>
                <input inputMode="decimal" value={String(d.quantity)} onFocus={(e) => e.currentTarget.select()} onChange={(e) => set({ quantity: e.target.value.replace(/[^0-9.]/g, "") as unknown as number })} className={inp} /></label>
              <label className="block"><span className={lbl}>{priceLabel} <span className="text-red-500">*</span></span>
                <input inputMode="decimal" value={String(d.rate)} onFocus={(e) => e.currentTarget.select()} onChange={(e) => set({ rate: e.target.value.replace(/[^0-9.]/g, "") as unknown as number })} className={inp} /></label>
              {showDiscount && (
                <div className="grid grid-cols-2 gap-4">
                  <label className="block"><span className={lbl}>Discount</span>
                    <input inputMode="decimal" value={String(d.discount)} onFocus={(e) => e.currentTarget.select()} onChange={(e) => set({ discount: e.target.value.replace(/[^0-9.]/g, "") as unknown as number })} className={inp} /></label>
                  <div><span className={lbl}>Discount type</span>
                    <div className="flex gap-5 pt-2.5">
                      {(["percent", "flat"] as DiscType[]).map((t) => (
                        <label key={t} className="flex items-center gap-2 text-[17px] text-[#0b1f3a]">
                          <input type="radio" checked={d.discount_type === t} onChange={() => set({ discount_type: t })} className="h-5 w-5 accent-[#0f766e]" />{t === "percent" ? "%" : "$"}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between rounded-xl bg-[#f6fbfa] px-3 py-2.5"><span className="text-[14px] text-slate-500">Amount</span><span className="text-[18px] font-bold tabular-nums text-[#0b1f3a]">{num2(lineAmount(d))}</span></div>
              {err && <p className="text-sm text-red-600">{err}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-slate-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button type="button" onClick={() => save(true)} className="rounded-xl border-2 border-[#0f766e] py-3 text-[16px] font-semibold text-[#0f766e] active:scale-[0.98]">{line ? "Save & Add New" : "Save and New"}</button>
            <button type="button" onClick={() => save(false)} className="rounded-xl bg-[#0f766e] py-3 text-[16px] font-semibold text-white active:scale-[0.98]">Save</button>
          </div>
        </>
      )}
    </div>
  );
}
