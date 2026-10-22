"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import IndustrySelect from "@/components/IndustrySelect";
import { formatPhone, setCurrentCompany } from "@/lib/types";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-[15px] placeholder:text-slate-400 focus:bg-white focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15";
const Label = ({ children, opt }: { children: React.ReactNode; opt?: boolean }) => (
  <span className="mb-1.5 block text-sm font-medium text-slate-700">{children}{opt && <span className="font-normal text-slate-400"> (optional)</span>}</span>
);

// Nueva compañía: todos los campos a la vista (solo nombre y tipo son obligatorios) + logo
export default function CreateCompanyForm({ onDone, onCancel }: { onDone?: () => void; onCancel?: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({ name: "", industry: "", phone: "", email: "", website: "", address: "", service_area: "", license_no: "", tax_id: "" });
  const [logo, setLogo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof f, v: string) => { setF((x) => ({ ...x, [k]: v })); setError(""); };

  function pickLogo(x?: File) {
    if (!x) return;
    if (!["image/png", "image/jpeg"].includes(x.type)) return setError("Use a PNG or JPG logo.");
    if (x.size > 2 * 1024 * 1024) return setError("The logo must be smaller than 2 MB.");
    setLogo(x); setPreview(URL.createObjectURL(x)); setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return setError("Enter your company name.");
    if (!f.industry) return setError("Choose the type of business.");
    if (f.phone && f.phone.replace(/\D/g, "").length !== 10) return setError("Enter a 10-digit phone number, or leave it blank.");
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) return setError("Check the email address.");
    setSaving(true); setError("");
    const s = createClient();
    const { data, error } = await s.rpc("create_company", { p_name: f.name.trim(), p_industry: f.industry, p_phone: f.phone });
    if (error || !data) { setSaving(false); return setError("The company couldn't be created. Try again in a moment."); }
    const id = data as string;
    const clean = (v: string) => v.trim() || null;
    await s.from("companies").update({
      email: clean(f.email), website: clean(f.website), address: clean(f.address), service_area: clean(f.service_area), license_no: clean(f.license_no), tax_id: clean(f.tax_id),
    }).eq("id", id);
    let logoUrl: string | null = null;
    if (logo) {
      const path = `${id}/logo-${Date.now()}.${logo.type === "image/png" ? "png" : "jpg"}`;
      const up = await s.storage.from("org-logos").upload(path, logo, { upsert: true });
      if (!up.error) logoUrl = s.storage.from("org-logos").getPublicUrl(path).data.publicUrl;
    }
    await s.from("sales_prefs").upsert({ company_id: id, logo_url: logoUrl, org_info: { phone: f.phone, email: f.email.trim(), website: f.website.trim(), address: f.address.trim() } });
    setSaving(false);
    setCurrentCompany(id);
    onDone?.();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 text-left">
      <div className="flex items-center gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3">
        <button type="button" onClick={() => file.current?.click()} aria-label="Upload logo"
          className="group flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white transition-colors hover:border-[#14a39a]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview ? <img src={preview} alt="Logo" className="max-h-full max-w-full object-contain p-1" />
            : <svg viewBox="0 0 24 24" className="h-7 w-7 text-slate-300 transition-colors group-hover:text-[#0f766e]" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m3 16 5-5 4 4 3-3 6 6M15 8.5h.01" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </button>
        <div className="min-w-0 text-sm">
          <p className="font-medium text-slate-700">Company logo <span className="font-normal text-slate-400">(optional)</span></p>
          <p className="text-[12px] text-slate-500">Shows on your quotes, invoices and emails. PNG or JPG.</p>
          <input ref={file} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { pickLogo(e.target.files?.[0]); e.target.value = ""; }} />
          <div className="mt-1 flex gap-3">
            <button type="button" onClick={() => file.current?.click()} className="font-medium text-[#0f766e] hover:underline">{logo ? "Change" : "Upload logo"}</button>
            {logo && <button type="button" onClick={() => { setLogo(null); setPreview(null); }} className="text-red-600 hover:underline">Remove</button>}
          </div>
        </div>
      </div>
      <label className="block"><Label>Company name</Label>
        <input autoComplete="off" value={f.name} placeholder="e.g. Lone Star Comfort Air" onChange={(e) => set("name", e.target.value)} className={inputClass} /></label>
      <div><Label>Type of business</Label><IndustrySelect id="company-industry" value={f.industry} onChange={(v) => set("industry", v)} /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><Label opt>Business phone</Label>
          <input type="tel" inputMode="tel" maxLength={14} value={f.phone} placeholder="(214) 555-0123" onChange={(e) => set("phone", formatPhone(e.target.value))} className={inputClass} /></label>
        <label className="block"><Label opt>Business email</Label>
          <input type="email" value={f.email} placeholder="office@company.com" onChange={(e) => set("email", e.target.value)} className={inputClass} /></label>
        <label className="block sm:col-span-2"><Label opt>Website</Label>
          <input value={f.website} placeholder="www.company.com" onChange={(e) => set("website", e.target.value)} className={inputClass} /></label>
        <label className="block sm:col-span-2"><Label opt>Business address</Label>
          <input value={f.address} placeholder="Street, City, State ZIP" onChange={(e) => set("address", e.target.value)} className={inputClass} /></label>
        <label className="block"><Label opt>Service area</Label>
          <input value={f.service_area} placeholder="e.g. Dallas–Fort Worth" onChange={(e) => set("service_area", e.target.value)} className={inputClass} /></label>
        <label className="block"><Label opt>License #</Label>
          <input value={f.license_no} placeholder="e.g. TACLA00000C" onChange={(e) => set("license_no", e.target.value)} className={inputClass} /></label>
        <label className="block sm:col-span-2"><Label opt>Tax ID / EIN</Label>
          <input value={f.tax_id} placeholder="12-3456789" onChange={(e) => set("tax_id", e.target.value)} className={inputClass} /></label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        {onCancel && <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-[15px] font-medium text-slate-700 hover:bg-slate-50">Cancel</button>}
        <button type="submit" disabled={saving}
          className="flex-1 rounded-lg bg-[#0f766e] py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#0c5f59] disabled:opacity-60">
          {saving ? "Creating company..." : "Create company"}
        </button>
      </div>
    </form>
  );
}
