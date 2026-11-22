"use client";

import { useLocale, useTranslations } from "next-intl";
import { intlTag } from "@/i18n/config";
import { jobError } from "@/lib/jobs";

// =====================================================================
// Paso 6.1 — fechas, horas y errores en el idioma de la persona (pantallas del técnico y el shell).
// lib/jobs.ts sigue con sus versiones en inglés para las pantallas de oficina hasta el Paso 6.2.
// =====================================================================
export function useFmt() {
  const tag = intlTag(useLocale());
  return {
    tag,
    time: (d: Date) => d.toLocaleTimeString(tag, { hour: "numeric", minute: "2-digit" }),
    date: (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString(tag, o),
    // "Thursday, Nov 20" · "jueves, 20 nov"
    dayLong: (d: Date) => d.toLocaleDateString(tag, { weekday: "long", month: "short", day: "numeric" }),
    dayShort: (d: Date) => d.toLocaleDateString(tag, { weekday: "short", month: "short", day: "numeric" }),
    monthDay: (d: Date) => d.toLocaleDateString(tag, { month: "short", day: "numeric" }),
    dateTime: (d: Date) => d.toLocaleString(tag, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
    usd: (v: number) => new Intl.NumberFormat(tag, { style: "currency", currency: "USD" }).format(Number(v) || 0),
  };
}

// Errores de la base: en inglés se deja el mensaje de siempre; en español se traducen los códigos conocidos
const CODES = ["OTHER_JOB_OPEN", "GPS_REQUIRED", "CHECKLIST_REQUIRED", "VISIT_CLOSED", "NOTE_REQUIRED", "REASON_REQUIRED", "NO_VAN", "JOB_CLOSED",
  "INVOICE_SENT", "NO_LINES", "VISIT_STARTED", "JOB_CANCELLED", "SCAN_PART", "SCAN_LINE", "NO_ACCESS", "NOT_FOUND"] as const;
export function useJobError() {
  const locale = useLocale();
  const t = useTranslations("errors");
  return (e: { message?: string; code?: string; hint?: string } | null | undefined): string => {
    if (!e) return "";
    if (locale === "en") return jobError(e);
    const m = `${e.message ?? ""} ${e.hint ?? ""}`;
    const code = CODES.find((c) => m.includes(c));
    if (code) return t(code);
    if (m.includes("does not exist") || m.includes("Could not find")) return jobError(e); // falta un SQL: el aviso técnico se deja igual
    return t("generic");
  };
}

// Fecha guardada como "2026-11-20" (sin hora) → "Nov 20, 2026" / "20 nov 2026"
export function useDayFmt() {
  const tag = intlTag(useLocale());
  return (s: string | null) => {
    if (!s) return "";
    const [y, m, d] = s.slice(0, 10).split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString(tag, { month: "short", day: "numeric", year: "numeric" });
  };
}
