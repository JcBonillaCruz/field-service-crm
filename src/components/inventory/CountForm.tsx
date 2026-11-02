"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SelectMenu from "@/components/ui/SelectMenu";
import { inputClass } from "@/components/customers/ui";
import { FormHeader, FormRow, SaveBar, SectionTitle } from "@/components/catalog/FormBits";
import ItemPicker from "@/components/inventory/ItemPicker";
import { InvItem, InvLocation, InvStock, invError, pingAlerts, qtyFmt, usd } from "@/lib/inventory";

type Result = { items: number; missing: number; extra: number; missing_cost: number };

// Conteo físico: cuentas lo que de verdad hay. La diferencia queda firmada y, si es una van, a nombre de su técnico.
export default function CountForm({ companyId, items, stock, locations, initialLocation, barcodes = {} }: {
  barcodes?: Record<string, string>; companyId: string; items: InvItem[]; stock: InvStock[]; locations: InvLocation[]; initialLocation?: string;
}) {
  const router = useRouter();
  const [loc, setLoc] = useState(initialLocation && locations.some((l) => l.id === initialLocation) ? initialLocation : locations[0]?.id ?? "");
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [extra, setExtra] = useState<InvItem[]>([]);
  const [showExpected, setShowExpected] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const at = (item: string) => Number(stock.find((s) => s.item_id === item && s.location_id === loc)?.qty ?? 0);
  const location = locations.find((l) => l.id === loc);
  const list = useMemo(() => {
    const ids = new Set(stock.filter((s) => s.location_id === loc && (Number(s.qty) !== 0 || Number(s.min_qty) > 0)).map((s) => s.item_id));
    extra.forEach((e) => ids.add(e.id));
    return items.filter((i) => ids.has(i.id));
  }, [items, stock, loc, extra]);
  const filled = list.filter((i) => (counts[i.id] ?? "").trim() !== "");
  const diff = (i: InvItem) => Number(counts[i.id]) - at(i.id);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!loc) return setError("Choose a location.");
    if (!filled.length) return setError("Enter what you counted for at least one item.");
    setSaving(true); setError("");
    const { data, error: err } = await createClient().rpc("inv_count_batch", {
      p_company: companyId, p_location: loc, p_note: note.trim() || null, p_lines: filled.map((i) => ({ item: i.id, counted: Number(counts[i.id]) })),
    });
    setSaving(false);
    if (err) return setError(invError(err));
    pingAlerts();
    setResult(data as Result);
    router.refresh();
  }

  if (result) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-white">
        <FormHeader title="Count saved" closeHref="/dashboard/inventory/counts" />
        <div className="mx-auto w-full max-w-lg px-5 py-10 text-center">
          <span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${result.missing > 0 ? "bg-[#fff1f2] text-[#be123c]" : "bg-[#e7f6f1] text-[#0f766e]"}`}>
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d={result.missing > 0 ? "M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" : "M5 12.5 9.5 17 19 7"} />
            </svg>
          </span>
          <h2 className="mt-4 text-xl font-semibold text-[#0b1f3a]">{location?.name}: {result.items} item{result.items === 1 ? "" : "s"} counted</h2>
          <div className="mt-6 grid grid-cols-3 gap-3 text-left">
            {[["Missing", qtyFmt(result.missing), "text-[#be123c]"], ["Missing value", usd(result.missing_cost), "text-[#be123c]"], ["Extra found", qtyFmt(result.extra), "text-[#0f766e]"]].map(([k, v, c]) => (
              <div key={k} className="rounded-xl border border-slate-200 p-3"><p className="text-[12px] text-slate-500">{k}</p><p className={`text-[18px] font-semibold tabular-nums ${c}`}>{v}</p></div>
            ))}
          </div>
          {result.missing > 0 && location?.kind === "van" && <p className="mt-4 text-[14px] text-slate-600">The missing parts were recorded under this van&apos;s technician. You&apos;ll see them in Reports.</p>}
          <div className="mt-8 flex justify-center gap-3">
            <Link prefetch={false} href="/dashboard/inventory/counts" className="rounded-lg bg-[#0f766e] px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-[#0c5f59]">Done</Link>
            <Link prefetch={false} href="/dashboard/inventory/reports" className="rounded-lg border border-slate-200 px-5 py-2.5 text-[15px] font-medium text-slate-700 hover:bg-slate-50">See reports</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate autoComplete="off" className="flex min-h-[calc(100vh-4rem)] flex-col bg-white">
      <FormHeader title="New Count" closeHref="/dashboard/inventory/counts" />
      <div className="flex-1">
        <div className="space-y-5 border-b border-slate-200 bg-[#fafbfc] px-5 py-6 sm:px-8">
          <FormRow label="Location" required width="max-w-[360px]" hint="Count one location at a time: the warehouse or a technician's van.">
            <SelectMenu ariaLabel="Location" value={loc} onChange={(v) => { setLoc(v); setCounts({}); setExtra([]); }} options={locations.map((l) => ({ value: l.id, label: `${l.name}${l.kind === "van" ? " (van)" : ""}` }))} />
          </FormRow>
          <FormRow label="Show expected" hint="Off = blind count (recommended): you count without seeing what the system expects, so the count is honest.">
            <button type="button" role="switch" aria-checked={showExpected} onClick={() => setShowExpected((v) => !v)} className="flex items-center gap-3 py-1.5">
              <span className={`relative h-6 w-11 rounded-full transition-colors ${showExpected ? "bg-[#0f766e]" : "bg-slate-300"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${showExpected ? "left-[22px]" : "left-0.5"}`} />
              </span>
              <span className="text-[15px] text-slate-700">{showExpected ? "Showing expected quantities" : "Blind count"}</span>
            </button>
          </FormRow>
        </div>
        <div className="px-5 py-7 sm:px-8">
          <SectionTitle>What you counted</SectionTitle>
          <div className="max-w-[820px] space-y-4">
            <ItemPicker barcodes={barcodes} items={items.filter((i) => !list.some((x) => x.id === i.id))} onPick={(it) => setExtra((l) => [...l, it])} placeholder="Found something not listed? Search or scan it"
              onNotFound={(code) => setError(`Code ${code} isn't in your inventory.`)} />
            {list.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">This location has no stock yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                {list.map((i) => {
                  const d = (counts[i.id] ?? "").trim() !== "" ? diff(i) : null;
                  return (
                    <li key={i.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-[#0b1f3a]">{i.name}</span>
                        <span className="block truncate font-mono text-[12px] text-slate-400">{i.sku}{showExpected ? <span className="font-sans"> · expected {qtyFmt(at(i.id))}</span> : null}</span>
                      </span>
                      {d !== null && showExpected && d !== 0 && <span className={`text-[13px] font-semibold tabular-nums ${d < 0 ? "text-[#be123c]" : "text-[#0f766e]"}`}>{d > 0 ? "+" : "−"}{qtyFmt(Math.abs(d))}</span>}
                      <input value={counts[i.id] ?? ""} inputMode="decimal" placeholder="—" aria-label={`Counted ${i.name}`}
                        onChange={(e) => { setCounts((c) => ({ ...c, [i.id]: e.target.value.replace(/[^0-9.]/g, "") })); setError(""); }}
                        className="h-10 w-24 rounded-lg border border-slate-200 bg-slate-50 text-center text-[15px] font-semibold tabular-nums focus:border-[#0f766e] focus:bg-white focus:outline-none" />
                      <span className="w-10 text-[13px] text-slate-500">{i.unit ?? ""}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-[13px] text-slate-500">{filled.length} of {list.length} counted. Items you leave empty are not changed.</p>
            <FormRow label="Note" htmlFor="ct-note" alignTop width="max-w-[460px]">
              <textarea id="ct-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" className={inputClass} />
            </FormRow>
          </div>
        </div>
      </div>
      <SaveBar saving={saving} cancelHref="/dashboard/inventory/counts" error={error} />
    </form>
  );
}
