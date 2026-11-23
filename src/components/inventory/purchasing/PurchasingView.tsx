"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import SelectMenu from "@/components/ui/SelectMenu";
import ExportModal, { ExportModule } from "@/components/customers/ExportModal";
import { EmptyBox, NewButton, card, pageWrap, useFmt } from "@/components/inventory/PageBits";
import { CartArt, ValueArt } from "@/components/inventory/KpiArt";
import { useInvTx } from "@/i18n/useInvTx";
import { InvItem, InvLocation, InvStock, KitRow, qtyFmt } from "@/lib/inventory";
import { shoppingList } from "@/lib/inventory-insights";
import { ItemSupplier, PO_META, PO_STATUSES, PoLine, PoStatus, PurchaseOrder, Supplier, poOpen, toBuyUnits } from "@/lib/purchasing";
import type { BuyInfo } from "@/lib/purchasing-server";

// =====================================================================
// Paso 6.14 · Compras (Inventory → Purchasing): Órdenes · Por comprar · Proveedores
// =====================================================================
export type PurchTab = "orders" | "tobuy" | "suppliers";
type Props = {
  tab: PurchTab; needsSql: boolean; suppliers: Supplier[]; orders: PurchaseOrder[]; lines: PoLine[]; links: ItemSupplier[]; buying: Record<string, BuyInfo>;
  items: InvItem[]; stock: InvStock[]; locations: InvLocation[]; kit: KitRow[];
};

export default function PurchasingView(p: Props) {
  const t = useTranslations("purch");
  const ix = useInvTx();
  const router = useRouter();
  const [exportOpen, setExportOpen] = useState<ExportModule | null>(null);
  const tabs: PurchTab[] = ["orders", "tobuy", "suppliers"];
  const supName = (id: string | null) => p.suppliers.find((s) => s.id === id)?.name ?? t("noSupplier");

  return (
    <>
      <div className="border-b border-slate-200 bg-white px-4 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3 pt-4">
          <div className="pb-2">
            <h1 className="text-[20px] font-semibold tracking-tight text-[#0b1f3a] lg:text-[22px]">{t("title")}</h1>
            <p className="text-[13.5px] text-slate-500">{t("subtitle")}</p>
          </div>
          <div className="flex items-center gap-2 pb-2">
            {p.tab !== "tobuy" && (
              <button type="button" onClick={() => setExportOpen(p.tab === "suppliers" ? "Suppliers" : "Purchase orders")}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-[14px] font-medium text-slate-700 transition-all hover:-translate-y-0.5 hover:border-[#14a39a] hover:text-[#0f766e]">
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>{t("export")}
              </button>
            )}
            {p.tab === "suppliers" ? <NewButton href="/dashboard/inventory/purchasing/suppliers/new" label={t("newSupplier")} /> : <NewButton href="/dashboard/inventory/purchasing/new" label={t("newOrder")} />}
          </div>
        </div>
        <div role="tablist" className="-mb-px flex gap-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((k) => (
            <Link key={k} prefetch={false} role="tab" aria-selected={p.tab === k} href={`/dashboard/inventory/purchasing?tab=${k}`}
              className={`relative shrink-0 whitespace-nowrap py-3 text-[15px] transition-colors ${p.tab === k ? "font-semibold text-[#0f766e]" : "text-slate-600 hover:text-[#0b1f3a]"}`}>
              {t(`tab.${k}`)}<span className={`absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-[#0f766e] transition-transform duration-200 ${p.tab === k ? "scale-x-100" : "scale-x-0"}`} />
            </Link>
          ))}
        </div>
      </div>
      <div className={pageWrap}>
        {p.needsSql && <p className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-[14px] text-amber-800 ring-1 ring-amber-200">{t("eSql")}</p>}
        {p.tab === "orders" && <Orders {...p} supName={supName} />}
        {p.tab === "tobuy" && <ToBuy {...p} onCreate={(sup, lines) => router.push(`/dashboard/inventory/purchasing/new?${sup ? `supplier=${sup}&` : ""}lines=${lines.map((l) => `${l.item}:${l.qty}`).join(",")}`)} />}
        {p.tab === "suppliers" && <Suppliers {...p} money={ix.money} />}
      </div>
      <ExportModal open={exportOpen !== null} onClose={() => setExportOpen(null)} initialModule={exportOpen ?? "Purchase orders"} />
    </>
  );
}

