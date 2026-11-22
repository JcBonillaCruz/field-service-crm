"use client";

import { useLocale, useTranslations } from "next-intl";
import { intlTag } from "@/i18n/config";
import { RANGES, type RangeKey } from "@/lib/expense-range";
import { COST_TYPES } from "@/lib/job-costing";
import { PAYMENT_MODES } from "@/lib/sales";
import type { FinPeriod } from "@/lib/finance-period";

// =====================================================================
// Paso 6.2b — textos de Finanzas en el idioma de cada persona.
// Las categorías, formas de pago y periodos se siguen GUARDANDO en inglés (son códigos);
// aquí solo cambia lo que se ve. Una categoría escrita a mano (ej. "Storage unit") se muestra tal cual.
// =====================================================================
export const catKey = (s: string) => (s || "").replace(/[^A-Za-z0-9]/g, "");

type FinT = { has: (k: never) => boolean; (k: never, v?: Record<string, string | number>): string };

// Lo mismo, pero para usarlo fuera de un componente (servidor o funciones de lib) con cualquier traductor de "finLib"
export function finWords(t: FinT) {
  const pick = (group: string, v: string | null | undefined) => {
    const k = `${group}.${catKey(v ?? "")}`;
    return v && catKey(v) && t.has(k as never) ? t(k as never) : String(v ?? "");
  };
  return { cat: (name: string | null | undefined) => pick("cat", name), pay: (m: string | null | undefined) => pick("pay", m) };
}

export function useFinTx() {
  const locale = useLocale();
  const tag = intlTag(locale);
  const t = useTranslations("finLib");
  const w = finWords(t as unknown as FinT);

  const utc = (day: string) => { const [y, m, d] = day.slice(0, 10).split("-").map(Number); return new Date(Date.UTC(y, (m || 1) - 1, d || 1)); };
  const mon = (day: string) => utc(day).toLocaleDateString(tag, { timeZone: "UTC", month: "short" }).replace(".", "");
  const dShort = (day: string, year = false) => utc(day).toLocaleDateString(tag, { timeZone: "UTC", month: "short", day: "numeric", ...(year ? { year: "numeric" } : {}) }).replace(".", "");
  // "Nov 3 – 9, 2026" · "3 nov – 9 nov 2026"
  const span = (from: string, to: string) => (from === to ? dShort(from, true)
    : locale === "es" && from.slice(0, 7) === to.slice(0, 7) ? `${utc(from).getUTCDate()} – ${dShort(to, true)}` // "1 – 30 nov 2026"
      : `${dShort(from, from.slice(0, 4) !== to.slice(0, 4))} – ${dShort(to, true)}`);
  // "Nov 15 – 21" · "15 – 21 nov" (corto, sin año)
  const spanShort = (from: string, to: string) => {
    const a = utc(from), b = utc(to);
    if (locale === "es") return from.slice(0, 7) === to.slice(0, 7) ? `${a.getUTCDate()} – ${b.getUTCDate()} ${mon(to)}` : `${a.getUTCDate()} ${mon(from)} – ${b.getUTCDate()} ${mon(to)}`;
    return from.slice(0, 7) === to.slice(0, 7) ? `${mon(from)} ${a.getUTCDate()} – ${b.getUTCDate()}` : `${mon(from)} ${a.getUTCDate()} – ${mon(to)} ${b.getUTCDate()}`;
  };
  const monthLong = (day: string, year = true) => utc(day).toLocaleDateString(tag, { timeZone: "UTC", month: "long", ...(year ? { year: "numeric" } : {}) });
  // Fecha corta de las listas: "20 Nov 2026" (inglés, como antes) · "20 nov 2026"
  const fmtD = (v: string | null | undefined) => {
    if (!v) return "";
    const d = new Date(v.length === 10 ? `${v}T12:00:00` : v);
    return locale === "es" ? d.toLocaleDateString(tag, { day: "2-digit", month: "short", year: "numeric" }).replace(".", "") : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };
  const money = (v: number | null | undefined) => new Intl.NumberFormat(tag, { style: "currency", currency: "USD" }).format(Number(v) || 0);

  // El título de un periodo de Finances (Payroll / Reports): semana con fechas, "noviembre de 2026", "T4 2026", "2026"
  const finTitle = (r: { period: FinPeriod; from: string; to: string }) =>
    r.period === "week" || r.period === "2weeks" ? span(r.from, r.to)
      : r.period === "month" ? monthLong(r.from)
        : r.period === "quarter" ? t("quarter", { q: Math.floor(Number(r.from.slice(5, 7)) / 3) + 1, y: r.from.slice(0, 4) }) : r.from.slice(0, 4);

  // "Nov" (como lo manda el servidor) → "nov"
  const EN_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monName = (en: string) => { const i = EN_MON.indexOf(en); return i < 0 ? en : new Date(2024, i, 1).toLocaleDateString(tag, { month: "short" }).replace(".", ""); };
  // Dinero sin centavos: "$1,250"
  const money0 = (v: number) => new Intl.NumberFormat(tag, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(v) || 0);

  return {
    t, tag, locale, money, money0, monName, fmtD, span, spanShort, monthLong, finTitle,
    cat: w.cat,
    pay: w.pay,
    payModes: PAYMENT_MODES.map((m) => ({ value: m, label: w.pay(m) })),
    range: (k: RangeKey) => t(`range.${k}` as never),
    ranges: RANGES.map((r) => ({ ...r, label: t(`range.${r.key}` as never) })),
    // La etiqueta del periodo de Gastos / Entradas de dinero (el servidor la manda en inglés)
    rangeLabel: (r: { key: RangeKey; from: string; to: string }) => (r.key === "custom" ? (locale === "es" ? span(r.from, r.to) : r.from === r.to ? dShort(r.from, true) : `${dShort(r.from, true)} – ${dShort(r.to, true)}`) : t(`range.${r.key}` as never)),
    cost: (v: string | null | undefined) => t(`cost.${COST_TYPES.some((c) => c.value === v) ? v : "other"}` as never),
    costShort: (v: string | null | undefined) => t(`costShort.${COST_TYPES.some((c) => c.value === v) ? v : "other"}` as never),
    period: (p: FinPeriod) => t(`period.${p}` as never),
    periods: (list: { value: FinPeriod; label: string }[]) => list.map((p) => ({ ...p, label: t(`period.${p.value}` as never) })),
    // El periodo anterior al que se está viendo (para "vs semana pasada")
    prevTitle: (r: { period: FinPeriod; from: string; prev: string }) => {
      const d = utc(r.from); d.setUTCDate(d.getUTCDate() - 1);
      return finTitle({ period: r.period, from: r.prev, to: d.toISOString().slice(0, 10) });
    },
  };
}
export type FinTx = ReturnType<typeof useFinTx>;
