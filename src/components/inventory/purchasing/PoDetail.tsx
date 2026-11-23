"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { askConfirm } from "@/lib/confirm";
import { MoreMenu, PencilButton, ICONS } from "@/components/catalog/DetailBits";
import { Modal, Toast, btnGhost, btnPrimary } from "@/components/sales/SalesBits";
import SelectMenu from "@/components/ui/SelectMenu";
import { PageHead, card, pageWrap, useFmt } from "@/components/inventory/PageBits";
import { StatusBadge } from "@/components/inventory/purchasing/PurchasingView";
import { useInvTx } from "@/i18n/useInvTx";
import { InvItem, InvLocation, pingAlerts, qtyFmt } from "@/lib/inventory";
import { ItemSupplier, PoLine, PurchaseOrder, Supplier, lineTotal, poErrKey, poOpen } from "@/lib/purchasing";
import { buildReportPdf, pdfFileName } from "@/lib/report-pdf";
import { showPdf } from "@/components/inventory/PdfViewer";

// =====================================================================
// Paso 6.14 · Ficha de la orden de compra: recibir (todo o parte), marcar como pedida, PDF para el proveedor
// =====================================================================
export default function PoDetail({ companyId, company, po, lines, supplier, links, items, locations, saved }: {
  companyId: string; company: string; po: PurchaseOrder; lines: PoLine[]; supplier: Supplier | null; links: ItemSupplier[]; items: InvItem[]; locations: InvLocation[]; saved?: string;
}) {
  const t = useTranslations("poDetail");
  const tp = useTranslations("purch");
  const ix = useInvTx();
  const { fmtDay, fmtWhen } = useFmt();
  const router = useRouter();
  const [toast, setToast] = useState(saved === "ordered" ? t("savedOrdered") : saved ? t("saved") : "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [receiving, setReceiving] = useState(false);
  useEffect(() => { if (toast) { const tm = setTimeout(() => setToast(""), 2800); return () => clearTimeout(tm); } }, [toast]);
  const item = (id: string) => items.find((i) => i.id === id);
  const sku = (id: string) => links.find((l) => l.item_id === id && l.supplier_id === po.supplier_id)?.supplier_sku ?? null;
  const unitLabel = (l: PoLine) => (l.per_unit > 1 || l.buy_unit ? `${l.buy_unit ?? tp("box")} × ${qtyFmt(l.per_unit)}` : item(l.item_id)?.unit ?? t("each"));
  const left = (l: PoLine) => Math.max(0, l.qty - l.received);
  const pending = lines.filter((l) => left(l) > 0);
  const editable = po.status === "draft" || po.status === "ordered";
  const canReceive = po.status !== "received" && po.status !== "cancelled" && pending.length > 0;
  const locName = locations.find((l) => l.id === po.location_id)?.name ?? "—";
  const today = new Date().toISOString().slice(0, 10);
  const late = poOpen(po.status) && po.expected_date && po.expected_date < today;

  async function rpc(fn: string, args: Record<string, unknown>, ok: string) {
    setBusy(true); setErr("");
    const { error } = await createClient().rpc(fn, args);
    setBusy(false);
    if (error) return setErr(tp(poErrKey(error) as never));
    setToast(ok); router.refresh();
  }
  async function cancel() {
    if (!(await askConfirm({ title: t("cancelQ", { n: po.number }), message: t("cancelMsg"), confirmLabel: t("cancelYes"), tone: "danger" }))) return;
    rpc("po_set_status", { p_po: po.id, p_status: "cancelled" }, t("cancelled"));
  }
  async function remove() {
    if (!(await askConfirm({ title: t("deleteQ", { n: po.number }), message: t("deleteMsg"), confirmLabel: t("deleteYes"), tone: "danger" }))) return;
    setBusy(true);
    const { error } = await createClient().rpc("po_delete", { p_po: po.id });
    setBusy(false);
    if (error) return setErr(tp(poErrKey(error) as never));
    router.replace("/dashboard/inventory/purchasing"); router.refresh();
  }
  async function closeShort() {
    if (!(await askConfirm({ title: t("closeQ"), message: t("closeMsg"), confirmLabel: t("closeYes") }))) return;
    rpc("po_close", { p_po: po.id }, t("closed"));
  }
  async function pdf() {
    const ship = locations.find((l) => l.id === po.location_id);
    const bytes = await buildReportPdf({
      title: `${t("pdfTitle")} ${po.number}`, subtitle: [supplier?.name, supplier?.phone, supplier?.email].filter(Boolean).join(" · "), company, fileName: pdfFileName("purchase-order", po.number),
      lang: ix.locale.startsWith("es") ? "es" : "en",
      blocks: [
        { type: "kpis", items: [{ label: t("orderDate"), value: fmtDay(`${po.order_date}T12:00:00`) }, { label: t("expected"), value: po.expected_date ? fmtDay(`${po.expected_date}T12:00:00`) : "—" }, { label: t("shipTo"), value: ship?.name ?? "—" }, { label: t("total"), value: ix.money(po.total) }] },
        {
          type: "table",
          columns: [{ label: t("h.item"), width: 4 }, { label: t("h.theirSku"), width: 2 }, { label: t("h.qty"), width: 1.2, align: "right" }, { label: t("h.unit"), width: 1.8 }, { label: t("h.price"), width: 1.4, align: "right" }, { label: t("h.amount"), width: 1.5, align: "right" }],
          rows: [
            ...lines.map((l) => ({ cells: [item(l.item_id)?.name ?? "—", sku(l.item_id) ?? item(l.item_id)?.sku ?? "", qtyFmt(l.qty), unitLabel(l), ix.money(l.unit_cost), ix.money(lineTotal(l))] })),
            { cells: [t("total"), "", "", "", "", ix.money(po.total)], style: "total" as const },
          ],
        },
        ...(po.notes ? [{ type: "note" as const, text: po.notes }] : []),
        ...(supplier?.account_no ? [{ type: "note" as const, text: `${t("account")}: ${supplier.account_no}` }] : []),
      ],
    });
    showPdf(bytes, pdfFileName("purchase-order", po.number));
  }

  const actions = [
    ...(editable ? [{ label: t("edit"), href: `/dashboard/inventory/purchasing/${po.id}/edit`, icon: "M13.5 3.5l3 3L7 16H4v-3z" }] : []),
    { label: t("pdf"), onClick: pdf, icon: "M6 3h7l5 5v13H6zM13 3v5h5M9 13h6M9 16h6" },
    ...(po.status === "partial" ? [{ label: t("closeShort"), onClick: closeShort, icon: "M5 12l4 4 10-10" }] : []),
    ...(editable && !lines.some((l) => l.received > 0) ? [{ label: t("cancelPo"), onClick: cancel, danger: true, icon: "M6 6l12 12M18 6 6 18" }] : []),
    ...(po.status === "draft" ? [{ label: t("delete"), onClick: remove, danger: true, icon: ICONS.trash }] : []),
  ];

  return (
    <div className={pageWrap}>
      <PageHead back="/dashboard/inventory/purchasing" title={po.number} subtitle={supplier?.name ?? tp("noSupplier")}>
        <StatusBadge s={po.status} />
        {po.status === "draft" && (
          <button type="button" disabled={busy} onClick={() => rpc("po_set_status", { p_po: po.id, p_status: "ordered" }, t("markedOrdered"))}
            className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-3.5 text-[14px] font-semibold text-slate-700 transition-all hover:-translate-y-0.5 hover:border-[#14a39a] hover:text-[#0f766e]">{t("markOrdered")}</button>
        )}
        {canReceive && (
          <button type="button" onClick={() => setReceiving(true)}
            className="group/r inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#0f766e] px-4 text-[14px] font-semibold text-white shadow-sm shadow-[#0f766e]/30 transition-all hover:-translate-y-0.5 hover:bg-[#0c5f59]">
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] transition-transform duration-200 group-hover/r:translate-y-0.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v12M6 10l6 6 6-6M5 20h14" /></svg>{t("receive")}
          </button>
        )}
        {editable && <PencilButton href={`/dashboard/inventory/purchasing/${po.id}/edit`} label={t("edit")} />}
        <MoreMenu dots actions={actions} />
      </PageHead>
      {err && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [t("orderDate"), fmtDay(`${po.order_date}T12:00:00`), po.created_by_name ? t("byX", { x: po.created_by_name }) : ""],
          [t("expected"), po.expected_date ? fmtDay(`${po.expected_date}T12:00:00`) : "—", late ? t("late") : supplier?.lead_days ? t("leadDays", { n: supplier.lead_days }) : ""],
          [t("shipTo"), locName, po.received_at ? t("receivedOn", { d: fmtWhen(po.received_at) }) : ""],
          [t("total"), ix.money(po.total), t("nLines", { n: lines.length })],
        ].map(([k, v, s]) => (
          <div key={k} className={`${card} p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,40,60,0.06)]`}>
            <p className="text-[12.5px] font-medium text-slate-500">{k}</p>
            <p className="mt-0.5 truncate text-[18px] font-semibold tabular-nums text-[#0b1f3a]">{v}</p>
            {s && <p className={`truncate text-[12.5px] ${s === t("late") ? "font-semibold text-[#be123c]" : "text-slate-500"}`}>{s}</p>}
          </div>
        ))}
      </div>

      <section className={`${card} mt-5 overflow-hidden`}>
        <div className="hidden grid-cols-[minmax(0,2.4fr)_9rem_6rem_6rem_7rem_7.5rem] gap-x-4 border-b border-slate-100 bg-[#fafbfc] px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-slate-500 lg:grid">
          <span>{t("h.item")}</span><span>{t("h.unit")}</span><span>{t("h.ordered")}</span><span>{t("h.received")}</span><span className="text-right">{t("h.price")}</span><span className="text-right">{t("h.amount")}</span>
        </div>
        <ul className="divide-y divide-slate-100">
          {lines.map((l) => {
            const it = item(l.item_id);
            const done = l.received >= l.qty;
            return (
              <li key={l.id} className="px-4 py-3 text-[14px]">
                {/* Celular: compacto */}
                <div className="flex items-start gap-3 lg:hidden">
                  <span className="min-w-0 flex-1">
                    {it ? <Link prefetch={false} href={`/dashboard/inventory/${it.id}`} className="block truncate font-medium text-[#0b1f3a]">{it.name}</Link> : <span className="block truncate text-slate-500">—</span>}
                    <span className="block truncate text-[12.5px] text-slate-500">{qtyFmt(l.qty)} × {unitLabel(l)} · {ix.money(l.unit_cost)}</span>
                    <span className={`block text-[12.5px] font-semibold ${done ? "text-[#0f766e]" : l.received > 0 ? "text-[#b45309]" : "text-slate-400"}`}>{t("h.received")}: {qtyFmt(l.received)}{done ? " ✓" : ""}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-[#0b1f3a]">{ix.money(lineTotal(l))}</span>
                </div>
                <div className="hidden items-center gap-x-4 lg:grid lg:grid-cols-[minmax(0,2.4fr)_9rem_6rem_6rem_7rem_7.5rem]">
                  <span className="min-w-0">
                    {it ? <Link prefetch={false} href={`/dashboard/inventory/${it.id}`} className="block truncate font-medium text-[#0b1f3a] hover:text-[#0f766e]">{it.name}</Link> : <span className="block truncate text-slate-500">—</span>}
                    <span className="block truncate font-mono text-[12px] text-slate-400">{sku(l.item_id) ? t("theirSku", { sku: sku(l.item_id) as string }) : it?.sku}</span>
                  </span>
                  <span className="text-slate-600">{unitLabel(l)}</span>
                  <span className="tabular-nums text-slate-700">{qtyFmt(l.qty)}</span>
                  <span className={`tabular-nums font-semibold ${done ? "text-[#0f766e]" : l.received > 0 ? "text-[#b45309]" : "text-slate-400"}`}>{qtyFmt(l.received)}{done ? " ✓" : ""}</span>
                  <span className="text-right tabular-nums text-slate-700">{ix.money(l.unit_cost)}</span>
                  <span className="text-right font-semibold tabular-nums text-[#0b1f3a]">{ix.money(lineTotal(l))}</span>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="flex justify-end gap-4 border-t border-slate-100 bg-[#fafbfc] px-4 py-3 text-[15px]"><span className="text-slate-500">{t("total")}</span><b className="tabular-nums text-[#0b1f3a]">{ix.money(po.total)}</b></p>
      </section>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {supplier && (
          <section className={`${card} p-4`}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[15px] font-semibold text-[#0b1f3a]">{t("supplier")}</p>
              <Link prefetch={false} href={`/dashboard/inventory/purchasing/suppliers/${supplier.id}`} className="text-[13.5px] font-medium text-[#0f766e] hover:underline">{t("openSupplier")}</Link>
            </div>
            <dl className="mt-2 grid gap-1.5 text-[14px] sm:grid-cols-2">
              {[[t("contact"), supplier.contact_name], [t("phone"), supplier.phone], [t("email"), supplier.email], [t("account"), supplier.account_no], [t("terms"), supplier.payment_terms]].filter(([, v]) => v).map(([k, v]) => (
                <div key={k as string}><dt className="text-[12px] text-slate-500">{k}</dt><dd className="truncate text-[#0b1f3a]">{v}</dd></div>
              ))}
            </dl>
          </section>
        )}
        {po.notes && <section className={`${card} p-4`}><p className="text-[15px] font-semibold text-[#0b1f3a]">{t("notes")}</p><p className="mt-1 whitespace-pre-line text-[14px] text-slate-700">{po.notes}</p></section>}
      </div>

      <ReceiveModal open={receiving} onClose={() => setReceiving(false)} po={po} lines={pending} item={item} unitLabel={unitLabel} locations={locations}
        onDone={(status) => { setReceiving(false); pingAlerts(); setToast(status === "received" ? t("receivedAll") : t("receivedPart")); router.refresh(); }} />
      <Toast text={toast} />
    </div>
  );
}

function ReceiveModal({ open, onClose, po, lines, item, unitLabel, locations, onDone }: {
  open: boolean; onClose: () => void; po: PurchaseOrder; lines: PoLine[]; item: (id: string) => InvItem | undefined; unitLabel: (l: PoLine) => string;
  locations: InvLocation[]; onDone: (status: string) => void;
}) {
  const t = useTranslations("poDetail");
  const tp = useTranslations("purch");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [loc, setLoc] = useState(po.location_id ?? locations.find((l) => l.is_default)?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const left = (l: PoLine) => Math.max(0, l.qty - l.received);
  useEffect(() => { if (open) { setQty(Object.fromEntries(lines.map((l) => [l.id, qtyFmt(left(l))]))); setErr(""); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  async function go() {
    const list = lines.map((l) => ({ line: l.id, qty: Number(qty[l.id]) || 0 })).filter((x) => x.qty > 0);
    if (!list.length) return setErr(t("eNone"));
    for (const x of list) { const l = lines.find((y) => y.id === x.line)!; if (x.qty > left(l) + 1e-9) return setErr(t("eMore", { name: item(l.item_id)?.name ?? "" })); }
    setBusy(true);
    const { data, error } = await createClient().rpc("po_receive", { p_po: po.id, p_lines: list, p_location: loc || null });
    setBusy(false);
    if (error) return setErr(tp(poErrKey(error) as never));
    onDone(String(data ?? ""));
  }
  return (
    <Modal open={open} onClose={onClose} title={t("receiveTitle", { n: po.number })} width="max-w-2xl"
      footer={<><button type="button" disabled={busy} onClick={go} className={btnPrimary}>{busy ? t("receiving") : t("receiveNow")}</button><button type="button" onClick={onClose} className={btnGhost}>{t("cancel")}</button>{err && <p role="alert" className="text-sm text-red-600">{err}</p>}</>}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-[14px] text-slate-600">{t("into")}</span>
        <div className="w-[240px]"><SelectMenu ariaLabel={t("into")} value={loc} onChange={setLoc} options={locations.map((l) => ({ value: l.id, label: l.name }))} /></div>
        <button type="button" onClick={() => setQty(Object.fromEntries(lines.map((l) => [l.id, qtyFmt(left(l))])))} className="ml-auto text-[13.5px] font-semibold text-[#0f766e] hover:underline">{t("all")}</button>
        <button type="button" onClick={() => setQty({})} className="text-[13.5px] font-medium text-slate-500 hover:underline">{t("none")}</button>
      </div>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
        {lines.map((l) => {
          const it = item(l.item_id);
          const n = Number(qty[l.id]) || 0;
          return (
            <li key={l.id} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-medium text-[#0b1f3a]">{it?.name ?? "—"}</span>
                <span className="block truncate text-[12.5px] text-slate-500">{t("pendingOf", { n: qtyFmt(left(l)), u: unitLabel(l) })}{l.per_unit > 1 && n > 0 ? ` · ${t("entersAs", { n: qtyFmt(n * l.per_unit), unit: it?.unit ?? "" })}` : ""}</span>
              </span>
              <input inputMode="decimal" value={qty[l.id] ?? ""} placeholder="0" aria-label={it?.name} onChange={(e) => setQty((x) => ({ ...x, [l.id]: e.target.value.replace(/[^0-9.]/g, "") }))}
                className="h-10 w-20 rounded-lg border border-slate-200 bg-slate-50 text-center text-[15px] font-semibold tabular-nums focus:border-[#0f766e] focus:bg-white focus:outline-none" />
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[13px] text-slate-500">{t("receiveHint")}</p>
    </Modal>
  );
}
