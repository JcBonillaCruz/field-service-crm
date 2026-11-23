"use client";

import { useTranslations } from "next-intl";
import { InvItem } from "@/lib/inventory";
import ItemPicker from "@/components/inventory/ItemPicker";

// Paso 6.12 · Kit estándar de la van: lo que toda van debe traer (cantidad que debe llevar) y su mínimo para la alerta
export type KitRow = { item_id: string; par: number; min: number };

export const kitOf = (raw: unknown): KitRow[] => (Array.isArray(raw) ? raw : [])
  .map((r) => r as Partial<KitRow>).filter((r) => typeof r.item_id === "string")
  .map((r) => ({ item_id: r.item_id as string, par: Math.max(0, Number(r.par) || 0), min: Math.max(0, Number(r.min) || 0) }));

export default function KitEditor({ items, rows, onChange, barcodes }: { items: InvItem[]; rows: KitRow[]; onChange: (r: KitRow[]) => void; barcodes?: Record<string, string> }) {
  const t = useTranslations("invKit");
  const byId = new Map(items.map((i) => [i.id, i]));
  const set = (i: number, patch: Partial<KitRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const num = "h-10 w-20 rounded-lg border border-slate-200 bg-white px-2 text-right text-[14.5px] tabular-nums focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15";
  return (
    <div className="space-y-2.5">
      {rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="grid grid-cols-[minmax(0,1fr)_5rem_5rem_2rem] items-center gap-2 bg-[#fafbfc] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <span>{t("item")}</span><span className="text-right">{t("par")}</span><span className="text-right">{t("min")}</span><span />
          </div>
          <ul className="divide-y divide-slate-100">
            {rows.map((r, i) => {
              const it = byId.get(r.item_id);
              return (
                <li key={r.item_id} className="grid grid-cols-[minmax(0,1fr)_5rem_5rem_2rem] items-center gap-2 px-3 py-2">
                  <span className="min-w-0"><span className="block truncate text-[14.5px] text-[#0b1f3a]">{it?.name ?? t("gone")}</span>{it?.sku && <span className="block truncate font-mono text-[12px] text-slate-400">{it.sku}</span>}</span>
                  <input inputMode="decimal" value={String(r.par)} aria-label={t("par")} onFocus={(e) => e.currentTarget.select()} onChange={(e) => set(i, { par: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 })} className={num} />
                  <input inputMode="decimal" value={String(r.min)} aria-label={t("min")} onFocus={(e) => e.currentTarget.select()} onChange={(e) => set(i, { min: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 })} className={num} />
                  <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label={t("remove")} className="group/x flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600">
                    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 transition-transform duration-200 group-hover/x:rotate-90" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6.5 6.5 7 7M13.5 6.5l-7 7" strokeLinecap="round" /></svg>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <ItemPicker items={items.filter((i) => i.is_active && !rows.some((r) => r.item_id === i.id))} barcodes={barcodes} placeholder={t("addPh")}
        onPick={(it) => onChange([...rows, { item_id: it.id, par: 2, min: 1 }])} />
      <p className="text-[12.5px] text-slate-500">{t("hint")}</p>
    </div>
  );
}
