"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions } from "@headlessui/react";
import { createClient } from "@/lib/supabase/client";
import { bustCache } from "@/lib/cache-client";
import { UNITS } from "@/lib/catalog";
import { Check, Chevron, optionClass, panelClass } from "@/components/ui/SearchSelect";
import SelectMenu from "@/components/ui/SelectMenu";
import { inputClass } from "@/components/customers/ui";
import { FormHeader, FormRow, SaveBar, SectionTitle } from "@/components/catalog/FormBits";
import BarcodeScanner from "@/components/catalog/BarcodeScanner";
import CategoryPicker from "@/components/inventory/CategoryPicker";
import { InvCategory, InvItem, InvLocation, InvPhoto, InvStock, MAX_PHOTOS, compressImage, invError, qtyFmt } from "@/lib/inventory";

type Props = {
  companyId: string; item?: InvItem; scannedSku?: string;
  locations: InvLocation[]; categories: InvCategory[]; photos?: InvPhoto[]; stock?: InvStock[];
  buying?: { purchase_unit: string | null; units_per_purchase: number };
};
type Pending = { key: string; file: Blob; preview: string };

// Nuevo / Editar producto de inventario: pantalla completa (solo el menú y este formulario), igual que New Item en Finances
export default function InventoryItemForm({ companyId, item, scannedSku, locations, categories: initialCats, photos = [], stock = [], buying }: Props) {
  const router = useRouter();
  const back = item ? `/dashboard/inventory/${item.id}` : "/dashboard/inventory";
  const def = locations.find((l) => l.is_default) ?? locations[0];
  const [categories, setCategories] = useState(initialCats);
  const [name, setName] = useState(item?.name ?? "");
  const [sku, setSku] = useState(item?.sku ?? scannedSku ?? "");
  const [category, setCategory] = useState<string | null>(item?.category_id ?? null);
  const [unit, setUnit] = useState(item?.unit ?? "each");
  const [location, setLocation] = useState(def?.id ?? "");
  const minAt = (loc: string) => Number(stock.find((s) => s.location_id === loc)?.min_qty ?? 0);
  const [qty, setQty] = useState("");
  const [min, setMin] = useState(item ? String(minAt(def?.id ?? "") || "") : "");
  const [cost, setCost] = useState(item ? String(item.cost_price || "") : "");
  const [price, setPrice] = useState(item ? String(item.selling_price || "") : "");
  const [description, setDescription] = useState(item?.description ?? "");
  // Compra por caja (opcional): "Box" de 12 → al recibir 1 caja entran 12 al stock
  const [buyUnit, setBuyUnit] = useState(buying?.purchase_unit ?? "");
  const [perBuy, setPerBuy] = useState(buying && buying.units_per_purchase > 1 ? String(buying.units_per_purchase) : "");
  const [saved, setSaved] = useState<InvPhoto[]>(photos);
  const [pending, setPending] = useState<Pending[]>([]);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState("");
  const [scan, setScan] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const previews = useRef<string[]>([]);

  useEffect(() => () => previews.current.forEach((u) => URL.revokeObjectURL(u)), []);
  // En edición: al cambiar de ubicación muestra el mínimo de esa ubicación
  useEffect(() => { if (item) setMin(String(minAt(location) || "")); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [location]);

  const unitOptions = Array.from(new Set([...(unit.trim() ? [unit.trim()] : []), ...UNITS])).filter((u) => !unit.trim() || u.toLowerCase().includes(unit.trim().toLowerCase()));
  const photoCount = saved.length + pending.length;
  const total = stock.reduce((s, r) => s + Number(r.qty), 0);
  const num = (v: string) => (v.trim() ? Number(v) : 0);

  async function uploadOne(supabase: ReturnType<typeof createClient>, itemId: string, blob: Blob, position: number) {
    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    const path = `${companyId}/inv/${itemId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const up = await supabase.storage.from("item-images").upload(path, blob, { contentType: blob.type, upsert: false });
    if (up.error) throw up.error;
    const url = supabase.storage.from("item-images").getPublicUrl(path).data.publicUrl;
    const { data, error } = await supabase.from("item_photos").insert({ company_id: companyId, item_id: itemId, url, path, position }).select("id, item_id, url, path, position").single();
    if (error) { await supabase.storage.from("item-images").remove([path]); throw error; }
    return data as InvPhoto;
  }
  // La primera foto también es la imagen del item en Finances (cotizaciones y facturas)
  const syncCover = (supabase: ReturnType<typeof createClient>, itemId: string, list: InvPhoto[]) =>
    supabase.from("items").update({ image_url: list[0]?.url ?? null }).eq("id", itemId);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const room = MAX_PHOTOS - photoCount;
    if (room <= 0) return setError(`Up to ${MAX_PHOTOS} photos per product.`);
    const chosen = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, room);
    setPhotoBusy(true);
    try {
      const blobs = await Promise.all(chosen.map((f) => compressImage(f)));
      if (!item) {
        setPending((p) => [...p, ...blobs.map((b) => { const preview = URL.createObjectURL(b); previews.current.push(preview); return { key: Math.random().toString(36), file: b, preview }; })]);
      } else {
        const supabase = createClient();
        const next = [...saved];
        for (const b of blobs) next.push(await uploadOne(supabase, item.id, b, next.length));
        setSaved(next);
        await syncCover(supabase, item.id, next);
      }
    } catch (e) {
      const m = invError(e as { message?: string });
      setError(m === "Something went wrong. Try again." ? "The photo couldn't be uploaded. Try again." : m);
    }
    setPhotoBusy(false);
  }

  async function removeSaved(p: InvPhoto) {
    if (!item) return;
    setPhotoBusy(true);
    const supabase = createClient();
    const { error: dbErr } = await supabase.from("item_photos").delete().eq("id", p.id);
    if (!dbErr) {
      await supabase.storage.from("item-images").remove([p.path]);
      const next = saved.filter((x) => x.id !== p.id);
      setSaved(next);
      await syncCover(supabase, item.id, next);
    } else setError("The photo couldn't be removed.");
    setPhotoBusy(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Enter the product name.");
    if (!sku.trim()) return setError("Scan or type the SKU / barcode.");
    for (const [v, label] of [[qty, "Quantity"], [min, "Low stock alert"], [cost, "Unit cost"], [price, "Selling price"]] as const) {
      if (v.trim() && (Number.isNaN(Number(v)) || Number(v) < 0)) return setError(`${label} must be a positive number.`);
    }
    setSaving(true); setError("");
    const supabase = createClient();
    let id = item?.id ?? "";
    if (!item) {
      const { data, error: rpcErr } = await supabase.rpc("inv_create_item", {
        p_company: companyId, p_name: name.trim(), p_sku: sku.trim(), p_unit: unit.trim(), p_category: category,
        p_cost: num(cost), p_price: num(price), p_description: description.trim(), p_location: location || null, p_qty: num(qty), p_min: num(min),
      });
      if (rpcErr || !data) { setSaving(false); return setError(invError(rpcErr)); }
      id = data as string;
      try {
        const list: InvPhoto[] = [];
        for (const p of pending) list.push(await uploadOne(supabase, id, p.file, list.length));
        if (list.length) await syncCover(supabase, id, list);
      } catch { /* el producto ya quedó guardado; las fotos se pueden subir después */ }
    } else {
      const { error: upErr } = await supabase.from("items").update({
        name: name.trim(), sku: sku.trim(), unit: unit.trim() || null, category_id: category, cost_price: num(cost),
        selling_price: num(price), description: description.trim() || null, updated_at: new Date().toISOString(),
      }).eq("id", item.id);
      if (upErr) { setSaving(false); return setError(invError(upErr)); }
      if (location && num(min) !== minAt(location)) {
        const { error: minErr } = await supabase.rpc("inv_set_min", { p_company: companyId, p_item: item.id, p_location: location, p_min: num(min) });
        if (minErr) { setSaving(false); return setError(invError(minErr)); }
      }
    }
    const per = Number(perBuy) || 1;
    if (buyUnit.trim() || per !== (buying?.units_per_purchase ?? 1)) {
      await supabase.from("items").update({ purchase_unit: buyUnit.trim() || null, units_per_purchase: per > 0 ? per : 1 }).eq("id", id);
    }
    await bustCache("catalog");
    router.push(item ? `/dashboard/inventory/${id}` : `/dashboard/inventory/${id}?created=1`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate autoComplete="off" className="flex min-h-[calc(100vh-4rem)] flex-col bg-white">
      <FormHeader title={item ? "Edit Inventory Item" : "New Inventory Item"} closeHref={back} />

      <div className="flex-1">
        {/* Datos principales + fotos (como New Item en Finances) */}
        <div className="border-b border-slate-200 bg-[#fafbfc] px-5 py-6 sm:px-8">
          <div className="flex max-w-[1100px] flex-col gap-8 lg:flex-row">
            <div className="min-w-0 flex-1 space-y-5">
              <FormRow label="Name" htmlFor="inv-name" required width="max-w-[560px]" hint="The product name as it will appear on quotes, invoices and to your team.">
                <input id="inv-name" autoFocus={!item} value={name} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder="e.g. Contactor 40A 2-pole" className={inputClass} />
              </FormRow>
              <FormRow label="SKU / Barcode" htmlFor="inv-sku" required width="max-w-[560px]" hint="Scan the barcode that already comes on the product's box. That code becomes your SKU, so you never print labels.">
                <div className="flex gap-2">
                  <input id="inv-sku" value={sku} onChange={(e) => { setSku(e.target.value); setError(""); }} placeholder="Scan or type the code" className={`${inputClass} font-mono`} />
                  <button type="button" onClick={() => setScan(true)} aria-label="Scan barcode" title="Scan barcode"
                    className="group flex h-[46px] w-12 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#0f766e] transition-colors hover:border-[#14a39a] hover:bg-[#e9f7f4]">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 8v8M10 8v8M13 8v8M16.5 8v8" /></svg>
                  </button>
                </div>
                {scannedSku && !item && <p className="mt-1.5 text-[13px] text-[#0f766e]">Scanned code — it isn&apos;t in your inventory yet.</p>}
              </FormRow>
              <FormRow label="Category" htmlFor="inv-cat" width="max-w-[360px]" hint="Type to search. If it doesn't exist, choose Create to add it.">
                <CategoryPicker id="inv-cat" companyId={companyId} value={category} categories={categories} onChange={setCategory}
                  onCreated={(c) => setCategories((l) => [...l, c].sort((a, b) => a.name.localeCompare(b.name)))} />
              </FormRow>
              <FormRow label="Unit" htmlFor="inv-unit" width="max-w-[360px]" hint="How you count this product: each, box, ft, gal...">
                <Combobox immediate value={unit} onChange={(v: string | null) => v != null && setUnit(v)}>
                  <div className="relative">
                    <ComboboxInput id="inv-unit" autoComplete="off" displayValue={(v: string) => v} onChange={(e) => setUnit(e.target.value)} className={`${inputClass} pr-10`} />
                    <ComboboxButton aria-label="Show units" className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400"><Chevron /></ComboboxButton>
                  </div>
                  <ComboboxOptions anchor="bottom start" transition className={`${panelClass} w-[var(--input-width)]`}>
                    {unitOptions.map((u) => <ComboboxOption key={u} value={u} className={optionClass}><span>{u}</span><Check /></ComboboxOption>)}
                  </ComboboxOptions>
                </Combobox>
              </FormRow>
            </div>

            {/* Fotos (hasta 3) */}
            <div className="shrink-0 lg:w-[19rem]">
              <p className="mb-2 text-sm font-medium text-slate-700">Photos <span className="font-normal text-slate-400">· up to {MAX_PHOTOS}</span></p>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              <div className="flex flex-wrap gap-3">
                {saved.map((p) => <Thumb key={p.id} src={p.url} onRemove={() => removeSaved(p)} disabled={photoBusy} />)}
                {pending.map((p) => <Thumb key={p.key} src={p.preview} onRemove={() => setPending((l) => l.filter((x) => x.key !== p.key))} disabled={photoBusy} />)}
                {photoCount < MAX_PHOTOS && (
                  <>
                    <PhotoButton label="Camera" d="M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" onClick={() => camRef.current?.click()} busy={photoBusy} />
                    <PhotoButton label="Upload" d="M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9h.01" onClick={() => fileRef.current?.click()} busy={photoBusy} />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stock */}
        <div className="border-b border-slate-100 px-5 py-7 sm:px-8">
          <SectionTitle>Stock</SectionTitle>
          <div className="grid max-w-[1100px] gap-5 xl:grid-cols-2 xl:gap-x-10">
            <FormRow label="Location" htmlFor="inv-loc" width="max-w-[340px]" hint={item ? "The low stock alert applies to this location." : "Where this first stock is stored. Vans for each technician come with Locations & Vans."}>
              <SelectMenu id="inv-loc" ariaLabel="Location" value={location} onChange={setLocation} options={locations.map((l) => ({ value: l.id, label: l.name }))} />
            </FormRow>
            {item ? (
              <FormRow label="On hand" width="max-w-[340px]" hint="Total in all locations. To change it use + / − or Adjust on the item, so every change stays in the history.">
                <p className="flex h-[46px] items-center rounded-lg bg-slate-50 px-4 text-[15px] font-semibold tabular-nums text-[#0b1f3a] ring-1 ring-slate-200">{qtyFmt(total)} {unit}</p>
              </FormRow>
            ) : (
              <FormRow label="Quantity on hand" htmlFor="inv-qty" width="max-w-[340px]" hint="How many you have right now in this location.">
                <input id="inv-qty" inputMode="decimal" value={qty} placeholder="0" onChange={(e) => setQty(e.target.value.replace(/[^0-9.]/g, ""))} className={`${inputClass} tabular-nums`} />
              </FormRow>
            )}
            <FormRow label="Buy in" htmlFor="inv-buy" width="max-w-[340px]" hint="Optional. If you buy it by the box (e.g. Box of 12), receiving 1 box adds 12 to stock.">
              <div className="flex items-center gap-2">
                <input id="inv-buy" value={buyUnit} onChange={(e) => setBuyUnit(e.target.value)} placeholder="Box, Case, Roll..." className={inputClass} />
                <span className="shrink-0 text-[14px] text-slate-500">of</span>
                <input inputMode="decimal" value={perBuy} onChange={(e) => setPerBuy(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="12" aria-label="Units per purchase unit" className={`${inputClass} w-24 tabular-nums`} />
              </div>
            </FormRow>
            <FormRow label="Low stock alert" htmlFor="inv-min" width="max-w-[340px]" hint="When this location has this many or fewer, the item is marked Low Stock.">
              <input id="inv-min" inputMode="decimal" value={min} placeholder="e.g. 3" onChange={(e) => setMin(e.target.value.replace(/[^0-9.]/g, ""))} className={`${inputClass} tabular-nums`} />
            </FormRow>
          </div>
        </div>

        {/* Precio */}
        <div className="px-5 py-7 sm:px-8">
          <SectionTitle>Cost &amp; Sales Information</SectionTitle>
          <div className="grid max-w-[1100px] gap-5 xl:grid-cols-2 xl:gap-x-10">
            <FormRow label="Unit cost" htmlFor="inv-cost" width="max-w-[340px]" hint="What you pay for one unit. Used for the inventory value and job costing. Technicians never see it.">
              <Money id="inv-cost" value={cost} onChange={setCost} />
            </FormRow>
            <FormRow label="Selling price" htmlFor="inv-price" width="max-w-[340px]" hint="The price on quotes and invoices (same item as Finances → Items).">
              <Money id="inv-price" value={price} onChange={setPrice} />
            </FormRow>
            <FormRow label="Description" htmlFor="inv-desc" alignTop width="max-w-[460px]" hint="Model, size, brand, notes for your team. Also shows on quotes and invoices.">
              <textarea id="inv-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Model, size, brand, notes for your team" className={inputClass} />
            </FormRow>
          </div>
        </div>
      </div>

      <SaveBar saving={saving || photoBusy} cancelHref={back} error={error} />
      <BarcodeScanner open={scan} everywhere onClose={() => setScan(false)} onCode={(c) => { setScan(false); setSku(c); setError(""); }} />
    </form>
  );
}

function Money({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex">
      <span className="flex items-center rounded-l-lg border border-r-0 border-slate-200 bg-slate-100 px-3 text-sm text-slate-600">USD</span>
      <input id={id} inputMode="decimal" value={value} placeholder="0.00" onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))} className={`${inputClass} rounded-l-none tabular-nums`} />
    </div>
  );
}

function Thumb({ src, onRemove, disabled }: { src: string; onRemove: () => void; disabled?: boolean }) {
  return (
    <div className="group relative h-24 w-24 overflow-hidden rounded-xl border border-slate-200 bg-white ">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
      <button type="button" disabled={disabled} onClick={onRemove} aria-label="Remove photo"
        className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-slate-500 shadow transition-all hover:rotate-90 hover:text-red-600 disabled:opacity-50">
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
      </button>
    </div>
  );
}

function PhotoButton({ label, d, onClick, busy }: { label: string; d: string; onClick: () => void; busy: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={busy}
      className="group flex h-24 w-24 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-white text-slate-500 transition-all hover:border-[#14a39a] hover:text-[#0f766e] hover:shadow-md disabled:opacity-50">
      {busy ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-[#0f766e]" /> : (
        <svg viewBox="0 0 24 24" className="h-6 w-6 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
      )}
      <span className="text-[12px] font-medium">{label}</span>
    </button>
  );
}
