"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { confirmDelete } from "@/lib/confirm";
import { inputClass } from "@/components/customers/ui";
import { Toast } from "@/components/sales/SalesBits";
import { AlertFrequency, InvCategory, InvItem } from "@/lib/inventory";
import KitEditor, { KitRow } from "@/components/inventory/KitEditor";
import { sheetItem } from "@/components/ui/sheet";
import { useTranslations } from "next-intl";

const FREQ: AlertFrequency[] = ["once", "daily", "weekly"];

// Ajustes del inventario: categorías y avisos de stock bajo
export default function InventorySettings({ companyId, categories, counts, needsSql, frequency, canEditAlerts, items = [], kit = null, barcodes }: {
  companyId: string; categories: InvCategory[]; counts: Record<string, number>; needsSql: boolean; frequency: AlertFrequency; canEditAlerts: boolean;
  items?: InvItem[]; kit?: KitRow[] | null; barcodes?: Record<string, string>; // Paso 6.12: kit estándar (null = falta el SQL 6.12)
}) {
  const t = useTranslations("invSettings");
  const tc = useTranslations("common");
  const [freq, setFreq] = useState<AlertFrequency>(frequency);
  async function saveFreq(v: AlertFrequency) {
    if (!canEditAlerts) return setError(t("eRole"));
    const prev = freq; setFreq(v); setError("");
    const { error: err } = await createClient().from("inventory_settings").upsert({ company_id: companyId, alert_frequency: v, updated_at: new Date().toISOString() });
    if (err) { setFreq(prev); return setError(t("eSql")); }
    say(t("freqSaved"));
  }
  const router = useRouter();
  const [kitRows, setKitRows] = useState<KitRow[]>(kit ?? []);
  const [kitDirty, setKitDirty] = useState(false);
  async function saveKit() {
    if (!canEditAlerts) return setError(t("eRole"));
    const { error: err } = await createClient().from("inventory_settings").upsert({ company_id: companyId, alert_frequency: freq, van_kit: kitRows, updated_at: new Date().toISOString() });
    if (err) return setError(t("eSql"));
    setKitDirty(false); say(t("kitSaved"));
  }
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2400); };
  const dupMsg = (code?: string) => (code === "23505" ? t("exists") : tc("cantSave"));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true); setError("");
    const { error: err } = await createClient().from("item_categories").insert({ company_id: companyId, name: name.trim() });
    setBusy(false);
    if (err) return setError(dupMsg(err.code));
    setName(""); say(t("added")); router.refresh();
  }
  async function rename(id: string) {
    if (!editName.trim()) return;
    const { error: err } = await createClient().from("item_categories").update({ name: editName.trim() }).eq("id", id);
    if (err) return setError(dupMsg(err.code));
    setEditing(null); setError(""); say(t("renamed")); router.refresh();
  }
  async function remove(c: InvCategory) {
    const n = counts[c.id] ?? 0;
    if (!(await confirmDelete({ title: t("delQ", { name: c.name }), message: n ? t("delMsg", { n }) : undefined }))) return;
    const { error: err } = await createClient().from("item_categories").delete().eq("id", c.id);
    if (err) return setError(t("eDel"));
    say(t("deleted")); router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-5 lg:px-8 lg:pt-7">
      <h1 className="text-[22px] font-semibold tracking-tight text-[#0b1f3a] lg:text-2xl">{t("title")}</h1>
      <p className="mt-0.5 text-sm text-slate-500">{t("subtitle")}</p>
      {needsSql && <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{t.rich("needsSql", { b: (c) => <b>{c}</b> })}</p>}

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-[16px] font-semibold text-[#0b1f3a]">{t("cats")}</h2>
          <p className="text-[13px] text-slate-500">{t("catsEx")}</p>
        </div>
        <form onSubmit={add} className="flex gap-2 border-b border-slate-100 px-5 py-4">
          <input value={name} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder={t("newPh")} maxLength={60} className={inputClass} />
          <button type="submit" disabled={busy || !name.trim()} className="shrink-0 rounded-lg bg-[#0f766e] px-4 text-[15px] font-semibold text-white transition-colors hover:bg-[#0c5f59] disabled:opacity-50">{tc("add")}</button>
        </form>
        {error && <p role="alert" className="px-5 pt-3 text-sm text-red-600">{error}</p>}
        {categories.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">{t("none")}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {categories.map((c) => (
              <li key={c.id} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[#f6fbfa]">
                {editing === c.id ? (
                  <>
                    <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={60}
                      onKeyDown={(e) => { if (e.key === "Enter") rename(c.id); if (e.key === "Escape") setEditing(null); }} className={`${inputClass} py-2`} />
                    <button type="button" onClick={() => rename(c.id)} className="rounded-lg bg-[#0f766e] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0c5f59]">{tc("save")}</button>
                    <button type="button" onClick={() => setEditing(null)} className="px-2 text-sm text-slate-500 hover:text-slate-700">{tc("cancel")}</button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-[15px] text-slate-800">{c.name}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[12px] tabular-nums text-slate-500">{t("nItems", { n: counts[c.id] ?? 0 })}</span>
                    <button type="button" onClick={() => { setEditing(c.id); setEditName(c.name); }} aria-label={t("renameX", { name: c.name })}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-white hover:text-[#0f766e] hover:shadow-sm lg:opacity-0 lg:group-hover:opacity-100">
                      <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform hover:-rotate-12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M13.5 3.5l3 3L7 16H4v-3z" /></svg>
                    </button>
                    <button type="button" onClick={() => remove(c)} aria-label={t("deleteX", { name: c.name })}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-red-50 hover:text-red-600 lg:opacity-0 lg:group-hover:opacity-100">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13" /></svg>
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-[16px] font-semibold text-[#0b1f3a]">{t("alerts")}</h2>
          <p className="text-[13px] text-slate-500">{t("alertsHint")}</p>
        </div>
        <div className="space-y-1.5 px-4 py-4">
          {FREQ.map((f) => (
            <button key={f} type="button" onClick={() => saveFreq(f)} className={sheetItem(freq === f)}>
              <span><span className="block font-medium">{t(`f.${f}`)}</span><span className="block text-[13px] text-slate-500">{t(`f.${f}Text`)}</span></span>
              {freq === f && <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-[#0f766e]" fill="currentColor"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" /></svg>}
            </button>
          ))}
        </div>
        <p className="border-t border-slate-100 px-5 py-3 text-[12.5px] text-slate-500">{t("phoneHint")}</p>
      </section>
      {kit && (
        <section id="kit" className="mt-5 scroll-mt-20 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-[16px] font-semibold text-[#0b1f3a]">{t("kit")}</h2>
            <p className="text-[13px] text-slate-500">{t("kitHint")}</p>
          </div>
          <div className="px-5 py-4">
            <KitEditor items={items} rows={kitRows} barcodes={barcodes} onChange={(r) => { setKitRows(r); setKitDirty(true); }} />
            {kitDirty && <button type="button" onClick={saveKit} className="mt-4 rounded-lg bg-[#0f766e] px-4 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#0c5f59]">{t("saveKit")}</button>}
          </div>
        </section>
      )}
      <Toast text={toast} />
    </div>
  );
}
