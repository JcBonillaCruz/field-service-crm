"use client";

import { bustCache } from "@/lib/cache-client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SalesModule, SalesPrefs } from "@/lib/sales";
import { inputClass } from "@/components/customers/ui";
import { SlideOver, XButton, btnGhost, btnPrimary } from "@/components/sales/SalesBits";
import { Tip } from "@/components/catalog/FormBits";

const FIELDS: Record<SalesModule, [string, string, string, string][]> = {
  quotes: [["Quote Number", "Text Box (Single Line)", "Yes", "No"], ["Customer Name", "Lookup", "Yes", "Yes"], ["Quote Date", "Date", "Yes", "Yes"],
    ["Expiry Date", "Date", "No", "Yes"], ["Reference#", "Text Box (Single Line)", "No", "Yes"], ["Salesperson", "Text Box (Single Line)", "No", "Yes"],
    ["Subject", "Text Box (Single Line)", "No", "Yes"], ["Terms & Conditions", "Text Box (Multi-line)", "No", "Yes"]],
  invoices: [["Invoice#", "Text Box (Single Line)", "Yes", "Yes"], ["Customer Name", "Lookup", "Yes", "Yes"], ["Invoice Date", "Date", "Yes", "Yes"],
    ["Terms", "Dropdown", "No", "Yes"], ["Due Date", "Date", "No", "Yes"], ["Order Number", "Text Box (Single Line)", "No", "Yes"],
    ["Discount", "Percent", "No", "Yes"], ["Salesperson", "Text Box (Single Line)", "No", "Yes"], ["Subject", "Text Box (Single Line)", "No", "Yes"],
    ["Terms & Conditions", "Text Box (Multi-line)", "No", "Yes"]],
  subscriptions: [["Subscription Number", "Text Box (Single Line)", "Yes", "Yes"], ["Profile Name", "Text Box (Single Line)", "Yes", "No"],
    ["Bill Every", "Number", "Yes", "No"], ["Start Date", "Date", "No", "No"], ["Expires After", "Number", "No", "No"], ["Salesperson", "Text Box (Single Line)", "No", "Yes"]],
};

