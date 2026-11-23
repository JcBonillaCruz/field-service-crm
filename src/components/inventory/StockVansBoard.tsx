"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useInvTx } from "@/i18n/useInvTx";
import { InvItem, InvLocation, InvMember, InvStock, KitRow, qtyFmt } from "@/lib/inventory";
import { UseMove, locationStats } from "@/lib/inventory-insights";
import { LocArt, VanArt, WarehouseArt } from "@/components/inventory/InvArt";
import { LowArt, ValueArt } from "@/components/inventory/KpiArt";
import NewLocationModal from "@/components/inventory/NewLocationModal";
import { useFmt } from "@/components/inventory/PageBits";

// =====================================================================
// Paso 6.12c · Stock & Vans: cada almacén y cada van en una tarjeta con lo que trae, su valor, lo bajo,
// el kit completo (vans) y botones directos: Resurtir / Transferir, Contar, + Producto y Abrir.
// La misma pieza va al final del Dashboard de Inventario (compact).
// =====================================================================
const INV = "/dashboard/inventory";
export type LocLite = InvLocation & { is_active?: boolean; vehicle?: { plate?: string; make?: string; model?: string; year?: string } | null; photo_url?: string | null; address?: { city?: string; state?: string } | null };
type Filter = "all" | "warehouse" | "van" | "restock";

