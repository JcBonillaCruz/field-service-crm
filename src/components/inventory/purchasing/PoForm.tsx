"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import SearchSelect from "@/components/ui/SearchSelect";
import SelectMenu from "@/components/ui/SelectMenu";
import DatePicker from "@/components/ui/DatePicker";
import { inputClass } from "@/components/customers/ui";
import { FormHeader, FormRow, SectionTitle } from "@/components/catalog/FormBits";
import { Modal, btnGhost, btnPrimary } from "@/components/sales/SalesBits";
import ItemPicker from "@/components/inventory/ItemPicker";
import { useInvTx } from "@/i18n/useInvTx";
import { InvItem, InvLocation, qtyFmt } from "@/lib/inventory";
import { ItemSupplier, PoLine, PurchaseOrder, Supplier, poErrKey } from "@/lib/purchasing";
import type { BuyInfo } from "@/lib/purchasing-server";

type Line = { key: string; item: InvItem; byBox: boolean; qty: string; cost: string };

// =====================================================================
// Paso 6.14 · Nueva / editar orden de compra (pantalla completa: solo el menú y el formulario)
//   Cada línea se pide por pieza o por su unidad de compra (Caja de 50); el precio es por esa unidad.
// =====================================================================
export default function PoForm({ companyId, po, poLines = [], suppliers: initialSups, links, items, buying, locations, barcodes = {}, initialSupplier, initialLines = [] }: {
  companyId: string; po?: PurchaseOrder; poLines?: PoLine[]; suppliers: Supplier[]; links: ItemSupplier[]; items: InvItem[]; buying: Record<string, BuyInfo>;
  locations: InvLocation[]; barcodes?: Record<string, string>; initialSupplier?: string; initialLines?: { item: string; qty: number }[];
}) {
  const t = useTranslations("poForm");
  const tp = useTranslations("purch");
  const ix = useInvTx();
  const router = useRouter();
  const back = po ? `/dashboard/inventory/purchasing/${po.id}` : "/dashboard/inventory/purchasing";
  const [suppliers, setSuppliers] = useState(initialSups);
  const [supplier, setSupplier] = useState(po?.supplier_id ?? (initialSupplier && initialSups.some((s) => s.id === initialSupplier) ? initialSupplier : ""));
  const home = locations.find((l) => l.is_default) ?? locations.find((l) => l.kind === "warehouse") ?? locations[0];
  const [location, setLocation] = useState(po?.location_id ?? home?.id ?? "");
  const [expected, setExpected] = useState(po?.expected_date ?? "");
  const [notes, setNotes] = useState(po?.notes ?? "");
  const [saving, setSaving] = useState<"" | "draft" | "ordered">("");
  const [error, setError] = useState("");
  const [newSup, setNewSup] = useState(false);
  const per = (id: string) => buying[id]?.per ?? 1;
  const pu = (id: string) => buying[id]?.purchase_unit || tp("box");
  const linkOf = (item: string, sup = supplier) => links.find((l) => l.item_id === item && l.supplier_id === sup);
  const defaultCost = (it: InvItem, byBox: boolean, sup = supplier) => {
    const l = linkOf(it.id, sup);
    const boxCost = l?.cost != null ? l.cost : it.cost_price * per(it.id);
    const v = byBox ? boxCost : per(it.id) > 1 ? boxCost / per(it.id) : boxCost;
    return v > 0 ? String(Math.round(v * 100) / 100) : "";
  };
  const make = (it: InvItem, qty: number, byBox = per(it.id) > 1): Line => ({ key: `${it.id}-${Math.random().toString(36).slice(2, 7)}`, item: it, byBox, qty: qtyFmt(qty), cost: defaultCost(it, byBox) });

  const [lines, setLines] = useState<Line[]>(() => {
    if (po) return poLines.map((l) => {
      const it = items.find((i) => i.id === l.item_id);
      return it ? { key: l.id, item: it, byBox: l.per_unit > 1 || Boolean(l.buy_unit), qty: qtyFmt(l.qty), cost: String(l.unit_cost) } : null;
    }).filter(Boolean) as Line[];
    return [];
  });
  const seeded = useRef(false);
  useEffect(() => {
    if (po || seeded.current || !initialLines.length) return;
    seeded.current = true;
    setLines(initialLines.map((l) => { const it = items.find((i) => i.id === l.item); return it ? make(it, l.qty) : null; }).filter(Boolean) as Line[]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pickable = useMemo(() => items.filter((i) => i.is_active && !buying[i.id]?.discontinued), [items, buying]);
  const total = lines.reduce((a, l) => a + (Number(l.qty) || 0) * (Number(l.cost) || 0), 0);
  const set = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const opts = locations.map((l) => ({ value: l.id, label: `${l.name}${l.kind === "van" ? ` · ${tp("van")}` : ""}` }));

  // Al cambiar de proveedor: los precios que nadie tocó toman los de ese proveedor
  function changeSupplier(v: string) {
    setLines((ls) => ls.map((l) => (l.cost === defaultCost(l.item, l.byBox) ? { ...l, cost: defaultCost(l.item, l.byBox, v) } : l)));
    setSupplier(v);
  }

  async function save(status: "draft" | "ordered") {
    setError("");
    if (!lines.length) return setError(tp("eLines"));
    for (const l of lines) if (!(Number(l.qty) > 0)) return setError(t("eQty", { name: l.item.name }));
    setSaving(status);
    const { data, error: err } = await createClient().rpc("po_save", {
      p_company: companyId, p_id: po?.id ?? null, p_supplier: supplier || null, p_location: location || null, p_expected: expected || null, p_notes: notes,
      p_status: status,
      p_lines: lines.map((l) => ({ item: l.item.id, buy_unit: l.byBox ? pu(l.item.id) : null, per_unit: l.byBox ? per(l.item.id) : 1, qty: Number(l.qty), unit_cost: Number(l.cost) || 0 })),
    });
    if (err || !data) { setSaving(""); return setError(tp(poErrKey(err) as never)); }
    router.push(`/dashboard/inventory/purchasing/${data as string}?saved=${status}`); router.refresh();
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); save(po?.status === "ordered" ? "ordered" : "draft"); }} noValidate autoComplete="off" className="flex min-h-[calc(100vh-4rem)] flex-col bg-white">
      <FormHeader title={po ? t("editTitle", { n: po.number }) : t("newTitle")} closeHref={back} />
      <div className="flex-1">
        <div className="space-y-5 border-b border-slate-200 bg-[#fafbfc] px-5 py-6 sm:px-8">
          <FormRow label={t("supplier")} width="max-w-[420px]" hint={t("supplierHint")}>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <SearchSelect ariaLabel={t("supplier")} value={supplier} onChange={changeSupplier} placeholder={t("pickSupplier")}
                  options={suppliers.filter((s) => s.is_active || s.id === supplier).map((s) => ({ value: s.id, label: s.name, search: `${s.contact_name ?? ""} ${s.phone ?? ""}` }))} />
              </div>
              <button type="button" onClick={() => setNewSup(true)} className="group/n inline-flex h-[46px] shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-[14px] font-semibold text-[#0f766e] transition-colors hover:border-[#14a39a] hover:bg-[#e9f7f4]">
                <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform duration-200 group-hover/n:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>{t("newSupplier")}
              </button>
            </div>
          </FormRow>
          <FormRow label={t("receiveInto")} width="max-w-[360px]" hint={t("receiveHint")}>
            <SelectMenu ariaLabel={t("receiveInto")} value={location} onChange={setLocation} options={opts} />
          </FormRow>
          <FormRow label={t("expected")} width="max-w-[260px]" hint={t("expectedHint")}>
            <DatePicker value={expected} onChange={setExpected} />
          </FormRow>
        </div>

        <div className="px-5 py-7 sm:px-8">
          <SectionTitle>{t("items")}</SectionTitle>
          <div className="max-w-[980px] space-y-4">
            <ItemPicker barcodes={barcodes} items={pickable} onPick={(it) => { setError(""); setLines((ls) => [...ls, make(it, 1)]); }} onNotFound={(code) => setError(t("noCode", { code }))} />
            {lines.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">{t("empty")}</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="hidden grid-cols-[minmax(0,2fr)_11rem_6rem_8rem_7rem_2.5rem] gap-x-3 border-b border-slate-100 bg-[#fafbfc] px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-slate-500 md:grid">
                  <span>{t("h.item")}</span><span>{t("h.buyAs")}</span><span>{t("h.qty")}</span><span>{t("h.price")}</span><span className="text-right">{t("h.amount")}</span><span />
                </div>
                <ul className="divide-y divide-slate-100">
                  {lines.map((l) => {
                    const p = per(l.item.id);
                    const pieces = (Number(l.qty) || 0) * (l.byBox ? p : 1);
                    const sku = linkOf(l.item.id)?.supplier_sku;
                    return (
                      <li key={l.key} className="grid grid-cols-2 items-center gap-x-3 gap-y-2 px-4 py-3 md:grid-cols-[minmax(0,2fr)_11rem_6rem_8rem_7rem_2.5rem]">
                        <span className="col-span-2 min-w-0 md:col-span-1">
                          <span className="block truncate font-medium text-[#0b1f3a]">{l.item.name}</span>
                          <span className="block truncate text-[12.5px] text-slate-500">{[sku ? t("theirSku", { sku }) : l.item.sku, l.byBox && p > 1 ? t("entersAs", { n: qtyFmt(pieces), unit: l.item.unit ?? "" }) : null].filter(Boolean).join(" · ")}</span>
                        </span>
                        {p > 1 ? (
                          <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                            {[false, true].map((b) => (
                              <button key={String(b)} type="button" onClick={() => set(l.key, { byBox: b, cost: l.cost === defaultCost(l.item, l.byBox) ? defaultCost(l.item, b) : l.cost })}
                                className={`truncate rounded-md px-1.5 py-1.5 text-[12.5px] font-medium transition-all ${l.byBox === b ? "bg-white text-[#0f766e] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                                {b ? t("boxOf", { pu: pu(l.item.id), n: qtyFmt(p) }) : t("each")}
                              </button>
                            ))}
                          </div>
                        ) : <span className="text-[13px] text-slate-500">{l.item.unit ?? t("each")}</span>}
                        <input inputMode="decimal" value={l.qty} aria-label={t("h.qty")} onChange={(e) => set(l.key, { qty: e.target.value.replace(/[^0-9.]/g, "") })}
                          className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 text-center text-[15px] font-semibold tabular-nums focus:border-[#0f766e] focus:bg-white focus:outline-none" />
                        <div className="flex">
                          <span className="flex items-center rounded-l-lg border border-r-0 border-slate-200 bg-slate-100 px-2 text-[13px] text-slate-500">$</span>
                          <input inputMode="decimal" value={l.cost} placeholder="0.00" aria-label={t("h.price")} onChange={(e) => set(l.key, { cost: e.target.value.replace(/[^0-9.]/g, "") })}
                            className="h-10 w-full min-w-0 rounded-r-lg border border-slate-200 bg-slate-50 px-2 text-right text-[14.5px] tabular-nums focus:border-[#0f766e] focus:bg-white focus:outline-none" />
                        </div>
                        <span className="text-right text-[14.5px] font-semibold tabular-nums text-[#0b1f3a]">{ix.money((Number(l.qty) || 0) * (Number(l.cost) || 0))}</span>
                        <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label={t("remove")}
                          className="group/x flex h-9 w-9 items-center justify-center justify-self-end rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600">
                          <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform duration-300 group-hover/x:rotate-90" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="flex justify-end gap-4 border-t border-slate-100 bg-[#fafbfc] px-4 py-3 text-[15px]"><span className="text-slate-500">{t("total")}</span><b className="tabular-nums text-[#0b1f3a]">{ix.money(total)}</b></p>
              </div>
            )}
            <FormRow label={t("notes")} htmlFor="po-notes" alignTop width="max-w-[520px]">
              <textarea id="po-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("notesPh")} className={inputClass} />
            </FormRow>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 mt-10 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white px-5 py-3 sm:px-8">
        {po?.status === "ordered" ? (
          <button type="submit" disabled={Boolean(saving)} className={btnPrimary}>{saving ? t("saving") : t("save")}</button>
        ) : (
          <>
            <button type="button" disabled={Boolean(saving)} onClick={() => save("ordered")} className={btnPrimary}>{saving === "ordered" ? t("saving") : t("saveOrdered")}</button>
            <button type="submit" disabled={Boolean(saving)} className={btnGhost}>{saving === "draft" ? t("saving") : t("saveDraft")}</button>
          </>
        )}
        <Link prefetch={false} href={back} className="px-2 py-2.5 text-[15px] font-medium text-slate-600 hover:text-slate-900">{t("cancel")}</Link>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </div>

      <QuickSupplier open={newSup} onClose={() => setNewSup(false)} companyId={companyId}
        onCreated={(s) => { setSuppliers((l) => [...l, s].sort((a, b) => a.name.localeCompare(b.name))); changeSupplier(s.id); setNewSup(false); }} />
    </form>
  );
}

// Proveedor nuevo sin salir de la orden (nombre, teléfono, correo); lo demás se llena después
export function QuickSupplier({ open, onClose, companyId, onCreated }: { open: boolean; onClose: () => void; companyId: string; onCreated: (s: Supplier) => void }) {
  const t = useTranslations("poForm");
  const tp = useTranslations("purch");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { if (open) { setName(""); setPhone(""); setEmail(""); setErr(""); } }, [open]);
  async function create() {
    if (!name.trim()) return setErr(t("eName"));
    setBusy(true);
    const { data, error } = await createClient().from("inventory_suppliers").insert({ company_id: companyId, name: name.trim(), phone: phone.trim() || null, email: email.trim() || null })
      .select("id, name, contact_name, phone, email, website, account_no, address, payment_terms, lead_days, notes, is_active").single();
    setBusy(false);
    if (error || !data) return setErr(tp(poErrKey(error) as never));
    onCreated(data as Supplier);
  }
  return (
    <Modal open={open} onClose={onClose} title={t("newSupplier")}
      footer={<><button type="button" disabled={busy} onClick={create} className={btnPrimary}>{busy ? t("saving") : t("create")}</button><button type="button" onClick={onClose} className={btnGhost}>{t("cancel")}</button>{err && <p role="alert" className="text-sm text-red-600">{err}</p>}</>}>
      <div className="space-y-3">
        <input autoFocus value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} placeholder={t("supName")} className={inputClass} />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("supPhone")} inputMode="tel" className={inputClass} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("supEmail")} inputMode="email" className={inputClass} />
      </div>
    </Modal>
  );
}
