"use client";

import { useTranslations } from "next-intl";
import { useDayFmt, useJobError } from "@/i18n/useFmt";
import { useEquipText } from "@/i18n/useFormTx";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import SelectMenu from "@/components/ui/SelectMenu";
import DatePicker from "@/components/ui/DatePicker";
import BarcodeScanner from "@/components/catalog/BarcodeScanner";
import { confirmDelete } from "@/lib/confirm";
import { EQUIPMENT_COLS, Equipment, WARRANTY_META, warrantyOf } from "@/lib/job-forms";
import { EquipmentArt } from "@/components/jobs/forms/FormArt";

// =====================================================================
// Equipos del cliente (Paso 5.5). Viven en el Job Site: quedan guardados para la próxima visita.
//  · En un trabajo (teléfono, iPad o ficha de oficina): los de la dirección de ese trabajo.
//  · En la ficha del cliente: los de todas sus direcciones, agrupados.
//  · Marca, modelo, serie (se puede escanear la etiqueta) y garantía con su estado.
// =====================================================================
type Site = { id: string; label: string };
export type Draft = {
  id: string | null; address_id: string; kind: string; brand: string; model: string; serial: string; location_note: string; install_date: string;
  parts_warranty_until: string; labor_warranty_until: string; registered: boolean; tonnage: string; seer: string; refrigerant: string; notes: string; is_active: boolean;
};
const blank = (addressId: string): Draft => ({
  id: null, address_id: addressId, kind: "condenser", brand: "", model: "", serial: "", location_note: "", install_date: "", parts_warranty_until: "", labor_warranty_until: "",
  registered: false, tonnage: "", seer: "", refrigerant: "", notes: "", is_active: true,
});
const toDraft = (e: Equipment): Draft => ({
  id: e.id, address_id: e.address_id ?? "", kind: e.kind, brand: e.brand ?? "", model: e.model ?? "", serial: e.serial ?? "", location_note: e.location_note ?? "",
  install_date: e.install_date ?? "", parts_warranty_until: e.parts_warranty_until ?? "", labor_warranty_until: e.labor_warranty_until ?? "", registered: e.registered,
  tonnage: e.tonnage != null ? String(e.tonnage) : "", seer: e.seer != null ? String(e.seer) : "", refrigerant: e.refrigerant ?? "", notes: e.notes ?? "", is_active: e.is_active,
});