// ---------- Órdenes ----------
function Orders({ orders, lines, supName }: Props & { supName: (id: string | null) => string }) {
  const t = useTranslations("purch");
  const ix = useInvTx();
  const { fmtDay } = useFmt();
  const [status, setStatus] = useState<"all" | "open" | PoStatus>("all");
  const [q, setQ] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + "01";
  const prog = useMemo(() => {
    // Avance por valor (no por cantidad: una caja de 100 no pesa igual que una pieza)
    const m = new Map<string, { qty: number; rec: number; n: number }>();
    for (const l of lines) { const x = m.get(l.po_id) ?? { qty: 0, rec: 0, n: 0 }; const w = l.unit_cost > 0 ? l.unit_cost : 1; x.qty += l.qty * w; x.rec += Math.min(l.received, l.qty) * w; x.n += 1; m.set(l.po_id, x); }
    return m;
  }, [lines]);
  const list = orders.filter((o) => (status === "all" ? true : status === "open" ? poOpen(o.status) : o.status === status)
    && `${o.number} ${supName(o.supplier_id)} ${o.notes ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()));
  const open = orders.filter((o) => poOpen(o.status));
  const openValue = open.reduce((a, o) => { const pr = prog.get(o.id); return a + (pr && pr.qty ? o.total * (1 - pr.rec / pr.qty) : o.total); }, 0);
  const late = open.filter((o) => o.expected_date && o.expected_date < today).length;
  const bought = orders.filter((o) => (o.status === "received" || o.status === "partial") && (o.received_at ?? o.ordered_at ?? o.created_at).slice(0, 10) >= monthStart)
    .reduce((a, o) => { const pr = prog.get(o.id); return a + (pr && pr.qty ? o.total * (pr.rec / pr.qty) : 0); }, 0);

  if (!orders.length) return (
    <EmptyBox title={t("noOrders")} text={t("noOrdersText")}>
      <NewButton href="/dashboard/inventory/purchasing/new" label={t("newOrder")} />
      <Link prefetch={false} href="/dashboard/inventory/purchasing?tab=tobuy" className="inline-flex h-10 items-center rounded-lg border border-slate-200 px-4 text-[15px] font-medium text-slate-700 hover:border-[#14a39a] hover:text-[#0f766e]">{t("seeToBuy")}</Link>
    </EmptyBox>
  );
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={t("kOpen")} value={String(open.length)} sub={ix.money(openValue)} Art={CartArt} />
        <Kpi label={t("kLate")} value={String(late)} sub={t("kLateSub")} tone={late ? "text-[#be123c]" : undefined} />
        <Kpi label={t("kDrafts")} value={String(orders.filter((o) => o.status === "draft").length)} sub={t("kDraftsSub")} />
        <Kpi label={t("kBought")} value={ix.money(bought)} sub={t("kBoughtSub")} Art={ValueArt} />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchOrders")}
          className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3.5 text-[14.5px] focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15 sm:max-w-sm" />
        <div className="w-[190px]">
          <SelectMenu ariaLabel={t("status")} value={status} onChange={(v) => setStatus(v as typeof status)}
            options={[{ value: "all", label: t("allStatus") }, { value: "open", label: t("openOnly") }, ...PO_STATUSES.map((s) => ({ value: s, label: t(`st.${s}`) }))]} />
        </div>
      </div>
      <section className={`${card} mt-4 overflow-hidden`}>
        <div className="hidden grid-cols-[7rem_minmax(0,2fr)_8rem_8rem_8rem_minmax(0,1fr)_7.5rem] gap-x-4 border-b border-slate-100 bg-[#fafbfc] px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-slate-500 lg:grid">
          <span>{t("h.number")}</span><span>{t("h.supplier")}</span><span>{t("h.status")}</span><span>{t("h.date")}</span><span>{t("h.expected")}</span><span>{t("h.received")}</span><span className="text-right">{t("h.total")}</span>
        </div>
        {list.length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-500">{t("noMatch")}</p> : (
          <div className="divide-y divide-slate-100">
            {list.map((o) => {
              const pr = prog.get(o.id) ?? { qty: 0, rec: 0, n: 0 };
              const pct = pr.qty ? Math.round((pr.rec / pr.qty) * 100) : 0;
              const isLate = poOpen(o.status) && o.expected_date && o.expected_date < today;
              return (
                <Link key={o.id} prefetch={false} href={`/dashboard/inventory/purchasing/${o.id}`}
                  className="grid grid-cols-2 items-center gap-x-4 gap-y-1 px-4 py-3 text-[14px] transition-colors hover:bg-[#f0faf7] lg:grid-cols-[7rem_minmax(0,2fr)_8rem_8rem_8rem_minmax(0,1fr)_7.5rem]">
                  <span className="font-semibold text-[#0f766e]">{o.number}</span>
                  <span className="min-w-0 truncate text-right font-medium text-[#0b1f3a] lg:text-left">{supName(o.supplier_id)}<span className="block truncate text-[12.5px] font-normal text-slate-500">{t("nLines", { n: pr.n })}</span></span>
                  <span><StatusBadge s={o.status} /></span>
                  <span className="text-right text-slate-600 lg:text-left">{fmtDay(`${o.order_date}T12:00:00`)}</span>
                  <span className={isLate ? "font-semibold text-[#be123c]" : "text-slate-600"}>{o.expected_date ? fmtDay(`${o.expected_date}T12:00:00`) : "—"}{isLate ? ` · ${t("late")}` : ""}</span>
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-full max-w-[120px] overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-[#14a39a] transition-all" style={{ width: `${pct}%` }} /></span>
                    <span className="text-[12.5px] tabular-nums text-slate-500">{pct}%</span>
                  </span>
                  <span className="col-span-2 text-right font-semibold tabular-nums text-[#0b1f3a] lg:col-span-1">{ix.money(o.total)}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

export function StatusBadge({ s }: { s: PoStatus }) {
  const t = useTranslations("purch");
  const m = PO_META[s];
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1 ${m.badge}`}><span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />{t(`st.${s}`)}</span>;
}

