"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useInvTx } from "@/i18n/useInvTx";
import { InvItem, InvLocation, InvMember, InvPhoto, InvStock, KitRow, qtyFmt } from "@/lib/inventory";
import { UseMove, runningOut, shoppingList } from "@/lib/inventory-insights";
import StockVansBoard, { LocLite } from "@/components/inventory/StockVansBoard";
import InvProductsList from "@/components/inventory/InvProductsList";
import type { MoveRow } from "@/lib/inventory-server";
import { CartArt, ItemsArt, LowArt, OutArt, UnscannedArt, UsedArt, ValueArt } from "@/components/inventory/KpiArt";
import { pageWrap } from "@/components/inventory/PageBits";
import NewLocationModal from "@/components/inventory/NewLocationModal";

// =====================================================================
// Paso 6.12 · Dashboard de Inventario
//   Alertas: bajo stock en almacén y por van, agotados, descontinuados con stock
//   Del mes: unidades usadas, gasto en compras, valor del inventario (total y por van), partes sin escanear
// =====================================================================
const INV = "/dashboard/inventory";
type Props = {
  companyId: string; items: InvItem[]; stock: InvStock[]; locations: InvLocation[]; members: InvMember[]; moves: MoveRow[]; needsSql: boolean;
  unscanned: { units: number; value: number } | null; kitSize: number; canEdit: boolean;
  photos: InvPhoto[]; kit: KitRow[]; boardLocations: LocLite[]; recent: UseMove[]; // Paso 6.12c
};

