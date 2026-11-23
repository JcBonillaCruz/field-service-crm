"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PencilButton } from "@/components/catalog/DetailBits";
import SelectMenu from "@/components/ui/SelectMenu";
import ExportModal from "@/components/customers/ExportModal";
import { InvLocation, STATUS_META, qtyFmt } from "@/lib/inventory";
import { useTranslations } from "next-intl";
import { useInvTx } from "@/i18n/useInvTx";
import type { MoveRow } from "@/lib/inventory-server";
import { HIST_PERIODS, HistPeriod, VanHistory, VanTab, histRange } from "@/lib/van-history";
import { LocIcon, PageHead, card, pageWrap, useFmt } from "@/components/inventory/PageBits";
import type { LocExtra } from "@/components/inventory/LocationForm";

type Row = { item_id: string; qty: number; min_qty: number; items: { name: string; sku: string | null; unit: string | null; cost_price: number; image_url: string | null } | null };

// Paso 6.13 · Ficha de una van o almacén: Stock now · Used · Received · Counts · Not scanned
//   filtros (periodo + buscar) y Exportar; el técnico (su propia van) la ve sin costos
export default function LocationDetail({ location, locations, rows, moves, techName, canEdit, extra = {}, manager = true, tab = "stock", period = "30", hist }: {
  location: InvLocation & { is_active: boolean }; locations: InvLocation[]; rows: Row[]; moves: MoveRow[]; techName: string | null; canEdit: boolean;
  extra?: LocExtra; manager?: boolean; tab?: VanTab; period?: HistPeriod; hist?: VanHistory;
}) {
  const t = useTranslations("invLocDetail");
  const tv = useTranslations("vanFicha");
  const ix = useInvTx();
  const usd = ix.money;
  const { fmtWhen, fmtDay } = useFmt();
  const router = useRouter();
  const path = usePathname();
  const [q, setQ] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const isVan = location.kind === "van";
  const tabs: VanTab[] = ["stock", "used", "received", "counts", ...(isVan && hist?.unscanned ? ["unscanned" as VanTab] : [])];
  const go = (next: { tab?: VanTab; p?: HistPeriod }) => router.push(`${path}?tab=${next.tab ?? tab}&p=${next.p ?? period}`);
  const match = (s: string) => s.toLowerCase().includes(q.trim().toLowerCase());
  const cons = useMemo(() => new Set(hist?.consumables ?? []), [hist]);

  const list = useMemo(() => rows.filter((r) => (r.qty > 0 || r.min_qty > 0) && match(`${r.items?.name} ${r.items?.sku}`))
    .sort((a, b) => (a.items?.name ?? "").localeCompare(b.items?.name ?? "")), [rows, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const used = useMemo(() => (hist?.used ?? []).filter((r) => match(`${r.name} ${r.sku} ${r.job_number} ${r.customer} ${r.address} ${r.by}`)), [hist, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const recv = useMemo(() => (hist?.received ?? []).filter((r) => match(`${r.name} ${r.sku} ${r.other} ${r.by}`)), [hist, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = useMemo(() => (hist?.counts ?? []).filter((r) => match(`${r.by}`)), [hist, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const unscanned = useMemo(() => (hist?.unscanned ?? []).filter((r) => match(`${r.name} ${r.sku} ${r.number} ${r.customer}`)), [hist, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const units = rows.reduce((s, r) => s + Math.max(0, r.qty), 0);
  const value = rows.reduce((s, r) => s + Math.max(0, r.qty) * Number(r.items?.cost_price ?? 0), 0);
  const low = rows.filter((r) => r.min_qty > 0 && r.qty <= r.min_qty).length;
  const usedJobs = (hist?.used ?? []).filter((u) => u.kind === "use");
  const usedUnits = usedJobs.reduce((a, u) => a + u.qty, 0);
  const usedCost = usedJobs.reduce((a, u) => a + (u.cost ?? 0), 0);
  const missing = (hist?.unscanned ?? []).reduce((a, u) => a + u.missing, 0);
  const locName = (id: string | null) => locations.find((l) => l.id === id)?.name ?? "—";
  const btn = "inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-[14px] font-medium text-slate-700 transition-all hover:-translate-y-0.5 hover:border-[#14a39a] hover:text-[#0f766e]";
  const range = histRange(period);
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const kpis: [string, string, string?][] = [
    [t("units"), qtyFmt(units)],
    ...(manager ? [[t("value"), usd(value)] as [string, string]] : []),
    [t("low"), String(low), low ? "text-[#b45309]" : undefined],
    [tv("kUsed", { p: tv(`p.${period}`) }), manager ? `${qtyFmt(usedUnits)} · ${usd(usedCost)}` : qtyFmt(usedUnits)],
    ...(isVan && hist?.unscanned ? [[tv("kMissing"), qtyFmt(missing), missing ? "text-[#be123c]" : undefined] as [string, string, string?]] : []),
  ];

  return (
    <div className={pageWrap}>
      <PageHead back={manager ? "/dashboard/inventory/locations" : "/dashboard/inventory/van"} title={location.name}
        subtitle={isVan ? (techName ? t("vanOf", { name: techName }) : t("vanNoTech")) : location.is_default ? t("mainWh") : t("warehouse")}>
        {manager && (
          <>
            <Link prefetch={false} href={`/dashboard/inventory/transfers/new?to=${location.id}${isVan ? "&restock=1" : ""}`} className={btn} aria-label={isVan ? t("restock") : t("transferIn")}>
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h13l-3-3M20 16H7l3 3" /></svg>
              <span className="hidden sm:inline">{isVan ? t("restock") : t("transferIn")}</span>
            </Link>
            <Link prefetch={false} href={`/dashboard/inventory/counts/new?location=${location.id}`} className={btn} aria-label={t("count")}>
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5h6M9 3h6v4H9zM6 5H5v16h14V5h-1M9 13l2 2 4-4" /></svg>
              <span className="hidden sm:inline">{t("count")}</span>
            </Link>
          </>
        )}
        <button type="button" onClick={() => setExportOpen(true)} className={btn} aria-label={tv("export")}>
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
          <span className="hidden sm:inline">{tv("export")}</span>
        </button>
        {canEdit && <PencilButton href={`/dashboard/inventory/locations/${location.id}/edit`} label={t("edit")} />}
      </PageHead>

      {/* Datos de la van (vehículo y foto) o de la bodega (dirección) */}
      {(extra.photo_url || extra.vehicle || extra.address || extra.notes) && (() => {
        const v = extra.vehicle ?? {}; const a = extra.address ?? {};
        const car = [v.year, v.make, v.model].filter(Boolean).join(" ");
        const place = [a.street, [a.city, [a.state, a.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean).join(", ");
        return (
          <div className={`${card} mt-5 flex flex-wrap items-center gap-4 p-4`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {extra.photo_url && <img src={extra.photo_url} alt={location.name} className="h-20 w-32 rounded-xl object-cover" />}
            <dl className="grid min-w-0 flex-1 gap-x-8 gap-y-1.5 text-[14px] sm:grid-cols-2">
              {car && <div><dt className="text-[12px] text-slate-500">{t("vehicle")}</dt><dd className="text-[#0b1f3a]">{car}</dd></div>}
              {v.plate && <div><dt className="text-[12px] text-slate-500">{t("plate")}</dt><dd className="font-mono text-[#0b1f3a]">{v.plate}</dd></div>}
              {v.vin && <div><dt className="text-[12px] text-slate-500">VIN</dt><dd className="font-mono text-[#0b1f3a]">{v.vin}</dd></div>}
              {place && <div className="sm:col-span-2"><dt className="text-[12px] text-slate-500">{t("address")}</dt><dd className="text-[#0b1f3a]">{place}</dd></div>}
              {extra.notes && <div className="sm:col-span-2"><dt className="text-[12px] text-slate-500">{t("notes")}</dt><dd className="whitespace-pre-line text-slate-700">{extra.notes}</dd></div>}
            </dl>
          </div>
        );
      })()}

      <div className={`mt-5 grid grid-cols-2 gap-3 ${kpis.length >= 5 ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
        {kpis.map(([k, v, tone]) => (
          <div key={k} className={`${card} p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,40,60,0.06)]`}>
            <p className="truncate text-[12.5px] font-medium text-slate-500">{k}</p>
            <p className={`mt-1 truncate text-[19px] font-semibold tabular-nums ${tone ?? "text-[#0b1f3a]"}`}>{v}</p>
          </div>
        ))}
      </div>

      {/* Pestañas + filtros */}
      <div className="mt-6 border-b border-slate-200">
        <div role="tablist" className="-mb-px flex gap-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => go({ tab: k })}
              className={`relative shrink-0 whitespace-nowrap py-3 text-[15px] transition-colors ${tab === k ? "font-semibold text-[#0f766e]" : "text-slate-600 hover:text-[#0b1f3a]"}`}>
              {tv(`tab.${k}`)}
              {k === "unscanned" && missing > 0 && <span className="ml-1.5 rounded-full bg-[#fff1f2] px-1.5 py-0.5 text-[11.5px] font-bold text-[#be123c]">{qtyFmt(missing)}</span>}
              <span className={`absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-[#0f766e] transition-transform duration-200 ${tab === k ? "scale-x-100" : "scale-x-0"}`} />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === "used" ? tv("searchUsed") : t("search")}
          className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3.5 text-[14.5px] focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15 sm:max-w-sm" />
        {tab !== "stock" && (
          <div className="w-[200px]">
            <SelectMenu ariaLabel={tv("period")} value={period} onChange={(v) => go({ p: v as HistPeriod })} options={HIST_PERIODS.map((p) => ({ value: p, label: tv(`p.${p}`) }))} />
          </div>
        )}
      </div>

      {tab === "stock" && (
        <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className={`${card} overflow-hidden`}>
            <p className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-[15px] font-semibold text-[#0b1f3a]"><LocIcon kind={location.kind} /> {t("stockHere")}</p>
            {list.length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-500">{rows.length ? t("noMatch") : t("empty")}</p> : (
              <ul className="divide-y divide-slate-100">
                {list.map((r) => {
                  const st = r.qty <= 0 ? "out" : r.min_qty > 0 && r.qty <= r.min_qty ? "low" : "in";
                  const m = { ...STATUS_META[st], label: ix.status(st) };
                  const inner = (
                    <>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-[#f4f7fa]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {r.items?.image_url ? <img src={r.items.image_url} alt="" className="h-full w-full object-cover" /> : <span className="text-slate-300">—</span>}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-[#0b1f3a]">{r.items?.name}{cons.has(r.item_id) && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{tv("consumable")}</span>}</span>
                        <span className="block truncate font-mono text-[12px] text-slate-400">{r.items?.sku}{r.min_qty > 0 ? <span className="font-sans"> · {t("alertAt", { n: qtyFmt(r.min_qty) })}</span> : null}</span>
                      </span>
                      {manager && <span className="hidden w-24 text-right text-[13px] tabular-nums text-slate-500 sm:block">{usd(Math.max(0, r.qty) * Number(r.items?.cost_price ?? 0))}</span>}
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold tabular-nums ring-1 ${m.badge}`}><span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />{qtyFmt(r.qty)} <span className="font-medium opacity-75">{r.items?.unit ?? ""}</span></span>
                    </>
                  );
                  return (
                    <li key={r.item_id}>
                      {manager ? <Link prefetch={false} href={`/dashboard/inventory/${r.item_id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[#f0faf7]">{inner}</Link>
                        : <div className="flex items-center gap-3 px-4 py-3">{inner}</div>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className={`${card} h-fit overflow-hidden`}>
            <p className="border-b border-slate-100 px-4 py-3 text-[15px] font-semibold text-[#0b1f3a]">{t("recent")}</p>
            {moves.length === 0 ? <p className="px-4 py-8 text-center text-sm text-slate-500">{t("noMoves")}</p> : (
              <ul className="divide-y divide-slate-100">
                {moves.slice(0, 25).map((m) => {
                  const inbound = m.to_location === location.id;
                  return (
                    <li key={m.id} className="px-4 py-2.5">
                      <p className="truncate text-[14px] text-slate-800"><b className="font-semibold">{ix.move(m.kind)}</b>{" "}
                        <span className={`tabular-nums ${inbound ? "text-[#0f766e]" : "text-[#be123c]"}`}>{m.kind === "count" && m.qty === 0 ? "±0" : `${inbound ? "+" : "−"}${qtyFmt(m.qty)}`}</span> · {m.items?.name}</p>
                      <p className="truncate text-[12.5px] text-slate-500">{[m.kind === "transfer" || m.kind === "return" ? (inbound ? t("fromX", { x: locName(m.from_location) }) : t("toX", { x: locName(m.to_location) })) : ix.reason(m.reason), m.actor_name, fmtWhen(m.created_at)].filter(Boolean).join(" · ")}</p>
                    </li>
                  );
                })}
              </ul>
            )}
            {manager && <Link prefetch={false} href={`/dashboard/inventory/movements?location=${location.id}`} className="block border-t border-slate-100 px-4 py-2.5 text-center text-[13.5px] font-medium text-[#0f766e] hover:bg-[#f0faf7]">{t("allMoves")}</Link>}
          </section>
        </div>
      )}

      {tab === "used" && (
        <Table empty={tv("noUsed")} head={[tv("h.product"), tv("h.qty"), tv("h.when"), tv("h.where"), tv("h.by"), ...(manager ? [tv("h.cost")] : [])]} cols={manager ? GRID6 : GRID5}
          total={manager && used.length ? usd(used.reduce((a, u) => a + (u.cost ?? 0), 0)) : undefined} totalLabel={tv("total")}>
          {used.map((u) => (
            <Line key={u.id} cols={manager ? GRID6 : GRID5}>
              <Prod name={u.name} sku={u.sku} tag={cons.has(u.item_id) ? tv("consumable") : undefined} />
              <span className="tabular-nums font-semibold text-[#be123c]">−{qtyFmt(u.qty)} <span className="font-normal text-slate-500">{u.unit ?? ""}</span></span>
              <span className="text-slate-600">{fmtWhen(u.when)}</span>
              <span className="min-w-0">
                {u.job_id ? (
                  manager
                    ? <Link prefetch={false} href={`/dashboard/jobs/${u.job_id}`} className="block truncate font-medium text-[#0f766e] hover:underline">#{u.job_number} · {u.customer ?? "—"}</Link>
                    : <span className="block truncate font-medium text-[#0b1f3a]">#{u.job_number} · {u.customer ?? "—"}</span>
                ) : <span className="block truncate text-slate-600">{ix.reason(u.reason) || ix.move(u.kind)}</span>}
                {u.address && <span className="block truncate text-[12.5px] text-slate-500">{u.address}</span>}
              </span>
              <span className="truncate text-slate-600">{u.by ?? "—"}</span>
              {manager && <span className="tabular-nums text-slate-700 lg:text-right">{usd(u.cost ?? 0)}</span>}
            </Line>
          ))}
        </Table>
      )}

      {tab === "received" && (
        <Table empty={tv("noRecv")} head={[tv("h.product"), tv("h.qty"), tv("h.when"), tv("h.from"), tv("h.by"), ...(manager ? [tv("h.cost")] : [])]} cols={manager ? GRID6 : GRID5}>
          {recv.map((r) => (
            <Line key={r.id} cols={manager ? GRID6 : GRID5}>
              <Prod name={r.name} sku={r.sku} />
              <span className={`tabular-nums font-semibold ${r.inbound ? "text-[#0f766e]" : "text-[#be123c]"}`}>{r.inbound ? "+" : "−"}{qtyFmt(r.qty)} <span className="font-normal text-slate-500">{r.unit ?? ""}</span></span>
              <span className="text-slate-600">{fmtWhen(r.when)}</span>
              <span className="min-w-0">
                <span className="block truncate text-slate-700">{r.kind === "receive" ? tv("supplierIn") : r.inbound ? t("fromX", { x: ix.reason(r.other) || r.other || "—" }) : t("toX", { x: r.other ?? "—" })}</span>
                {r.note && <span className="block truncate text-[12.5px] text-slate-500">{r.note}</span>}
              </span>
              <span className="truncate text-slate-600">{r.by ?? "—"}</span>
              {manager && <span className="tabular-nums text-slate-700 lg:text-right">{usd(r.cost ?? 0)}</span>}
            </Line>
          ))}
        </Table>
      )}

      {tab === "counts" && (
        <Table empty={tv("noCounts")} head={[tv("h.when"), tv("h.by"), tv("h.items"), tv("h.diff"), ...(manager ? [tv("h.shortValue")] : [])]} cols={manager ? GRID5C : GRID4C}>
          {counts.map((c) => {
            const body = (
              <>
                <span className="font-medium text-[#0b1f3a]">{fmtDay(c.when)}{c.reversed && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{tv("reversed")}</span>}</span>
                <span className="truncate text-slate-600">{c.by ?? "—"}</span>
                <span className="tabular-nums text-slate-700">{c.items}</span>
                <span className={`tabular-nums font-semibold ${c.short > 0 ? "text-[#be123c]" : "text-[#0f766e]"}`}>{c.short > 0 ? tv("shortN", { n: qtyFmt(c.short) }) : tv("allGood")}</span>
                {manager && <span className="tabular-nums text-slate-700 lg:text-right">{usd(c.shortValue ?? 0)}</span>}
              </>
            );
            return manager
              ? <Link key={c.batch} prefetch={false} href={`/dashboard/inventory/counts/${c.batch}`} className={`grid ${manager ? GRID5C : GRID4C} items-center gap-x-4 gap-y-1 px-4 py-3 text-[14px] transition-colors hover:bg-[#f0faf7]`}>{body}</Link>
              : <div key={c.batch} className={`grid ${GRID4C} items-center gap-x-4 gap-y-1 px-4 py-3 text-[14px]`}>{body}</div>;
          })}
        </Table>
      )}

      {tab === "unscanned" && (
        <>
          <p className="mt-4 rounded-xl bg-[#fffaf0] px-4 py-3 text-[13.5px] text-[#7a3d06] ring-1 ring-[#fcdca4]">{tv("unscannedHint")}</p>
          <Table empty={tv("noUnscanned")} head={[tv("h.product"), tv("h.job"), tv("h.billed"), tv("h.scanned"), tv("h.missing"), ...(manager ? [tv("h.value")] : [])]} cols={manager ? GRID6 : GRID5}
            total={manager && unscanned.length ? usd(unscanned.reduce((a, u) => a + (u.value ?? 0), 0)) : undefined} totalLabel={tv("total")}>
            {unscanned.map((u) => (
              <Line key={u.key} cols={manager ? GRID6 : GRID5}>
                <Prod name={u.name} sku={u.sku} />
                <span className="min-w-0">
                  {manager ? <Link prefetch={false} href={`/dashboard/jobs/${u.job_id}`} className="block truncate font-medium text-[#0f766e] hover:underline">#{u.number} · {u.customer}</Link>
                    : <span className="block truncate font-medium text-[#0b1f3a]">#{u.number} · {u.customer}</span>}
                  {u.when && <span className="block text-[12.5px] text-slate-500">{fmtDay(u.when)}</span>}
                </span>
                <span className="tabular-nums text-slate-700">{qtyFmt(u.billed)}</span>
                <span className="tabular-nums text-slate-700">{qtyFmt(u.scanned)}</span>
                <span className="tabular-nums font-semibold text-[#be123c]">{qtyFmt(u.missing)} <span className="font-normal text-slate-500">{u.unit ?? ""}</span></span>
                {manager && <span className="tabular-nums text-slate-700 lg:text-right">{usd(u.value ?? 0)}</span>}
              </Line>
            ))}
          </Table>
        </>
      )}

      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} initialModule="Van history" defaultScope="view"
        view={{ module: "Van history", label: location.name, ids: [location.id], columns: [tab === "stock" ? "all" : tab], range: { from: ymd(range.from), to: ymd(new Date(range.to.getTime() - 86400000)) }, query: `?loc=${location.id}` }} />
    </div>
  );
}

const GRID6 = "lg:grid-cols-[minmax(0,2.2fr)_6.5rem_8.5rem_minmax(0,2fr)_minmax(0,1fr)_6.5rem]";
const GRID5 = "lg:grid-cols-[minmax(0,2.2fr)_6.5rem_8.5rem_minmax(0,2fr)_minmax(0,1fr)]";
const GRID5C = "lg:grid-cols-[9rem_minmax(0,1.5fr)_6rem_minmax(0,1fr)_7rem]";
const GRID4C = "lg:grid-cols-[9rem_minmax(0,1.5fr)_6rem_minmax(0,1fr)]";

function Table({ head, cols, empty, children, total, totalLabel }: { head: string[]; cols: string; empty: string; children: React.ReactNode[]; total?: string; totalLabel?: string }) {
  return (
    <section className={`${card} mt-4 overflow-hidden`}>
      <div className={`hidden ${cols} gap-x-4 border-b border-slate-100 bg-[#fafbfc] px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-slate-500 lg:grid`}>
        {head.map((h, i) => <span key={h} className={i === head.length - 1 && /\$|cost|costo|value|valor/i.test(h) ? "text-right" : ""}>{h}</span>)}
      </div>
      {children.length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-500">{empty}</p> : <div className="divide-y divide-slate-100">{children}</div>}
      {total && <p className="flex justify-end gap-3 border-t border-slate-100 px-4 py-3 text-[14px]"><span className="text-slate-500">{totalLabel}</span><b className="tabular-nums text-[#0b1f3a]">{total}</b></p>}
    </section>
  );
}
function Line({ cols, children }: { cols: string; children: React.ReactNode }) {
  return <div className={`grid grid-cols-2 ${cols} items-center gap-x-4 gap-y-1 px-4 py-3 text-[14px] transition-colors hover:bg-[#fafcfc]`}>{children}</div>;
}
function Prod({ name, sku, tag }: { name: string; sku: string | null; tag?: string }) {
  return (
    <span className="col-span-2 min-w-0 lg:col-span-1">
      <span className="block truncate font-medium text-[#0b1f3a]">{name}{tag && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{tag}</span>}</span>
      {sku && <span className="block truncate font-mono text-[12px] text-slate-400">{sku}</span>}
    </span>
  );
}
