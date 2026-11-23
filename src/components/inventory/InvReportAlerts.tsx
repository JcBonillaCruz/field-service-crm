"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useInvTx } from "@/i18n/useInvTx";
import { InvItem, InvLocation, InvMember, InvStock, KitRow, qtyFmt } from "@/lib/inventory";
import { UseMove, locationStats, runningOut, shoppingList } from "@/lib/inventory-insights";
import { CartArt, LowArt, OutArt } from "@/components/inventory/KpiArt";
import { LocArt } from "@/components/inventory/InvArt";
import { useFmt } from "@/components/inventory/PageBits";

// =====================================================================
// Paso 6.12c · Reports → alertas: qué comprar, qué se va a acabar, qué está agotado y cuánto le queda a cada técnico
// =====================================================================
const INV = "/dashboard/inventory";
type Tab = "buy" | "soon" | "out";

export default function InvReportAlerts({ items, stock, locations, members, kit, moves }: {
  items: InvItem[]; stock: InvStock[]; locations: InvLocation[]; members: InvMember[]; kit: KitRow[]; moves: UseMove[];
}) {
  const t = useTranslations("invAlerts");
  const ix = useInvTx();
  const usd = ix.money;
  const { fmtDay } = useFmt();
  const [tab, setTab] = useState<Tab>("buy");
  const [open, setOpen] = useState<string | null>(null);
  const buy = useMemo(() => shoppingList(items, stock, locations, kit), [items, stock, locations, kit]);
  const soon = useMemo(() => runningOut(items, stock, moves, 30), [items, stock, moves]);
  const out = useMemo(() => items.filter((i) => i.is_active && stock.filter((s) => s.item_id === i.id).reduce((a, s) => a + s.qty, 0) <= 0), [items, stock]);
  const stats = useMemo(() => locationStats(items, stock, locations, kit, moves), [items, stock, locations, kit, moves]);
  const vans = locations.filter((l) => l.kind === "van");
  const buyTotal = buy.reduce((a, r) => a + r.cost, 0);
  const techOf = (id: string | null) => members.find((m) => m.user_id === id)?.full_name ?? null;

  function csv() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [[t("cProduct"), "SKU", t("cHave"), t("cTarget"), t("cBuy"), t("cUnitCost"), t("cCost"), t("cFor")].map(esc).join(",")];
    buy.forEach((r) => lines.push([r.item.name, r.item.sku ?? "", qtyFmt(r.onHand), qtyFmt(r.target), qtyFmt(r.need), r.item.cost_price.toFixed(2), r.cost.toFixed(2), r.places.join(" / ")].map((v) => esc(String(v))).join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `shopping-list-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  const tabs: { k: Tab; label: string; n: number; Art: (p: { size?: number }) => JSX.Element; tone: string }[] = [
    { k: "buy", label: t("tBuy"), n: buy.length, Art: CartArt, tone: "bg-[#e9f7f4] text-[#0f766e]" },
    { k: "soon", label: t("tSoon"), n: soon.length, Art: LowArt, tone: "bg-[#fff7e6] text-[#b45309]" },
    { k: "out", label: t("tOut"), n: out.length, Art: OutArt, tone: "bg-[#fff1f2] text-[#be123c]" },
  ];

  return (
    <div className="mt-5 space-y-5">
      {/* Qué comprar / por agotarse / agotados */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="grid grid-cols-3 border-b border-slate-100">
          {tabs.map((x) => (
            <button key={x.k} type="button" onClick={() => setTab(x.k)} aria-pressed={tab === x.k}
              className={`group relative flex flex-col items-center gap-1 px-2 py-3 text-center transition-colors sm:flex-row sm:justify-center sm:gap-2.5 sm:py-4 ${tab === x.k ? "bg-[#f6fbfa]" : "hover:bg-slate-50"}`}>
              <x.Art size={34} />
              <span className={`whitespace-nowrap text-[13.5px] sm:text-[15px] ${tab === x.k ? "font-semibold text-[#0b1f3a]" : "text-slate-600"}`}>{x.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${x.n ? x.tone : "bg-slate-100 text-slate-500"}`}>{x.n}</span>
              <span className={`absolute inset-x-0 bottom-0 h-[3px] bg-[#0f766e] transition-transform duration-200 ${tab === x.k ? "scale-x-100" : "scale-x-0"}`} />
            </button>
          ))}
        </div>

        {tab === "buy" && (
          buy.length === 0 ? <Empty text={t("buyNone")} /> : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <p className="text-[13.5px] text-slate-500">{t("buyHint")}</p>
                <div className="flex items-center gap-3">
                  <span className="text-[15px] text-slate-600">{t("estimated")} <b className="tabular-nums text-[#0b1f3a]">{usd(buyTotal)}</b></span>
                  <button type="button" onClick={csv} className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 px-3 text-[13px] font-semibold text-slate-700 transition-all hover:-translate-y-0.5 hover:border-[#14a39a] hover:text-[#0f766e]">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>CSV
                  </button>
                </div>
              </div>
              <ItemTable head={[t("cProduct"), t("cHave"), t("cTarget"), t("cBuy"), t("cCost")]}
                rows={buy.map((r) => ({ id: r.item.id, name: r.item.name, sub: r.places.length ? t("forX", { list: r.places.slice(0, 3).join(", ") }) : r.item.sku,
                  cells: [qtyFmt(r.onHand), qtyFmt(r.target), <b key="b" className="text-[#0f766e]">+{qtyFmt(r.need)}</b>, usd(r.cost)] }))} />
            </>
          )
        )}
        {tab === "soon" && (
          soon.length === 0 ? <Empty text={t("soonNone")} /> : (
            <>
              <p className="px-5 py-3 text-[13.5px] text-slate-500">{t("soonHint")}</p>
              <ItemTable head={[t("cProduct"), t("cHave"), t("cPerWeek"), t("cDaysLeft")]}
                rows={soon.map((r) => ({ id: r.item.id, name: r.item.name, sub: r.item.sku,
                  cells: [qtyFmt(r.onHand), qtyFmt(Math.round(r.perDay * 7 * 10) / 10), <b key="d" className={r.daysLeft <= 7 ? "text-[#be123c]" : "text-[#b45309]"}>{r.daysLeft <= 0 ? t("today") : t("days", { n: r.daysLeft })}</b>] }))} />
            </>
          )
        )}
        {tab === "out" && (
          out.length === 0 ? <Empty text={t("outNone")} /> : (
            <ItemTable head={[t("cProduct"), t("cUnitCost")]} rows={out.map((i) => ({ id: i.id, name: i.name, sub: i.sku, cells: [usd(i.cost_price)] }))} />
          )
        )}
      </section>

      {/* Cuánto le queda a cada técnico */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-[16px] font-semibold text-[#0b1f3a]">{t("techTitle")}</h2>
          <p className="text-[13px] text-slate-500">{t("techHint")}</p>
        </div>
        {vans.length === 0 ? <Empty text={t("noVans")} /> : (
          <ul className="divide-y divide-slate-100">
            {vans.map((v) => {
              const s = stats[v.id];
              const pct = s.kitTotal ? Math.round((s.kitOk / s.kitTotal) * 100) : null;
              const low = stock.filter((x) => x.location_id === v.id && x.min_qty > 0 && x.qty <= x.min_qty)
                .map((x) => ({ x, it: items.find((i) => i.id === x.item_id) })).filter((r) => r.it?.is_active);
              const isOpen = open === v.id;
              return (
                <li key={v.id}>
                  <div className="group flex flex-wrap items-center gap-3 px-5 py-3.5">
                    <LocArt kind="van" size={44} />
                    <div className="min-w-0 flex-1 basis-40">
                      <p className="truncate text-[15px] font-semibold text-[#0b1f3a]">{techOf(v.assigned_user_id) ?? t("noTech")}</p>
                      <p className="truncate text-[12.5px] text-slate-500">{v.name} · {s.lastRestock ? t("restocked", { date: fmtDay(s.lastRestock) }) : t("neverRestocked")}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-right text-[13px]">
                      <div><p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">{t("units")}</p><p className="font-semibold tabular-nums text-[#0b1f3a]">{qtyFmt(s.units)}</p></div>
                      <div><p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">{t("value")}</p><p className="font-semibold tabular-nums text-[#0b1f3a]">{usd(s.value)}</p></div>
                      <div><p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">{t("kit")}</p><p className={`font-semibold tabular-nums ${pct === null ? "text-slate-400" : pct === 100 ? "text-[#0f766e]" : pct >= 60 ? "text-[#b45309]" : "text-[#be123c]"}`}>{pct === null ? "—" : `${pct}%`}</p></div>
                    </div>
                    <div className="flex items-center gap-2">
                      {low.length > 0 && (
                        <button type="button" onClick={() => setOpen(isOpen ? null : v.id)} aria-expanded={isOpen}
                          className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1 ${s.out ? "bg-[#fff1f2] text-[#be123c] ring-[#fecdd3]" : "bg-[#fff7e6] text-[#b45309] ring-[#fcdca4]"}`}>{t("nLow", { n: low.length })}</button>
                      )}
                      <Link prefetch={false} href={`${INV}/transfers/new?to=${v.id}&restock=1`}
                        className={`inline-flex h-9 items-center whitespace-nowrap rounded-lg px-3 text-[13px] font-semibold transition-all hover:-translate-y-0.5 ${low.length ? "bg-[#0f766e] text-white hover:bg-[#0c5f59]" : "border border-slate-200 text-slate-700 hover:border-[#14a39a] hover:text-[#0f766e]"}`}>{t("restock")}</Link>
                    </div>
                  </div>
                  {isOpen && (
                    <ul className="animate-[bp-fade_0.2s_ease-out] space-y-0.5 bg-[#fffbf5] px-5 pb-3 pl-[76px] pt-1">
                      {low.map(({ x, it }) => (
                        <li key={x.item_id} className="flex justify-between gap-3 text-[13.5px]">
                          <Link prefetch={false} href={`${INV}/${x.item_id}`} className="truncate text-slate-700 hover:text-[#0f766e]">{it!.name}</Link>
                          <span className="shrink-0 tabular-nums"><b className={x.qty <= 0 ? "text-[#be123c]" : "text-[#b45309]"}>{qtyFmt(x.qty)}</b><span className="text-slate-400"> / {qtyFmt(x.min_qty)}</span></span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

const Empty = ({ text }: { text: string }) => <p className="px-5 py-10 text-center text-[14px] text-slate-500">{text}</p>;

function ItemTable({ head, rows }: { head: string[]; rows: { id: string; name: string; sub: string | null; cells: React.ReactNode[] }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[460px] text-[14px]">
        <thead><tr className="border-y border-slate-100 bg-[#fafbfc] text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {head.map((h, i) => <th key={h} className={`px-5 py-2.5 ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-[#f6fbfa]">
              <td className="px-5 py-2.5"><Link prefetch={false} href={`${INV}/${r.id}`} className="block min-w-0"><span className="block truncate text-[#0b1f3a] hover:text-[#0f766e]">{r.name}</span>{r.sub && <span className="block truncate text-[12px] text-slate-400">{r.sub}</span>}</Link></td>
              {r.cells.map((c, i) => <td key={i} className="whitespace-nowrap px-5 py-2.5 text-right tabular-nums text-slate-700">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
