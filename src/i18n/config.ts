// =====================================================================
// Paso 6.1 — Idioma (inglés / español)
// El idioma es de cada USUARIO (no de la compañía) y NO va en la URL (/es no existe).
//   · Se guarda en profiles.language (sirve en cualquier aparato donde entre)
//   · y en la cookie bp_lang (para pintar cada pantalla sin consultar la base)
// Si no hay cookie ni idioma guardado, se usa el idioma del navegador (español o inglés).
// =====================================================================
export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "bp_lang";

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);

// Idioma preferido del navegador (encabezado Accept-Language): "es-MX,es;q=0.9,en;q=0.8" → "es"
export function fromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  for (const part of header.split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return DEFAULT_LOCALE;
}

// Fechas y números: español con formato de EE. UU. (dólares, mes/día) porque los clientes están aquí
export const intlTag = (l: string): string => (l === "es" ? "es-US" : "en-US");

// La cookie también se escribe desde el navegador (al elegir idioma en otro aparato o la primera vez)
export function setLocaleCookie(l: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
}
