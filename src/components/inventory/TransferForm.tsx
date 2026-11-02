"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SelectMenu from "@/components/ui/SelectMenu";
import { inputClass } from "@/components/customers/ui";
import { FormHeader, FormRow, SaveBar, SectionTitle } from "@/components/catalog/FormBits";
import ItemPicker from "@/components/inventory/ItemPicker";
import { InvItem, InvLocation, InvStock, invError, pingAlerts, qtyFmt } from "@/lib/inventory";

type Line = { item: InvItem; qty: string };

// Nueva transferencia (resurtir una van): pantalla completa. Varios productos de una vez, todo o nada.
export default function TransferForm({ companyId, items, stock, locations, initialTo, initialFrom, barcodes = {} }: {
  barcodes?: Record<string, string>; companyId: string; items: InvItem[]; stock: InvStock[]; locations: InvLocation[]; initialTo?: string; initialFrom?: string;
}) {
  const router = useRouter();
  const def = locations.find((l) => l.is_default) ?? locations[0];
  const [from, setFrom] = useState(initialFrom && locations.some((l) => l.id === initialFrom) ? initialFrom : def?.id ?? "");
  const [to, setTo] = useState(initialTo && locations.some((l) => l.id === initialTo) ? initialTo : locations.find((l) => l.id !== (initialFrom ?? def?.id))?.id ?? "");
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const at = (item: string, loc: string) => Number(stock.find((s) => s.item_id === item && s.location_id === loc)?.qty ?? 0);
  const minAt = (item: string, loc: string) => Number(stock.find((s) => s.item_id === item && s.location_id === loc)?.min_qty ?? 0);
  const opts = locations.map((l) => ({ value: l.id, label: `${l.name}${l.kind === "van" ? " (van)" : ""}` }));
  const withStock = useMemo(() => items.filter((i) => at(i.id, from) > 0), [items, from, stock]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sugerencia: lo que le falta al destino para llegar a su mínimo (+ lo mismo otra vez como colchón)
  const suggested = useMemo(() => to ? items.filter((i) => minAt(i.id, to) > 0 && at(i.id, to) <= minAt(i.id, to) && at(i.id, from) > 0) : [], [items, to, from, stock]); // eslint-disable-line react-hooks/exhaustive-deps

  function add(it: InvItem, qty = 1) {
    setError("");
    setLines((l) => l.some((x) => x.item.id === it.id) ? l : [...l, { item: it, qty: String(Math.min(qty, Math.max(at(it.id, from), 1))) }]);
  }
  const addSuggested = () => suggested.forEach((i) => add(i, Math.max(1, minAt(i.id, to) * 2 - at(i.id, to))));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!from || !to || from === to) return setError("Choose two different locations.");
    if (!lines.length) return setError("Add at least one item.");
    for (const l of lines) {
      const n = Number(l.qty);
      if (!n || n <= 0) return setError(`Enter a quantity for ${l.item.name}.`);
      if (n > at(l.item.id, from)) return setError(`Only ${qtyFmt(at(l.item.id, from))} ${l.item.name} in the source location.`);
    }
    setSaving(true); setError("");
    const { error: err } = await createClient().rpc("inv_transfer_batch", {
      p_company: companyId, p_from: from, p_to: to, p_note: note.trim() || null, p_lines: lines.map((l) => ({ item: l.item.id, qty: Number(l.qty) })),
    });
    if (err) { setSaving(false); return setError(invError(err)); }
    pingAlerts();
    router.push(`/dashboard/inventory/transfers?done=${lines.length}`); router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate autoComplete="off" className="flex min-h-[calc(100vh-4rem)] flex-col bg-white">
      <FormHeader title="New Transfer" closeHref="/dashboard/inventory/transfers" />
      <div className="flex-1">
        <div className="space-y-5 border-b border-slate-200 bg-[#fafbfc] px-5 py-6 sm:px-8">
          <FormRow label="From" required width="max-w-[360px]" hint="Where the parts come out of (usually the warehouse).">
            <SelectMenu ariaLabel="From" value={from} onChange={(v) => { setFrom(v); setLines([]); }} options={opts} />
          </FormRow>
          <FormRow label="To" required width="max-w-[360px]" hint="Where the parts go (for example a technician's van).">
            <SelectMenu ariaLabel="To" value={to} onChange={setTo} options={opts.filter((o) => o.value !== from)} />
          </FormRow>
        </div>
        <div className="px-5 py-7 sm:px-8">
          <SectionTitle>Items</SectionTitle>
          <div className="max-w-[820px] space-y-4">
            {suggested.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#fcdca4] bg-[#fffaf0] px-4 py-3">
                <p className="text-[14px] text-[#7a3d06]"><b>{suggested.length}</b> item{suggested.length === 1 ? " is" : "s are"} at or below the alert in the destination.</p>
                <button type="button" onClick={addSuggested} className="rounded-lg bg-[#d97706] px-3 py-1.5 text-[13.5px] font-semibold text-white hover:bg-[#b45309]">Add suggested</button>
              </div>
            )}
            <ItemPicker barcodes={barcodes} items={withStock} onPick={(it) => add(it)} available={(id) => at(id, from)}
              onNotFound={(code) => setError(`No stock with code ${code} in the source location.`)} />
            {lines.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">Search, scan or use the suggestions to add parts.</p>
            ) : (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                {lines.map((l, i) => (
                  <li key={l.item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-[#0b1f3a]">{l.item.name}</span>
                      <span className="block text-[12.5px] text-slate-500">Available: {qtyFmt(at(l.item.id, from))} · Destination has {qtyFmt(at(l.item.id, to))}</span>
                    </span>
                    <input value={l.qty} inputMode="decimal" aria-label="Quantity" onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, qty: e.target.value.replace(/[^0-9.]/g, "") } : x))}
                      className="h-10 w-24 rounded-lg border border-slate-200 bg-slate-50 text-center text-[15px] font-semibold tabular-nums focus:border-[#0f766e] focus:bg-white focus:outline-none" />
                    <span className="w-10 text-[13px] text-slate-500">{l.item.unit ?? ""}</span>
                    <button type="button" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} aria-label="Remove"
                      className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600">
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <FormRow label="Note" htmlFor="tr-note" alignTop width="max-w-[460px]">
              <textarea id="tr-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" className={inputClass} />
            </FormRow>
          </div>
        </div>
      </div>
      <SaveBar saving={saving} cancelHref="/dashboard/inventory/transfers" error={error} />
    </form>
  );
}
