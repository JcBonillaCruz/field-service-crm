"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import IndustrySelect from "@/components/IndustrySelect";
import { formatPhone } from "@/lib/types";
import { Modal, btnGhost, btnPrimary } from "@/components/sales/SalesBits";

const input = "w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-[15px] placeholder:text-slate-400 focus:border-[#0f766e] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15";
type Form = { name: string; industry: string; phone: string; email: string; website: string; address: string; tax_id: string; license_no: string; service_area: string };

// Editar la compañía completa: logo, nombre, tipo, contacto, dirección y datos legales (todo opcional menos el nombre)
export default function CompanyEditModal({ companyId, open, onClose }: { companyId: string | null; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = useState<Form>({ name: "", industry: "", phone: "", email: "", website: "", address: "", tax_id: "", license_no: "", service_area: "" });
  const [logo, setLogo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const set = (k: keyof Form, v: string) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (!open || !companyId) return;
    setMsg("");
    (async () => {
      const s = createClient();
      const [{ data: c }, { data: p }] = await Promise.all([
        s.from("companies").select("*").eq("id", companyId).maybeSingle(),
        s.from("sales_prefs").select("logo_url, org_info").eq("company_id", companyId).maybeSingle(),
      ]);
      const org = (p?.org_info ?? {}) as Record<string, string>;
      setF({
        name: c?.name ?? "", industry: c?.industry ?? "", phone: c?.phone ?? org.phone ?? "", email: c?.email ?? org.email ?? "",
        website: c?.website ?? org.website ?? "", address: c?.address ?? org.address ?? "", tax_id: c?.tax_id ?? "", license_no: c?.license_no ?? "", service_area: c?.service_area ?? "",
      });
      setLogo(p?.logo_url ?? null);
    })();
  }, [open, companyId]);

  async function upload(x?: File) {
    if (!x || !companyId) return;
    if (!["image/png", "image/jpeg"].includes(x.type)) return setMsg("Use a PNG or JPG logo so it also shows in the PDF.");
    if (x.size > 2 * 1024 * 1024) return setMsg("The logo must be smaller than 2 MB.");
    setBusy(true);
    const s = createClient();
    const path = `${companyId}/logo-${Date.now()}.${x.type === "image/png" ? "png" : "jpg"}`;
    const { error } = await s.storage.from("org-logos").upload(path, x, { upsert: true });
    setBusy(false);
    if (error) return setMsg("The logo couldn't be uploaded.");
    setLogo(s.storage.from("org-logos").getPublicUrl(path).data.publicUrl); setMsg("");
  }

  async function save() {
    if (!companyId) return;
    if (!f.name.trim()) return setMsg("Enter the company name.");
    if (f.phone && f.phone.replace(/\D/g, "").length !== 10) return setMsg("Enter a 10-digit phone number, or leave it blank.");
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) return setMsg("Check the email address.");
    setBusy(true); setMsg("");
    const s = createClient();
    const clean = (v: string) => v.trim() || null;
    let { error } = await s.from("companies").update({
      name: f.name.trim(), industry: f.industry || null, phone: clean(f.phone), email: clean(f.email), website: clean(f.website),
      address: clean(f.address), tax_id: clean(f.tax_id), license_no: clean(f.license_no), service_area: clean(f.service_area),
    }).eq("id", companyId);
    if (error) ({ error } = await s.from("companies").update({ name: f.name.trim(), industry: f.industry || null }).eq("id", companyId)); // sin el SQL 3.35
    // Lo mismo sale en los PDFs y correos
    const { data: p } = await s.from("sales_prefs").select("org_info").eq("company_id", companyId).maybeSingle();
    await s.from("sales_prefs").upsert({
      company_id: companyId, logo_url: logo,
      org_info: { ...(p?.org_info ?? {}), address: f.address.trim(), phone: f.phone.trim(), email: f.email.trim(), website: f.website.trim() },
      updated_at: new Date().toISOString(),
    });
    setBusy(false);
    if (error) return setMsg("It couldn't be saved. Try again.");
    router.refresh(); onClose();
  }

  const L = ({ children, opt }: { children: React.ReactNode; opt?: boolean }) => <label className="mb-1.5 block text-sm font-medium text-slate-700">{children}{opt && <span className="font-normal text-slate-400"> (optional)</span>}</label>;
  return (
    <Modal open={open} onClose={onClose} title="Edit organization" width="max-w-2xl"
      footer={<><button type="button" onClick={save} disabled={busy} className={btnPrimary}>{busy ? "Saving..." : "Save"}</button><button type="button" onClick={onClose} className={btnGhost}>Cancel</button>{msg && <p className="text-sm text-red-600">{msg}</p>}</>}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 p-4">
          <div className="flex h-20 w-36 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo ? <img src={logo} alt="Logo" className="max-h-full max-w-full object-contain p-1.5" /> : <span className="text-xs text-slate-400">No logo</span>}
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-[#0b1f3a]">Company logo</p>
            <p className="text-[12px] text-slate-500">Shows on quotes, invoices, PDFs and emails. PNG or JPG, up to 2 MB.</p>
            <input ref={file} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => file.current?.click()} disabled={busy} className="text-sm font-medium text-[#2563eb] hover:underline">{logo ? "Change logo" : "Upload logo"}</button>
              {logo && <button type="button" onClick={() => setLogo(null)} className="text-sm text-red-600 hover:underline">Remove</button>}
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><L>Company name</L><input value={f.name} onChange={(e) => set("name", e.target.value)} className={input} /></div>
          <div className="sm:col-span-2"><L>Type of business</L><IndustrySelect id="edit-industry" value={f.industry} onChange={(v) => set("industry", v)} /></div>
          <div><L opt>Business phone</L><input type="tel" inputMode="tel" maxLength={14} value={f.phone} onChange={(e) => set("phone", formatPhone(e.target.value))} placeholder="(214) 555-0123" className={input} /></div>
          <div><L opt>Business email</L><input value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="office@company.com" className={input} /></div>
          <div className="sm:col-span-2"><L opt>Website</L><input value={f.website} onChange={(e) => set("website", e.target.value)} placeholder="www.company.com" className={input} /></div>
          <div className="sm:col-span-2"><L opt>Business address</L><textarea rows={2} value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="Street, City, State ZIP" className={input} /></div>
          <div><L opt>Service area</L><input value={f.service_area} onChange={(e) => set("service_area", e.target.value)} placeholder="e.g. Dallas–Fort Worth" className={input} /></div>
          <div><L opt>License #</L><input value={f.license_no} onChange={(e) => set("license_no", e.target.value)} placeholder="e.g. TACLA00000C" className={input} /></div>
          <div><L opt>Tax ID / EIN</L><input value={f.tax_id} onChange={(e) => set("tax_id", e.target.value)} placeholder="12-3456789" className={input} /></div>
        </div>
      </div>
    </Modal>
  );
}
