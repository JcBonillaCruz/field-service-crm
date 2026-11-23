"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import SelectMenu from "@/components/ui/SelectMenu";
import DatePicker from "@/components/ui/DatePicker";
import { inputClass } from "@/components/customers/ui";
import {
  EXEMPT_REASONS, TaxRate, TaxSetting, certExpired, certFileName, certUrl, fromKey, settingKey, uploadCert,
} from "@/lib/tax";

// =====================================================================
// Paso 6.9 · Impuesto del cliente o de un Job Site
// Cliente: lleva impuesto / exento.  Job Site: igual que el cliente (por defecto) / exento.
// La tasa (ej. 8.25%) se elige en cada cotización o factura.
// Exento: motivo, número de certificado, vence, archivo del certificado.
// =====================================================================
export function taxOptions(t: (k: string, v?: Record<string, string>) => string, site: boolean) {
  // Paso 6.9b: solo "lleva impuesto" o "exento" (la tasa se elige en cada cotización o factura)
  return [
    ...(site ? [{ value: "inherit", label: t("sameAsCustomer") }] : [{ value: "company", label: t("taxable") }]),
    { value: "exempt", label: t("exempt") },
  ];
}

export default function TaxFields({ companyId, rates, value, onChange, site = false, idPrefix }: {
  companyId: string; rates: TaxRate[]; value: TaxSetting; onChange: (v: TaxSetting) => void; site?: boolean; idPrefix: string;
}) {
  const t = useTranslations("tax");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const raw = settingKey(value, site ? "inherit" : "company");
  const key = raw.startsWith("rate:") || (site && raw === "company") ? (site ? "inherit" : "company") : raw;
  const exempt = key === "exempt";
  const set = (patch: Partial<TaxSetting>) => onChange({ ...value, ...patch });

  async function upload(f?: File) {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) return setErr(t("eFileSize"));
    setUploading(true); setErr("");
    const path = await uploadCert(createClient(), companyId, f);
    setUploading(false);
    if (!path) return setErr(t("eUpload"));
    set({ tax_cert_path: path });
  }
  async function open() {
    if (!value.tax_cert_path) return;
    const url = await certUrl(createClient(), value.tax_cert_path);
    if (url) window.open(url, "_blank", "noopener"); else setErr(t("eOpen"));
  }
  const lab = "mb-1 block text-[12px] font-medium text-slate-500";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1 sm:max-w-[340px]">
          <SelectMenu id={`${idPrefix}-tax`} ariaLabel={t("label")} value={key} options={taxOptions(t, site)} onChange={(k) => onChange(fromKey(k, value))} />
        </div>

      </div>
      {exempt && (
        <div className="grid gap-3 rounded-xl border border-[#d8ece8] bg-[#f6fbfa] p-3 animate-[bp-fade_0.25s_ease-out] sm:grid-cols-2">
          <div>
            <label className={lab} htmlFor={`${idPrefix}-reason`}>{t("reason")}</label>
            <SelectMenu id={`${idPrefix}-reason`} value={value.tax_exempt_reason ?? ""} placeholder={t("reasonPh")}
              options={EXEMPT_REASONS.map((r) => ({ value: r, label: t(`r.${r}`) }))} onChange={(v) => set({ tax_exempt_reason: v })} />
          </div>
          <div>
            <label className={lab} htmlFor={`${idPrefix}-cert`}>{t("certNo")}</label>
            <input id={`${idPrefix}-cert`} value={value.tax_cert_number ?? ""} maxLength={60} autoComplete="bp-off" onChange={(e) => set({ tax_cert_number: e.target.value })} placeholder={t("certPh")} className={inputClass} />
          </div>
          <div>
            <label className={lab}>{t("certExpires")}</label>
            <DatePicker value={value.tax_cert_expires ?? ""} onChange={(v) => set({ tax_cert_expires: v || null })} placeholder={t("noExpiry")} />
            {certExpired(value.tax_cert_expires) && <p className="mt-1 text-[12.5px] font-medium text-[#b45309]">{t("certExpiredShort")}</p>}
          </div>
          <div>
            <span className={lab}>{t("certFile")}</span>
            <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
            {value.tax_cert_path ? (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px]">
                <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-[#0f766e]" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M11.5 3H6a1.5 1.5 0 0 0-1.5 1.5v11A1.5 1.5 0 0 0 6 17h8a1.5 1.5 0 0 0 1.5-1.5V7zM11.5 3v4h4" strokeLinejoin="round" /></svg>
                <button type="button" onClick={open} className="min-w-0 flex-1 truncate text-left font-medium text-[#0f766e] hover:underline">{certFileName(value.tax_cert_path)}</button>
                <button type="button" onClick={() => set({ tax_cert_path: null })} className="text-[12.5px] text-slate-400 hover:text-red-600">{t("remove")}</button>
              </div>
            ) : (
              <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3.5 py-2 text-[14px] text-slate-600 transition-colors hover:border-[#14a39a] hover:text-[#0f766e] disabled:opacity-60">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
                {uploading ? t("uploading") : t("uploadCert")}
              </button>
            )}
          </div>
          {err && <p role="alert" className="text-[13px] text-red-600 sm:col-span-2">{err}</p>}
        </div>
      )}
    </div>
  );
}

// Texto corto para listas: "Exempt", "Dallas (8.25%)", "Same as customer"…
export function taxShort(t: (k: string, v?: Record<string, string>) => string, s: TaxSetting | null | undefined, site: boolean) {
  if (s?.tax_mode === "exempt") return s.tax_cert_number ? t("exemptCert", { cert: s.tax_cert_number }) : t("exempt");
  return site ? t("sameAsCustomer") : t("taxable");
}
