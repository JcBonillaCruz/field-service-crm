"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions } from "@headlessui/react";
import { createClient } from "@/lib/supabase/client";
import { ACCOUNTS, Item, ItemType, UNITS } from "@/lib/catalog";
import SearchSelect, { Check, Chevron, optionClass, panelClass } from "@/components/ui/SearchSelect";
import { inputClass } from "@/components/customers/ui";
import { FormHeader, FormRow, SaveBar, SectionTitle } from "@/components/catalog/FormBits";
import { readItemPrefs } from "@/lib/item-prefs";

const ACCOUNT_OPTIONS = ACCOUNTS.map((a) => ({ value: a, label: a }));

export default function ItemForm({ companyId, item, clone }: { companyId: string; item?: Item; clone?: Item }) {
  const router = useRouter();
  const src = item ?? clone;
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(src?.name ?? "");
  const [type, setType] = useState<ItemType>(src?.item_type ?? "goods");
  const [unit, setUnit] = useState(src?.unit ?? "");
  const [sku, setSku] = useState(item?.sku ?? "");
  const [image, setImage] = useState(src?.image_url ?? "");
  const [price, setPrice] = useState(src ? String(src.selling_price) : "");
  const [account, setAccount] = useState(src?.account ?? "Sales");
  const [description, setDescription] = useState(src?.description ?? "");
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [requireSku, setRequireSku] = useState(false);
  const [warnDup, setWarnDup] = useState(true);
  const back = item ? `/dashboard/items/${item.id}` : "/dashboard/items";

  // Valores por defecto de las Preferencias (solo para un item nuevo)
  useEffect(() => {
    const p = readItemPrefs(companyId);
    setRequireSku(p.requireSku); setWarnDup(p.warnDuplicates);
    if (src) return;
    setType(p.defaultType); setUnit(p.defaultUnit); setAccount(p.defaultAccount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unitOptions = Array.from(new Set([...(unit.trim() ? [unit.trim()] : []), ...UNITS])).filter((u) => u.toLowerCase().includes(unit.trim().toLowerCase()) || !unit.trim());

  async function upload(file?: File) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return setError("Use a PNG, JPG or WEBP image.");
    if (file.size > 5 * 1024 * 1024) return setError("The image must be 5 MB or smaller.");
    setUploading(true); setError("");
    const supabase = createClient();
    const path = `${companyId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${file.name.split(".").pop() || "png"}`;
    const { error: upErr } = await supabase.storage.from("item-images").upload(path, file);
    setUploading(false);
    if (upErr) return setError("The image couldn't be uploaded. Try again.");
    setImage(supabase.storage.from("item-images").getPublicUrl(path).data.publicUrl);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(price.replace(/[^0-9.]/g, ""));
    if (!name.trim()) return setError("Enter the item name.");
    if (!price.trim() || Number.isNaN(amount)) return setError("Enter the selling price.");
    if (requireSku && !sku.trim()) return setError("Enter the SKU (your Preferences require it).");
    setSaving(true); setError("");
    const supabase = createClient();
    if (!item && warnDup) {
      const { data: dup } = await supabase.from("items").select("id").eq("company_id", companyId).ilike("name", name.trim()).limit(1);
      if (dup?.length && !window.confirm(`An item named "${name.trim()}" already exists. Save anyway?`)) { setSaving(false); return; }
    }
    const row = {
      name: name.trim(), item_type: type, unit: unit.trim() || null, sku: sku.trim() || null, image_url: image || null,
      selling_price: Math.round(amount * 100) / 100, account, description: description.trim() || null, updated_at: new Date().toISOString(),
    };
    const { data: saved, error: dbErr } = item
      ? await supabase.from("items").update(row).eq("id", item.id).select("id").single()
      : await supabase.from("items").insert({ ...row, company_id: companyId }).select("id").single();
    if (dbErr || !saved) { setSaving(false); return setError("The item couldn't be saved. Did you run the SQL for Paso 3.24?"); }
    router.push(`/dashboard/items/${saved.id}`);
    router.refresh();
  }

  async function remove() {
    if (!item || !window.confirm(`Delete "${item.name}"?`)) return;
    const { error: dbErr } = await createClient().from("items").delete().eq("id", item.id);
    if (dbErr) return setError("The item couldn't be deleted.");
    router.push("/dashboard/items");
    router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate autoComplete="off" className="flex min-h-[calc(100vh-4rem)] flex-col bg-white">
      <FormHeader title={item ? "Edit Item" : clone ? "Clone Item" : "New Item"} closeHref={back} />

      <div className="flex-1">
        {/* Datos principales + imagen (como Zoho) */}
        <div className="border-b border-slate-200 bg-[#fafbfc] px-5 py-6 sm:px-8">
          <div className="flex max-w-[1100px] flex-col gap-8 lg:flex-row">
            <div className="min-w-0 flex-1 space-y-5">
              <FormRow label="Name" htmlFor="it-name" required width="max-w-[560px]" hint="The name of the item as it will appear on quotes and invoices.">
                <input id="it-name" autoFocus value={name} onChange={(e) => { setName(e.target.value); setError(""); }} className={inputClass} />
              </FormRow>
              <FormRow label="Type" hint="Choose Goods for parts and equipment you sell or install. Choose Service for labor, visits and maintenance plans.">
                <div className="flex gap-6 py-1.5">
                  {(["goods", "service"] as ItemType[]).map((t) => (
                    <label key={t} className="flex cursor-pointer items-center gap-2 text-[15px] text-slate-700">
                      <input type="radio" name="item-type" checked={type === t} onChange={() => setType(t)} className="h-4 w-4 accent-[#0f766e]" />
                      {t === "goods" ? "Goods" : "Service"}
                    </label>
                  ))}
                </div>
              </FormRow>
              <FormRow label="Unit" htmlFor="it-unit" hint="The item will be measured in terms of this unit (e.g. each, hour, visit, ton).">
                <Combobox immediate value={unit} onChange={(v: string | null) => v != null && setUnit(v)}>
                  <div className="relative">
                    <ComboboxInput id="it-unit" autoComplete="off" placeholder="Select or type to add" displayValue={(v: string) => v}
                      onChange={(e) => setUnit(e.target.value)} className={`${inputClass} pr-10`} />
                    <ComboboxButton aria-label="Show units" className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400"><Chevron /></ComboboxButton>
                  </div>
                  <ComboboxOptions anchor="bottom start" transition className={`${panelClass} w-[var(--input-width)]`}>
                    {unitOptions.map((u) => <ComboboxOption key={u} value={u} className={optionClass}><span>{u}</span><Check /></ComboboxOption>)}
                  </ComboboxOptions>
                </Combobox>
              </FormRow>
              <FormRow label="SKU" htmlFor="it-sku" hint="The Stock Keeping Unit of the item: your own product or part code.">
                <input id="it-sku" value={sku} onChange={(e) => setSku(e.target.value)} className={inputClass} />
              </FormRow>
            </div>

            <div className="shrink-0">
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
              <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files?.[0]); }}
                className={`relative flex h-56 w-64 flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed bg-white text-center transition-colors ${drag ? "border-[#3b82f6] bg-[#f5f9ff]" : "border-slate-300"}`}>
                {image ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt="" className="h-full w-full object-contain p-3" />
                    <button type="button" onClick={() => setImage("")} className="absolute right-2 top-2 rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-red-600 shadow-sm hover:bg-white">Remove</button>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" className="h-10 w-10 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="15.5" cy="9.5" r="1.8" /><path d="m4 17 5-5 4 4 2.5-2.5L20 18" />
                    </svg>
                    <p className="mt-3 text-sm text-slate-500">{uploading ? "Uploading..." : "Drag image here or"}</p>
                    {!uploading && <button type="button" onClick={() => fileRef.current?.click()} className="text-sm font-medium text-[#2563eb] hover:underline">Browse images</button>}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Información de venta */}
        <div className="px-5 py-7 sm:px-8">
          <SectionTitle>Sales Information</SectionTitle>
          <div className="grid max-w-[1100px] gap-5 xl:grid-cols-2 xl:gap-x-10">
            <FormRow label="Selling Price" htmlFor="it-price" required width="max-w-[340px]" hint="The rate at which you're going to sell this item.">
              <div className="flex">
                <span className="flex items-center rounded-l-lg border border-r-0 border-slate-200 bg-slate-100 px-3 text-sm text-slate-600">USD</span>
                <input id="it-price" inputMode="decimal" value={price} placeholder="0.00"
                  onChange={(e) => { setPrice(e.target.value.replace(/[^0-9.]/g, "")); setError(""); }} className={`${inputClass} rounded-l-none`} />
              </div>
            </FormRow>
            <FormRow label="Account" htmlFor="it-account" required width="max-w-[340px]" hint="All sales transactions for this item will be tracked under this account in your reports.">
              <SearchSelect id="it-account" ariaLabel="Account" value={account} options={ACCOUNT_OPTIONS} onChange={setAccount} />
            </FormRow>
            <FormRow label="Description" htmlFor="it-desc" alignTop width="max-w-[460px]" hint="Shows under the item name on quotes and invoices.">
              <textarea id="it-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Shows on quotes and invoices" className={inputClass} />
            </FormRow>
          </div>
        </div>
      </div>

      <SaveBar saving={saving} cancelHref={back} error={error} onDelete={item ? remove : undefined} deleteLabel="Delete item" />
    </form>
  );
}
