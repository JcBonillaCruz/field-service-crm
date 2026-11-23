"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useInvTx } from "@/i18n/useInvTx";
import { InvItem, InvLocation, InvMember, InvStock, KitRow, qtyFmt } from "@/lib/inventory";
import { UseMove, locationStats, lowRows, runningOut, shoppingList } from "@/lib/inventory-insights";
import { buildCountPdf, loadPdfBrand, openPdf } from "@/lib/count-pdf";
import { SheetIcon } from "@/components/inventory/CountSheetModal";
import { CartArt, LowArt, OutArt } from "@/components/inventory/KpiArt";
import { LocArt } from "@/components/inventory/InvArt";
import { useFmt } from "@/components/inventory/PageBits";

// =====================================================================
// Paso 6.12c · Reports → alertas: qué comprar, qué se va a acabar, qué está agotado y cuánto le queda a cada técnico
// =====================================================================
const INV = "/dashboard/inventory";
type Tab = "buy" | "soon" | "out";

export default function InvReportAlerts({ items, stock, locations, members, kit, moves, company = "", companyId = "" }: {
  companyId?: string; items: InvItem[]; stock: InvStock[]; locations: InvLocation[]; members: InvMember[]; kit: KitRow[]; moves: UseMove[]; company?: string;
}) {
  const t = useTranslations("invAlerts");
  const ix = useInvTx();
  const usd = ix.money;
  const es = useLocale().startsWith("es");
  const { fmtDay } = useFmt();
  const [tab, setTab] = useState<Tab>("buy");
  const [open, setOpen] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, string>>({}); // cantidades a comprar ajustadas por el dueño
  const [busy, setBusy] = useState("");
  const buy = useMemo(() => shoppingList(items, stock, locations, kit), [items, stock, locations, kit]);
  const low = useMemo(() => lowRows(items, stock, locations, kit), [items, stock, locations, kit]);
  const usage = useMemo(() => runningOut(items, stock, moves, 30), [items, stock, moves]);
  // Por agotarse: lo que está en o debajo de su mínimo (sin llegar a 0) + lo que al ritmo de uso dura 30 días o menos
  const soon = useMemo(() => {
    const rows = low.filter((r) => !r.out).map((r) => ({ key: `${r.item.id}${r.loc.id}`, item: r.item, where: r.loc.name, qty: r.qty, min: r.min, days: usage.find((u) => u.item.id === r.item.id)?.daysLeft ?? null }));
    usage.forEach((u) => { if (!rows.some((r) => r.item.id === u.item.id)) rows.push({ key: u.item.id, item: u.item, where: t("allPlaces"), qty: u.onHand, min: 0, days: u.daysLeft }); });
    return rows;
  }, [low, usage, t]);
  const out = useMemo(() => low.filter((r) => r.out), [low]);
  const stats = useMemo(() => locationStats(items, stock, locations, kit, moves), [items, stock, locations, kit, moves]);
  const vans = locations.filter((l) => l.kind === "van");
  const techOf = (id: string | null) => members.find((m) => m.user_id === id)?.full_name ?? null;
  const buyQty = (r: { item: InvItem; need: number }) => { const v = qty[r.item.id]; return v === undefined ? r.need : Math.max(0, Number(v) || 0); };
  const buyTotal = buy.reduce((a, r) => a + buyQty(r) * r.item.cost_price, 0);
  const daysLabel = (d: number | null) => (d === null ? "—" : d <= 0 ? t("today") : t("days", { n: d }));

  // Lo que se ve en cada pestaña, listo para PDF y Excel
  function table(k: Tab) {
    if (k === "buy") return {
      title: t("pdfBuy"), cols: [t("cProduct"), "SKU", t("cWh"), t("cVans"), t("cTarget"), t("cBuy"), t("cUnitCost"), t("cCost"), t("cFor")],
      rows: buy.filter((r) => buyQty(r) > 0).map((r) => [r.item.name, r.item.sku ?? "", qtyFmt(r.whQty), qtyFmt(r.vanQty), qtyFmt(r.target), qtyFmt(buyQty(r)), usd(r.item.cost_price), usd(buyQty(r) * r.item.cost_price), r.places.join(", ")]),
      total: usd(buyTotal),
    };
    if (k === "soon") return { title: t("pdfSoon"), cols: [t("cProduct"), "SKU", t("cWhere"), t("cHave"), t("cMin"), t("cDaysLeft")], rows: soon.map((r) => [r.item.name, r.item.sku ?? "", r.where, qtyFmt(r.qty), r.min ? qtyFmt(r.min) : "—", daysLabel(r.days)]), total: "" };
    return { title: t("pdfOut"), cols: [t("cProduct"), "SKU", t("cWhere"), t("cMin"), t("cUnitCost")], rows: out.map((r) => [r.item.name, r.item.sku ?? "", r.loc.name, r.min ? qtyFmt(r.min) : "—", usd(r.item.cost_price)]), total: "" };
  }
  async function pdf() {
    const o = "portrait" as "portrait" | "landscape"; // Paso 6.12g: reportes siempre vertical
    const d = table(tab);
    setBusy("pdf");
    const brand = companyId ? await loadPdfBrand(companyId) : null;
    const widths = tab === "buy" ? [22, 11, 7, 7, 7, 7, 9, 9, o === "landscape" ? 18 : 12] : tab === "soon" ? [26, 12, 18, 8, 8, 10] : [28, 12, 20, 8, 10];
    const right = (i: number) => (tab === "buy" ? i >= 2 && i <= 7 : tab === "soon" ? i >= 3 : i >= 3);
    const bytes = await buildCountPdf({
      design: brand?.design, logoBytes: brand?.logoBytes, logoPng: brand?.logoPng,
      company, title: d.title, subtitle: t("pdfSub", { date: fmtDay(new Date().toISOString()) }), orientation: o,
      meta: [[t("mDate"), fmtDay(new Date().toISOString())], [t("mItems"), String(d.rows.length)], ...(d.total ? [[t("estimated"), d.total] as [string, string]] : [])],
      columns: d.cols.map((c, i) => ({ label: c, w: widths[i], align: right(i) ? "right" as const : "left" as const })),
      // Paso 6.12g: alertas resaltadas (rojo = agotado, ámbar = por agotarse) y renglón de total
      rows: [...d.rows.map((r) => ({ cells: r, alert: tab === "out" ? "red" as const : tab === "soon" ? (r[3] === "0" ? "red" as const : "amber" as const) : undefined,
        tone: tab === "soon" ? [null, null, null, "neg" as const] : undefined })),
        ...(tab === "buy" && d.total ? [{ cells: d.cols.map((_, i) => (i === 0 ? t("estimated") : i === d.cols.length - 2 ? d.total : "")), total: true }] : [])],
      sign: tab === "buy" ? [t("sApproved"), t("sOrdered"), t("sDate")] : undefined,
      footer: `BrightPro · ${company}`, page: (n, total) => t("page", { n, total }),
    });
    openPdf(bytes, `${d.title}.pdf`);
    setBusy("");
  }

  const tabs: { k: Tab; label: string; n: number; Art: (p: { size?: number }) => JSX.Element; tone: string }[] = [
    { k: "buy", label: t("tBuy"), n: buy.length, Art: CartArt, tone: "bg-[#e9f7f4] text-[#0f766e]" },
    { k: "soon", label: t("tSoon"), n: soon.length, Art: LowArt, tone: "bg-[#fff7e6] text-[#b45309]" },
    { k: "out", label: t("tOut"), n: out.length, Art: OutArt, tone: "bg-[#fff1f2] text-[#be123c]" },
  ];
  const empty = tab === "buy" ? !buy.length : tab === "soon" ? !soon.length : !out.length;

  return (
    <div className="mt-5 space-y-5">
      {/* Qué comprar / por agotarse / agotados */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="grid grid-cols-3 border-b border-slate-100">
          {tabs.map((x) => (
            <button key={x.k} type="button" onClick={() => setTab(x.k)} aria-pressed={tab === x.k}
              className={`group relative flex flex-col items-center gap-1 px-2 py-3 text-center transition-colors sm:flex-row sm:justify-center sm:gap-2.5 sm:py-4 ${tab === x.k ? "bg-[#f6fbfa]" : "hover:bg-slate-50"}`}>
              <span className="transition-transform duration-200 group-hover:scale-110"><x.Art size={34} /></span>
              <span className={`whitespace-nowrap text-[13.5px] sm:text-[15px] ${tab === x.k ? "font-semibold text-[#0b1f3a]" : "text-slate-600"}`}>{x.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${x.n ? x.tone : "bg-slate-100 text-slate-500"}`}>{x.n}</span>
              <span className={`absolute inset-x-0 bottom-0 h-[3px] bg-[#0f766e] transition-transform duration-200 ${tab === x.k ? "scale-x-100" : "scale-x-0"}`} />
            </button>
          ))}
        </div>

        {/* Barra: explicación, total y descargas */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          <p className="min-w-0 flex-1 basis-64 text-[13.5px] text-slate-500">{tab === "buy" ? t("buyHint") : tab === "soon" ? t("soonHint") : t("outHint")}</p>
          <div className="flex flex-wrap items-center gap-2">
            {tab === "buy" && buy.length > 0 && <span className="mr-1 text-[15px] text-slate-600">{t("estimated")} <b className="tabular-nums text-[#0b1f3a]">{usd(buyTotal)}</b></span>}
            <button type="button" onClick={() => pdf()} disabled={empty || !!busy} className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#0f766e] px-3 text-[13px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#0c5f59] disabled:opacity-50"><SheetIcon className="h-4 w-4" />PDF</button>
          </div>
        </div>

        {tab === "buy" && (buy.length === 0 ? <Empty text={t("buyNone")} /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[14px]">
              <thead><tr className="border-y border-slate-100 bg-[#fafbfc] text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-2.5 text-left">{t("cProduct")}</th><th className="px-3 py-2.5 text-right">{t("cWh")}</th><th className="px-3 py-2.5 text-right">{t("cVans")}</th>
                <th className="px-3 py-2.5 text-right">{t("cTarget")}</th><th className="px-3 py-2.5 text-center">{t("cBuy")}</th><th className="px-5 py-2.5 text-right">{t("cCost")}</th>
              </tr></thead>
              <tbody>
                {buy.map((r) => (
                  <tr key={r.item.id} className="border-b border-slate-100 last:border-0 hover:bg-[#f6fbfa]">
                    <td className="px-5 py-2.5"><Link prefetch={false} href={`${INV}/${r.item.id}`} className="block min-w-0"><span className="block truncate text-[#0b1f3a] hover:text-[#0f766e]">{r.item.name}</span><span className="block truncate text-[12px] text-slate-400">{t("forX", { list: r.places.slice(0, 3).join(", ") })}</span></Link></td>
                    <td className={`px-3 py-2.5 text-right tabular-nums ${r.whQty <= 0 ? "font-semibold text-[#be123c]" : "text-slate-700"}`}>{qtyFmt(r.whQty)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{qtyFmt(r.vanQty)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{qtyFmt(r.target)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <input inputMode="numeric" value={qty[r.item.id] ?? String(r.need)} aria-label={t("cBuy")} onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => setQty((q) => ({ ...q, [r.item.id]: e.target.value.replace(/[^0-9]/g, "") }))}
                        className="h-9 w-16 rounded-lg border border-slate-200 bg-[#f3fbf8] text-center text-[14.5px] font-semibold tabular-nums text-[#0f766e] focus:border-[#0f766e] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15" />
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-slate-700">{usd(buyQty(r) * r.item.cost_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {tab === "soon" && (soon.length === 0 ? <Empty text={t("soonNone")} /> : (
          <ItemTable head={[t("cProduct"), t("cWhere"), t("cHave"), t("cMin"), t("cDaysLeft")]}
            rows={soon.map((r) => ({ id: r.item.id, key: r.key, name: r.item.name, sub: r.item.sku,
              cells: [<span key="w" className="whitespace-nowrap text-slate-600">{r.where}</span>, <b key="q" className="text-[#b45309]">{qtyFmt(r.qty)}</b>, r.min ? qtyFmt(r.min) : "—",
                <span key="d" className={r.days !== null && r.days <= 7 ? "font-semibold text-[#be123c]" : "text-slate-600"}>{daysLabel(r.days)}</span>] }))} />
        ))}
        {tab === "out" && (out.length === 0 ? <Empty text={t("outNone")} /> : (
          <ItemTable head={[t("cProduct"), t("cWhere"), t("cMin"), t("cUnitCost")]}
            rows={out.map((r) => ({ id: r.item.id, key: `${r.item.id}${r.loc.id}`, name: r.item.name, sub: r.item.sku, cells: [<span key="w" className="whitespace-nowrap text-slate-600">{r.loc.name}</span>, r.min ? qtyFmt(r.min) : "—", usd(r.item.cost_price)] }))} />
        ))}
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

function ItemTable({ head, rows }: { head: string[]; rows: { id: string; key?: string; name: string; sub: string | null; cells: React.ReactNode[] }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[460px] text-[14px]">
        <thead><tr className="border-y border-slate-100 bg-[#fafbfc] text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {head.map((h, i) => <th key={h} className={`px-5 py-2.5 ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key ?? r.id} className="border-b border-slate-100 last:border-0 hover:bg-[#f6fbfa]">
              <td className="px-5 py-2.5"><Link prefetch={false} href={`${INV}/${r.id}`} className="block min-w-0"><span className="block truncate text-[#0b1f3a] hover:text-[#0f766e]">{r.name}</span>{r.sub && <span className="block truncate text-[12px] text-slate-400">{r.sub}</span>}</Link></td>
              {r.cells.map((c, i) => <td key={i} className="whitespace-nowrap px-5 py-2.5 text-right tabular-nums text-slate-700">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
