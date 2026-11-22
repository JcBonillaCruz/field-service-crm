"use client";

import { useLocale, useTranslations } from "next-intl";
import { intlTag } from "@/i18n/config";
import { MoveKind, StockStatus } from "@/lib/inventory";

// =====================================================================
// Paso 6.2c — Inventario en el idioma de quien lo ve. Motivos y movimientos se siguen GUARDANDO en inglés.
// =====================================================================
const k = (s: string) => (s || "").replace(/[^A-Za-z0-9]/g, "");

// Errores de invError() (en inglés) → texto traducido
const ERR: Record<string, string> = {
  "Another inventory product already uses this SKU / barcode.": "skuExists",
  "Products that track inventory need a SKU / barcode.": "skuRequired",
  "There isn't enough stock in that location.": "notEnough",
  "Choose a reason for this adjustment.": "reason",
  "You don't have permission to do this.": "noAccess",
  "Enter the product name.": "name",
  "This location still has stock. Transfer it or count it to zero first.": "notEmpty",
  "The main warehouse can't be deleted.": "defaultLoc",
  "That technician already has a van. Each technician can have one active van.": "oneVan",
  "Choose two different locations.": "badLoc",
  "Run the SQL for Paso 4.1 in Supabase first.": "sql",
  "Something went wrong. Try again.": "generic",
};

export function useInvTx() {
  const t = useTranslations("invLib");
  const locale = useLocale();
  const tag = intlTag(locale);
  const or = (key: string, fb: string) => (t.has(key as never) ? t(key as never) : fb);
  return {
    t, tag, locale,
    money: (v: number) => new Intl.NumberFormat(tag, { style: "currency", currency: "USD" }).format(v || 0),
    status: (s: StockStatus) => t(`st.${s}` as never),
    move: (m: MoveKind | string) => or(`mv.${m}`, m),
    reason: (r: string | null | undefined) => (r ? or(`rs.${k(r)}`, r) : ""),
    err: (msg: string) => {
      if (!msg) return msg;
      if (ERR[msg]) return t(`err.${ERR[msg]}` as never);
      const m = /^Up to (\d+) photos per product\.$/.exec(msg);
      return m ? t("err.photos", { n: Number(m[1]) }) : msg;
    },
    date: (v: string | null | undefined) => (v ? new Date(v.length === 10 ? `${v}T12:00:00` : v).toLocaleDateString(tag, { day: "numeric", month: "short", year: "numeric" }) : ""),
    dateTime: (v: string) => new Date(v).toLocaleString(tag, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }),
  };
}
export type InvTx = ReturnType<typeof useInvTx>;
