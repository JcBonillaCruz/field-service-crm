"use client";

import { confirmDelete } from "@/lib/confirm";
import { bustCache } from "@/lib/cache-client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react";
import { createClient } from "@/lib/supabase/client";
import { CatalogProduct, Coupon, DiscountType, REDEMPTION_OPTIONS, RedemptionType, cleanCode } from "@/lib/catalog";
import SearchSelect from "@/components/ui/SearchSelect";
import { inputClass } from "@/components/customers/ui";
import { FormHeader, FormRow, SaveBar, SectionTitle } from "@/components/catalog/FormBits";
import ProductModal from "@/components/catalog/ProductModal";
import DatePicker from "@/components/ui/DatePicker";
import { useTranslations } from "next-intl";
import { useViewTx } from "@/i18n/useViewTx";

export default function CouponForm({ companyId, products: initialProducts, coupon, clone }: {
  companyId: string; products: CatalogProduct[]; coupon?: Coupon; clone?: Coupon;
}) {
  const t = useTranslations("couponForm");
  const vx = useViewTx("coupons");
  const router = useRouter();
  const src = coupon ?? clone;
  const back = coupon ? `/dashboard/coupons/${coupon.id}` : "/dashboard/coupons";
  const [products, setProducts] = useState(initialProducts);
  const [productId, setProductId] = useState(src?.product_id ?? "");
  const [name, setName] = useState(src?.name ?? "");
  const [code, setCode] = useState(coupon?.code ?? "");
  const [dtype, setDtype] = useState<DiscountType>(src?.discount_type ?? "flat");
  const [value, setValue] = useState(src ? String(src.discount_value) : "");
  const [rtype, setRtype] = useState<RedemptionType>(src?.redemption_type ?? "one_time");
  const [cycles, setCycles] = useState(src?.cycles ? String(src.cycles) : "");
  const [expires, setExpires] = useState(src?.expires_on ?? "");
  const [maxRed, setMaxRed] = useState(src?.max_redemptions ? String(src.max_redemptions) : "");
  const [active, setActive] = useState(coupon?.is_active ?? true);
  const [modal, setModal] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const clear = () => setError("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(value);
    if (!productId) return setError(t("eProduct"));
    if (!name.trim()) return setError(t("eName"));
    if (!code.trim()) return setError(t("eCode"));
    if (!(amount > 0)) return setError(t("eDiscount"));
    if (dtype === "percent" && amount > 100) return setError(t("ePct"));
    if (rtype === "limited_cycles" && !(Number(cycles) > 0)) return setError(t("eCycles"));
    setSaving(true); clear();
    const row = {
      product_id: productId, name: name.trim(), code: cleanCode(code), discount_type: dtype, discount_value: Math.round(amount * 100) / 100,
      redemption_type: rtype, cycles: rtype === "limited_cycles" ? Number(cycles) : null, expires_on: expires || null,
      max_redemptions: Number(maxRed) > 0 ? Number(maxRed) : null, is_active: active,
    };
    const supabase = createClient();
    const { data: saved, error: dbErr } = coupon
      ? await supabase.from("coupons").update(row).eq("id", coupon.id).select("id").single()
      : await supabase.from("coupons").insert({ ...row, company_id: companyId }).select("id").single();
    if (dbErr || !saved) {
      setSaving(false);
      return setError(dbErr?.code === "23505" ? t("eDup") : t("eSave"));
    }
    await bustCache("catalog"); router.push(`/dashboard/coupons/${saved.id}`);
    router.refresh();
  }

  async function remove() {
    if (!coupon || !(await confirmDelete({ title: t("delQ", { code: coupon.code }), download: { filename: coupon.code, data: coupon } }))) return;
    const { error: dbErr } = await createClient().from("coupons").delete().eq("id", coupon.id);
    if (dbErr) return setError(t("eDel"));
    await bustCache("catalog"); router.replace("/dashboard/coupons");
    router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate autoComplete="off" className="flex min-h-[calc(100vh-4rem)] flex-col bg-white">
      <FormHeader title={coupon ? t("editTitle") : clone ? t("cloneTitle") : t("newTitle")} closeHref={back} />

      <div className="flex-1">
        <div className="border-b border-slate-200 bg-[#fafbfc] px-5 py-6 sm:px-8">
          <div className="grid max-w-[1100px] gap-5 xl:grid-cols-2 xl:gap-x-10">
            <FormRow label={t("product")} htmlFor="cp-product" required width="max-w-[340px]" hint={t("productHint")}>
              <SearchSelect id="cp-product" ariaLabel={t("product")} value={productId} placeholder={t("productPh")}
                options={products.map((p) => ({ value: p.id, label: p.name }))} onChange={(v) => { setProductId(v); clear(); }} />
              <button type="button" onClick={() => setModal(true)} className="mt-1.5 text-sm font-medium text-[#2563eb] hover:underline">{t("newProduct")}</button>
            </FormRow>
            <div className="hidden xl:block" />
            <FormRow label={t("name")} htmlFor="cp-name" required width="max-w-[340px]" hint={t("nameHint")}>
              <input id="cp-name" value={name} onChange={(e) => { setName(e.target.value); clear(); }} placeholder={t("namePh")} className={inputClass} />
            </FormRow>
            <FormRow label={t("code")} htmlFor="cp-code" required width="max-w-[340px]" hint={t("codeHint")}>
              <input id="cp-code" value={code} onChange={(e) => { setCode(cleanCode(e.target.value)); clear(); }} placeholder="FALL25" className={`${inputClass} font-medium uppercase tracking-wide`} />
            </FormRow>
            <FormRow label={dtype === "percent" ? t("discPct") : t("discUsd")} htmlFor="cp-value" required width="max-w-[340px]" hint={t("discHint")}>
              <div className="flex">
                <input id="cp-value" inputMode="decimal" value={value} placeholder={dtype === "percent" ? "10" : "25.00"}
                  onChange={(e) => { setValue(e.target.value.replace(/[^0-9.]/g, "")); clear(); }} className={`${inputClass} rounded-r-none`} />
                <Listbox value={dtype} onChange={(v: DiscountType) => { setDtype(v); clear(); }}>
                  <ListboxButton className="flex min-w-[78px] items-center justify-between gap-1 rounded-r-lg border border-l-0 border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50">
                    {dtype === "percent" ? "%" : t("flat")}
                    <svg viewBox="0 0 20 20" className="h-4 w-4 text-slate-400" fill="currentColor" aria-hidden="true"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
                  </ListboxButton>
                  <ListboxOptions anchor="bottom end" transition className="z-[60] mt-1 w-32 rounded-xl border border-slate-200 bg-white p-1 shadow-[0_12px_40px_rgba(15,40,60,0.14)] transition duration-150 data-[closed]:opacity-0">
                    {(["percent", "flat"] as DiscountType[]).map((d) => (
                      <ListboxOption key={d} value={d} className="cursor-pointer rounded-lg px-3 py-2 text-sm text-slate-700 data-[focus]:bg-slate-50 data-[selected]:bg-[#eaf2ff] data-[selected]:font-medium data-[selected]:text-[#1e40af]">
                        {d === "percent" ? "%" : t("flat")}
                      </ListboxOption>
                    ))}
                  </ListboxOptions>
                </Listbox>
              </div>
            </FormRow>
            <FormRow label={t("redemption")} htmlFor="cp-rtype" required width="max-w-[340px]" hint={t("redemptionHint")}>
              <SearchSelect id="cp-rtype" ariaLabel={t("redemption")} value={rtype} options={REDEMPTION_OPTIONS.map((o) => ({ ...o, label: vx.choice(o.value, o.label) }))} onChange={(v) => { setRtype(v as RedemptionType); clear(); }} />
            </FormRow>
            {rtype === "limited_cycles" && (
              <>
                <div className="hidden xl:block" />
                <FormRow label={t("cycles")} htmlFor="cp-cycles" required width="max-w-[340px]">
                  <input id="cp-cycles" inputMode="numeric" value={cycles} placeholder={t("cyclesPh")} onChange={(e) => { setCycles(e.target.value.replace(/\D/g, "")); clear(); }} className={inputClass} />
                </FormRow>
              </>
            )}
          </div>
        </div>

        <div className="px-5 py-7 sm:px-8">
          <SectionTitle>{t("validity")}</SectionTitle>
          <div className="grid max-w-[1100px] gap-5 xl:grid-cols-2 xl:gap-x-10">
            <FormRow label={t("expires")} htmlFor="cp-exp" width="max-w-[340px]" hint={t("expiresHint")}>
              <DatePicker id="cp-exp" value={expires} onChange={setExpires} placeholder={t("pickDate")} minDate={new Date().toLocaleDateString("en-CA")} />
            </FormRow>
            <FormRow label={t("maxR")} htmlFor="cp-max" width="max-w-[340px]" hint={t("maxHint")}>
              <input id="cp-max" inputMode="numeric" value={maxRed} placeholder={t("numPh")} onChange={(e) => setMaxRed(e.target.value.replace(/\D/g, ""))} className={inputClass} />
            </FormRow>
            {coupon && (
              <FormRow label={t("status")}>
                <label className="flex cursor-pointer items-center gap-2.5 py-1.5 text-[15px] text-slate-700">
                  <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 rounded accent-[#0f766e]" />
                  {t("activeLabel")}
                </label>
              </FormRow>
            )}
          </div>
        </div>
      </div>

      <SaveBar saving={saving} cancelHref={back} error={error} onDelete={coupon ? remove : undefined} deleteLabel={t("delete")} />
      <ProductModal open={modal} companyId={companyId} onClose={() => setModal(false)}
        onCreated={(p) => { setProducts((l) => [...l, p].sort((a, b) => a.name.localeCompare(b.name))); setProductId(p.id); clear(); }} />
    </form>
  );
}
