"use client";

import { bustCache } from "@/lib/cache-client";
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

// Nueva compañía en 3 pasos (nombre · rubro y contacto · detalles y logo), con vista previa en vivo y celebración al final
export default function CreateCompanyForm({ onDone, onCancel }: { onDone?: () => void; onCancel?: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({ name: "", industry: "", phone: "", email: "", website: "", address: "", service_area: "", license_no: "", tax_id: "" });
  const [logo, setLogo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof f, v: string) => { setF((x) => ({ ...x, [k]: v })); setError(""); };
  // Pasos: 1 nombre · 2 rubro y contacto · 3 detalles y logo (todo lo del 3 es opcional)
  const [step, setStep] = useState(1);
  const [dir, setDir] = useState<"next" | "back">("next");
  const [celebrate, setCelebrate] = useState(false);
  function go(n: number) {
    setError("");
    if (n > step) {
      if (step === 1 && !f.name.trim()) return setError("Enter your company name.");
      if (step === 2 && !f.industry) return setError("Choose the type of business.");
      if (step === 2 && f.phone && f.phone.replace(/\D/g, "").length !== 10) return setError("Enter a 10-digit phone number, or leave it blank.");
      if (step === 2 && f.email && !/^\S+@\S+\.\S+$/.test(f.email)) return setError("Check the email address.");
    }
    setDir(n > step ? "next" : "back"); setStep(n);
  }

  function pickLogo(x?: File) {
    if (!x) return;
    if (!["image/png", "image/jpeg"].includes(x.type)) return setError("Use a PNG or JPG logo.");
    if (x.size > 2 * 1024 * 1024) return setError("The logo must be smaller than 2 MB.");
    setLogo(x); setPreview(URL.createObjectURL(x)); setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step < 3) return go(step + 1);
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
    setCurrentCompany(id);
    await bustCache("prefs");
    setCelebrate(true);
    await new Promise((r) => setTimeout(r, 1400));
    setSaving(false);
    onDone?.();
    router.refresh();
  }

  const STEPS = ["Your company", "Contact", "Details"];
  const initials = f.name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
  const anim = dir === "next" ? "animate-[bp-in-left_0.35s_ease-out]" : "animate-[bp-in-right_0.35s_ease-out]";

  if (celebrate) {
    const dots = Array.from({ length: 18 }, (_, i) => {
      const a = (i / 18) * Math.PI * 2, r = 70 + (i % 3) * 22;
      return { x: Math.cos(a) * r, y: Math.sin(a) * r, c: ["#0f766e", "#14a39a", "#e8713a", "#f5b52a", "#2563eb", "#a78bfa"][i % 6] };
    });
    return (
      <div className="relative flex flex-col items-center py-10 text-center">
        <div className="relative flex h-24 w-24 items-center justify-center">
          {dots.map((d, i) => (
            <span key={i} className="absolute h-2.5 w-2.5 rounded-full animate-[bp-burst_0.9s_ease-out_forwards]"
              style={{ background: d.c, ["--bx" as string]: `${d.x}px`, ["--by" as string]: `${d.y}px`, animationDelay: `${(i % 4) * 40}ms` } as React.CSSProperties} />
          ))}
          <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[#14a39a] to-[#0f766e] text-white shadow-[0_14px_34px_rgba(15,118,110,0.35)] animate-[bp-pop-in_0.4s_ease-out]">
            <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 9.5 17 19 7" /></svg>
          </span>
        </div>
        <p className="mt-6 text-xl font-semibold text-[#0b1f3a]">{f.name.trim()} is ready!</p>
        <p className="mt-1 text-[14.5px] text-slate-500">Setting up your workspace…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="text-left">
      {/* Pasos */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-[12.5px] font-medium">
          {STEPS.map((t, i) => (
            <button key={t} type="button" onClick={() => i + 1 < step && go(i + 1)} disabled={i + 1 >= step}
              className={`flex items-center gap-1.5 transition-colors ${i + 1 === step ? "text-[#0f766e]" : i + 1 < step ? "text-slate-600 hover:text-[#0f766e]" : "text-slate-400"}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold transition-all duration-300 ${i + 1 < step ? "bg-[#0f766e] text-white" : i + 1 === step ? "bg-[#e3f6f0] text-[#0f766e] ring-2 ring-[#0f766e]" : "bg-slate-100 text-slate-400"}`}>
                {i + 1 < step ? <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" /></svg> : i + 1}
              </span>
              <span className="hidden sm:inline">{t}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-[#14a39a] to-[#0f766e] transition-all duration-500 ease-out" style={{ width: `${(step / 3) * 100}%` }} />
        </div>
      </div>

      <div key={step} className={`space-y-4 ${anim}`}>
        {step === 1 && (
          <>
            <div>
              <p className="text-[20px] font-semibold leading-snug text-[#0b1f3a]">What&apos;s your company called?</p>
              <p className="mt-1 text-[14px] text-slate-500">This name shows on your quotes, invoices and messages to customers.</p>
            </div>
            <input autoFocus autoComplete="off" value={f.name} placeholder="e.g. Lone Star Comfort Air" onChange={(e) => set("name", e.target.value)}
              className={`${inputClass} py-3.5 text-[17px] font-medium`} />
            {/* Vista previa en vivo */}
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-[#f3fbf8] p-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#14a39a] to-[#0f766e] text-[16px] font-bold text-white shadow-[0_8px_20px_rgba(15,118,110,0.25)]">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="" className="h-full w-full bg-white object-contain p-1" />
                ) : initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[15.5px] font-semibold text-[#0b1f3a]">{f.name.trim() || "Your company"}</p>
                <p className="truncate text-[13px] text-slate-500">{f.industry || "Powered by BrightPro"}</p>
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <p className="text-[20px] font-semibold leading-snug text-[#0b1f3a]">What do you do, and how do customers reach you?</p>
              <p className="mt-1 text-[14px] text-slate-500">Only the type of business is required.</p>
            </div>
            <div><Label>Type of business</Label><IndustrySelect id="company-industry" value={f.industry} onChange={(v) => set("industry", v)} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><Label opt>Business phone</Label>
                <input type="tel" inputMode="tel" maxLength={14} value={f.phone} placeholder="(214) 555-0123" onChange={(e) => set("phone", formatPhone(e.target.value))} className={inputClass} /></label>
              <label className="block"><Label opt>Business email</Label>
                <input type="email" value={f.email} placeholder="office@company.com" onChange={(e) => set("email", e.target.value)} className={inputClass} /></label>
              <label className="block sm:col-span-2"><Label opt>Business address</Label>
                <input value={f.address} placeholder="Street, City, State ZIP" onChange={(e) => set("address", e.target.value)} className={inputClass} /></label>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div>
              <p className="text-[20px] font-semibold leading-snug text-[#0b1f3a]">Last touches</p>
              <p className="mt-1 text-[14px] text-slate-500">All optional. You can add or change them later in Settings.</p>
            </div>
            <div className="flex items-center gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3">
              <button type="button" onClick={() => file.current?.click()} aria-label="Upload logo"
                className="group flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white transition-colors hover:border-[#14a39a]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {preview ? <img src={preview} alt="Logo" className="max-h-full max-w-full object-contain p-1" />
                  : <svg viewBox="0 0 24 24" className="h-7 w-7 text-slate-300 transition-transform duration-200 group-hover:scale-110 group-hover:text-[#0f766e]" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m3 16 5-5 4 4 3-3 6 6M15 8.5h.01" strokeLinecap="round" strokeLinejoin="round" /></svg>}
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
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2"><Label opt>Website</Label>
                <input value={f.website} placeholder="www.company.com" onChange={(e) => set("website", e.target.value)} className={inputClass} /></label>
              <label className="block"><Label opt>Service area</Label>
                <input value={f.service_area} placeholder="e.g. Dallas–Fort Worth" onChange={(e) => set("service_area", e.target.value)} className={inputClass} /></label>
              <label className="block"><Label opt>License #</Label>
                <input value={f.license_no} placeholder="e.g. TACLA00000C" onChange={(e) => set("license_no", e.target.value)} className={inputClass} /></label>
              <label className="block sm:col-span-2"><Label opt>Tax ID / EIN</Label>
                <input value={f.tax_id} placeholder="12-3456789" onChange={(e) => set("tax_id", e.target.value)} className={inputClass} /></label>
            </div>
          </>
        )}
      </div>

      {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex gap-3">
        {step > 1 ? (
          <button type="button" onClick={() => go(step - 1)} className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-[15px] font-medium text-slate-700 hover:bg-slate-50">Back</button>
        ) : onCancel ? (
          <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-[15px] font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
        ) : null}
        <button type="submit" disabled={saving}
          className="group flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0f766e] py-3 text-[15px] font-semibold text-white shadow-[0_8px_20px_rgba(15,118,110,0.22)] transition-all hover:bg-[#0c5f59] hover:shadow-[0_10px_26px_rgba(15,118,110,0.3)] disabled:opacity-60">
          {saving ? "Creating company..." : step < 3 ? "Continue" : "Create company"}
          {!saving && <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10h12M11 5l5 5-5 5" /></svg>}
        </button>
      </div>
      {step === 3 && !saving && <p className="mt-3 text-center text-[13px] text-slate-400">Nothing else to add? Just press Create company.</p>}
    </form>
  );
}
