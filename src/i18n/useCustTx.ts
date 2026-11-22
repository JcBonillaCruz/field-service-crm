"use client";

import { useLocale, useTranslations } from "next-intl";
import { intlTag } from "@/i18n/config";
import { postalLabel, stateLabel } from "@/lib/geo";

// =====================================================================
// Paso 6.2b2 — textos de Clientes en el idioma de quien lo ve.
// Tipos, etiquetas de teléfono/correo, términos de pago e idiomas se siguen GUARDANDO en inglés;
// aquí solo cambia lo que se ve. Algo escrito a mano se muestra tal cual.
// =====================================================================
const key = (s: string) => (s || "").replace(/[^A-Za-z0-9]/g, "");

export function useCustTx() {
  const t = useTranslations("custLib");
  const locale = useLocale();
  let regions: Intl.DisplayNames | null = null;
  try { regions = new Intl.DisplayNames([intlTag(locale)], { type: "region" }); } catch { regions = null; }
  const pick = (group: string, v: string | null | undefined) => {
    const k = `${group}.${key(v ?? "")}`;
    return v && key(v) && t.has(k as never) ? t(k as never) : String(v ?? "");
  };
  // Mensajes de validación de lib/customers (vienen en inglés)
  const ERR: Record<string, string> = {
    "Enter a 10-digit phone number.": "ePhone10", "Enter a valid phone number.": "ePhone", "Enter a valid email address.": "eEmail",
    "Enter the street address.": "eStreet", "Enter the city.": "eCity", "Choose the state or province.": "eState",
  };
  return {
    t,
    view: (v: string) => pick("view", v),          // all / residential / commercial / missing-…
    sort: (v: string) => pick("sort", v),          // name / company / email / created
    type: (v: string | null | undefined) => pick("type", v),
    phoneLabel: (v: string | null | undefined) => pick("phone", v),
    emailLabel: (v: string | null | undefined) => pick("email", v),
    term: (v: string | null | undefined) => pick("term", v),
    lang: (v: string | null | undefined) => pick("lang", v),
    // "State" / "Province" / "ZIP"… del país, en el idioma
    stateLabel: (country: string) => pick("geo", stateLabel(country)),
    postalLabel: (country: string) => pick("geo", postalLabel(country)),
    // Nombre del país en el idioma (el inglés queda como antes)
    country: (code: string, fallback: string) => (locale === "en" || !regions ? fallback : regions.of(code) ?? fallback),
    err: (m: string | null | undefined) => (m && ERR[m] ? t(ERR[m] as never) : String(m ?? "")),
  };
}
