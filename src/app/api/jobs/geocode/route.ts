import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { canManageJobs } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// =====================================================================
// Paso 5.9 · Coordenadas de las direcciones, para poner cada trabajo en el mapa.
// Se buscan UNA sola vez por dirección y se guardan (customer_addresses.lat / lng).
// Servicios gratuitos, sin llave ni tarjeta:
//   1. U.S. Census Geocoder (direcciones de Estados Unidos).
//   2. Nominatim de OpenStreetMap (respaldo y otros países). Pide máximo 1 consulta por segundo.
// Si ninguna la encuentra, queda marcada "not_found" para no buscarla cada vez; al corregir la dirección se busca de nuevo.
// =====================================================================
type Addr = { id: string; street: string | null; city: string | null; state: string | null; zip: string | null; country: string | null; lat: number | null; geo_status: string | null };
// null = el servicio respondió y no la encontró · "fail" = el servicio no respondió (no se marca nada; se intenta después)
type Hit = { lat: number; lng: number } | null | "fail";
const UA = "BrightPro/1.0 (+https://brightproapp.com)";
const isUS = (c: string | null) => !c || /^(us|usa|u\.s\.|u\.s\.a\.|united states|united states of america|estados unidos)$/i.test(c.trim());
const okPoint = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson(url: string, ms: number): Promise<unknown> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: ctl.signal, cache: "no-store" });
    return r.ok ? await r.json() : undefined;
  } catch { return undefined; } finally { clearTimeout(t); }
}

async function census(line: string): Promise<Hit> {
  const j = await getJson(`https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(line)}&benchmark=Public_AR_Current&format=json`, 9000) as
    { result?: { addressMatches?: { coordinates?: { x?: number; y?: number } }[] } } | undefined;
  if (!j?.result) return "fail";
  const c = j?.result?.addressMatches?.[0]?.coordinates;
  const lat = Number(c?.y), lng = Number(c?.x);
  return c && okPoint(lat, lng) ? { lat, lng } : null;
}
let lastNominatim = 0;
async function nominatim(line: string): Promise<Hit> {
  const wait = lastNominatim + 1100 - Date.now();
  if (wait > 0) await sleep(wait);
  lastNominatim = Date.now();
  const j = await getJson(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(line)}`, 9000) as { lat?: string; lon?: string }[] | undefined;
  if (!Array.isArray(j)) return "fail";
  const lat = Number(j?.[0]?.lat), lng = Number(j?.[0]?.lon);
  return j[0] && okPoint(lat, lng) ? { lat, lng } : null;
}

export async function POST(request: NextRequest) {
  const { supabase, current } = await getSession();
  if (!current || !canManageJobs(current.role)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const b = await request.json().catch(() => null) as { ids?: unknown[]; retry?: boolean } | null;
  const ids = Array.from(new Set((b?.ids ?? []).filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)))).slice(0, 12);
  if (!ids.length) return NextResponse.json({ done: [] });

  // RLS ya limita a las direcciones de la compañía de quien pregunta
  const { data, error } = await supabase.from("customer_addresses").select("id, street, city, state, zip, country, lat, geo_status").in("id", ids);
  if (error) return NextResponse.json({ error: error.message, needsSql: true }, { status: 400 });

  const done: { id: string; lat: number | null; lng: number | null; geo_status: string }[] = [];
  const started = Date.now();
  for (const a of (data ?? []) as Addr[]) {
    if (a.lat !== null || (a.geo_status && !b?.retry)) continue;
    if (Date.now() - started > 45000) break; // lo que falte se busca en la siguiente llamada
    const line = [a.street, a.city, [a.state, a.zip].filter(Boolean).join(" "), isUS(a.country) ? "" : a.country].filter((x) => x && String(x).trim()).join(", ");
    let hit: Hit = null;
    if (a.street && (a.city || a.zip)) {
      const first: Hit = isUS(a.country) ? await census(line) : null;
      const second: Hit = first && first !== "fail" ? first : await nominatim(isUS(a.country) ? `${line}, USA` : line);
      hit = second && second !== "fail" ? second : first === "fail" || second === "fail" ? "fail" : null;
    }
    if (hit === "fail") continue; // sin respuesta del buscador: queda pendiente para la próxima vez
    const save = await supabase.rpc("address_geo_set", { p_id: a.id, p_lat: hit?.lat ?? null, p_lng: hit?.lng ?? null, p_status: hit ? "ok" : "not_found" });
    if (save.error) return NextResponse.json({ error: save.error.message, needsSql: true, done }, { status: 400 });
    done.push({ id: a.id, lat: hit?.lat ?? null, lng: hit?.lng ?? null, geo_status: hit ? "ok" : "not_found" });
  }
  return NextResponse.json({ done });
}
