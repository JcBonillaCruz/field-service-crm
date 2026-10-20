"use client";

import { useState } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { createClient } from "@/lib/supabase/client";
import { CatalogProduct } from "@/lib/catalog";
import { inputClass } from "@/components/customers/ui";

// Ventana "New Product" (como Zoho): el grupo al que se aplica un cupón
export default function ProductModal({ open, companyId, onClose, onCreated }: {
  open: boolean; companyId: string; onClose: () => void; onCreated: (p: CatalogProduct) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emails, setEmails] = useState("");
  const [url, setUrl] = useState("");
  const [autoNumbers, setAutoNumbers] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function close() { setName(""); setDescription(""); setEmails(""); setUrl(""); setAutoNumbers(false); setError(""); onClose(); }

  async function save() {
    if (!name.trim()) return setError("Enter the product name.");
    setSaving(true);
    const { data, error: dbErr } = await createClient().from("catalog_products")
      .insert({ company_id: companyId, name: name.trim(), description: description.trim() || null, notify_emails: emails.trim() || null, redirect_url: url.trim() || null, auto_numbers: autoNumbers })
      .select("id, name, description, notify_emails, redirect_url, auto_numbers").single();
    setSaving(false);
    if (dbErr || !data) return setError(dbErr?.code === "23505" ? "A product with this name already exists." : "The product couldn't be saved.");
    onCreated(data as CatalogProduct);
    close();
  }

  const label = "mb-1.5 block text-[15px] text-slate-700";
  return (
    <Dialog open={open} onClose={close} className="relative z-[70]">
      <div className="fixed inset-0 bg-slate-900/40" aria-hidden="true" />
      <div className="fixed inset-0 flex items-start justify-center overflow-y-auto p-4 pt-16">
        <DialogPanel className="w-full max-w-xl rounded-xl bg-white shadow-2xl">
          <div className="flex items-center justify-between rounded-t-xl border-b border-slate-200 bg-[#fafbfc] px-6 py-4">
            <DialogTitle className="text-xl font-medium text-[#0b1f3a]">New Product</DialogTitle>
            <button type="button" onClick={close} aria-label="Close" className="rounded-full p-1.5 text-red-500 hover:bg-red-50">
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
            </button>
          </div>
          <div className="space-y-5 px-6 py-6">
            <div>
              <label htmlFor="pm-name" className="mb-1.5 block text-[15px] text-red-600">Name*</label>
              <input id="pm-name" autoFocus value={name} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder="e.g. HVAC Maintenance Plans" className={inputClass} />
            </div>
            <div>
              <label htmlFor="pm-desc" className={label}>Description</label>
              <textarea id="pm-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="pm-emails" className={label}>Email Notification Recipients</label>
              <input id="pm-emails" value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="office@yourcompany.com, you@yourcompany.com" className={inputClass} />
              <p className="mt-1.5 text-[13px] text-slate-500">Who gets an email when someone signs up for this product. Separate emails with commas.</p>
            </div>
            <div>
              <label htmlFor="pm-url" className={label}>Redirection URL</label>
              <input id="pm-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://yourwebsite.com/thank-you" className={inputClass} />
              <p className="mt-1.5 text-[13px] text-slate-500">Where customers go after they sign up online.</p>
            </div>
            <label className="flex cursor-pointer items-center gap-2.5 text-[15px] text-slate-700">
              <input type="checkbox" checked={autoNumbers} onChange={(e) => setAutoNumbers(e.target.checked)} className="h-4 w-4 rounded accent-[#0f766e]" />
              Auto-generate subscription numbers for this product
            </label>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          </div>
          <div className="flex gap-3 border-t border-slate-200 px-6 py-4">
            <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-[#0f766e] px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-[#0c5f59] disabled:opacity-60">{saving ? "Saving..." : "Save"}</button>
            <button type="button" onClick={close} className="rounded-lg border border-slate-200 px-5 py-2.5 text-[15px] font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
