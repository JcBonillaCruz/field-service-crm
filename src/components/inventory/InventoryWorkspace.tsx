"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react";
import { Check, Chevron, optionClass, panelClass } from "@/components/ui/SearchSelect";
import BottomSheet from "@/components/customers/BottomSheet";
import ExportModal from "@/components/customers/ExportModal";
import { sheetItem } from "@/components/ui/sheet";
import { Toast } from "@/components/sales/SalesBits";
import QuickAdjust from "@/components/inventory/QuickAdjust";
import { ItemsArt, LowArt, OutArt, ValueArt } from "@/components/inventory/KpiArt";
import {
  InvCategory, InvItem, InvLocation, InvPhoto, InvStock, STATUS_META, StockStatus, qtyFmt, statusOf, usd,
} from "@/lib/inventory";

type Props = {
  companyId: string; needsSql: boolean; children: React.ReactNode;
  items: InvItem[]; stock: InvStock[]; locations: InvLocation[]; categories: InvCategory[]; photos: InvPhoto[];
};
type StatusFilter = "all" | StockStatus;
type Row = InvItem & { rows: InvStock[]; total: number; status: StockStatus; value: number; retail: number; thumb: string | null; places: InvLocation[] };

const BASE = "/dashboard/inventory";
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" }, { value: "in", label: "In Stock" }, { value: "low", label: "Low Stock" }, { value: "out", label: "Out of Stock" },
];
const ICON = {
  box: "M12 3 20 7.5v9L12 21l-8-4.5v-9zM4 7.5 12 12l8-4.5M12 12v9",
  value: "M12 2.5v19M16.6 6.6c-.6-1.6-2.4-2.6-4.6-2.6-2.6 0-4.6 1.3-4.6 3.4 0 4.8 9.4 2.5 9.4 7.4 0 2.1-2.1 3.5-4.8 3.5-2.4 0-4.4-1.1-5-2.9",
  low: "M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  out: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8",
  scan: "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 8v8M10 8v8M13 8v8M16.5 8v8",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  filter: "M4 6h16M7 12h10M10 18h4",
  export: "M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14",
};
const Svg = ({ d, className = "h-5 w-5", sw = 1.8 }: { d: string; className?: string; sw?: number }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const plus = (
  <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform duration-200 group-hover/n:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M10 4.5v11M4.5 10h11" /></svg>
);

// Igual que Items/Customers/Invoices:
//   · Sin producto abierto → lista completa (KPIs, filtros, tabla).
//   · Producto abierto → 3 paneles: menú lateral | lista compacta | ficha.
//   · Nuevo / Editar / Scan / Settings → solo el menú lateral y esa pantalla.
export default function InventoryWorkspace({ companyId, needsSql, items, stock, locations, categories, photos, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [filterSheet, setFilterSheet] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const seg = pathname.slice(BASE.length).split("/").filter(Boolean);
  const isForm = ["new", "scan", "settings"].includes(seg[0] ?? "") || seg[1] === "edit";
  const selectedId = seg.length === 1 && !isForm ? seg[0] : null;

  const say = useCallback((text: string) => {
    setToast(text); clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  }, []);
  const changed = useCallback((msg: string, ok: boolean) => { say(msg); if (ok) router.refresh(); }, [router, say]);

  const rows: Row[] = useMemo(() => {
    const byItem = new Map<string, InvStock[]>();
    stock.forEach((s) => { const l = byItem.get(s.item_id) ?? []; l.push(s); byItem.set(s.item_id, l); });
    const thumbs = new Map<string, string>();
    photos.forEach((p) => { if (!thumbs.has(p.item_id)) thumbs.set(p.item_id, p.url); });
    return items.map((it) => {
      const r = byItem.get(it.id) ?? [];
      const total = r.reduce((s, x) => s + Number(x.qty), 0);
      return {
        ...it, rows: r, total, status: statusOf(r), value: total * it.cost_price, retail: total * it.selling_price,
        thumb: thumbs.get(it.id) ?? it.image_url, places: locations.filter((l) => r.some((x) => x.location_id === l.id && Number(x.qty) > 0)),
      };
    });
  }, [items, stock, photos, locations]);

  const kpi = useMemo(() => ({
    total: rows.length, units: rows.reduce((s, r) => s + Math.max(0, r.total), 0),
    value: rows.reduce((s, r) => s + r.value, 0), retail: rows.reduce((s, r) => s + r.retail, 0),
    low: rows.filter((r) => r.status === "low").length, out: rows.filter((r) => r.status === "out").length,
  }), [rows]);

  const shown = useMemo(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter((r) => {
      if (cat === "none" ? r.category_id : cat !== "all" && r.category_id !== cat) return false;
      if (status !== "all" && r.status !== status) return false;
      if (!terms.length) return true;
      const blob = `${r.name} ${r.sku ?? ""} ${r.description ?? ""}`.toLowerCase();
      return terms.every((t) => blob.includes(t));
    });
  }, [rows, q, cat, status]);

  useEffect(() => { if (isForm) setFilterSheet(false); }, [isForm]);
  if (isForm) return <>{children}</>;

  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "";
  const filtersOn = cat !== "all" || status !== "all" || q.trim() !== "";
  const clearFilters = () => { setQ(""); setCat("all"); setStatus("all"); };
  const catOptions = [{ value: "all", label: "All categories" }, ...categories.map((c) => ({ value: c.id, label: c.name })), { value: "none", label: "No category" }];
  const open = (id: string) => router.push(`${BASE}/${id}`);

  const searchBox = (
    <div className="relative min-w-0 flex-1 basis-60">
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400"><Svg d={ICON.search} className="h-[18px] w-[18px]" /></span>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or SKU" aria-label="Search inventory"
        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-[15px] placeholder:text-slate-400 focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15" />
      {q && (
        <button type="button" onClick={() => setQ("")} aria-label="Clear search"
          className="absolute inset-y-0 right-2 my-auto flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600">
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
        </button>
      )}
    </div>
  );

  return (
    <div className="lg:flex lg:h-[calc(100vh-4rem)] lg:overflow-hidden">
      {/* ===== Panel de la lista ===== */}
      <div className={selectedId ? "hidden w-full shrink-0 flex-col border-r border-slate-200 bg-white lg:flex lg:w-[360px]" : "flex w-full min-w-0 flex-col bg-[#f4f6f8]"}>
        {selectedId ? (
          <>
            {/* Lista compacta (como Items / Customers) */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <h1 className="text-lg font-semibold tracking-tight text-[#0b1f3a]">Inventory</h1>
              <div className="flex items-center gap-2">
                <Link prefetch={false} href={`${BASE}/scan`} aria-label="Scan barcode" title="Scan barcode"
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-[#0f766e] transition-colors hover:border-[#14a39a] hover:bg-[#e9f7f4]"><Svg d={ICON.scan} /></Link>
                <Link prefetch={false} href={`${BASE}/new`} aria-label="New Item" title="New Item"
                  className="group/n flex h-10 w-10 items-center justify-center rounded-lg bg-[#0f766e] text-white shadow-sm shadow-[#0f766e]/30 transition-colors hover:bg-[#0c5f59]">{plus}</Link>
              </div>
            </div>
            <div className="shrink-0 border-b border-slate-100 px-3 py-2.5">{searchBox}</div>
            <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
              {shown.map((r) => <CompactRow key={r.id} r={r} active={r.id === selectedId} />)}
              {shown.length === 0 && <li className="px-5 py-10 text-center text-sm text-slate-500">No items match.</li>}
            </ul>
          </>
        ) : (
          <div className="min-h-0 flex-1 px-4 pb-24 pt-5 lg:overflow-y-auto lg:px-8 lg:pb-10 lg:pt-7">
            {/* Encabezado */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-[22px] font-semibold tracking-tight text-[#0b1f3a] lg:text-2xl">Inventory</h1>
                <p className="mt-0.5 text-[13.5px] text-slate-500 lg:text-sm">Parts and products in your warehouse and vans, tracked by their barcode.</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={() => setExportOpen(true)}
                  className="hidden h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[14px] font-medium text-slate-600 transition-colors hover:border-[#14a39a] hover:text-[#0f766e] lg:flex">
                  <Svg d={ICON.export} className="h-[18px] w-[18px]" /> Export
                </button>
                <Link prefetch={false} href={`${BASE}/scan`} aria-label="Scan barcode" title="Scan barcode"
                  className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[14px] font-medium text-[#0f766e] transition-colors hover:border-[#14a39a] hover:bg-[#e9f7f4]">
                  <Svg d={ICON.scan} /><span className="hidden sm:inline">Scan</span>
                </Link>
                <Link prefetch={false} href={`${BASE}/new`}
                  className="group/n hidden h-10 items-center gap-1.5 rounded-lg bg-[#0f766e] px-4 text-[15px] font-semibold text-white shadow-sm shadow-[#0f766e]/30 transition-colors hover:bg-[#0c5f59] sm:inline-flex">{plus}New</Link>
              </div>
            </div>

            {needsSql && (
              <div role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                The inventory tables aren&apos;t ready. Run <b>paso-4.1-inventory.sql</b> in Supabase → SQL Editor, then reload this page.
              </div>
            )}

            {/* KPIs: tarjetas blancas; al pasar el mouse se elevan, el ícono se anima y (si aplica) filtran al hacer clic */}
            <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Kpi label="Total Items" value={kpi.total.toLocaleString("en-US")} Art={ItemsArt}
                hint={`${qtyFmt(kpi.units)} units on hand`} action="Show all" active={status === "all" && !filtersOn} onClick={clearFilters} />
              <Kpi label="Inventory Value" value={usd(kpi.value)} Art={ValueArt}
                hint={`At cost · ${usd(kpi.retail)} at selling price`} />
              <Kpi label="Low Stock" value={String(kpi.low)} Art={LowArt} warn={kpi.low > 0 ? "amber" : undefined} hint={kpi.low ? "Need restocking soon" : "Nothing running low"}
                action={kpi.low ? "Show them" : undefined} active={status === "low"} onClick={kpi.low ? () => setStatus(status === "low" ? "all" : "low") : undefined} />
              <Kpi label="Out of Stock" value={String(kpi.out)} Art={OutArt} warn={kpi.out > 0 ? "red" : undefined} hint={kpi.out ? "None left in any location" : "Everything in stock"}
                action={kpi.out ? "Show them" : undefined} active={status === "out"} onClick={kpi.out ? () => setStatus(status === "out" ? "all" : "out") : undefined} />
            </div>

            {/* Filtros */}
            {rows.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                {searchBox}
                <div className="hidden gap-2.5 lg:flex">
                  <FilterSelect value={cat} onChange={setCat} options={catOptions} width="w-52" />
                  <FilterSelect value={status} onChange={(v) => setStatus(v as StatusFilter)} options={STATUS_OPTIONS} width="w-44" prefix="Status:" />
                </div>
                <button type="button" onClick={() => setFilterSheet(true)} aria-label="Filters"
                  className={`relative flex h-11 w-11 items-center justify-center rounded-xl border bg-white lg:hidden ${cat !== "all" || status !== "all" ? "border-[#0f766e] text-[#0f766e]" : "border-slate-200 text-slate-500"}`}>
                  <Svg d={ICON.filter} />
                  {(cat !== "all" || status !== "all") && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#e8713a]" />}
                </button>
                {filtersOn && <button type="button" onClick={clearFilters} className="hidden text-sm font-medium text-[#0f766e] hover:underline lg:block">Clear</button>}
              </div>
            )}

            {/* Lista */}
            {rows.length === 0 ? (
              <Empty icon={ICON.box} title="Your inventory is empty"
                text="Scan the barcode that comes on a product's box, or add it by hand. That factory code becomes its SKU."
                actions={(
                  <>
                    <Link prefetch={false} href={`${BASE}/scan`} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[15px] font-medium text-[#0f766e] transition-colors hover:border-[#14a39a] hover:bg-[#e9f7f4]">
                      <Svg d={ICON.scan} /> Scan a barcode
                    </Link>
                    <Link prefetch={false} href={`${BASE}/new`} className="rounded-lg bg-[#0f766e] px-4 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#0c5f59]">+ New Item</Link>
                  </>
                )} />
            ) : shown.length === 0 ? (
              <Empty icon={ICON.search} title="No items match" text="Try another name or SKU, or clear the filters."
                actions={<button type="button" onClick={clearFilters} className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[15px] font-medium text-slate-700 hover:bg-slate-50">Clear filters</button>} />
            ) : (
              <>
                {/* Computadora: tabla */}
                <div className="mt-4 hidden overflow-hidden rounded-2xl border border-slate-200 bg-white lg:block">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[920px] text-left text-[14px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-[#fafbfc] text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                          <th className="px-4 py-3">Item</th><th className="px-3 py-3">Category</th><th className="px-3 py-3">Location</th>
                          <th className="px-3 py-3">Quantity</th><th className="px-3 py-3 text-right">Cost / Price</th><th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((r) => (
                          <tr key={r.id} onClick={() => open(r.id)} className="group cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-[#f0faf7]">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <Thumb src={r.thumb} />
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-[#0b1f3a] group-hover:text-[#0f766e]">{r.name}</p>
                                  <p className="truncate font-mono text-[12px] text-slate-400">{r.sku}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-slate-600">{catName(r.category_id) || <span className="text-slate-300">—</span>}</td>
                            <td className="px-3 py-3 text-slate-600"><Places places={r.places} rows={r.rows} /></td>
                            <td className="px-3 py-3"><QtyBadge row={r} /></td>
                            <td className="px-3 py-3 text-right tabular-nums">
                              <p className="text-slate-500">{usd(r.cost_price)}</p>
                              <p className="font-medium text-[#0b1f3a]">{usd(r.selling_price)}</p>
                            </td>
                            <td className="px-4 py-3"><div className="flex justify-end"><QuickAdjust companyId={companyId} item={r} locations={locations} rows={r.rows} onDone={changed} /></div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="border-t border-slate-100 bg-[#fafbfc] px-4 py-2.5 text-[12.5px] text-slate-500">
                    {shown.length === rows.length ? `${rows.length} items` : `${shown.length} of ${rows.length} items`}
                  </div>
                </div>

                {/* Celular: tarjetas fáciles de operar con el pulgar */}
                <ul className="mt-4 space-y-2.5 lg:hidden">
                  {shown.map((r) => (
                    <li key={r.id}>
                      <div role="button" tabIndex={0} onClick={() => open(r.id)} onKeyDown={(e) => { if (e.key === "Enter") open(r.id); }}
                        className="rounded-2xl border border-slate-200 bg-white p-3.5 transition-colors active:bg-[#f6fbfa]">
                        <div className="flex items-start gap-3">
                          <Thumb src={r.thumb} size="lg" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15.5px] font-semibold text-[#0b1f3a]">{r.name}</p>
                            <p className="truncate font-mono text-[12.5px] text-slate-400">{r.sku}</p>
                            <p className="mt-1 truncate text-[12.5px] text-slate-500">
                              {[catName(r.category_id), r.places.length === 1 ? r.places[0].name : r.places.length > 1 ? `${r.places.length} locations` : null].filter(Boolean).join(" · ") || "No category"}
                            </p>
                          </div>
                          <QtyBadge row={r} />
                        </div>
                        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                          <p className="text-[13px] tabular-nums text-slate-500">{usd(r.selling_price)} <span className="text-slate-300">·</span> cost {usd(r.cost_price)}</p>
                          <QuickAdjust companyId={companyId} item={r} locations={locations} rows={r.rows} onDone={changed} size="lg" />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>

      {/* ===== Ficha (panel derecho) ===== */}
      <div className={selectedId ? "flex min-w-0 flex-1 flex-col bg-white" : "hidden"}>
        <div className="min-h-0 flex-1 lg:overflow-y-auto">{children}</div>
      </div>

      {/* Celular: botón flotante + (como Customers / Items) */}
      {!selectedId && (
        <Link prefetch={false} href={`${BASE}/new`} aria-label="New Item"
          className="fixed bottom-6 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#0f766e] text-white shadow-lg shadow-[#0f766e]/30 active:scale-95 lg:hidden">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
        </Link>
      )}

      {/* Celular: filtros en hoja de abajo */}
      <BottomSheet open={filterSheet} onClose={() => setFilterSheet(false)} title="Filter"
        footer={(
          <div className="flex gap-3">
            <button type="button" onClick={() => { setCat("all"); setStatus("all"); }} className="flex-1 rounded-xl border border-slate-200 py-3 text-[15px] font-medium text-slate-700">Reset</button>
            <button type="button" onClick={() => setFilterSheet(false)} className="flex-1 rounded-xl bg-[#0f766e] py-3 text-[15px] font-semibold text-white">Show {shown.length}</button>
          </div>
        )}>
        <div className="space-y-5 px-4 py-4">
          <div>
            <p className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wide text-slate-400">Stock status</p>
            <div className="space-y-1">
              {STATUS_OPTIONS.map((o) => (
                <button key={o.value} type="button" onClick={() => setStatus(o.value)} className={sheetItem(status === o.value)}>
                  <span className="flex items-center gap-2.5">{o.value !== "all" && <span className={`h-2 w-2 rounded-full ${STATUS_META[o.value].dot}`} />}{o.label}</span>
                  {status === o.value && <CheckMark />}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wide text-slate-400">Category</p>
            <div className="space-y-1">
              {catOptions.map((o) => (
                <button key={o.value} type="button" onClick={() => setCat(o.value)} className={sheetItem(cat === o.value)}>
                  <span className="truncate">{o.label}</span>{cat === o.value && <CheckMark />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </BottomSheet>

      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} initialModule="Inventory"
        view={filtersOn ? { module: "Inventory", label: "Current filters", ids: shown.map((r) => r.id), columns: [] } : undefined}
        defaultScope={filtersOn ? "view" : "all"} />
      <Toast text={toast} />
    </div>
  );
}

// Tarjeta de resumen: blanca y limpia. Al pasar el mouse sube un poquito y su ícono ilustrado se anima.
function Kpi({ label, value, Art, hint, action, active, onClick, warn }: {
  label: string; value: string; Art: (p: { size?: number }) => JSX.Element; hint: string; action?: string; active?: boolean; onClick?: () => void; warn?: "amber" | "red";
}) {
  const cls = `group relative block w-full rounded-2xl border bg-white p-3.5 text-left transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,40,60,0.09)] lg:p-4 ${active && onClick ? "border-[#0f766e]" : "border-slate-200 hover:border-slate-300"} ${onClick ? "cursor-pointer" : "cursor-default"}`;
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-medium text-slate-500 lg:text-[13px]">{label}</p>
          <p className={`mt-1 truncate text-[22px] font-semibold tabular-nums tracking-tight lg:text-[26px] ${warn === "amber" ? "text-[#b45309]" : warn === "red" ? "text-[#be123c]" : "text-[#0b1f3a]"}`}>{value}</p>
        </div>
        <span className="shrink-0"><Art size={44} /></span>
      </div>
      <p className="mt-0.5 flex items-center justify-between gap-2 text-[12.5px] text-slate-500">
        <span className="truncate">{hint}</span>
        {action && onClick && <span className="hidden shrink-0 font-semibold text-[#0f766e] group-hover:inline">{action} →</span>}
      </p>
    </>
  );
  return onClick ? <button type="button" onClick={onClick} className={cls}>{body}</button> : <div className={cls}>{body}</div>;
}

function CompactRow({ r, active }: { r: Row; active: boolean }) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => { if (active) ref.current?.scrollIntoView({ block: "nearest" }); }, [active]);
  return (
    <li ref={ref} className={`relative transition-colors ${active ? "bg-[#d7f1eb] before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-[#0f766e]" : "hover:bg-[#f0faf7]"}`}>
      <Link prefetch={false} href={`${BASE}/${r.id}`} className="flex items-center gap-3 px-4 py-3">
        <Thumb src={r.thumb} />
        <span className="min-w-0 flex-1">
          <span className={`block truncate font-medium ${active ? "text-[#0f766e]" : "text-[#0b1f3a]"}`}>{r.name}</span>
          <span className="block truncate font-mono text-[12px] text-slate-500">{r.sku}</span>
        </span>
        <QtyBadge row={r} />
      </Link>
    </li>
  );
}

function QtyBadge({ row }: { row: Row }) {
  const m = STATUS_META[row.status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold tabular-nums ring-1 ${m.badge}`} title={m.label}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {qtyFmt(row.total)}<span className="font-medium opacity-75">{row.unit ?? ""}</span>
    </span>
  );
}

function Places({ places, rows }: { places: InvLocation[]; rows: InvStock[] }) {
  if (!places.length) return <span className="text-slate-300">—</span>;
  if (places.length === 1) return <span>{places[0].name}</span>;
  const title = places.map((p) => `${p.name}: ${qtyFmt(Number(rows.find((r) => r.location_id === p.id)?.qty ?? 0))}`).join("\n");
  return <span title={title} className="cursor-help border-b border-dotted border-slate-300">{places.length} locations</span>;
}

function Thumb({ src, size = "sm" }: { src: string | null; size?: "sm" | "lg" }) {
  const s = size === "lg" ? "h-12 w-12 rounded-xl" : "h-10 w-10 rounded-lg";
  return (
    <span className={`flex ${s} shrink-0 items-center justify-center overflow-hidden border border-slate-200 bg-gradient-to-br from-[#f4f7fa] to-[#e9f7f4]`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : <Svg d={ICON.box} className="h-5 w-5 text-[#9fc9c0]" sw={1.5} />}
    </span>
  );
}

function FilterSelect({ value, onChange, options, width, prefix }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; width: string; prefix?: string }) {
  const cur = options.find((o) => o.value === value);
  return (
    <Listbox value={value} onChange={onChange}>
      <ListboxButton className={`relative h-11 ${width} rounded-xl border border-slate-200 bg-white pl-3.5 pr-9 text-left text-[14.5px] text-slate-700 transition-colors hover:border-[#14a39a] focus:outline-none data-[open]:border-[#0f766e] data-[open]:ring-4 data-[open]:ring-[#14a39a]/15`}>
        <span className="block truncate">{prefix && <span className="text-slate-400">{prefix} </span>}{cur?.label}</span>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400"><Chevron /></span>
      </ListboxButton>
      <ListboxOptions anchor="bottom start" transition className={`${panelClass} w-[max(var(--button-width),12rem)] focus:outline-none`}>
        {options.map((o) => (
          <ListboxOption key={o.value} value={o.value} className={`${optionClass} data-[selected]:bg-[#eef5ff] data-[selected]:text-[#1d4ed8]`}>
            <span className="truncate">{o.label}</span><Check />
          </ListboxOption>
        ))}
      </ListboxOptions>
    </Listbox>
  );
}

const CheckMark = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4 text-[#0f766e]" fill="currentColor"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" /></svg>
);

function Empty({ icon, title, text, actions }: { icon: string; title: string; text: string; actions: React.ReactNode }) {
  return (
    <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center ">
      <span className="relative flex h-20 w-20 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-[#e9f7f4]" />
        <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#14a39a] to-[#0f766e] text-white shadow-[0_10px_24px_rgba(15,118,110,0.28)]">
          <Svg d={icon} className="h-8 w-8" sw={1.6} />
        </span>
      </span>
      <h2 className="mt-5 text-lg font-semibold text-[#0b1f3a]">{title}</h2>
      <p className="mt-1.5 max-w-sm text-[14.5px] text-slate-500">{text}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">{actions}</div>
    </div>
  );
}
