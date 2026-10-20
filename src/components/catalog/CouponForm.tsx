"use client";

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

export default function CouponForm({ companyId, products: initialProducts, coupon, clone }: {
  companyId: string; products: CatalogProduct[]; coupon?: Coupon; clone?: Coupon;
}) {
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
    if (!productId) return setError("Choose the product this coupon applies to.");
    if (!name.trim()) return setError("Enter the coupon name.");
    if (!code.trim()) return setError("Enter the coupon code.");
    if (!(amount > 0)) return setError("Enter the discount.");
    if (dtype === "percent" && amount > 100) return setError("A percentage discount can't be more than 100%.");
    if (rtype === "limited_cycles" && !(Number(cycles) > 0)) return setError("Enter how many billing cycles the discount lasts.");
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
      return setError(dbErr?.code === "23505" ? "That coupon code is already in use." : "The coupon couldn't be saved. Did you run the SQL for Paso 3.24?");
    }
    router.push(`/dashboard/coupons/${saved.id}`);
    router.refresh();
  }

  async function remove() {
    if (!coupon || !window.confirm(`Delete the coupon "${coupon.code}"?`)) return;
    const { error: dbErr } = await createClient().from("coupons").delete().eq("id", coupon.id);
    if (dbErr) return setError("The coupon couldn't be deleted.");
    router.push("/dashboard/coupons");
    router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate autoComplete="off" className="flex min-h-[calc(100vh-4rem)] flex-col bg-white">
      <FormHeader title={coupon ? "Edit Coupon" : clone ? "Clone Coupon" : "New Coupon"} closeHref={back} />

      <div className="flex-1">
        <div className="border-b border-slate-200 bg-[#fafbfc] px-5 py-6 sm:px-8">
          <div className="grid max-w-[1100px] gap-5 xl:grid-cols-2 xl:gap-x-10">
            <FormRow label="Product" htmlFor="cp-product" required width="max-w-[340px]" hint="The product or plan group this coupon can be used on.">
              <SearchSelect id="cp-product" ariaLabel="Product" value={productId} placeholder="Select Product"
                options={products.map((p) => ({ value: p.id, label: p.name }))} onChange={(v) => { setProductId(v); clear(); }} />
              <button type="button" onClick={() => setModal(true)} className="mt-1.5 text-sm font-medium text-[#2563eb] hover:underline">+ New Product</button>
            </FormRow>
            <div className="hidden xl:block" />
            <FormRow label="Coupon Name" htmlFor="cp-name" required width="max-w-[340px]" hint="A name for your team to recognize this coupon. Customers don't see it.">
              <input id="cp-name" value={name} onChange={(e) => { setName(e.target.value); clear(); }} placeholder="e.g. Fall tune-up special" className={inputClass} />
            </FormRow>
            <FormRow label="Coupon Code" htmlFor="cp-code" required width="max-w-[340px]" hint="A unique code that helps you identify this coupon, and apply it for discounts and promotions. Letters, numbers, - and _ only.">
              <input id="cp-code" value={code} onChange={(e) => { setCode(cleanCode(e.target.value)); clear(); }} placeholder="FALL25" className={`${inputClass} font-medium uppercase tracking-wide`} />
            </FormRow>
            <FormRow label={dtype === "percent" ? "Discount (%)" : "Discount (USD)"} htmlFor="cp-value" required width="max-w-[340px]" hint="Flat takes a fixed amount off. % takes a percentage off the product price.">
              <div className="flex">
                <input id="cp-value" inputMode="decimal" value={value} placeholder={dtype === "percent" ? "10" : "25.00"}
                  onChange={(e) => { setValue(e.target.value.replace(/[^0-9.]/g, "")); clear(); }} className={`${inputClass} rounded-r-none`} />
                <Listbox value={dtype} onChange={(v: DiscountType) => { setDtype(v); clear(); }}>
                  <ListboxButton className="flex min-w-[78px] items-center justify-between gap-1 rounded-r-lg border border-l-0 border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50">
                    {dtype === "percent" ? "%" : "Flat"}
                    <svg viewBox="0 0 20 20" className="h-4 w-4 text-slate-400" fill="currentColor" aria-hidden="true"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
                  </ListboxButton>
                  <ListboxOptions anchor="bottom end" transition className="z-[60] mt-1 w-32 rounded-xl border border-slate-200 bg-white p-1 shadow-[0_12px_40px_rgba(15,40,60,0.14)] transition duration-150 data-[closed]:opacity-0">
                    {(["percent", "flat"] as DiscountType[]).map((t) => (
                      <ListboxOption key={t} value={t} className="cursor-pointer rounded-lg px-3 py-2 text-sm text-slate-700 data-[focus]:bg-slate-50 data-[selected]:bg-[#eaf2ff] data-[selected]:font-medium data-[selected]:text-[#1e40af]">
                        {t === "percent" ? "%" : "Flat"}
                      </ListboxOption>
                    ))}
                  </ListboxOptions>
                </Listbox>
              </div>
            </FormRow>
            <FormRow label="Redemption Type" htmlFor="cp-rtype" required width="max-w-[340px]" hint="One-Time: only the first invoice. Unlimited: every invoice. Limited Cycles: a set number of billing cycles.">
              <SearchSelect id="cp-rtype" ariaLabel="Redemption type" value={rtype} options={REDEMPTION_OPTIONS} onChange={(v) => { setRtype(v as RedemptionType); clear(); }} />
            </FormRow>
            {rtype === "limited_cycles" && (
              <>
                <div className="hidden xl:block" />
                <FormRow label="Number of Cycles" htmlFor="cp-cycles" required width="max-w-[340px]">
                  <input id="cp-cycles" inputMode="numeric" value={cycles} placeholder="e.g. 3" onChange={(e) => { setCycles(e.target.value.replace(/\D/g, "")); clear(); }} className={inputClass} />
                </FormRow>
              </>
            )}
          </div>
        </div>

        <div className="px-5 py-7 sm:px-8">
          <SectionTitle>Validity</SectionTitle>
          <div className="grid max-w-[1100px] gap-5 xl:grid-cols-2 xl:gap-x-10">
            <FormRow label="Expiration Date" htmlFor="cp-exp" width="max-w-[340px]" hint="After this date the code can no longer be used. Leave empty so it never expires.">
              <DatePicker id="cp-exp" value={expires} onChange={setExpires} placeholder="Click to select" minDate={new Date().toLocaleDateString("en-CA")} />
            </FormRow>
            <FormRow label="Maximum Redemptions" htmlFor="cp-max" width="max-w-[340px]" hint="How many times this code can be used in total. Leave empty for no limit.">
              <input id="cp-max" inputMode="numeric" value={maxRed} placeholder="Enter a number" onChange={(e) => setMaxRed(e.target.value.replace(/\D/g, ""))} className={inputClass} />
            </FormRow>
            {coupon && (
              <FormRow label="Status">
                <label className="flex cursor-pointer items-center gap-2.5 py-1.5 text-[15px] text-slate-700">
                  <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 rounded accent-[#0f766e]" />
                  Active (customers can use this code)
                </label>
              </FormRow>
            )}
          </div>
        </div>
      </div>

      <SaveBar saving={saving} cancelHref={back} error={error} onDelete={coupon ? remove : undefined} deleteLabel="Delete coupon" />
      <ProductModal open={modal} companyId={companyId} onClose={() => setModal(false)}
        onCreated={(p) => { setProducts((l) => [...l, p].sort((a, b) => a.name.localeCompare(b.name))); setProductId(p.id); clear(); }} />
    </form>
  );
}