function Kpi({ label, value, sub, tone, Art }: { label: string; value: string; sub?: string; tone?: string; Art?: (p: { size?: number }) => JSX.Element }) {
  return (
    <div className={`${card} group flex items-center gap-3 p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,40,60,0.06)]`}>
      {Art && <span className="hidden shrink-0 transition-transform duration-200 group-hover:scale-110 sm:block"><Art size={40} /></span>}
      <div className="min-w-0">
        <p className="truncate text-[12.5px] font-medium text-slate-500">{label}</p>
        <p className={`mt-0.5 truncate text-[20px] font-semibold tabular-nums ${tone ?? "text-[#0b1f3a]"}`}>{value}</p>
        {sub && <p className="truncate text-[12px] text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}

// ---------- Por comprar (lista de compras → órdenes por proveedor) ----------
function ToBuy({ items, stock, locations, kit, links, suppliers, buying, orders, lines, onCreate }: Props & { onCreate: (sup: string | null, lines: { item: string; qty: number }[]) => void }) {
  const t = useTranslations("purch");
  const ix = useInvTx();
  // Lo que ya está pedido y no ha llegado (en piezas)
  const onOrder = useMemo(() => {
    const open = new Set(orders.filter((o) => poOpen(o.status) || o.status === "draft").map((o) => o.id));
    const m = new Map<string, number>();
    for (const l of lines) if (open.has(l.po_id)) m.set(l.item_id, (m.get(l.item_id) ?? 0) + Math.max(0, l.qty - l.received) * l.per_unit);
    return m;
  }, [orders, lines]);
  const rows = useMemo(() => shoppingList(items.filter((i) => !buying[i.id]?.discontinued), stock, locations, kit).map((r) => {
    const b = buying[r.item.id] ?? { purchase_unit: null, per: 1, consumable: false, discontinued: false };
    const pref = links.find((l) => l.item_id === r.item.id && l.is_preferred) ?? links.find((l) => l.item_id === r.item.id);
    const ordered = onOrder.get(r.item.id) ?? 0;
    const left = Math.max(0, r.need - ordered);
    const buyQty = toBuyUnits(left || r.need, b.per);
    const price = pref?.cost != null ? pref.cost : r.item.cost_price * b.per;
    return { ...r, b, sup: pref?.supplier_id ?? null, ordered, left, buyQty, price };
  }), [items, stock, locations, kit, links, buying, onOrder]);
  const [off, setOff] = useState<Set<string>>(() => new Set(rows.filter((r) => r.left <= 0).map((r) => r.item.id)));
  const groups = useMemo(() => {
    const m = new Map<string, typeof rows>();
    rows.forEach((r) => { const k = r.sup ?? ""; m.set(k, [...(m.get(k) ?? []), r]); });
    return Array.from(m.entries()).sort((a, b) => (a[0] ? 0 : 1) - (b[0] ? 0 : 1) || (suppliers.find((s) => s.id === a[0])?.name ?? "").localeCompare(suppliers.find((s) => s.id === b[0])?.name ?? ""));
  }, [rows, suppliers]);

  if (!rows.length) return <EmptyBox title={t("nothingToBuy")} text={t("nothingToBuyText")} />;
  return (
    <>
      <p className="rounded-xl bg-[#f3fbf8] px-4 py-3 text-[13.5px] text-[#0b3d38] ring-1 ring-[#bfe6da]">{t("toBuyHint")}</p>
      {groups.map(([sup, g]) => {
        const picked = g.filter((r) => !off.has(r.item.id));
        const total = picked.reduce((a, r) => a + r.buyQty * r.price, 0);
        return (
          <section key={sup || "none"} className={`${card} mt-4 overflow-hidden`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-[#fafbfc] px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-[15.5px] font-semibold text-[#0b1f3a]">{sup ? suppliers.find((s) => s.id === sup)?.name ?? t("noSupplier") : t("noSupplier")}</p>
                <p className="text-[12.5px] text-slate-500">{t("pickedOf", { n: picked.length, total: g.length })} · {ix.money(total)}</p>
              </div>
              <button type="button" disabled={!picked.length} onClick={() => onCreate(sup || null, picked.map((r) => ({ item: r.item.id, qty: r.buyQty })))}
                className="group/c inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#0f766e] px-3.5 text-[14px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#0c5f59] disabled:opacity-50">
                <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform duration-200 group-hover/c:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>{t("createOrder")}
              </button>
            </div>
            <ul className="divide-y divide-slate-100">
              {g.map((r) => {
                const on = !off.has(r.item.id);
                return (
                  <li key={r.item.id}>
                    <label className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-[#f6fbfa] ${on ? "" : "opacity-60"}`}>
                      <input type="checkbox" checked={on} onChange={() => setOff((s) => { const n = new Set(s); if (n.has(r.item.id)) n.delete(r.item.id); else n.add(r.item.id); return n; })}
                        className="h-4 w-4 shrink-0 rounded border-slate-300 accent-[#0f766e]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-[#0b1f3a]">{r.item.name}{r.b.consumable && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{t("consumable")}</span>}</span>
                        <span className="block truncate text-[12.5px] text-slate-500">
                          {t("needLine", { need: qtyFmt(r.need), unit: r.item.unit ?? "", have: qtyFmt(r.onHand) })}{r.places.length ? ` · ${r.places.slice(0, 3).join(", ")}` : ""}
                          {r.ordered > 0 && <span className="font-semibold text-[#1d4ed8]"> · {t("onOrder", { n: qtyFmt(r.ordered) })}</span>}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[14px] font-semibold tabular-nums text-[#0b1f3a]">{r.b.per > 1 ? t("buyAs", { n: r.buyQty, pu: r.b.purchase_unit || t("box"), per: qtyFmt(r.b.per) }) : `${r.buyQty} ${r.item.unit ?? ""}`}</span>
                        <span className="block text-[12.5px] tabular-nums text-slate-500">{ix.money(r.buyQty * r.price)}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </>
  );
}

// ---------- Proveedores ----------
function Suppliers({ suppliers, links, orders, lines, money }: Props & { money: (v: number) => string }) {
  const t = useTranslations("purch");
  const [q, setQ] = useState("");
  const year = String(new Date().getFullYear());
  const spent = useMemo(() => {
    const byPo = new Map<string, { qty: number; rec: number }>();
    lines.forEach((l) => { const x = byPo.get(l.po_id) ?? { qty: 0, rec: 0 }; const w = l.unit_cost > 0 ? l.unit_cost : 1; x.qty += l.qty * w; x.rec += Math.min(l.received, l.qty) * w; byPo.set(l.po_id, x); });
    const m = new Map<string, number>();
    orders.filter((o) => o.supplier_id && (o.status === "received" || o.status === "partial") && (o.received_at ?? o.created_at).startsWith(year))
      .forEach((o) => { const p = byPo.get(o.id); m.set(o.supplier_id as string, (m.get(o.supplier_id as string) ?? 0) + (p && p.qty ? o.total * (p.rec / p.qty) : 0)); });
    return m;
  }, [orders, lines, year]);
  const list = suppliers.filter((s) => `${s.name} ${s.contact_name ?? ""} ${s.phone ?? ""} ${s.email ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()));
  if (!suppliers.length) return (
    <EmptyBox title={t("noSuppliers")} text={t("noSuppliersText")}>
      <NewButton href="/dashboard/inventory/purchasing/suppliers/new" label={t("newSupplier")} />
    </EmptyBox>
  );
  return (
    <>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchSuppliers")}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-[14.5px] focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15 sm:max-w-sm" />
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map((s) => {
          const n = links.filter((l) => l.supplier_id === s.id).length;
          const open = orders.filter((o) => o.supplier_id === s.id && poOpen(o.status)).length;
          return (
            <Link key={s.id} prefetch={false} href={`/dashboard/inventory/purchasing/suppliers/${s.id}`}
              className={`${card} group block p-4 transition-all hover:-translate-y-0.5 hover:border-[#14a39a] hover:shadow-[0_10px_24px_rgba(15,40,60,0.07)] ${s.is_active ? "" : "opacity-60"}`}>
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#2bb3a4] to-[#0f766e] text-[16px] font-bold text-white transition-transform duration-200 group-hover:scale-105">{s.name.slice(0, 1).toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15.5px] font-semibold text-[#0b1f3a]">{s.name}</span>
                  <span className="block truncate text-[13px] text-slate-500">{[s.contact_name, s.phone, s.email].filter(Boolean).join(" · ") || t("noContact")}</span>
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[[t("sItems"), String(n)], [t("sOpen"), String(open)], [t("sSpent", { y: year }), money(spent.get(s.id) ?? 0)]].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-slate-50 px-2 py-1.5"><p className="truncate text-[11px] text-slate-500">{k}</p><p className="truncate text-[14px] font-semibold tabular-nums text-[#0b1f3a]">{v}</p></div>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