export default function SiteEquipment({ companyId, jobId, addressId, customerId, sites, variant = "office", readOnly = false, onToast }: {
  companyId: string; jobId?: string; addressId?: string | null; customerId?: string; sites?: Site[];
  variant?: "tech" | "office" | "customer"; readOnly?: boolean; onToast?: (m: string, err?: boolean) => void;
}) {
  const t = useTranslations("equipment");
  const tc = useTranslations("common");
  const eq = useEquipText();
  const fmtDate = useDayFmt();
  const [list, setList] = useState<Equipment[] | null>(null);
  const [off, setOff] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const tech = variant === "tech", byCustomer = variant === "customer";
  const canDelete = !tech && !readOnly;

  const load = useCallback(async () => {
    if (!byCustomer && !addressId) { setList([]); return; }
    const q = createClient().from("customer_equipment").select(EQUIPMENT_COLS);
    const { data, error } = await (byCustomer ? q.eq("customer_id", customerId!) : q.eq("address_id", addressId!)).order("is_active", { ascending: false }).order("created_at");
    if (error) { setOff(true); return; }
    setOff(false); setList((data ?? []) as Equipment[]);
  }, [byCustomer, addressId, customerId]);
  useEffect(() => { load(); }, [load]);

  if (off || !list) return null;
  const noSite = byCustomer ? !(sites ?? []).length : !addressId;
  const firstSite = byCustomer ? sites?.[0]?.id ?? "" : addressId ?? "";

  const row = (e: Equipment) => {
    const w = warrantyOf(e), meta = WARRANTY_META[w.status];
    const sub = [e.serial ? `S/N ${e.serial}` : t("noSerial"), e.location_note, e.install_date ? t("installedOn", { date: fmtDate(e.install_date) }) : ""].filter(Boolean).join(" · ");
    return (
      <button key={e.id} type="button" onClick={() => !readOnly && setDraft(toDraft(e))} disabled={readOnly}
        className={`group flex w-full items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5 text-left transition-colors duration-150 enabled:hover:bg-slate-50 disabled:cursor-default ${e.is_active ? "" : "opacity-60"}`}>
        <EquipmentArt size={36} className="shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-[14.5px] font-semibold text-[#0b1f3a]">{eq.equipmentName(e)}</span>
            {!e.is_active ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{t("replaced")}</span>
              : <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.cls}`}>{eq.warranty(w.status)}{w.until && w.status !== "unknown" ? ` · ${fmtDate(w.until)}` : ""}</span>}
          </span>
          <span className="block truncate text-[12.5px] text-slate-500">{sub}</span>
        </span>
        {!readOnly && <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-300 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[#0f766e]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m8 5 5 5-5 5" /></svg>}
      </button>
    );
  };
  const addBtn = !readOnly && !noSite && (
    <button type="button" onClick={() => setDraft(blank(firstSite))} className="rounded-lg px-2 py-1 text-[12.5px] font-semibold text-[#0f766e] transition-colors hover:bg-[#e9f7f4]">{t("addEquip")}</button>
  );
  const editor = draft && (
    <EquipmentEditor draft={draft} setDraft={setDraft} companyId={companyId} jobId={jobId} customerId={customerId} sites={byCustomer ? sites ?? [] : []} canDelete={canDelete}
      onDone={(m) => { setDraft(null); onToast?.(m); load(); }} />
  );

  // Ficha del cliente: por dirección
  if (byCustomer) {
    const groups = (sites ?? []).map((s) => ({ ...s, items: list.filter((e) => e.address_id === s.id) })).filter((g) => g.items.length);
    return (
      <div>
        {noSite ? <p className="py-2 text-center text-sm text-slate-400">{t("addAddressFirst")}</p>
          : groups.length === 0 ? <p className="py-2 text-center text-sm text-slate-400">{t("noneSaved")}</p>
          : groups.map((g) => (
            <div key={g.id} className="mb-3 last:mb-0">
              {(sites ?? []).length > 1 && <p className="mb-1.5 text-[12.5px] font-semibold text-slate-500">{g.label}</p>}
              <div className="space-y-2">{g.items.map(row)}</div>
            </div>
          ))}
        {addBtn && <div className="mt-2 flex justify-end">{addBtn}</div>}
        {editor}
      </div>
    );
  }

  const box = tech ? "mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3" : "rounded-2xl border border-slate-200 bg-white p-5";
  if (readOnly && !list.length) return null;
  return (
    <section className={box}>
      <div className="flex items-center justify-between gap-3">
        <h2 className={tech ? "text-[15px] font-semibold text-[#0b1f3a]" : "text-[16px] font-semibold text-[#0b1f3a]"}>{t("title")}</h2>
        {addBtn}
      </div>
      {noSite ? <p className="mt-2 text-[13.5px] text-slate-500">{t("noSite")} {tech ? t("noSiteTech") : t("noSiteOffice")}</p>
        : list.length === 0 ? <p className="mt-2 text-[13.5px] text-slate-500">{t("nothingYet")}</p>
        : <div className="mt-2 space-y-2">{list.map(row)}</div>}
      {editor}
    </section>
  );
}

// ---------- Agregar / editar un equipo ----------
export function EquipmentEditor({ draft: d, setDraft, companyId, jobId, customerId, sites, canDelete, onDone }: {
  draft: Draft; setDraft: (d: Draft | null) => void; companyId: string; jobId?: string; customerId?: string; sites: Site[]; canDelete: boolean; onDone: (msg: string) => void;
}) {
  const t = useTranslations("equipment");
  const tc = useTranslations("common");
  const eq = useEquipText();
  const jobErr = useJobError();
  const REFRIGERANTS = [{ value: "", label: t("notSet") }, ...["R-410A", "R-22", "R-32", "R-454B", "Other"].map((v) => ({ value: v, label: v === "Other" ? t("other") : v }))];
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [scan, setScan] = useState(false);
  const [more, setMore] = useState(Boolean(d.tonnage || d.seer || d.refrigerant || d.notes));
  const set = (p: Partial<Draft>) => { setErr(""); setDraft({ ...d, ...p }); };
  const w = warrantyOf(d.parts_warranty_until || d.labor_warranty_until ? { parts_warranty_until: d.parts_warranty_until || null, labor_warranty_until: d.labor_warranty_until || null } : { parts_warranty_until: null, labor_warranty_until: null });

  async function save() {
    if (busy) return;
    if (!d.brand.trim() && !d.model.trim() && !d.serial.trim()) return setErr(t("needOne"));
    const bad = [d.tonnage, d.seer].some((x) => x.trim() && !Number.isFinite(Number(x)));
    if (bad) return setErr(t("mustNumbers"));
    setBusy(true); setErr("");
    const sb = createClient();
    const fields = {
      kind: d.kind, brand: d.brand.trim(), model: d.model.trim(), serial: d.serial.trim(), location_note: d.location_note.trim(), install_date: d.install_date,
      parts_warranty_until: d.parts_warranty_until, labor_warranty_until: d.labor_warranty_until, registered: d.registered, tonnage: d.tonnage.trim(), seer: d.seer.trim(),
      refrigerant: d.refrigerant, notes: d.notes.trim(), is_active: d.is_active,
    };
    let error: { message?: string; hint?: string; code?: string } | null = null;
    if (jobId) {
      // Dentro de un trabajo: función firmada (queda en el historial del trabajo quién lo agregó)
      ({ error } = await sb.rpc("tech_save_equipment", { p_job: jobId, p: fields, p_id: d.id }));
    } else {
      const n = (v: string) => (v === "" ? null : v);
      const rowData = { ...fields, brand: n(fields.brand), model: n(fields.model), serial: n(fields.serial), location_note: n(fields.location_note), install_date: n(fields.install_date),
        parts_warranty_until: n(fields.parts_warranty_until), labor_warranty_until: n(fields.labor_warranty_until), tonnage: fields.tonnage === "" ? null : Number(fields.tonnage),
        seer: fields.seer === "" ? null : Number(fields.seer), refrigerant: n(fields.refrigerant), notes: n(fields.notes), address_id: d.address_id, updated_at: new Date().toISOString() };
      ({ error } = d.id ? await sb.from("customer_equipment").update(rowData).eq("id", d.id)
        : await sb.from("customer_equipment").insert({ ...rowData, company_id: companyId, customer_id: customerId }));
    }
    setBusy(false);
    if (error) return setErr(error.message?.includes("numeric") ? t("smallNumbers") : jobErr(error));
    onDone(d.id ? t("updated") : t("saved"));
  }
  async function remove() {
    if (!d.id || busy) return;
    if (!(await confirmDelete({ title: t("deleteQ", { kind: eq.kindLabel(d.kind).toLowerCase() }), message: t("deleteBody") }))) return;
    setBusy(true);
    const { error } = await createClient().from("customer_equipment").delete().eq("id", d.id);
    setBusy(false);
    if (error) return setErr(jobErr(error));
    onDone(t("deleted"));
  }

  const lab = "mb-1 block text-[12px] font-medium text-slate-500";
  const inp = "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[16px] text-[#0b1f3a] outline-none transition-colors placeholder:text-slate-400 focus:border-[#0f766e] focus:bg-white";
  const date = (key: "install_date" | "parts_warranty_until" | "labor_warranty_until", label: string) => (
    <div>
      <span className="mb-1 flex items-center justify-between text-[12px] font-medium text-slate-500">{label}
        {d[key] && <button type="button" onClick={() => set({ [key]: "" } as Partial<Draft>)} className="font-semibold text-slate-400 hover:text-[#e11d48]">{t("clear")}</button>}</span>
      <DatePicker value={d[key]} onChange={(v) => set({ [key]: v } as Partial<Draft>)} />
    </div>
  );
  const check = (on: boolean, label: string, onClick: () => void) => (
    <button type="button" role="checkbox" aria-checked={on} onClick={onClick} className="flex items-center gap-2.5 py-1 text-left">
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors duration-150 ${on ? "border-[#0f766e] bg-[#0f766e] text-white" : "border-slate-300"}`}>
        {on && <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7" /></svg>}
      </span>
      <span className="text-[14.5px] text-[#0b1f3a]">{label}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={t("equipment")} onClick={() => !busy && setDraft(null)}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl bg-white animate-[bp-sheet_0.22s_ease-out] sm:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <EquipmentArt size={34} className="shrink-0" />
          <p className="min-w-0 flex-1 truncate text-[16px] font-semibold text-[#0b1f3a]">{d.id ? t("edit") : t("add")}</p>
          <button type="button" onClick={() => setDraft(null)} aria-label={tc("close")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-all duration-200 hover:rotate-90 hover:bg-red-50 hover:text-red-600">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 5l10 10M15 5 5 15" /></svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          <div className="grid grid-cols-2 gap-x-3 gap-y-3">
            {sites.length > 1 && (
              <div className="col-span-2"><span className={lab}>{t("jobSite")}</span>
                <SelectMenu value={d.address_id} ariaLabel={t("jobSite")} options={sites.map((s) => ({ value: s.id, label: s.label }))} onChange={(v) => set({ address_id: v })} /></div>
            )}
            <div className="col-span-2"><span className={lab}>{t("type")}</span>
              <SelectMenu value={d.kind} ariaLabel={t("type")} options={eq.kindOptions} onChange={(v) => set({ kind: v })} /></div>
            <label className="block"><span className={lab}>{t("brand")}</span><input value={d.brand} maxLength={60} onChange={(e) => set({ brand: e.target.value })} placeholder="Trane" className={inp} /></label>
            <label className="block"><span className={lab}>{t("model")}</span><input value={d.model} maxLength={60} autoCapitalize="characters" onChange={(e) => set({ model: e.target.value })} placeholder="4TTR4036" className={inp} /></label>
            <div className="col-span-2">
              <label htmlFor="eq-serial" className={lab}>{t("serial")}</label>
              <div className="flex gap-2">
                <input id="eq-serial" value={d.serial} maxLength={60} autoCapitalize="characters" onChange={(e) => set({ serial: e.target.value })} placeholder={t("serialPh")} className={inp} />
                <button type="button" onClick={() => setScan(true)} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[13.5px] font-semibold text-[#0f766e] transition-colors hover:bg-[#e9f7f4]">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 8v8M11 8v8M14 8v8M17 8v8" /></svg>{t("scan")}
                </button>
              </div>
            </div>
            <label className="col-span-2 block"><span className={lab}>{t("where")}</span><input value={d.location_note} maxLength={80} onChange={(e) => set({ location_note: e.target.value })} placeholder={t("wherePh")} className={inp} /></label>
          </div>

          <p className="mb-2 mt-5 flex flex-wrap items-center gap-2 text-[12.5px] font-semibold uppercase tracking-wide text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-[#e8713a]" />{t("warrantyTitle")}
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal ${WARRANTY_META[w.status].cls}`}>{eq.warranty(w.status)}</span></p>
          <div className="grid gap-x-3 gap-y-3 sm:grid-cols-3">
            {date("install_date", t("installedLbl"))}
            {date("parts_warranty_until", t("partsUntil"))}
            {date("labor_warranty_until", t("laborUntil"))}
          </div>
          <div className="mt-2">{check(d.registered, t("registered"), () => set({ registered: !d.registered }))}</div>

          <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} className="mt-3 flex items-center gap-1 text-[13px] font-semibold text-[#0f766e]">
            <svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform duration-150 ${more ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 8 5 5 5-5" /></svg>{t("moreDetails")}
          </button>
          {more && (
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-3">
              <label className="block"><span className={lab}>{t("tonnage")}</span><input inputMode="decimal" value={d.tonnage} maxLength={5} onChange={(e) => set({ tonnage: e.target.value.replace(/[^\d.]/g, "") })} placeholder="3.5" className={inp} /></label>
              <label className="block"><span className={lab}>SEER</span><input inputMode="decimal" value={d.seer} maxLength={5} onChange={(e) => set({ seer: e.target.value.replace(/[^\d.]/g, "") })} placeholder="16" className={inp} /></label>
              <div className="col-span-2 sm:col-span-1"><span className={lab}>{t("refrigerant")}</span><SelectMenu value={d.refrigerant} ariaLabel={t("refrigerant")} options={REFRIGERANTS} onChange={(v) => set({ refrigerant: v })} /></div>
              <label className="col-span-full block"><span className={lab}>{tc("notes")}</span><textarea rows={2} maxLength={1000} value={d.notes} onChange={(e) => set({ notes: e.target.value })} className={`${inp} resize-y`} /></label>
            </div>
          )}
          {d.id && <div className="mt-3 border-t border-slate-100 pt-2">{check(!d.is_active, t("wasReplaced"), () => set({ is_active: !d.is_active }))}</div>}
        </div>

        <div className="border-t border-slate-100 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5">
          {err && <p role="alert" className="mb-2 rounded-lg bg-[#fff1f2] px-3 py-2 text-[13px] font-medium text-[#be123c]">{err}</p>}
          <div className="flex items-center gap-2">
            {d.id && canDelete && <button type="button" onClick={remove} disabled={busy} className="h-10 rounded-xl px-3 text-[13.5px] font-semibold text-slate-400 transition-colors hover:bg-[#fff1f2] hover:text-[#e11d48] disabled:opacity-50">{tc("delete")}</button>}
            <span className="flex-1" />
            <button type="button" onClick={() => setDraft(null)} disabled={busy} className="h-10 rounded-xl border border-slate-200 px-3.5 text-[13.5px] font-semibold text-slate-700 transition-colors hover:bg-slate-50">{tc("cancel")}</button>
            <button type="button" onClick={save} disabled={busy} className="h-10 rounded-xl bg-[#0f766e] px-5 text-[14px] font-semibold text-white transition-all duration-150 hover:bg-[#0c5f59] active:scale-[0.98] disabled:opacity-60">{busy ? tc("saving") : tc("save")}</button>
          </div>
        </div>
      </div>
      <span onClick={(e) => e.stopPropagation()}>
        <BarcodeScanner open={scan} everywhere onClose={() => setScan(false)} onCode={(code) => { setScan(false); set({ serial: code.trim().slice(0, 60) }); }} />
      </span>
    </div>
  );
}
