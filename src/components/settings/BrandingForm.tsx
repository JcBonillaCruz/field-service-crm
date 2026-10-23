"use client";

import { bustCache } from "@/lib/cache-client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SalesPrefs, pdfOf } from "@/lib/sales";
import { tplOf } from "@/lib/pdf-templates";
import { inputClass } from "@/components/customers/ui";
import { btnGhost, btnPrimary } from "@/components/sales/SalesBits";

const SWATCHES = ["#1a2744", "#e8713a", "#0f766e", "#2563eb", "#7c3aed", "#be123c", "#2f3437", "#15803d"];

// Branding: logo, datos de la compañía y color de los documentos
export default function BrandingForm({ companyId, prefs, company }: { companyId: string; prefs: SalesPrefs; company: string }) {
  const router = useRouter();
  const [logo, setLogo] = useState(prefs.logo_url);
  const [org, setOrg] = useState(prefs.org_info ?? {});
  const pdf = pdfOf(prefs.pdf_settings);
  const [accent, setAccent] = useState(prefs.pdf_settings.accent || "");
  const [footer, setFooter] = useState(pdf.footer_text);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const shown = /^#[0-9a-f]{6}$/i.test(accent) ? accent : tplOf(pdf.template).accent;

  async function upload(f?: File) {
    if (!f) return;
    if (!["image/png", "image/jpeg"].includes(f.type)) return setMsg("Use a PNG or JPG logo so it also shows in the PDF.");
    if (f.size > 2 * 1024 * 1024) return setMsg("The logo must be smaller than 2 MB.");
    setBusy(true);
    const s = createClient();
    const path = `${companyId}/logo-${Date.now()}.${f.type === "image/png" ? "png" : "jpg"}`;
    const { error } = await s.storage.from("org-logos").upload(path, f, { upsert: true });
    setBusy(false);
    if (error) return setMsg("The logo couldn't be uploaded. Did you run the SQL for Paso 3.30?");
    setLogo(s.storage.from("org-logos").getPublicUrl(path).data.publicUrl); setMsg("");
  }
  async function save() {
    if (accent && !/^#[0-9a-f]{6}$/i.test(accent)) return setMsg("Enter a color like #1a2744.");
    setBusy(true); setMsg("");
    const { error } = await createClient().from("sales_prefs").upsert({
      company_id: companyId, logo_url: logo, org_info: org, pdf_settings: { ...prefs.pdf_settings, accent, footer_text: footer }, updated_at: new Date().toISOString(),
    });
    setBusy(false);
    if (error) return setMsg("It couldn't be saved. Did you run the SQL for Paso 3.31?");
    setMsg("Saved ✓"); await bustCache("prefs"); router.refresh();
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f6f8f9] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-[1100px]">
        <Link prefetch={false} href="/dashboard/settings" className="text-[13px] font-medium text-[#0f766e] hover:underline">← All Settings</Link>
        <h1 className="mb-1 mt-1 text-2xl font-semibold text-[#0b1f3a]">Branding</h1>
        <p className="mb-6 text-[15px] text-slate-500">Your logo, contact details and brand color on every quote, invoice, PDF and email.</p>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6">
            <div>
              <p className="mb-2 font-semibold text-[#0b1f3a]">Logo</p>
              <div className="flex flex-wrap items-center gap-5">
                <div className="flex h-28 w-56 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {logo ? <img src={logo} alt="Logo" className="max-h-full max-w-full object-contain p-2" /> : <span className="text-sm text-slate-400">No logo yet</span>}
                </div>
                <div className="space-y-1.5">
                  <input ref={file} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
                  <button type="button" onClick={() => file.current?.click()} disabled={busy} className={btnGhost}>{logo ? "Change logo" : "Upload logo"}</button>
                  {logo && <button type="button" onClick={() => setLogo(null)} className="block text-sm text-red-600 hover:underline">Remove</button>}
                  <p className="text-[12px] text-slate-500">PNG or JPG, up to 2 MB. A wide logo with transparent background looks best.</p>
                </div>
              </div>
            </div>
            <div>
              <p className="mb-2 font-semibold text-[#0b1f3a]">Address & contact on documents</p>
              <textarea rows={2} value={org.address ?? ""} onChange={(e) => setOrg({ ...org, address: e.target.value })} placeholder="Street, City, State ZIP" className={inputClass} />
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <input value={org.phone ?? ""} onChange={(e) => setOrg({ ...org, phone: e.target.value })} placeholder="Phone" className={inputClass} />
                <input value={org.email ?? ""} onChange={(e) => setOrg({ ...org, email: e.target.value })} placeholder="Email (customers reply here)" className={inputClass} />
                <input value={org.website ?? ""} onChange={(e) => setOrg({ ...org, website: e.target.value })} placeholder="Website" className={inputClass} />
              </div>
            </div>
            <div>
              <p className="mb-2 font-semibold text-[#0b1f3a]">Brand color</p>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setAccent("")} className={`rounded-full border px-3 py-1.5 text-sm ${!accent ? "border-[#0f766e] bg-[#e9f7f4] text-[#0f766e]" : "border-slate-200 text-slate-600"}`}>Template color</button>
                {SWATCHES.map((c) => <button key={c} type="button" onClick={() => setAccent(c)} aria-label={c} className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${accent.toLowerCase() === c ? "border-[#0b1f3a] ring-2 ring-white ring-offset-2 ring-offset-[#0b1f3a]" : "border-white shadow"}`} style={{ background: c }} />)}
                <input value={accent} onChange={(e) => setAccent(e.target.value.slice(0, 7))} placeholder="#1a2744" className={`${inputClass} !w-28`} />
              </div>
            </div>
            <div>
              <p className="mb-2 font-semibold text-[#0b1f3a]">Footer text</p>
              <input value={footer} onChange={(e) => setFooter(e.target.value.slice(0, 140))} placeholder="e.g. Licensed & insured · TACLA00000C" className={inputClass} />
              {!prefs.white_label && <p className="mt-1 text-[12px] text-slate-500">&quot;Powered by BrightPro&quot; shows on free plans. Paid plans can remove it (white label).</p>}
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
              <button type="button" onClick={save} disabled={busy} className={btnPrimary}>{busy ? "Saving..." : "Save"}</button>
              <Link prefetch={false} href="/dashboard/settings/pdf-templates" className="text-sm font-medium text-[#2563eb] hover:underline">Choose a PDF template →</Link>
              {msg && <p className={`text-sm ${msg.startsWith("Saved") ? "text-[#0f766e]" : "text-red-600"}`}>{msg}</p>}
            </div>
          </div>
          <div className="h-fit rounded-2xl border border-slate-200 bg-white p-5">
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-slate-500">Preview</p>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <div>{logo && <img src={logo} alt="" className="mb-2 max-h-14 max-w-[150px] object-contain" />}<p className="text-sm font-semibold text-[#0b1f3a]">{company}</p>
                  {org.address && <p className="whitespace-pre-line text-[11px] text-slate-500">{org.address}</p>}</div>
                <p className="text-lg font-light text-[#0b1f3a]">INVOICE</p>
              </div>
              <div className="mt-4 h-5 rounded-sm" style={{ background: shown }} />
              {[...Array(3)].map((_, i) => <div key={i} className="mt-2 h-2 rounded bg-slate-100" />)}
              <div className="mt-3 flex justify-end"><div className="h-5 w-28 rounded-sm bg-[#f5f4f3]" /></div>
              {footer && <p className="mt-4 border-t border-slate-100 pt-2 text-[10px] text-slate-400">{footer}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
