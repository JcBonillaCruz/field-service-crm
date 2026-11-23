import type { SupabaseClient } from "@supabase/supabase-js";

// =====================================================================
// Paso 6.9 · Sales tax
// - Tasas por compañía (Settings → Taxes), una predeterminada.
// - Cliente: tasa de la compañía / tasa propia / exento con certificado.
// - Job Site: igual que el cliente (por defecto) / tasa de la compañía / tasa propia / exento.
// - Prioridad: Job Site → cliente → compañía. Mismo cálculo que el SQL (sales_doc_apply_tax).
// =====================================================================
export type TaxRate = { id: string; name: string; rate: number; is_default: boolean; is_active: boolean; position: number };
export type CustomerTaxMode = "company" | "rate" | "exempt";
export type SiteTaxMode = "inherit" | CustomerTaxMode;

// Lo que guarda el cliente o el Job Site
export type TaxSetting = {
  tax_mode?: string | null; tax_rate_id?: string | null; tax_exempt_reason?: string | null;
  tax_cert_number?: string | null; tax_cert_expires?: string | null; tax_cert_path?: string | null;
};

export type TaxSource = "site" | "customer" | "company" | "manual" | "import";
export type DocTax = {
  mode: "rate" | "exempt" | "none"; rate_id: string | null; name: string | null; rate: number; source: TaxSource;
  reason?: string | null; cert_number?: string | null; cert_expires?: string | null;
};
export const NO_TAX: DocTax = { mode: "none", rate_id: null, name: null, rate: 0, source: "company" };

export const EXEMPT_REASONS = ["resale", "government", "nonprofit", "religious", "school", "agriculture", "manufacturing", "other"] as const;

export const TAX_COLS = "tax_mode, tax_rate_id, tax_exempt_reason, tax_cert_number, tax_cert_expires, tax_cert_path";
export const taxMissingSql = (msg?: string | null) => /tax_|does not exist|schema cache|function .* not/i.test(msg ?? "");

export const rateLabel = (r: Pick<TaxRate, "name" | "rate">) => `${r.name} (${+Number(r.rate).toFixed(4)}%)`;
export const defaultRate = (rates: TaxRate[]) => rates.find((r) => r.is_default && r.is_active) ?? null;

// Carga las tasas de la compañía. needsSql = falta correr el SQL del 6.9
export async function loadTaxRates(sb: SupabaseClient, companyId: string): Promise<{ rates: TaxRate[]; needsSql: boolean }> {
  const { data, error } = await sb.from("tax_rates").select("id, name, rate, is_default, is_active, position")
    .eq("company_id", companyId).order("position").order("created_at");
  if (error) return { rates: [], needsSql: true };
  return { rates: ((data ?? []) as TaxRate[]).map((r) => ({ ...r, rate: Number(r.rate) })), needsSql: false };
}

// Si el Job Site o el cliente están exentos → exento. Si no → la tasa predeterminada (las demás se eligen a mano).
export function resolveTax(rates: TaxRate[], customer: TaxSetting | null | undefined, site?: TaxSetting | null): DocTax {
  const useSite = Boolean(site && site.tax_mode && site.tax_mode !== "inherit");
  const s = (useSite ? site : customer) ?? {};
  if (s.tax_mode === "exempt") {
    return { mode: "exempt", rate_id: null, name: "Exempt", rate: 0, source: useSite ? "site" : "customer", reason: s.tax_exempt_reason ?? null, cert_number: s.tax_cert_number ?? null, cert_expires: s.tax_cert_expires ?? null };
  }
  const r = defaultRate(rates);
  if (!r) return { ...NO_TAX };
  return { mode: "rate", rate_id: r.id, name: r.name, rate: Number(r.rate), source: "company" };
}

// Recargos (Trip charge, Distance fee…): no son impuesto
export type SurchargePreset = { id: string; name: string; kind: "flat" | "percent"; value: number; is_active: boolean; position: number };
export async function loadSurcharges(sb: SupabaseClient, companyId: string): Promise<SurchargePreset[]> {
  const { data, error } = await sb.from("surcharges").select("id, name, kind, value, is_active, position").eq("company_id", companyId).order("position").order("created_at");
  if (error) return [];
  return ((data ?? []) as SurchargePreset[]).map((x) => ({ ...x, value: Number(x.value) }));
}

// Valor único para los selectores: "company" | "inherit" | "exempt" | "rate:<id>"
export const settingKey = (s: TaxSetting | null | undefined, fallback: "company" | "inherit") => {
  const m = s?.tax_mode || fallback;
  return m === "rate" && s?.tax_rate_id ? `rate:${s.tax_rate_id}` : m === "rate" ? fallback : m;
};
export function fromKey(key: string, prev: TaxSetting = {}): TaxSetting {
  if (key.startsWith("rate:")) return { ...blankExempt, tax_mode: "rate", tax_rate_id: key.slice(5) };
  if (key === "exempt") return { ...prev, tax_mode: "exempt", tax_rate_id: null };
  return { ...blankExempt, tax_mode: key, tax_rate_id: null };
}
const blankExempt: TaxSetting = { tax_exempt_reason: null, tax_cert_number: null, tax_cert_expires: null, tax_cert_path: null };

export const certExpired = (d?: string | null) => Boolean(d && d < new Date().toISOString().slice(0, 10));

// Para guardar con customer_save_tax
export const taxPayload = (s: TaxSetting) => ({
  mode: s.tax_mode || "company", rate_id: s.tax_rate_id ?? null, reason: s.tax_exempt_reason ?? null,
  cert_number: s.tax_cert_number ?? null, cert_expires: s.tax_cert_expires ?? null, cert_path: s.tax_cert_path ?? null,
});

// Sube el certificado (bucket privado "tax-certs", carpeta de la compañía)
export async function uploadCert(sb: SupabaseClient, companyId: string, file: File): Promise<string | null> {
  const path = `${companyId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
  const { error } = await sb.storage.from("tax-certs").upload(path, file);
  return error ? null : path;
}
export async function certUrl(sb: SupabaseClient, path: string): Promise<string | null> {
  const { data } = await sb.storage.from("tax-certs").createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}
export const certFileName = (path?: string | null) => (path ? path.split("/").pop()!.replace(/^\d+-/, "") : "");
