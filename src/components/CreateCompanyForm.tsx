"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import IndustrySelect from "@/components/IndustrySelect";
import { formatPhone, setCurrentCompany } from "@/lib/types";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] placeholder:text-slate-400 focus:bg-white focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15";

export default function CreateCompanyForm({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [phone, setPhone] = useState("");
  const [more, setMore] = useState(false);
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Enter your company name.");
    if (!industry) return setError("Choose the type of business.");
    if (phone && phone.replace(/\D/g, "").length !== 10) return setError("Enter a 10-digit phone number, or leave it blank.");

    setSaving(true);
    setError("");
    const { data, error } = await createClient().rpc("create_company", {
      p_name: name.trim(),
      p_industry: industry,
      p_phone: phone,
    });
    setSaving(false);

    if (error || !data) return setError("The company couldn't be created. Try again in a moment.");
    // Datos opcionales: se guardan en la compañía y salen en los PDFs (se pueden editar después)
    if (email.trim() || website.trim() || address.trim()) {
      const s = createClient();
      await s.from("companies").update({ email: email.trim() || null, website: website.trim() || null, address: address.trim() || null }).eq("id", data as string);
      await s.from("sales_prefs").upsert({ company_id: data as string, org_info: { phone, email: email.trim(), website: website.trim(), address: address.trim() } });
    }
    setCurrentCompany(data as string);
    onDone?.();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 text-left">
      <div>
        <label htmlFor="company-name" className="mb-1.5 block text-sm font-medium text-slate-700">Company name</label>
        <input id="company-name" autoComplete="off" value={name} placeholder="e.g. Lone Star Comfort Air"
          onChange={(e) => { setName(e.target.value); setError(""); }} className={inputClass} />
      </div>
      <div>
        <label htmlFor="company-industry" className="mb-1.5 block text-sm font-medium text-slate-700">Type of business</label>
        <IndustrySelect id="company-industry" value={industry} onChange={(v) => { setIndustry(v); setError(""); }} />
      </div>
      <div>
        <label htmlFor="company-phone" className="mb-1.5 block text-sm font-medium text-slate-700">
          Business phone <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input id="company-phone" type="tel" value={phone} placeholder="(214) 555-0123"
          inputMode="tel" maxLength={14}
          onChange={(e) => setPhone(formatPhone(e.target.value))} className={inputClass} />
      </div>

      <button type="button" onClick={() => setMore((v) => !v)} className="flex items-center gap-1.5 text-sm font-medium text-[#0f766e]">
        <svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${more ? "rotate-90" : ""}`} fill="currentColor"><path d="M7 5l6 5-6 5z" /></svg>
        More details <span className="font-normal text-slate-400">(optional, you can add them later)</span>
      </button>
      {more && (
        <div className="space-y-3 animate-[bp-fade_0.2s_ease-out]">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Business email" className={inputClass} />
          <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Website" className={inputClass} />
          <textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Business address" className={inputClass} />
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={saving}
        className="w-full rounded-lg bg-[#0f766e] py-3 text-[15px] font-semibold text-white hover:bg-[#0c5f59] transition-colors disabled:opacity-60">
        {saving ? "Creating company..." : "Create company"}
      </button>
    </form>
  );
}
