"use client";

import { useLocale, useTranslations } from "next-intl";
import { intlTag } from "@/i18n/config";
import { CouponRow, Item, couponStatus } from "@/lib/catalog";
import { CatalogModule, FIELDS, Row, ViewDef, displayValue, isSales, rawValue, shortViewName } from "@/lib/catalog-views";

// =====================================================================
// Paso 6.2b2 — vistas, columnas, filtros y valores de Artículos / Cupones (y la parte común de Ventas)
// en el idioma de quien lo ve. Las vistas, columnas y valores se siguen GUARDANDO igual (claves en inglés).
// =====================================================================
const k = (s: string) => (s || "").replace(/[^A-Za-z0-9_]/g, "");

export function useViewTx(m: CatalogModule) {
  const t = useTranslations("views");
  const locale = useLocale();
  const tag = intlTag(locale);
  const or = (key: string, fb: string) => (t.has(key as never) ? t(key as never) : fb);
  const money = (v: number | null | undefined) => new Intl.NumberFormat(tag, { style: "currency", currency: "USD" }).format(Number(v) || 0);
  const date = (v: string | null | undefined) =>
    v ? new Date(v.length === 10 ? `${v}T12:00:00` : v).toLocaleDateString(tag, { day: "2-digit", month: "short", year: "numeric" }).replace(".", "") : "";
  const dateTime = (v: string) => new Date(v).toLocaleString(tag, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const choice = (v: string, fb: string) => or(`ch.${m}.${k(v)}`, or(`ch.${k(v)}`, fb));
  const coupon = (c: CouponRow) => { const s = couponStatus(c); return { ...s, label: t(`cs.${s.tone}` as never) }; };
  const discount = (c: Pick<CouponRow, "discount_type" | "discount_value">) => (c.discount_type === "percent" ? `${+c.discount_value}%` : money(c.discount_value));

  return {
    t, tag, locale, money, date, dateTime, choice, coupon, discount,
    one: or(`m.${m}.one`, m), many: or(`m.${m}.many`, m),
    count: (n: number) => t(`m.${m}.count` as never, { n } as never),
    field: (key: string, fb: string) => or(`f.${m}.${key}`, or(`f.${key}`, fb)),
    view: (v: ViewDef) => (v.builtin ? or(`v.${m}.${v.id}`, v.name) : v.name),
    shortView: (v: ViewDef) => (v.builtin ? or(`vs.${m}.${v.id}`, shortViewName(m, v)) : v.name),
    op: (value: string, fb: string) => or(`op.${value}`, fb),
    unit: (u: string | null | undefined) => (u ? or(`unit.${k(u)}`, u) : ""),
    account: (a: string | null | undefined) => (a ? or(`acct.${k(a)}`, a) : ""),
    histField: (f: string) => or(`hf.${f}`, f),
    // El texto que se ve en una celda de la tabla
    display: (row: Row, key: string): string => {
      const f = FIELDS[m].find((x) => x.key === key);
      const raw = rawValue(m, row, key);
      if (raw == null || raw === "") return "";
      if (isSales(m)) {
        if (key === "amount" || key === "balance") return money(raw as number);
        if (f?.type === "date") return date(String(raw));
        return displayValue(m, row, key); // estados de Ventas: Paso 6.2b3
      }
      if (m === "items") {
        const it = row as Item;
        if (key === "rate") return money(it.selling_price);
        if (key === "unit") return or(`unit.${k(String(raw))}`, String(raw));
        if (key === "account") return or(`acct.${k(String(raw))}`, String(raw));
      }
      if (m === "coupons" && key === "discount") return discount(row as CouponRow);
      if (m === "coupons" && key === "status") return coupon(row as CouponRow).label;
      if (f?.type === "date") return date(String(raw));
      if (f?.choices) { const c = f.choices.find((ch) => ch.value === raw); return c ? choice(c.value, c.label) : String(raw); }
      return String(raw);
    },
  };
}
export type ViewTx = ReturnType<typeof useViewTx>;
