"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { INDUSTRIES, setCurrentCompany } from "@/lib/types";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] placeholder:text-slate-400 focus:bg-white focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15";

export default function CreateCompanyForm({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Enter your company name.");
    if (!industry) return setError("Choose the type of business.");

    setSaving(true);
    setError("");
    const { data, error } = await createClient().rpc("create_company", {
      p_name: name.trim(),
      p_industry: industry,
      p_phone: phone,
    });
    setSaving(false);

    if (error || !data) return setError("The company couldn't be created. Try again in a moment.");
    setCurrentCompany(data as string);
    onDone?.();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 text-left">
      <div>
        <label htmlFor="company-name" className="mb-1.5 block text-sm font-medium text-slate-700">Company name</label>
        <input id="company-name" value={name} placeholder="e.g. Jeni Clean Service"
          onChange={(e) => { setName(e.target.value); setError(""); }} className={inputClass} />
      </div>
      <div>
        <label htmlFor="company-industry" className="mb-1.5 block text-sm font-medium text-slate-700">Type of business</label>
        <select id="company-industry" value={industry}
          onChange={(e) => { setIndustry(e.target.value); setError(""); }} className={inputClass}>
          <option value="">Choose one</option>
          {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="company-phone" className="mb-1.5 block text-sm font-medium text-slate-700">
          Business phone <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input id="company-phone" type="tel" value={phone} placeholder="(214) 555-0123"
          onChange={(e) => setPhone(e.target.value)} className={inputClass} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={saving}
        className="w-full rounded-lg bg-[#0f766e] py-3 text-[15px] font-semibold text-white hover:bg-[#0c5f59] transition-colors disabled:opacity-60">
        {saving ? "Creating company..." : "Create company"}
      </button>
    </form>
  );
}
