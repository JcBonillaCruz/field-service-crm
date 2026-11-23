import type { SupabaseClient } from "@supabase/supabase-js";

// =====================================================================
// Paso 6.8 · Lead source: cómo llegó el cliente.
// Lista de fábrica (se traduce por su code) + las propias de cada compañía (name).
// "Referral" es la única que pide "Referido por" (otro cliente).
// =====================================================================
export type LeadSource = { id: string; code: string | null; name: string | null; is_active: boolean; position: number };

export const LEAD_CODES = [
  "google_maps", "google_search", "google_lsa", "google_ads", "website", "referral", "repeat", "facebook", "instagram",
  "nextdoor", "yelp", "angi", "thumbtack", "truck_sign", "flyer", "event", "other",
] as const;

export const REFERRAL = "referral";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type T = { (key: any): string; has: (key: any) => boolean };
export function leadLabel(t: T, s: Pick<LeadSource, "code" | "name"> | null | undefined) {
  if (!s) return "";
  if (s.code) return t.has(`src.${s.code}`) ? t(`src.${s.code}`) : s.code;
  return s.name ?? "";
}

export const missingSql = (msg?: string | null) => /lead_source|referred_by|places_|does not exist|schema cache|function .* not/i.test(msg ?? "");

// Carga la lista (y crea la de fábrica la primera vez). needsSql = falta correr el SQL del 6.8
export async function loadLeadSources(sb: SupabaseClient, companyId: string): Promise<{ list: LeadSource[]; needsSql: boolean }> {
  const read = () => sb.from("lead_sources").select("id, code, name, is_active, position").eq("company_id", companyId)
    .order("position").order("created_at");
  let r = await read();
  if (r.error) return { list: [], needsSql: true };
  if (!r.data?.length) {
    const e = await sb.rpc("lead_sources_ensure", { p_company: companyId });
    if (e.error) return { list: [], needsSql: missingSql(e.error.message) };
    r = await read();
  }
  return { list: (r.data ?? []) as LeadSource[], needsSql: false };
}
