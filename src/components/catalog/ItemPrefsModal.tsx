"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { ACCOUNTS, ItemType, UNITS } from "@/lib/catalog";
import { DEFAULT_PREFS, ItemPrefs, readItemPrefs, saveItemPrefs } from "@/lib/item-prefs";
import SelectMenu from "@/components/ui/SelectMenu";
import { InfoIcon, Tip } from "@/components/catalog/FormBits";

// Preferencias de Items (como "Preferences" de Zoho)
export default function ItemPrefsModal({ open, companyId, onClose }: { open: boolean; companyId: string; onClose: () => void }) {
  const [p, setP] = useState<ItemPrefs>(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (open) { setP(readItemPrefs(companyId)); setSaved(false); } }, [open, companyId]);
  const set = <K extends keyof ItemPrefs>(k: K, v: ItemPrefs[K]) => setP((o) => ({ ...o, [k]: v }));

  function save() { saveItemPrefs(companyId, p); setSaved(true); setTimeout(onClose, 500); }

  return (
    <Dialog open={open} onClose={onClose} className="relative z-[90]">
      <div className="fixed inset-0 bg-slate-900/40 animate-[bp-fade_0.2s_ease-out]" aria-hidden="true" />
      <div className="fixed inset-0 flex items-start justify-center overflow-y-auto p-4 sm:pt-16">
        <DialogPanel className="w-full max-w-xl rounded-2xl bg-white shadow-2xl animate-[bp-fade_0.25s_ease-out]">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <DialogTitle className="text-lg font-semibold text-[#0b1f3a]">Item Preferences</DialogTitle>
            <button type="button" onClick={onClose} aria-label="Close" className="group/x flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-600">
              <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform duration-300 group-hover/x:rotate-90" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
            </button>
          </div>
          <div className="space-y-5 px-6 py-5">
            <p className="text-sm text-slate-500">These defaults fill in every new item you create in this organization.</p>
            <Line label="Default type" tip="The type a new item starts with.">
              <SelectMenu value={p.defaultType} onChange={(v) => set("defaultType", v as ItemType)} options={[{ value: "goods", label: "Goods" }, { value: "service", label: "Service" }]} />
            </Line>
            <Line label="Default unit" tip="The unit a new item starts with. You can still change it on each item.">
              <SelectMenu value={p.defaultUnit} onChange={(v) => set("defaultUnit", v)} options={UNITS.map((u) => ({ value: u, label: u }))} />
            </Line>
            <Line label="Default account" tip="Where the income of new items is tracked in your reports.">
              <SelectMenu value={p.defaultAccount} onChange={(v) => set("defaultAccount", v)} options={ACCOUNTS.map((a) => ({ value: a, label: a }))} />
            </Line>
            <Check label="Make SKU required" text="Every item must have its own product or part code." checked={p.requireSku} onChange={(v) => set("requireSku", v)} />
            <Check label="Warn about duplicate item names" text="Ask before saving an item with a name that already exists." checked={p.warnDuplicates} onChange={(v) => set("warnDuplicates", v)} />
          </div>
          <div className="flex items-center gap-3 border-t border-slate-200 px-6 py-4">
            <button type="button" onClick={save} className="rounded-lg bg-[#0f766e] px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-[#0c5f59]">{saved ? "Saved ✓" : "Save"}</button>
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-5 py-2.5 text-[15px] font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

function Line({ label, tip, children }: { label: string; tip: string; children: React.ReactNode }) {
  return (
    <div className="grid items-center gap-1.5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
      <Tip text={tip}><span className="flex cursor-help items-center gap-1.5 text-[15px] text-slate-700"><span className="border-b border-dotted border-slate-400">{label}</span><InfoIcon /></span></Tip>
      {children}
    </div>
  );
}

function Check({ label, text, checked, onChange }: { label: string; text: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 transition-colors hover:border-[#14a39a] hover:bg-[#f0faf7]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0f766e]" />
      <span><span className="block text-[15px] font-medium text-[#0b1f3a]">{label}</span><span className="block text-sm text-slate-500">{text}</span></span>
    </label>
  );
}
