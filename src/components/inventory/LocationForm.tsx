"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { confirmDelete } from "@/lib/confirm";
import { inputClass } from "@/components/customers/ui";
import SearchSelect from "@/components/ui/SearchSelect";
import { FormHeader, FormRow, SaveBar, SectionTitle } from "@/components/catalog/FormBits";
import { InvItem, InvLocation, InvMember, compressImage, invError } from "@/lib/inventory";
import { useTranslations } from "next-intl";
import { useInvTx } from "@/i18n/useInvTx";
import StreetAutocomplete from "@/components/customers/StreetAutocomplete";
import KitEditor, { KitRow } from "@/components/inventory/KitEditor";
import { VanArt, WarehouseArt } from "@/components/inventory/NewLocationModal";

// Paso 6.12: datos extra de la van (vehículo, foto) y de la bodega (dirección, Main)
export type Vehicle = { make?: string; model?: string; year?: string; plate?: string; vin?: string };
export type Addr = { street?: string; city?: string; state?: string; zip?: string };
export type LocExtra = { vehicle?: Vehicle | null; photo_url?: string | null; photo_path?: string | null; address?: Addr | null; notes?: string | null };

// Nueva / editar ubicación: pantalla completa (menú + formulario)
export default function LocationForm({ companyId, members, location, taken, initialKind, canEdit, items = [], kit = [], extraSql = true, barcodes }: {
  companyId: string; members: InvMember[]; location?: InvLocation & { is_active: boolean } & LocExtra; taken: string[]; initialKind: "warehouse" | "van"; canEdit: boolean;
  items?: InvItem[]; kit?: KitRow[]; extraSql?: boolean; barcodes?: Record<string, string>;
}) {
  const t = useTranslations("invLocForm");
  const tk = useTranslations("invKit");
  const tr = useTranslations("roles");
  const ix = useInvTx();
  const router = useRouter();
  const [kind, setKind] = useState<"warehouse" | "van">(initialKind);
  const [name, setName] = useState(location?.name ?? "");
  const [tech, setTech] = useState(location?.assigned_user_id ?? "");
  const [active, setActive] = useState(location?.is_active ?? true);
  const [main, setMain] = useState(location?.is_default ?? false);
  const [veh, setVeh] = useState<Vehicle>(location?.vehicle ?? {});
  const [addr, setAddr] = useState<Addr>(location?.address ?? { state: "TX" });
  const [notes, setNotes] = useState(location?.notes ?? "");
  const [photo, setPhoto] = useState<{ url: string; path: string | null } | null>(location?.photo_url ? { url: location.photo_url, path: location.photo_path ?? null } : null);
  const [photoFile, setPhotoFile] = useState<Blob | null>(null);
  const [kitRows, setKitRows] = useState<KitRow[]>(location ? [] : kit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const back = location ? `/dashboard/inventory/locations/${location.id}` : "/dashboard/inventory/locations";
  const options = members.map((m) => ({
    value: m.user_id, label: m.full_name,
    hint: taken.includes(m.user_id) ? t("hasVan") : tr.has(m.role as never) ? tr(m.role as never) : m.role,
  }));

  function pickTech(id: string) {
    setTech(id); setError("");
    const m = members.find((x) => x.user_id === id);
    if (m && !name.trim()) setName(t("vanOf", { name: m.full_name.split(" ")[0] }));
  }
  async function pickPhoto(f: File | undefined) {
    if (!f) return;
    try {
      const blob = await compressImage(f);
      setPhotoFile(blob); setPhoto({ url: URL.createObjectURL(blob), path: photo?.path ?? null });
    } catch { setError(t("ePhoto")); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return setError(t("eRole"));
    if (!name.trim()) return setError(t("eName"));
    if (kind === "van" && tech && taken.includes(tech)) return setError(t("eVan"));
    setSaving(true); setError("");
    const sb = createClient();
    const base = { name: name.trim(), kind, assigned_user_id: kind === "van" ? tech || null : null, is_active: location?.is_default ? true : active };
    const clean = <T extends Record<string, string | undefined>>(o: T) => { const r = Object.fromEntries(Object.entries(o).map(([k, v]) => [k, (v ?? "").trim()]).filter(([, v]) => v)); return Object.keys(r).length ? r : null; };
    const extra = extraSql ? {
      vehicle: kind === "van" ? clean(veh) : null, address: kind === "warehouse" ? clean(addr) : null, notes: notes.trim() || null,
      ...(kind === "warehouse" ? { photo_url: null, photo_path: null } : {}),
    } : {};
    let { data, error: dbErr } = location
      ? await sb.from("inventory_locations").update({ ...base, ...extra }).eq("id", location.id).select("id").single()
      : await sb.from("inventory_locations").insert({ ...base, ...extra, company_id: companyId }).select("id").single();
    // Sin el SQL 6.12 (columnas nuevas): se guarda lo de siempre
    if (dbErr && /vehicle|address|notes|photo_/i.test(dbErr.message ?? "")) {
      ({ data, error: dbErr } = location
        ? await sb.from("inventory_locations").update(base).eq("id", location.id).select("id").single()
        : await sb.from("inventory_locations").insert({ ...base, company_id: companyId }).select("id").single());
    }
    if (dbErr || !data) { setSaving(false); return setError(ix.err(invError(dbErr))); }
    const id = data.id as string;
    // Foto de la van
    if (kind === "van" && photoFile && extraSql) {
      const ext = photoFile.type === "image/webp" ? "webp" : "jpg";
      const path = `${companyId}/vans/${id}/${Date.now()}.${ext}`;
      const up = await sb.storage.from("item-images").upload(path, photoFile, { contentType: photoFile.type, upsert: false });
      if (!up.error) {
        const url = sb.storage.from("item-images").getPublicUrl(path).data.publicUrl;
        await sb.from("inventory_locations").update({ photo_url: url, photo_path: path }).eq("id", id);
        if (location?.photo_path) await sb.storage.from("item-images").remove([location.photo_path]);
      }
    } else if (kind === "van" && !photo && location?.photo_path && extraSql) {
      await sb.from("inventory_locations").update({ photo_url: null, photo_path: null }).eq("id", id);
      await sb.storage.from("item-images").remove([location.photo_path]);
    }
    // Bodega principal
    if (kind === "warehouse" && main && !location?.is_default) {
      const r = await sb.rpc("inv_set_main", { p_company: companyId, p_location: id });
      if (r.error) { setSaving(false); return setError(ix.err(invError(r.error))); }
    }
    // Kit estándar: deja puesto el mínimo de cada producto en la van nueva
    if (kind === "van" && !location && kitRows.length) {
      for (const k of kitRows) {
        if (k.min > 0) await sb.rpc("inv_set_min", { p_company: companyId, p_item: k.item_id, p_location: id, p_min: k.min });
      }
    }
    router.push(`/dashboard/inventory/locations/${id}`); router.refresh();
  }

  async function remove() {
    if (!location || !(await confirmDelete({ title: t("delQ", { name: location.name }), message: t("delMsg") }))) return;
    const { error: err } = await createClient().rpc("inv_delete_location", { p_company: companyId, p_location: location.id });
    if (err) return setError(ix.err(invError(err)));
    if (location.photo_path) await createClient().storage.from("item-images").remove([location.photo_path]);
    router.replace("/dashboard/inventory/locations"); router.refresh();
  }

  const vField = (k: keyof Vehicle, label: string, cls = "") => (
    <div className={cls}><label className="mb-1 block text-[12.5px] text-slate-500" htmlFor={`veh-${k}`}>{label}</label>
      <input id={`veh-${k}`} value={veh[k] ?? ""} maxLength={k === "vin" ? 17 : 40} onChange={(e) => setVeh((v) => ({ ...v, [k]: k === "plate" || k === "vin" ? e.target.value.toUpperCase() : e.target.value }))} className={inputClass} /></div>
  );

  return (
    <form onSubmit={submit} noValidate autoComplete="off" className="flex min-h-[calc(100vh-4rem)] flex-col bg-white">
      <FormHeader title={location ? t("editTitle") : kind === "van" ? t("newVan") : t("newWh")} closeHref={back} />
      <div className="flex-1 space-y-6 px-5 py-7 sm:px-8">
        <FormRow label={t("type")} hint={t("typeHint")}>
          <div className="grid max-w-[460px] grid-cols-2 gap-3">
            {(["van", "warehouse"] as const).map((k) => (
              <button key={k} type="button" disabled={location?.is_default} onClick={() => setKind(k)}
                className={`group flex items-center gap-3 rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 disabled:opacity-60 ${kind === k ? "border-[#0f766e] bg-[#f3fbf8]" : "border-slate-200 hover:border-[#14a39a]"}`}>
                {k === "van" ? <VanArt size={44} /> : <WarehouseArt size={44} />}
                <span><span className="block text-[15px] font-semibold text-[#0b1f3a]">{k === "van" ? t("van") : t("warehouse")}</span>
                  <span className="block text-[12.5px] text-slate-500">{k === "van" ? t("vanSub") : t("warehouseSub")}</span></span>
              </button>
            ))}
          </div>
        </FormRow>
        {kind === "van" && (
          <FormRow label={t("tech")} htmlFor="loc-tech" width="max-w-[420px]" hint={t("techHint")}>
            <SearchSelect id="loc-tech" ariaLabel={t("tech")} value={tech} options={options} onChange={pickTech} placeholder={t("techPh")} />
            {members.filter((m) => m.role === "technician").length === 0 && (
              <p className="mt-1.5 text-[13px] text-slate-500">{t.rich("noTechs", { a: (c) => <a href="/dashboard/inventory/team/invite?role=technician" className="font-medium text-[#0f766e] hover:underline">{c}</a> })}</p>
            )}
          </FormRow>
        )}
        <FormRow label={t("name")} htmlFor="loc-name" required width="max-w-[420px]" hint={t("nameHint")}>
          <input id="loc-name" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} maxLength={60} placeholder={kind === "van" ? t("vanPh") : t("shopPh")} className={inputClass} />
        </FormRow>

        {extraSql && kind === "van" && (
          <>
            <FormRow label={t("vehicle")} hint={t("vehicleHint")} alignTop width="max-w-[560px]">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                {vField("make", t("make"), "sm:col-span-2")}{vField("model", t("model"), "sm:col-span-2")}{vField("year", t("year"), "sm:col-span-2")}
                {vField("plate", t("plate"), "sm:col-span-3")}{vField("vin", t("vin"), "col-span-2 sm:col-span-3")}
              </div>
            </FormRow>
            <FormRow label={t("photo")} alignTop width="max-w-[560px]">
              <div className="flex items-center gap-4">
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="group relative flex h-24 w-36 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-[#f6fbfa] transition-all hover:-translate-y-0.5 hover:border-[#14a39a]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {photo ? <img src={photo.url} alt={t("photo")} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" /> : <VanArt size={52} />}
                </button>
                <div className="space-y-1.5 text-[13.5px]">
                  <button type="button" onClick={() => fileRef.current?.click()} className="block font-semibold text-[#0f766e] hover:underline">{photo ? t("changePhoto") : t("addPhoto")}</button>
                  {photo && <button type="button" onClick={() => { setPhoto(null); setPhotoFile(null); }} className="block text-red-600 hover:underline">{t("removePhoto")}</button>}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { pickPhoto(e.target.files?.[0]); e.target.value = ""; }} />
              </div>
            </FormRow>
          </>
        )}

        {extraSql && kind === "warehouse" && (
          <>
            <FormRow label={t("address")} alignTop width="max-w-[560px]">
              <div className="grid gap-2.5 sm:grid-cols-6">
                <div className="sm:col-span-6">
                  <StreetAutocomplete value={addr.street ?? ""} country="US" placeholder={t("street")} className={inputClass} inputProps={{ autoComplete: "bp-off", "data-lpignore": "true", "data-1p-ignore": "true" }}
                    onChange={(street) => setAddr((a) => ({ ...a, street }))}
                    onPick={(p) => setAddr((a) => ({ street: p.street || a.street, city: p.city || a.city, state: (p.state || a.state || "").slice(0, 2).toUpperCase(), zip: (p.zip || a.zip || "").slice(0, 10) }))} />
                </div>
                <input value={addr.city ?? ""} onChange={(e) => setAddr((a) => ({ ...a, city: e.target.value }))} placeholder={t("city")} className={`${inputClass} sm:col-span-3`} />
                <input value={addr.state ?? ""} maxLength={2} onChange={(e) => setAddr((a) => ({ ...a, state: e.target.value.toUpperCase() }))} placeholder={t("state")} className={`${inputClass} uppercase sm:col-span-1`} />
                <input value={addr.zip ?? ""} inputMode="numeric" onChange={(e) => setAddr((a) => ({ ...a, zip: e.target.value }))} placeholder={t("zip")} className={`${inputClass} sm:col-span-2`} />
              </div>
            </FormRow>
            <FormRow label={t("main")} hint={t("mainHint")}>
              <button type="button" role="switch" aria-checked={main} disabled={location?.is_default} onClick={() => setMain((v) => !v)} className="flex items-center gap-3 py-1.5 disabled:opacity-70">
                <span className={`relative h-6 w-11 rounded-full transition-colors ${main ? "bg-[#0f766e]" : "bg-slate-300"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${main ? "left-[22px]" : "left-0.5"}`} /></span>
                <span className="text-[15px] text-slate-700">{location?.is_default ? t("isMain") : main ? t("makeMain") : t("notMain")}</span>
              </button>
            </FormRow>
          </>
        )}

        {extraSql && (
          <FormRow label={t("notes")} htmlFor="loc-notes" alignTop width="max-w-[560px]">
            <textarea id="loc-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} resize-y`} />
          </FormRow>
        )}

        {location && !location.is_default && (
          <FormRow label={t("status")} hint={t("statusHint")}>
            <button type="button" role="switch" aria-checked={active} onClick={() => setActive((v) => !v)} className="group flex items-center gap-3 py-1.5">
              <span className={`relative h-6 w-11 rounded-full transition-colors ${active ? "bg-[#0f766e]" : "bg-slate-300"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${active ? "left-[22px]" : "left-0.5"}`} />
              </span>
              <span className="text-[15px] text-slate-700">{active ? t("active") : t("inactive")}</span>
            </button>
          </FormRow>
        )}

        {kind === "van" && !location && items.length > 0 && (
          <div className="max-w-[1000px] border-t border-slate-200 pt-6">
            <SectionTitle>{tk("title")}</SectionTitle>
            <p className="-mt-3 mb-4 max-w-2xl text-[13.5px] text-slate-500">{kit.length ? tk("fromStandard") : tk("noStandard")}</p>
            <div className="max-w-[640px]"><KitEditor items={items} rows={kitRows} onChange={setKitRows} barcodes={barcodes} /></div>
          </div>
        )}
      </div>
      <SaveBar saving={saving} cancelHref={back} error={error} onDelete={location && !location.is_default && canEdit ? remove : undefined} deleteLabel={t("delete")} />
    </form>
  );
}