export default function PrefsPanel({ open, onClose, module, companyId, prefs }: {
  open: boolean; onClose: () => void; module: SalesModule; companyId: string; prefs: SalesPrefs;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"prefs" | "fields">("prefs");
  const [p, setP] = useState<SalesPrefs>(prefs);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setP(prefs); setMsg(""); setTab("prefs"); } }, [open, prefs]);

  const qs = p.quote_settings; const is = p.invoice_settings;
  const setQ = (patch: Partial<SalesPrefs["quote_settings"]>) => setP((x) => ({ ...x, quote_settings: { ...x.quote_settings, ...patch } }));
  const setI = (patch: Partial<SalesPrefs["invoice_settings"]>) => setP((x) => ({ ...x, invoice_settings: { ...x.invoice_settings, ...patch } }));
  const setO = (patch: Partial<SalesPrefs["org_info"]>) => setP((x) => ({ ...x, org_info: { ...x.org_info, ...patch } }));

  async function uploadLogo(file?: File) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return setMsg("The logo must be smaller than 2 MB.");
    if (!["image/png", "image/jpeg"].includes(file.type)) return setMsg("Use a PNG or JPG logo so it also shows in the PDF.");
    setUploading(true);
    const supabase = createClient();
    const path = `${companyId}/logo-${Date.now()}.${(file.name.split(".").pop() || "png").toLowerCase()}`;
    const { error } = await supabase.storage.from("org-logos").upload(path, file, { upsert: true });
    setUploading(false);
    if (error) return setMsg("The logo couldn't be uploaded. Did you run the SQL for Paso 3.30?");
    setP((x) => ({ ...x, logo_url: supabase.storage.from("org-logos").getPublicUrl(path).data.publicUrl }));
  }

  async function save() {
    setSaving(true); setMsg("");
    const { error } = await createClient().from("sales_prefs").upsert({
      company_id: companyId, quote_prefix: p.quote_prefix, quote_next: Math.max(1, Number(p.quote_next) || 1), invoice_prefix: p.invoice_prefix,
      invoice_next: Math.max(1, Number(p.invoice_next) || 1), sub_prefix: p.sub_prefix, sub_next: Math.max(1, Number(p.sub_next) || 1),
      quote_settings: p.quote_settings, invoice_settings: p.invoice_settings, org_info: p.org_info, logo_url: p.logo_url, updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) return setMsg("Preferences couldn't be saved. Did you run the SQL for Paso 3.30?");
    await bustCache("prefs"); router.refresh();
    onClose();
  }

  const check = (label: string, on: boolean, set: (v: boolean) => void, hint?: string) => (
    <label className="flex cursor-pointer items-start gap-3 py-2 text-[15px] text-slate-700">
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#0f766e]" />
      <span>{label}{hint && <span className="mt-0.5 block text-[13px] text-slate-500">{hint}</span>}</span>
    </label>
  );
  const radio = (name: string, label: string, on: boolean, set: () => void, hint?: string) => (
    <label className="flex cursor-pointer items-start gap-3 py-1.5 text-[15px] text-slate-700">
      <input type="radio" name={name} checked={on} onChange={set} className="mt-1 h-4 w-4 shrink-0 accent-[#0f766e]" />
      <span>{label}{hint && <span className="ml-1 text-[13px] text-slate-500">{hint}</span>}</span>
    </label>
  );
  const H = ({ children }: { children: React.ReactNode }) => <h3 className="mb-1 mt-6 text-[16px] font-semibold text-[#0b1f3a] first:mt-0">{children}</h3>;

  const header = (
    <div className="flex items-center gap-6 border-b border-slate-200 px-5">
      {([["prefs", "Preferences"], ["fields", "Fields"]] as const).map(([k, l]) => (
        <button key={k} type="button" onClick={() => setTab(k)}
          className={`relative py-4 text-[16px] transition-colors ${tab === k ? "font-semibold text-[#0f766e]" : "text-slate-600 hover:text-[#0b1f3a]"}`}>
          {l}<span className={`absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-[#0f766e] transition-transform duration-200 ${tab === k ? "scale-x-100" : "scale-x-0"}`} />
        </button>
      ))}
      <span className="ml-auto" title="Coming soon"><span className="text-sm text-slate-400">All Preferences</span></span>
      <XButton onClick={onClose} className="!text-red-500" />
    </div>
  );

  const prefix = module === "quotes" ? "quote" : module === "invoices" ? "invoice" : "sub";

  return (
    <SlideOver open={open} onClose={onClose} width="max-w-[640px]" header={header}>
      {tab === "fields" ? (
        <div className="p-5">
          <div className="mb-3 flex justify-end">
            <Tip text="Custom fields are coming soon." side="top">
              <span className="flex cursor-not-allowed items-center gap-1 rounded-lg bg-[#0f766e]/50 px-3 py-1.5 text-sm font-medium text-white">+ New</span>
            </Tip>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="bg-[#fafbfc] text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">Field Name</th><th className="px-4 py-2.5">Data Type</th><th className="px-4 py-2.5">Mandatory</th><th className="px-4 py-2.5">Show in all PDFs</th><th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {FIELDS[module].map(([n, t, m, pdf]) => (
                  <tr key={n} className="border-t border-slate-100 hover:bg-[#f6fbfa]">
                    <td className="px-4 py-2.5 text-[#0b1f3a]"><svg viewBox="0 0 20 20" className="mr-2 inline h-3.5 w-3.5 -translate-y-px text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="4.5" y="9" width="11" height="8" rx="1.5" /><path d="M7 9V6.5a3 3 0 0 1 6 0V9" /></svg>{n}</td>
                    <td className="px-4 py-2.5 text-slate-600">{t}</td><td className="px-4 py-2.5 text-slate-600">{m}</td><td className="px-4 py-2.5 text-slate-600">{pdf}</td>
                    <td className="px-4 py-2.5 font-medium text-[#16a34a]">Active</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex min-h-full flex-col">
          <div className="flex-1 space-y-1 p-5">
            {module === "quotes" && (
              <>
                {check("Allow editing of accepted quotes", !!qs.allow_edit_accepted, (v) => setQ({ allow_edit_accepted: v }))}
                {check("Allow customers to accept or decline the quotes via the public link", !!qs.allow_customer_respond, (v) => setQ({ allow_customer_respond: v }), "Shows Accept and Decline buttons on the shared quote page.")}
                <H>Automate accepted quotes to invoices conversion</H>
                {radio("ac", "Don't convert accepted quotes automatically", (qs.auto_convert ?? "none") === "none", () => setQ({ auto_convert: "none" }))}
                {radio("ac", "Convert accepted quotes to draft invoices", qs.auto_convert === "draft", () => setQ({ auto_convert: "draft" }), "(Invoice will be saved as a draft.)")}
                {radio("ac", "Convert accepted quotes to invoices and mark them as sent", qs.auto_convert === "send", () => setQ({ auto_convert: "send" }))}
                <H>Zero-Value Line Items</H>
                {check("Hide zero-value line items", !!qs.hide_zero_lines, (v) => setQ({ hide_zero_lines: v }), "Hides lines with a $0.00 amount on the quote PDF and the shared link. They stay visible while editing.")}
                <H>Select the fields to retain when you convert a quote into an invoice</H>
                {check("Customer Notes", !!qs.retain_notes, (v) => setQ({ retain_notes: v }))}
                {check("Terms & Conditions", !!qs.retain_terms, (v) => setQ({ retain_terms: v }))}
                {check("Address (Job Site)", qs.retain_address !== false, (v) => setQ({ retain_address: v }))}
                <H>Default Customer Notes</H>
                <textarea rows={2} value={qs.default_notes ?? ""} onChange={(e) => setQ({ default_notes: e.target.value })} className={inputClass} />
                <H>Terms & Conditions</H>
                <textarea rows={5} value={qs.default_terms ?? ""} onChange={(e) => setQ({ default_terms: e.target.value })} className={inputClass} placeholder="Shown on every new quote" />
              </>
            )}
            {module === "invoices" && (
              <>
                <H>Zero-Value Line Items</H>
                {check("Hide zero-value line items", !!is.hide_zero_lines, (v) => setI({ hide_zero_lines: v }), "Hides lines with a $0.00 amount on the invoice PDF and the shared link.")}
                <H>Default Customer Notes</H>
                <textarea rows={2} value={is.default_notes ?? ""} onChange={(e) => setI({ default_notes: e.target.value })} className={inputClass} />
                <H>Terms & Conditions</H>
                <textarea rows={5} value={is.default_terms ?? ""} onChange={(e) => setI({ default_terms: e.target.value })} className={inputClass} placeholder="Shown on every new invoice" />
              </>
            )}

            <H>{module === "subscriptions" ? "Subscription" : module === "quotes" ? "Quote" : "Invoice"} numbers</H>
            <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3">
              <div>
                <label className="mb-1 block text-[13px] text-slate-500">Prefix</label>
                <input value={(p as unknown as Record<string, string>)[`${prefix}_prefix`]} onChange={(e) => setP((x) => ({ ...x, [`${prefix}_prefix`]: e.target.value.slice(0, 12) }))} className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-[13px] text-slate-500">Next Number</label>
                <input inputMode="numeric" value={String((p as unknown as Record<string, number>)[`${prefix}_next`])} onChange={(e) => setP((x) => ({ ...x, [`${prefix}_next`]: Number(e.target.value.replace(/\D/g, "")) || 1 }))} className={inputClass} />
              </div>
            </div>

            <H>Organization details on PDFs</H>
            <p className="mb-2 text-[13px] text-slate-500">Your logo (PNG or JPG) and contact info show at the top of every quote, invoice, PDF and email.</p>
            <div className="flex items-center gap-4 py-1">
              <div className="flex h-20 w-40 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.logo_url ? <img src={p.logo_url} alt="Logo" className="max-h-full max-w-full object-contain p-1.5" /> : <span className="text-xs text-slate-400">No logo</span>}
              </div>
              <div className="flex flex-col items-start gap-1">
                <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { uploadLogo(e.target.files?.[0]); e.target.value = ""; }} />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="text-sm font-medium text-[#2563eb] hover:underline">{uploading ? "Uploading..." : p.logo_url ? "Change logo" : "Upload logo"}</button>
                {p.logo_url && <button type="button" onClick={() => setP((x) => ({ ...x, logo_url: null }))} className="text-sm text-red-600 hover:underline">Remove</button>}
              </div>
            </div>
            <textarea rows={2} value={p.org_info.address ?? ""} onChange={(e) => setO({ address: e.target.value })} className={`${inputClass} mt-2`} placeholder="Street, City, State ZIP" />
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <input value={p.org_info.phone ?? ""} onChange={(e) => setO({ phone: e.target.value })} className={inputClass} placeholder="Phone" />
              <input value={p.org_info.email ?? ""} onChange={(e) => setO({ email: e.target.value })} className={inputClass} placeholder="Email" />
              <input value={p.org_info.website ?? ""} onChange={(e) => setO({ website: e.target.value })} className={inputClass} placeholder="Website" />
            </div>
          </div>
          <div className="sticky bottom-0 flex items-center gap-3 border-t border-slate-200 bg-white px-5 py-3">
            <button type="button" onClick={save} disabled={saving} className={btnPrimary}>{saving ? "Saving..." : "Save"}</button>
            <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
            {msg && <p role="alert" className="text-sm text-red-600">{msg}</p>}
          </div>
        </div>
      )}
    </SlideOver>
  );
}
