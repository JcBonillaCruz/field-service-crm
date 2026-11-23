import { COUNTRIES, cleanPostal, subdivisions } from "@/lib/geo";

const COUNTRY_CODES = new Set(COUNTRIES.map((c) => c.code));

// =====================================================================
// Paso 6.8 · Autocompletar direcciones con Google Places API (New)
// La llave vive SOLO en el servidor (GOOGLE_PLACES_API_KEY en Vercel). El navegador habla con /api/places/*.
// Sesiones: todas las búsquedas mientras escribes + la dirección elegida usan el mismo token → Google lo cobra como una sola sesión.
// =====================================================================
export type PlaceSuggestion = { id: string; main: string; secondary: string };
export type PlaceAddress = { street: string; unit: string; city: string; state: string; zip: string; country: string };
// Por qué no hay sugerencias: sin llave, apagado en Settings, límite del día, tope del sistema, falta el SQL, Google no respondió
export type PlacesOff = "nokey" | "off" | "limit" | "cap" | "sql" | "error";

export const PLACES_MIN_CHARS = 4;

type Comp = { longText?: string; shortText?: string; types?: string[] };

// Convierte addressComponents de Google en nuestra dirección (calle + número, unidad, ciudad, estado, zip, país)
export function parseComponents(list: Comp[] | undefined): PlaceAddress {
  const get = (type: string, short = false) => {
    const c = (list ?? []).find((x) => x.types?.includes(type));
    return (short ? c?.shortText || c?.longText : c?.longText || c?.shortText) ?? "";
  };
  const number = get("street_number");
  const route = get("route", true);
  const country = get("country", true).toUpperCase() || "US";
  const city = get("locality") || get("postal_town") || get("sublocality_level_1") || get("sublocality") || get("administrative_area_level_3") || get("neighborhood");
  const zip = get("postal_code");
  return {
    street: [number, route].filter(Boolean).join(" "),
    unit: get("subpremise"),
    city,
    state: get("administrative_area_level_1", true),
    zip: country === "US" ? zip.slice(0, 5) : zip,
    country,
  };
}

// Llena una dirección nuestra con la de Google. El estado solo si existe en nuestra lista; la unidad no se borra si Google no trae.
export function fillFromPlace<A extends PlaceAddress>(cur: A, p: PlaceAddress): A {
  const country = COUNTRY_CODES.has(p.country) ? p.country : cur.country;
  const list = subdivisions(country);
  const state = list.length ? (list.find(([v, name]) => v.toUpperCase() === p.state.toUpperCase() || name.toLowerCase() === p.state.toLowerCase())?.[0] ?? "") : p.state;
  return { ...cur, street: p.street || cur.street, unit: p.unit || cur.unit, city: p.city || cur.city, state: state || (country === cur.country ? cur.state : ""), zip: cleanPostal(country, p.zip || cur.zip), country };
}

export function newSessionToken() {
  try { return crypto.randomUUID(); } catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`; }
}