export default function InvDashboard({ items, stock, locations, members, moves, needsSql, unscanned, kitSize, canEdit, photos, kit, boardLocations, recent }: Props) {
  const t = useTranslations("invDash");
  const ix = useInvTx();
  const usd = ix.money;
  const [newOpen, setNewOpen] = useState(false);

  const d = useMemo(() => {
    const item = new Map(items.map((i) => [i.id, i]));
    const loc = new Map(locations.map((l) => [l.id, l]));
    const techOf = (id: string | null) => members.find((m) => m.user_id === id)?.full_name ?? null;
    const totals = new Map<string, number>();
    const byLoc = new Map<string, { value: number; units: number; low: number }>();
    const lowWh: { item: InvItem; loc: InvLocation; qty: number; min: number }[] = [];
    const lowVan = new Map<string, { item: InvItem; qty: number; min: number }[]>();
    for (const s of stock) {
      const it = item.get(s.item_id), l = loc.get(s.location_id);
      if (!it || !l) continue;
      totals.set(s.item_id, (totals.get(s.item_id) ?? 0) + s.qty);
      const b = byLoc.get(l.id) ?? { value: 0, units: 0, low: 0 };
      if (s.qty > 0) { b.units += s.qty; b.value += s.qty * it.cost_price; }
      if (it.is_active && s.min_qty > 0 && s.qty <= s.min_qty) {
        b.low += 1;
        if (l.kind === "warehouse") lowWh.push({ item: it, loc: l, qty: s.qty, min: s.min_qty });
        else { const list = lowVan.get(l.id) ?? []; list.push({ item: it, qty: s.qty, min: s.min_qty }); lowVan.set(l.id, list); }
      }
      byLoc.set(l.id, b);
    }
    const out = items.filter((i) => i.is_active && (totals.get(i.id) ?? 0) <= 0);
    const discontinued = items.filter((i) => !i.is_active && (totals.get(i.id) ?? 0) > 0).map((i) => ({ item: i, qty: totals.get(i.id) ?? 0 }));
    const value = Array.from(byLoc.values()).reduce((a, b) => a + b.value, 0);
    const units = Array.from(byLoc.values()).reduce((a, b) => a + b.units, 0);
    // Del mes
    const costOf = (m: MoveRow) => (m.unit_cost ?? item.get(m.item_id)?.cost_price ?? 0);
    const used = moves.filter((m) => m.kind === "use");
    const bought = moves.filter((m) => m.kind === "receive" || (m.kind === "adjust" && m.reason === "Received purchase" && m.qty > 0));
    const usedUnits = used.reduce((a, m) => a + Math.abs(m.qty), 0);
    const usedCost = used.reduce((a, m) => a + Math.abs(m.qty) * costOf(m), 0);
    const spend = bought.reduce((a, m) => a + Math.abs(m.qty) * costOf(m), 0);
    const spots = locations.map((l) => ({ l, tech: l.kind === "van" ? techOf(l.assigned_user_id) : null, ...(byLoc.get(l.id) ?? { value: 0, units: 0, low: 0 }) }))
      .sort((a, b) => (a.l.kind === b.l.kind ? b.value - a.value : a.l.kind === "warehouse" ? -1 : 1));
    return {
      out, discontinued, lowWh, value, units, usedUnits, usedCost, spend, receipts: new Set(bought.map((m) => m.created_at.slice(0, 16))).size, spots,
      lowVan: Array.from(lowVan.entries()).map(([id, list]) => ({ loc: loc.get(id)!, tech: techOf(loc.get(id)?.assigned_user_id ?? null), list })),
    };
  }, [items, stock, locations, members, moves]);

  const buy = useMemo(() => shoppingList(items, stock, locations, kit), [items, stock, locations, kit]);
  const buyTotal = buy.reduce((a, r) => a + r.cost, 0);
  const soon = useMemo(() => runningOut(items, stock, recent, 21), [items, stock, recent]);
  const alerts = d.out.length + d.lowWh.length + d.lowVan.reduce((a, v) => a + v.list.length, 0) + d.discontinued.length;
  const vans = locations.filter((l) => l.kind === "van");

  return (
    <div className={`${pageWrap} min-h-[calc(100vh-4rem)] bg-[#f4f6f8]`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight text-[#0b1f3a] lg:text-2xl">{t("title")}</h1>
          <p className="mt-0.5 text-[13.5px] text-slate-500 lg:text-sm">{t("subtitle")}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link prefetch={false} href={`${INV}/scan`} className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[14px] font-medium text-[#0f766e] transition-all hover:-translate-y-0.5 hover:border-[#14a39a] hover:bg-[#e9f7f4]">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 8v8M10 8v8M13 8v8M16.5 8v8" /></svg>{t("scan")}
          </Link>
          {canEdit && (
            <button type="button" onClick={() => setNewOpen(true)}
              className="group/n inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#0f766e] px-4 text-[15px] font-semibold text-white shadow-sm shadow-[#0f766e]/30 transition-colors hover:bg-[#0c5f59]">
              <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform duration-200 group-hover/n:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>{t("new")}
            </button>
          )}
        </div>
      </div>

      {needsSql && <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{t("needsSql")}</p>}

      {/* Del mes */}
      <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label={t("kValue")} value={usd(d.value)} Art={ValueArt} hint={t("kValueHint", { units: qtyFmt(d.units), n: locations.length })} href={`${INV}/locations`} action={t("seeStock")} />
        <Kpi label={t("kUsed")} value={qtyFmt(d.usedUnits)} Art={UsedArt} hint={t("kUsedHint", { cost: usd(d.usedCost) })} href={`${INV}/history?tab=movements`} action={t("seeHistory")} />
        <Kpi label={t("kSpend")} value={usd(d.spend)} Art={CartArt} hint={d.receipts ? t("kSpendHint", { n: d.receipts }) : t("kSpendNone")} />
        <Kpi label={t("kUnscanned")} value={unscanned ? (unscanned.value > 0 ? usd(unscanned.value) : qtyFmt(unscanned.units)) : "—"} Art={UnscannedArt}
          warn={unscanned && unscanned.units > 0 ? "red" : undefined} hint={!unscanned ? t("kUnscannedNa") : unscanned.units > 0 ? t("kUnscannedHint", { n: qtyFmt(unscanned.units) }) : t("kUnscannedNone")}
          href={unscanned ? "/dashboard/jobs/reports?tab=parts" : undefined} action={t("seeParts")} />
      </div>

      {items.length === 0 ? (
        <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <ItemsArt size={64} />
          <h2 className="mt-4 text-lg font-semibold text-[#0b1f3a]">{t("emptyTitle")}</h2>
          <p className="mt-1.5 max-w-md text-[14.5px] text-slate-500">{t("emptyText")}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link prefetch={false} href={`${INV}/scan`} className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[15px] font-medium text-[#0f766e] hover:border-[#14a39a] hover:bg-[#e9f7f4]">{t("scanFirst")}</Link>
            <Link prefetch={false} href={`${INV}/new`} className="rounded-lg bg-[#0f766e] px-4 py-2.5 text-[15px] font-semibold text-white hover:bg-[#0c5f59]">{t("newItem")}</Link>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          {/* Alertas */}
          <section className="rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <h2 className="text-[16px] font-semibold text-[#0b1f3a]">{t("attention")}</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${alerts ? "bg-[#fff7e6] text-[#b45309]" : "bg-[#e7f6f1] text-[#0f766e]"}`}>{alerts ? t("nAlerts", { n: alerts }) : t("allGood")}</span>
            </div>
            {alerts === 0 ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <ItemsArt size={52} />
                <p className="mt-3 text-[15px] font-semibold text-[#0b1f3a]">{t("allGoodTitle")}</p>
                <p className="mt-1 max-w-sm text-[13.5px] text-slate-500">{t("allGoodText")}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {d.out.length > 0 && (
                  <Group Art={OutArt} title={t("gOut")} count={d.out.length} tone="red">
                    {d.out.slice(0, 6).map((it) => <ItemRow key={it.id} id={it.id} name={it.name} sku={it.sku} right={<span className="font-semibold text-[#be123c]">0</span>} />)}
                    {d.out.length > 6 && <More href={INV} label={t("moreN", { n: d.out.length - 6 })} />}
                  </Group>
                )}
                {d.lowWh.length > 0 && (
                  <Group Art={LowArt} title={t("gLowWh")} count={d.lowWh.length} tone="amber">
                    {d.lowWh.slice(0, 6).map((r) => <ItemRow key={`${r.item.id}${r.loc.id}`} id={r.item.id} name={r.item.name} sku={r.loc.name}
                      right={<span><b className="text-[#b45309]">{qtyFmt(r.qty)}</b><span className="text-slate-400"> / {qtyFmt(r.min)}</span></span>} />)}
                    {d.lowWh.length > 6 && <More href={INV} label={t("moreN", { n: d.lowWh.length - 6 })} />}
                  </Group>
                )}
                {d.lowVan.map((v) => (
                  <Group key={v.loc.id} Art={LowArt} title={t("gLowVan", { name: v.loc.name })} sub={v.tech ?? undefined} count={v.list.length} tone="amber"
                    action={<Link prefetch={false} href={`${INV}/transfers/new?to=${v.loc.id}&restock=1`} className="rounded-lg bg-[#0f766e] px-3 py-1.5 text-[13px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#0c5f59]">{t("restock")}</Link>}>
                    {v.list.slice(0, 5).map((r) => <ItemRow key={r.item.id} id={r.item.id} name={r.item.name} sku={r.item.sku}
                      right={<span><b className="text-[#b45309]">{qtyFmt(r.qty)}</b><span className="text-slate-400"> / {qtyFmt(r.min)}</span></span>} />)}
                    {v.list.length > 5 && <More href={`${INV}/locations/${v.loc.id}`} label={t("moreN", { n: v.list.length - 5 })} />}
                  </Group>
                ))}
                {d.discontinued.length > 0 && (
                  <Group Art={OutArt} title={t("gDisc")} sub={t("gDiscSub")} count={d.discontinued.length} tone="slate">
                    {d.discontinued.slice(0, 5).map((r) => <ItemRow key={r.item.id} id={r.item.id} name={r.item.name} sku={r.item.sku} right={<span className="text-slate-600">{qtyFmt(r.qty)}</span>} />)}
                  </Group>
                )}
              </div>
            )}
          </section>

          {/* Paso 6.12c: qué comprar y qué se va a acabar (lista completa en Reports) */}
          <section className="flex flex-col rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="flex min-w-0 items-center gap-2.5"><CartArt size={34} /><h2 className="truncate text-[16px] font-semibold text-[#0b1f3a]">{t("toBuy")}</h2></div>
              {buy.length > 0 && <span className="shrink-0 text-[14px] font-semibold tabular-nums text-[#0b1f3a]">{usd(buyTotal)}</span>}
            </div>
            {buy.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13.5px] text-slate-500">{t("toBuyNone")}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {buy.slice(0, 6).map((r) => (
                  <li key={r.item.id}>
                    <Link prefetch={false} href={`${INV}/${r.item.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[14px] transition-colors hover:bg-[#f6fbfa]">
                      <span className="min-w-0"><span className="block truncate text-[#0b1f3a]">{r.item.name}</span><span className="block truncate text-[12px] text-slate-400">{t("haveNeed", { have: qtyFmt(r.onHand), need: qtyFmt(r.target) })}</span></span>
                      <span className="shrink-0 text-right"><b className="block tabular-nums text-[#0f766e]">+{qtyFmt(r.need)}</b><span className="block text-[12px] tabular-nums text-slate-500">{usd(r.cost)}</span></span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {soon.length > 0 && (
              <div className="border-t border-slate-100 px-5 py-3">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">{t("runOut")}</p>
                <ul className="mt-1.5 space-y-1">
                  {soon.slice(0, 3).map((r) => (
                    <li key={r.item.id} className="flex justify-between gap-3 text-[13.5px]"><span className="truncate text-slate-700">{r.item.name}</span><span className={`shrink-0 font-semibold ${r.daysLeft <= 7 ? "text-[#be123c]" : "text-[#b45309]"}`}>{r.daysLeft <= 0 ? t("today") : t("days", { n: r.daysLeft })}</span></li>
                  ))}
                </ul>
              </div>
            )}
            <Link prefetch={false} href={`${INV}/reports`} className="mt-auto block border-t border-slate-100 px-5 py-3 text-center text-[13.5px] font-semibold text-[#0f766e] hover:bg-[#f0faf7]">{t("seeReports")}</Link>
            {vans.length > 0 && kitSize === 0 && canEdit && (
              <div className="border-t border-slate-100 px-5 py-3 text-[13px] text-slate-500">
                {t("noKit")} <Link prefetch={false} href={`${INV}/settings#kit`} className="font-semibold text-[#0f766e] hover:underline">{t("setKit")}</Link>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Paso 6.12c: Stock & Vans y todos los productos aquí mismo, para trabajar sin cambiar de pantalla */}
      <div className="mt-8"><StockVansBoard compact items={items} stock={stock} locations={boardLocations} members={members} kit={kit} moves={recent} canEdit={canEdit} /></div>
      {items.length > 0 && <div className="mt-8"><InvProductsList items={items} stock={stock} locations={locations} photos={photos} /></div>}
      <NewLocationModal open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}

function Kpi({ label, value, Art, hint, href, action, warn }: {
  label: string; value: string; Art: (p: { size?: number }) => JSX.Element; hint: string; href?: string; action?: string; warn?: "red";
}) {
  const cls = "group relative block w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-left transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_28px_rgba(15,40,60,0.09)] lg:p-4";
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-medium text-slate-500 lg:text-[13px]">{label}</p>
          <p className={`mt-1 truncate text-[16px] font-semibold tabular-nums tracking-tight sm:text-[22px] lg:text-[26px] ${warn === "red" ? "text-[#be123c]" : "text-[#0b1f3a]"}`}>{value}</p>
        </div>
        <span className="shrink-0"><Art size={44} /></span>
      </div>
      <p className="mt-0.5 flex items-center justify-between gap-2 text-[12.5px] text-slate-500">
        <span className="truncate">{hint}</span>
        {action && href && <span className="hidden shrink-0 font-semibold text-[#0f766e] group-hover:inline">{action} →</span>}
      </p>
    </>
  );
  return href ? <Link prefetch={false} href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

function Group({ Art, title, sub, count, tone, action, children }: {
  Art: (p: { size?: number }) => JSX.Element; title: string; sub?: string; count: number; tone: "red" | "amber" | "slate"; action?: React.ReactNode; children: React.ReactNode;
}) {
  const badge = tone === "red" ? "bg-[#fff1f2] text-[#be123c]" : tone === "amber" ? "bg-[#fff7e6] text-[#b45309]" : "bg-slate-100 text-slate-600";
  return (
    <div className="group px-5 py-4">
      <div className="mb-2 flex items-center gap-3">
        <Art size={34} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[14.5px] font-semibold text-[#0b1f3a]"><span className="truncate">{title}</span><span className={`shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${badge}`}>{count}</span></p>
          {sub && <p className="truncate text-[12.5px] text-slate-500">{sub}</p>}
        </div>
        {action}
      </div>
      <ul className="space-y-0.5 pl-[46px]">{children}</ul>
    </div>
  );
}

function ItemRow({ id, name, sku, right }: { id: string; name: string; sku: string | null; right: React.ReactNode }) {
  return (
    <li>
      <Link prefetch={false} href={`${INV}/${id}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-[14px] transition-colors hover:bg-[#f0faf7]">
        <span className="min-w-0"><span className="block truncate text-[#0b1f3a]">{name}</span>{sku && <span className="block truncate text-[12px] text-slate-400">{sku}</span>}</span>
        <span className="shrink-0 tabular-nums">{right}</span>
      </Link>
    </li>
  );
}
const More = ({ href, label }: { href: string; label: string }) => (
  <li><Link prefetch={false} href={href} className="block rounded-lg px-2 py-1.5 text-[13px] font-semibold text-[#0f766e] hover:bg-[#f0faf7]">{label}</Link></li>
);
