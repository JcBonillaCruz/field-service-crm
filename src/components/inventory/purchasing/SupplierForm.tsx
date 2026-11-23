"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { confirmDelete } from "@/lib/confirm";
import { inputClass } from "@/components/customers/ui";
import { FormHeader, FormRow, SaveBar, SectionTitle } from "@/components/catalog/FormBits";
import { StatusBadge } from "@/components/inventory/purchasing/PurchasingView";
import { useInvTx } from "@/i18n/useInvTx";
import { useFmt } from "@/components/inventory/PageBits";
import { InvItem } from "@/lib/inventory";
import { ItemSupplier, PurchaseOrder, Supplier, poErrKey } from "@/lib/purchasing";

// =====================================================================
// Paso 6.14 · Proveedor: datos (contacto, cuenta, términos, días de entrega) + lo que le compras y sus órdenes
// =====================================================================
export default function SupplierForm({ companyId, supplier, links = [], items = [], orders = [] }: {
  companyId: string; supplier?: Supplier; links?: ItemSupplier[]; items?: InvItem[]; orders?: PurchaseOrder[];
}) {
  const t = useTranslations("supplier");
  const tp = useTranslations("purch");
  const ix = useInvTx();
  const { fmtDay } = useFmt();
  const router = useRouter();
  const back = "/dashboard/inventory/purchasing?tab=suppliers";
  const [f, setF] = useState({
    name: supplier?.name ?? "", contact_name: supplier?.contact_name ?? "", phone: supplier?.phone ?? "", email: supplier?.email ?? "", website: supplier?.website ?? "",
    account_no: supplier?.account_no ?? "", address: supplier?.address ?? "", payment_terms: supplier?.payment_terms ?? "", lead_days: supplier?.lead_days != null ? String(supplier.lead_days) : "",
    notes: supplier?.notes ?? "", is_active: supplier?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const on = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setF((x) => ({ ...x, [k]: e.target.value })); setError(""); };
  const item = (id: string) => items.find((i) => i.id === id);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return setError(t("eName"));
    setSaving(true);
    const row = {
      name: f.name.trim(), contact_name: f.contact_name.trim() || null, phone: f.phone.trim() || null, email: f.email.trim() || null, website: f.website.trim() || null,
      account_no: f.account_no.trim() || null, address: f.address.trim() || null, payment_terms: f.payment_terms.trim() || null,
      lead_days: f.lead_days ? Math.min(365, Math.max(0, Math.round(Number(f.lead_days)))) : null, notes: f.notes.trim() || null, is_active: f.is_active, updated_at: new Date().toISOString(),
    };
    const sb = createClient();
    const { error: err } = supplier ? await sb.from("inventory_suppliers").update(row).eq("id", supplier.id) : await sb.from("inventory_suppliers").insert({ ...row, company_id: companyId });
    setSaving(false);
    if (err) return setError(/duplicate|23505/.test(`${err.code} ${err.message}`) ? t("eDup") : tp(poErrKey(err) as never));
    router.push(back); router.refresh();
  }
  async function remove() {
    if (!supplier) return;
    if (!(await confirmDelete({ title: t("delQ", { name: supplier.name }), message: t("delMsg"), download: { filename: supplier.name, data: { supplier, items: links, orders } } }))) return;
    const { error: err } = await createClient().from("inventory_suppliers").delete().eq("id", supplier.id);
    if (err) return setError(tp(poErrKey(err) as never));
    router.push(back); router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate autoComplete="off" className="flex min-h-[calc(100vh-4rem)] flex-col bg-white">
      <FormHeader title={supplier ? supplier.name : t("newTitle")} closeHref={back} />
      <div className="flex-1">
        <div className="border-b border-slate-200 bg-[#fafbfc] px-5 py-6 sm:px-8">
          <div className="grid max-w-[1100px] gap-5 xl:grid-cols-2 xl:gap-x-10">
            <FormRow label={t("name")} htmlFor="s-name" required width="max-w-[420px]"><input id="s-name" autoFocus={!supplier} value={f.name} onChange={on("name")} placeholder={t("namePh")} className={inputClass} /></FormRow>
            <FormRow label={t("contact")} htmlFor="s-contact" width="max-w-[420px]"><input id="s-contact" value={f.contact_name} onChange={on("contact_name")} placeholder={t("contactPh")} className={inputClass} /></FormRow>
            <FormRow label={t("phone")} htmlFor="s-phone" width="max-w-[420px]"><input id="s-phone" inputMode="tel" value={f.phone} onChange={on("phone")} className={inputClass} /></FormRow>
            <FormRow label={t("email")} htmlFor="s-email" width="max-w-[420px]"><input id="s-email" inputMode="email" value={f.email} onChange={on("email")} className={inputClass} /></FormRow>
            <FormRow label={t("website")} htmlFor="s-web" width="max-w-[420px]"><input id="s-web" value={f.website} onChange={on("website")} placeholder="https://" className={inputClass} /></FormRow>
            <FormRow label={t("account")} htmlFor="s-acct" width="max-w-[420px]" hint={t("accountHint")}><input id="s-acct" value={f.account_no} onChange={on("account_no")} className={`${inputClass} font-mono`} /></FormRow>
          </div>
        </div>
        <div className="px-5 py-7 sm:px-8">
          <SectionTitle>{t("buying")}</SectionTitle>
          <div className="grid max-w-[1100px] gap-5 xl:grid-cols-2 xl:gap-x-10">
            <FormRow label={t("terms")} htmlFor="s-terms" width="max-w-[420px]" hint={t("termsHint")}><input id="s-terms" value={f.payment_terms} onChange={on("payment_terms")} placeholder={t("termsPh")} className={inputClass} /></FormRow>
            <FormRow label={t("lead")} htmlFor="s-lead" width="max-w-[200px]" hint={t("leadHint")}>
              <div className="flex items-center gap-2"><input id="s-lead" inputMode="numeric" value={f.lead_days} onChange={(e) => setF((x) => ({ ...x, lead_days: e.target.value.replace(/\D/g, "") }))} className={`${inputClass} tabular-nums`} /><span className="text-[14px] text-slate-500">{t("days")}</span></div>
            </FormRow>
            <FormRow label={t("address")} htmlFor="s-addr" alignTop width="max-w-[420px]"><textarea id="s-addr" rows={2} value={f.address} onChange={on("address")} className={inputClass} /></FormRow>
            <FormRow label={t("notes")} htmlFor="s-notes" alignTop width="max-w-[420px]"><textarea id="s-notes" rows={2} value={f.notes} onChange={on("notes")} className={inputClass} /></FormRow>
            {supplier && (
              <FormRow label={t("active")} width="max-w-[420px]" hint={t("activeHint")}>
                <label className="inline-flex cursor-pointer items-center gap-2 text-[15px] text-slate-700">
                  <input type="checkbox" checked={f.is_active} onChange={(e) => setF((x) => ({ ...x, is_active: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 accent-[#0f766e]" />{t("activeLabel")}
                </label>
              </FormRow>
            )}
          </div>

          {supplier && (
            <div className="mt-10 grid max-w-[1100px] gap-5 xl:grid-cols-2">
              <section className="overflow-hidden rounded-2xl border border-slate-200">
                <p className="border-b border-slate-100 bg-[#fafbfc] px-4 py-3 text-[15px] font-semibold text-[#0b1f3a]">{t("itemsTitle", { n: links.length })}</p>
                {links.length === 0 ? <p className="px-4 py-8 text-center text-[14px] text-slate-500">{t("noItems")}</p> : (
                  <ul className="divide-y divide-slate-100">
                    {links.map((l) => (
                      <li key={l.id}>
                        <Link prefetch={false} href={`/dashboard/inventory/${l.item_id}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[#f0faf7]">
                          <span className="min-w-0 flex-1"><span className="block truncate text-[14.5px] font-medium text-[#0b1f3a]">{item(l.item_id)?.name ?? "—"}{l.is_preferred && <span className="ml-2 rounded-full bg-[#e9f7f4] px-2 py-0.5 text-[11px] font-semibold text-[#0f766e]">{t("preferred")}</span>}</span>
                            {l.supplier_sku && <span className="block truncate font-mono text-[12px] text-slate-400">{l.supplier_sku}</span>}</span>
                          <span className="text-[14px] tabular-nums text-slate-700">{l.cost != null ? ix.money(l.cost) : "—"}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-[#fafbfc] px-4 py-3">
                  <p className="text-[15px] font-semibold text-[#0b1f3a]">{t("ordersTitle")}</p>
                  <Link prefetch={false} href={`/dashboard/inventory/purchasing/new?supplier=${supplier.id}`} className="text-[13.5px] font-semibold text-[#0f766e] hover:underline">{t("newOrder")}</Link>
                </div>
                {orders.length === 0 ? <p className="px-4 py-8 text-center text-[14px] text-slate-500">{t("noOrders")}</p> : (
                  <ul className="divide-y divide-slate-100">
                    {orders.slice(0, 20).map((o) => (
                      <li key={o.id}>
                        <Link prefetch={false} href={`/dashboard/inventory/purchasing/${o.id}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[#f0faf7]">
                          <span className="w-20 shrink-0 font-semibold text-[#0f766e]">{o.number}</span>
                          <span className="min-w-0 flex-1 truncate text-[13.5px] text-slate-500">{fmtDay(`${o.order_date}T12:00:00`)}</span>
                          <StatusBadge s={o.status} />
                          <span className="w-24 text-right text-[14px] font-semibold tabular-nums text-[#0b1f3a]">{ix.money(o.total)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
      <SaveBar saving={saving} cancelHref={back} error={error} onDelete={supplier ? remove : undefined} />
    </form>
  );
}
