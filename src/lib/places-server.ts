import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlacesOff } from "@/lib/places";

// Lado servidor de las rutas /api/places/*: llave, contador diario y centro de la compañía para el sesgo
export const placesKey = () => process.env.GOOGLE_PLACES_API_KEY?.trim() || "";
const cap = () => Math.max(0, Math.floor(Number(process.env.GOOGLE_PLACES_DAILY_CAP) || 0));

export type Take = { ok: true; warn: boolean; picks: number; limit: number } | { ok: false; off: PlacesOff };

// Cuenta la llamada en places_usage y dice si todavía se puede (límite de la compañía y tope del sistema)
export async function takePlaces(sb: SupabaseClient, companyId: string, kind: "search" | "pick"): Promise<Take> {
  const { data, error } = await sb.rpc("places_take", { p_company: companyId, p_kind: kind, p_cap: cap() });
  if (error) return { ok: false, off: /places_take|does not exist|schema cache/i.test(error.message) ? "sql" : "error" };
  const r = (data ?? {}) as { ok?: boolean; reason?: string; warn?: boolean; picks?: number; limit?: number };
  if (!r.ok) return { ok: false, off: r.reason === "off" ? "off" : r.reason === "cap" ? "cap" : "limit" };
  return { ok: true, warn: Boolean(r.warn), picks: r.picks ?? 0, limit: r.limit ?? 0 };
}

// Centro de los clientes de la compañía (con las coordenadas que ya guardó el mapa del 5.9).
// Sin esto Google usaría la ubicación del servidor de Vercel y daría sugerencias de otro estado.
const centers = new Map<string, { at: number; c: { lat: number; lng: number } | null }>();
export async function companyCenter(sb: SupabaseClient, companyId: string) {
  const hit = centers.get(companyId);
  if (hit && Date.now() - hit.at < 3600_000) return hit.c;
  const { data } = await sb.from("customer_addresses").select("lat, lng").eq("company_id", companyId).not("lat", "is", null).limit(400);
  const pts = ((data ?? []) as { lat: number; lng: number }[]).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  let c: { lat: number; lng: number } | null = null;
  if (pts.length) {
    // Mediana (no promedio): un cliente lejano no mueve el centro
    const mid = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
    c = { lat: mid(pts.map((p) => p.lat)), lng: mid(pts.map((p) => p.lng)) };
  }
  centers.set(companyId, { at: Date.now(), c });
  return c;
}

export async function googleFetch(url: string, init: RequestInit, ms = 6000): Promise<unknown | undefined> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...init, signal: ctl.signal, cache: "no-store" });
    if (!r.ok) { console.error("google places:", r.status, (await r.text().catch(() => "")).slice(0, 300)); return undefined; }
    return await r.json();
  } catch { return undefined; } finally { clearTimeout(timer); }
}

export const okSession = (s: unknown): s is string => typeof s === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(s);