export default function StockVansBoard({ items, stock, locations, members, kit, moves, canEdit, compact = false }: {
  items: InvItem[]; stock: InvStock[]; locations: LocLite[]; members: InvMember[]; kit: KitRow[]; moves: UseMove[]; canEdit: boolean; compact?: boolean;
}) {
  const t = useTranslations("invBoard");
  const usd = useInvTx().money;
  const { fmtDay } = useFmt();
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState("");
  const [f, setF] = useState<Filter>("all");
  const [newOpen, setNewOpen] = useState(false);
  useEffect(() => {
    if (compact || sp.get("new") !== "1") return;
    if (canEdit) setNewOpen(true);
    router.replace(`${INV}/locations`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const stats = useMemo(() => locationStats(items, stock, locations, kit, moves), [items, stock, locations, kit, moves]);
  const techOf = (id: string | null) => members.find((m) => m.user_id === id)?.full_name ?? null;
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return locations
      .filter((l) => (f === "all" ? true : f === "restock" ? l.kind === "van" && (stats[l.id]?.low ?? 0) > 0 : l.kind === f))
      .filter((l) => !term || `${l.name} ${techOf(l.assigned_user_id) ?? ""} ${l.vehicle?.plate ?? ""}`.toLowerCase().includes(term))
      .sort((a, b) => Number(b.is_active !== false) - Number(a.is_active !== false) || (a.kind === b.kind ? Number(b.is_default) - Number(a.is_default) || a.name.localeCompare(b.name) : a.kind === "warehouse" ? -1 : 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations, f, q, stats]);
  const active = locations.filter((l) => l.is_active !== false);
  const total = active.reduce((a, l) => a + (stats[l.id]?.value ?? 0), 0);
  const lowAll = active.reduce((a, l) => a + (stats[l.id]?.low ?? 0), 0);
  const vansLow = active.filter((l) => l.kind === "van" && (stats[l.id]?.low ?? 0) > 0).length;
  const btn = "inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 text-[14px] font-medium text-slate-700 transition-all hover:-translate-y-0.5 hover:border-[#14a39a] hover:text-[#0f766e]";
  const chips: { k: Filter; label: string; n?: number }[] = [
    { k: "all", label: t("fAll"), n: locations.length }, { k: "warehouse", label: t("fWh"), n: locations.filter((l) => l.kind === "warehouse").length },
    { k: "van", label: t("fVans"), n: locations.filter((l) => l.kind === "van").length }, { k: "restock", label: t("fRestock"), n: vansLow },
  ];

  return (
    <section>
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {compact ? <h2 className="text-[18px] font-semibold tracking-tight text-[#0b1f3a]">{t("title")}</h2>
            : <h1 className="text-[22px] font-semibold tracking-tight text-[#0b1f3a] lg:text-2xl">{t("title")}</h1>}
          <p className="mt-0.5 text-[13.5px] text-slate-500 lg:text-sm">{t("subtitle")}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link prefetch={false} href={`${INV}/transfers/new`} className={btn}>
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h13l-3-3M20 16H7l3 3" /></svg>{t("transfer")}
          </Link>
          <Link prefetch={false} href={`${INV}/counts/new`} className={`${btn} max-sm:hidden`}>
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5h6M9 3h6v4H9zM6 5H5v16h14V5h-1M9 13l2 2 4-4" /></svg>{t("count")}
          </Link>
          {canEdit && (
            <button type="button" onClick={() => setNewOpen(true)} className="group/n inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#0f766e] px-4 text-[15px] font-semibold text-white shadow-sm shadow-[#0f766e]/30 transition-colors hover:bg-[#0c5f59]">
              <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform duration-200 group-hover/n:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>{t("new")}
            </button>
          )}
        </div>
      </div>

      {/* Resumen */}
      {!compact && (
        <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Mini label={t("kWh")} value={String(active.filter((l) => l.kind === "warehouse").length)} Art={WarehouseArt} hint={t("kWhHint")} />
          <Mini label={t("kVans")} value={String(active.filter((l) => l.kind === "van").length)} Art={VanArt} hint={active.some((l) => l.kind === "van" && !l.assigned_user_id) ? t("kVansNoTech") : t("kVansHint")} />
          <Mini label={t("kValue")} value={usd(total)} Art={ValueArt} hint={t("kValueHint")} />
          <Mini label={t("kLow")} value={String(lowAll)} Art={LowArt} warn={lowAll > 0} hint={vansLow ? t("kLowVans", { n: vansLow }) : t("kLowNone")} onClick={vansLow ? () => setF("restock") : undefined} />
        </div>
      )}

      {/* Filtros */}
      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-0 flex-1 basis-56">
          <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} aria-label={t("search")}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-[15px] placeholder:text-slate-400 focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15" />
        </div>
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 text-[14px] [scrollbar-width:none]">
          {chips.map((c) => (
            <button key={c.k} type="button" onClick={() => setF(c.k)} aria-pressed={f === c.k}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 transition-colors ${f === c.k ? "bg-[#e9f7f4] font-semibold text-[#0b5e57]" : "text-slate-600 hover:text-[#0b1f3a]"}`}>
              {c.label}{c.n ? <span className={`rounded-full px-1.5 text-[11px] font-semibold ${c.k === "restock" ? "bg-[#fff7e6] text-[#b45309]" : "bg-slate-100 text-slate-500"}`}>{c.n}</span> : null}
            </button>
          ))}
        </div>
      </div>

      {/* Tarjetas */}
      {locations.length === 0 ? (
        <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <div className="flex gap-3"><WarehouseArt size={64} /><VanArt size={64} /></div>
          <p className="mt-4 text-[16px] font-semibold text-[#0b1f3a]">{t("emptyTitle")}</p>
          <p className="mt-1 max-w-md text-[14px] text-slate-500">{t("emptyText")}</p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {shown.map((l) => {
            const s = stats[l.id];
            const tech = l.kind === "van" ? techOf(l.assigned_user_id) : null;
            const off = l.is_active === false;
            const car = l.vehicle ? [l.vehicle.year, l.vehicle.make, l.vehicle.model].filter(Boolean).join(" ") : "";
            const kitPct = s.kitTotal ? Math.round((s.kitOk / s.kitTotal) * 100) : null;
            return (
              <article key={l.id} className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-[#14a39a] hover:shadow-[0_14px_30px_rgba(15,40,60,0.09)] ${off ? "border-dashed border-slate-300 opacity-70" : "border-slate-200"}`}>
                <Link prefetch={false} href={`${INV}/locations/${l.id}`} aria-label={l.name} className="absolute inset-0 z-0" />
                {l.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.photo_url} alt="" className="h-28 w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                )}
                <div className="flex items-start gap-3 p-4 pb-3">
                  <span className="shrink-0 transition-transform duration-200 group-hover:scale-110"><LocArt kind={l.kind} size={52} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-[16px] font-semibold text-[#0b1f3a] group-hover:text-[#0f766e]">{l.name}</span>
                      {l.is_default && <span className="rounded-full bg-[#e9f7f4] px-2 py-0.5 text-[10.5px] font-semibold text-[#0f766e]">{t("main")}</span>}
                      {off && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-500">{t("inactive")}</span>}
                    </p>
                    <p className="truncate text-[13px] text-slate-500">
                      {l.kind === "van" ? (tech ?? t("noTech")) : [t("warehouse"), [l.address?.city, l.address?.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
                    </p>
                    {(car || l.vehicle?.plate) && (
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-slate-500">
                        {car && <span className="truncate">{car}</span>}
                        {l.vehicle?.plate && <span className="rounded-md border border-slate-300 bg-slate-50 px-1.5 py-px font-mono text-[11px] font-semibold tracking-wide text-slate-700">{l.vehicle.plate}</span>}
                      </p>
                    )}
                  </div>
                  {s.low > 0 && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] font-semibold ring-1 ${s.out ? "bg-[#fff1f2] text-[#be123c] ring-[#fecdd3]" : "bg-[#fff7e6] text-[#b45309] ring-[#fcdca4]"}`}>{t("nLow", { n: s.low })}</span>}
                </div>

                <div className="mx-4 grid grid-cols-3 gap-2 rounded-xl bg-[#f7f9fa] py-2.5 text-center">
                  {[[t("items"), String(s.items)], [t("units"), qtyFmt(s.units)], [t("value"), usd(s.value)]].map(([k, v]) => (
                    <div key={k} className="min-w-0"><p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">{k}</p><p className="truncate text-[15px] font-semibold tabular-nums text-[#0b1f3a]">{v}</p></div>
                  ))}
                </div>

                <div className="space-y-2 px-4 pt-3 text-[12.5px]">
                  {kitPct !== null && (
                    <div>
                      <div className="flex justify-between text-slate-500"><span>{t("kit")}</span><span className="font-semibold tabular-nums text-[#0b1f3a]">{s.kitOk}/{s.kitTotal}</span></div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full transition-all duration-500 ${kitPct === 100 ? "bg-[#14a39a]" : kitPct >= 60 ? "bg-[#f4a261]" : "bg-[#e11d48]"}`} style={{ width: `${Math.max(4, kitPct)}%` }} />
                      </div>
                    </div>
                  )}
                  {s.lowNames.length > 0 && <p className="truncate text-[#b45309]">{t("lowList", { list: s.lowNames.join(", ") })}{s.low > s.lowNames.length ? ` +${s.low - s.lowNames.length}` : ""}</p>}
                  {l.kind === "van" && <p className="text-slate-400">{s.lastRestock ? t("lastRestock", { date: fmtDay(s.lastRestock) }) : t("neverRestocked")}</p>}
                </div>

                {/* Botones directos (encima del enlace de la tarjeta) */}
                <div className="relative z-10 mt-auto flex flex-wrap gap-1.5 border-t border-slate-100 p-3">
                  {!off && (
                    <Link prefetch={false} href={`${INV}/transfers/new?to=${l.id}${l.kind === "van" ? "&restock=1" : ""}`}
                      className={`inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg max-sm:flex-1 px-3 text-[13px] font-semibold transition-all hover:-translate-y-0.5 ${l.kind === "van" && s.low > 0 ? "bg-[#0f766e] text-white hover:bg-[#0c5f59]" : "border border-slate-200 text-slate-700 hover:border-[#14a39a] hover:text-[#0f766e]"}`}>
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h13l-3-3M20 16H7l3 3" /></svg>{l.kind === "van" ? t("restock") : t("transferIn")}
                    </Link>
                  )}
                  {!off && (
                    <Link prefetch={false} href={`${INV}/counts/new?location=${l.id}`} className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg max-sm:flex-1 border border-slate-200 px-3 text-[13px] font-semibold text-slate-700 transition-all hover:-translate-y-0.5 hover:border-[#14a39a] hover:text-[#0f766e]">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5h6M9 3h6v4H9zM6 5H5v16h14V5h-1M9 13l2 2 4-4" /></svg>{t("count")}
                    </Link>
                  )}
                  {!off && (
                    <Link prefetch={false} href={`${INV}/new?location=${l.id}`} className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg max-sm:flex-1 border border-slate-200 px-3 text-[13px] font-semibold text-slate-700 transition-all hover:-translate-y-0.5 hover:border-[#14a39a] hover:text-[#0f766e]">
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>{t("product")}
                    </Link>
                  )}
                  <Link prefetch={false} href={`${INV}/locations/${l.id}`} className="ml-auto hidden h-9 items-center gap-1 whitespace-nowrap rounded-lg px-2.5 sm:inline-flex text-[13px] font-semibold text-[#0f766e] hover:bg-[#e9f7f4]">
                    {t("open")}<svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 5l5 5-5 5" /></svg>
                  </Link>
                </div>
              </article>
            );
          })}
          {shown.length === 0 && <p className="col-span-full py-8 text-center text-sm text-slate-500">{t("noMatch")}</p>}
        </div>
      )}
      <NewLocationModal open={newOpen} onClose={() => setNewOpen(false)} />
    </section>
  );
}

function Mini({ label, value, Art, hint, warn, onClick }: { label: string; value: string; Art: (p: { size?: number }) => JSX.Element; hint: string; warn?: boolean; onClick?: () => void }) {
  const cls = `group block w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,40,60,0.09)] lg:p-4 ${onClick ? "cursor-pointer" : ""}`;
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><p className="truncate text-[12.5px] font-medium text-slate-500 lg:text-[13px]">{label}</p>
          <p className={`mt-1 truncate text-[16px] font-semibold tabular-nums sm:text-[22px] lg:text-[24px] ${warn ? "text-[#b45309]" : "text-[#0b1f3a]"}`}>{value}</p></div>
        <span className="shrink-0"><Art size={44} /></span>
      </div>
      <p className="mt-0.5 truncate text-[12.5px] text-slate-500">{hint}</p>
    </>
  );
  return onClick ? <button type="button" onClick={onClick} className={cls}>{body}</button> : <div className={cls}>{body}</div>;
}
