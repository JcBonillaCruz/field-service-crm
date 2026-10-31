"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { confirmDelete } from "@/lib/confirm";
import { inputClass } from "@/components/customers/ui";
import { Toast } from "@/components/sales/SalesBits";
import { AlertFrequency, InvCategory } from "@/lib/inventory";
import { sheetItem } from "@/components/ui/sheet";

const FREQ: { value: AlertFrequency; label: string; text: string }[] = [
  { value: "once", label: "Once", text: "One alert when an item reaches its minimum." },
  { value: "daily", label: "Every day", text: "Repeat every day while it stays low." },
  { value: "weekly", label: "Every week", text: "Repeat once a week while it stays low." },
];

// Ajustes del inventario: categorías y avisos de stock bajo
export default function InventorySettings({ companyId, categories, counts, needsSql, frequency, canEditAlerts }: {
  companyId: string; categories: InvCategory[]; counts: Record<string, number>; needsSql: boolean; frequency: AlertFrequency; canEditAlerts: boolean;
}) {
  const [freq, setFreq] = useState<AlertFrequency>(frequency);
  async function saveFreq(v: AlertFrequency) {
    if (!canEditAlerts) return setError("Only the owner or a manager can change alerts.");
    const prev = freq; setFreq(v); setError("");
    const { error: err } = await createClient().from("inventory_settings").upsert({ company_id: companyId, alert_frequency: v, updated_at: new Date().toISOString() });
    if (err) { setFreq(prev); return setError("It couldn't be saved. Did you run the SQL for Paso 4.2?"); }
    say("Alert frequency saved");
  }
  const router = useRouter();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const say = (t: string) => { setToast(t); setTimeout(() => setToast(""), 2400); };
  const dupMsg = (code?: string) => (code === "23505" ? "That category already exists." : "It couldn't be saved. Try again.");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true); setError("");
    const { error: err } = await createClient().from("item_categories").insert({ company_id: companyId, name: name.trim() });
    setBusy(false);
    if (err) return setError(dupMsg(err.code));
    setName(""); say("Category added"); router.refresh();
  }
  async function rename(id: string) {
    if (!editName.trim()) return;
    const { error: err } = await createClient().from("item_categories").update({ name: editName.trim() }).eq("id", id);
    if (err) return setError(dupMsg(err.code));
    setEditing(null); setError(""); say("Category renamed"); router.refresh();
  }
  async function remove(c: InvCategory) {
    const n = counts[c.id] ?? 0;
    if (!(await confirmDelete({ title: `Delete "${c.name}"?`, message: n ? `${n} item${n === 1 ? "" : "s"} will stay in your inventory without a category.` : undefined }))) return;
    const { error: err } = await createClient().from("item_categories").delete().eq("id", c.id);
    if (err) return setError("It couldn't be deleted.");
    say("Category deleted"); router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-5 lg:px-8 lg:pt-7">
      <h1 className="text-[22px] font-semibold tracking-tight text-[#0b1f3a] lg:text-2xl">Inventory settings</h1>
      <p className="mt-0.5 text-sm text-slate-500">Organize your products so your team finds them fast.</p>
      {needsSql && <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Run <b>paso-4.1-inventory.sql</b> in Supabase first.</p>}

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-[16px] font-semibold text-[#0b1f3a]">Categories</h2>
          <p className="text-[13px] text-slate-500">e.g. Electrical, Refrigerant, Filters, Plumbing, Cleaning supplies</p>
        </div>
        <form onSubmit={add} className="flex gap-2 border-b border-slate-100 px-5 py-4">
          <input value={name} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder="New category name" maxLength={60} className={inputClass} />
          <button type="submit" disabled={busy || !name.trim()} className="shrink-0 rounded-lg bg-[#0f766e] px-4 text-[15px] font-semibold text-white transition-colors hover:bg-[#0c5f59] disabled:opacity-50">Add</button>
        </form>
        {error && <p role="alert" className="px-5 pt-3 text-sm text-red-600">{error}</p>}
        {categories.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">No categories yet. You can also create them while adding a product.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {categories.map((c) => (
              <li key={c.id} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[#f6fbfa]">
                {editing === c.id ? (
                  <>
                    <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={60}
                      onKeyDown={(e) => { if (e.key === "Enter") rename(c.id); if (e.key === "Escape") setEditing(null); }} className={`${inputClass} py-2`} />
                    <button type="button" onClick={() => rename(c.id)} className="rounded-lg bg-[#0f766e] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0c5f59]">Save</button>
                    <button type="button" onClick={() => setEditing(null)} className="px-2 text-sm text-slate-500 hover:text-slate-700">Cancel</button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-[15px] text-slate-800">{c.name}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[12px] tabular-nums text-slate-500">{counts[c.id] ?? 0} items</span>
                    <button type="button" onClick={() => { setEditing(c.id); setEditName(c.name); }} aria-label={`Rename ${c.name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-white hover:text-[#0f766e] hover:shadow-sm lg:opacity-0 lg:group-hover:opacity-100">
                      <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform hover:-rotate-12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M13.5 3.5l3 3L7 16H4v-3z" /></svg>
                    </button>
                    <button type="button" onClick={() => remove(c)} aria-label={`Delete ${c.name}`}
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
          <h2 className="text-[16px] font-semibold text-[#0b1f3a]">Low stock alerts</h2>
          <p className="text-[13px] text-slate-500">When the warehouse or a van reaches the minimum you set on an item, you get a notification on your phone and in the bell.</p>
        </div>
        <div className="space-y-1.5 px-4 py-4">
          {FREQ.map((f) => (
            <button key={f.value} type="button" onClick={() => saveFreq(f.value)} className={sheetItem(freq === f.value)}>
              <span><span className="block font-medium">{f.label}</span><span className="block text-[13px] text-slate-500">{f.text}</span></span>
              {freq === f.value && <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-[#0f766e]" fill="currentColor"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" /></svg>}
            </button>
          ))}
        </div>
        <p className="border-t border-slate-100 px-5 py-3 text-[12.5px] text-slate-500">Phone alerts need notifications turned on in the app (bell → enable alerts on this device).</p>
      </section>
      <Toast text={toast} />
    </div>
  );
}
