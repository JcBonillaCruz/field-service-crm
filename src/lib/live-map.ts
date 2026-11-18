// =====================================================================
// Mapa en vivo (Paso 5.9)
//  · El teléfono comparte la ubicación SOLO con el día iniciado y con la app abierta en pantalla
//    (una app web no puede leer el GPS en segundo plano; por eso el mapa siempre muestra "hace cuánto").
//  · El mapa usa OpenStreetMap (gratis). Para cambiar a otro proveedor basta cambiar TILE_URL.
// =====================================================================
export const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

export type LiveRow = { user_id: string; lat: number; lng: number; accuracy: number | null; recorded_at: string; on_shift: boolean };
export type RoutePoint = { lat: number; lng: number; recorded_at: string };
export type GeoRow = { id: string; lat: number | null; lng: number | null; geo_status: string | null };

// Aviso entre pantallas: "revisa ahora si hay que compartir ubicación" (al iniciar/cerrar el día o tocar un botón del trabajo)
export const LOC_EVENT = "bp-loc-check";
export const locCheck = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event(LOC_EVENT)); };

// Una posición de hace más de esto ya no es "en vivo" (la app quedó cerrada o el teléfono bloqueado)
export const FRESH_MS = 3 * 60 * 1000;
export const isFresh = (iso: string, now: number) => now - new Date(iso).getTime() < FRESH_MS;

// "just now" · "4 min ago" · "2 h ago" · "Nov 17, 5:02 PM"
export function agoLabel(iso: string, now: number): string {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  if (min < 24 * 60) return `${Math.floor(min / 60)} h ago`;
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// ¿Falta el SQL del Paso 5.9?
export const needsMapSql = (e: { message?: string; code?: string } | null | undefined) =>
  Boolean(e) && (e!.code === "PGRST202" || e!.code === "42883" || e!.code === "42703" || e!.code === "42P01" || /does not exist|Could not find|schema cache/i.test(e!.message ?? ""));

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
