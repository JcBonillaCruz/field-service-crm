"use client";

import { useLocale, useTranslations } from "next-intl";
import { intlTag } from "@/i18n/config";
import { DocKind, SalesModule, Status } from "@/lib/sales";

// =====================================================================
// Paso 6.2b3 — Cotizaciones, Facturas y Suscripciones en el idioma de quien lo ve.
// Lo que se GUARDA no cambia (estados, términos, formas de pago, cuentas e historial siguen en inglés):
// aquí solo se traduce lo que se ve en pantalla.
// =====================================================================
const k = (s: string) => (s || "").replace(/[^A-Za-z0-9]/g, "");

type T = ReturnType<typeof useTranslations<"salesLib">>;

// Estado (Draft, Sent, Overdue by 3 days…). La llave sale del texto en inglés para distinguir
// "Customer Viewed" (cotización) de "Viewed" (factura).
export function statusText(t: T, s: Status & { days?: number }) {
  if (s.key === "overdue") return t("st.overdueBy", { n: s.days ?? 0 });
  const key = `st.${k(s.label)}`;
  return t.has(key as never) ? t(key as never) : s.label;
}

// Historial: los mensajes se guardan en inglés; aquí se muestran en el idioma de quien lo ve
const ACT: [RegExp, string][] = [
  [/^(Quote|Invoice) created for (.+)$/, "createdFor"],
  [/^(Quote|Invoice) created \(cloned from (.+)\)$/, "cloned"],
  [/^(Quote|Invoice) updated$/, "updated"],
  [/^(Quote|Invoice) marked as sent$/, "markedSent"],
  [/^(Quote) marked as accepted$/, "markedAccepted"],
  [/^(Quote) marked as declined$/, "markedDeclined"],
  [/^(Invoice) marked as void$/, "markedVoid"],
  [/^(Quote|Invoice) sent from the email app to (.+)$/, "sentApp"],
  [/^(Quote|Invoice) emailed to (.+)$/, "emailed"],
  [/^Payment reminder emailed to (.+)$/, "reminderEmailed"],
  [/^(Quote|Invoice) shared by (.+?) to (.+)$/, "sharedTo"],
  [/^(Quote|Invoice) shared by (.+)$/, "sharedBy"],
  [/^(Quote|Invoice) link shared$/, "linkShared"],
  [/^Payment of (.+) recorded \((.+)\)$/, "paymentRecorded"],
  [/^(.+) written off$/, "writtenOff"],
  [/^Expected payment date set to (.+)$/, "expectedSet"],
  [/^Expected payment date removed$/, "expectedRemoved"],
  [/^Job (.*)created from this quote$/, "jobCreated"],
  [/^Payment reminders enabled$/, "remindersOn"],
  [/^Payment reminders stopped$/, "remindersOff"],
  [/^(Payment|Write-off) of (.+) deleted$/, "paymentDeleted"],
  [/^(Quote|Invoice) imported from CSV$/, "imported"],
  [/^Quote converted to invoice (.+)$/, "converted"],
  [/^Invoice created from quote (.+)$/, "fromQuote"],
  [/^Invoice (.+) created \(cycle (\d+)\)$/, "cycleInvoice"],
  [/^Invoice created from subscription (.+)$/, "fromSub"],
  [/^Subscription created · (.+) every (\d+) (week|month|year)s?$/, "subCreated"],
  [/^Subscription created$/, "subCreatedPlain"],
  [/^Subscription updated$/, "subUpdated"],
  [/^Subscription cancelled$/, "subCancelled"],
  [/^Subscription reactivated$/, "subReactivated"],
  [/^Subscription paused$/, "subPaused"],
  [/^Subscription resumed$/, "subResumed"],
];

export function useSalesTx() {
  const t = useTranslations("salesLib");
  const locale = useLocale();
  const tag = intlTag(locale);
  const dTag = locale === "es" ? "es-US" : "en-GB"; // "20 Oct 2026" en inglés, "20 oct 2026" en español
  const or = (key: string, fb: string) => (t.has(key as never) ? t(key as never) : fb);

  const money = (v: number | null | undefined, currency = "USD") => {
    try { return new Intl.NumberFormat(tag, { style: "currency", currency }).format(Number(v) || 0); } catch { return `$${(Number(v) || 0).toFixed(2)}`; }
  };
  const num2 = (v: number) => (Number(v) || 0).toLocaleString(tag, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtD = (v: string | null | undefined) =>
    v ? new Date(v.length === 10 ? `${v}T12:00:00` : v).toLocaleDateString(dTag, { day: "2-digit", month: "short", year: "numeric" }).replace(".", "") : "";
  const fmtDT = (v: string) =>
    new Date(v).toLocaleString(dTag, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
  const unitName = (u: string, n: number) => t(`unit.${u}` as never, { n } as never);
  const noun = (kind: DocKind | "subscription") => t(`noun.${kind}` as never);

  function act(message: string) {
    for (const [re, key] of ACT) {
      const m = re.exec(message);
      if (!m) continue;
      const a = m.slice(1);
      const kind = (x?: string) => (x === "Quote" ? "quote" : x === "Invoice" ? "invoice" : "other");
      switch (key) {
        case "createdFor": return t("act.createdFor", { kind: kind(a[0]), amount: a[1] });
        case "cloned": return t("act.cloned", { kind: kind(a[0]), from: a[1] });
        case "sentApp": case "emailed": return t(`act.${key}`, { kind: kind(a[0]), to: a[1] });
        case "reminderEmailed": return t("act.reminderEmailed", { to: a[0] });
        case "sharedTo": return t("act.sharedTo", { kind: kind(a[0]), how: or(`how.${k(a[1])}`, a[1]), to: a[2] });
        case "sharedBy": return t("act.sharedBy", { kind: kind(a[0]), how: or(`how.${k(a[1])}`, a[1]) });
        case "paymentRecorded": return t("act.paymentRecorded", { amount: a[0], mode: or(`pay.${k(a[1])}`, a[1]) });
        case "writtenOff": return t("act.writtenOff", { amount: a[0] });
        case "expectedSet": return t("act.expectedSet", { date: a[0] });
        case "jobCreated": return t("act.jobCreated", { job: a[0].trim() });
        case "paymentDeleted": return t("act.paymentDeleted", { what: a[0] === "Payment" ? "payment" : "writeoff", amount: a[1] });
        case "converted": case "fromQuote": case "fromSub": return t(`act.${key}`, { n: a[0] });
        case "cycleInvoice": return t("act.cycleInvoice", { n: a[0], cycle: a[1] });
        case "subCreated": return t("act.subCreated", { amount: a[0], every: t("every", { n: Number(a[1]), unit: unitName(a[2], Number(a[1])) }) });
        default: return t(`act.${key}` as never, { kind: kind(a[0]) } as never);
      }
    }
    return message;
  }

  return {
    t, tag, locale, money, num2, fmtD, fmtDT, noun, act,
    status: (s: Status & { days?: number }) => statusText(t, s),
    term: (x: string | null | undefined) => (x ? or(`term.${k(x)}`, x) : ""),
    pay: (x: string | null | undefined) => (x ? or(`pay.${k(x)}`, x) : ""),
    account: (x: string | null | undefined) => (x ? or(`acct.${k(x)}`, x) : ""),
    // "Every month", "Every 3 months"
    freq: (every: number, unit: string) => t("every", { n: every, unit: unitName(unit, every) }),
    unitName,
    one: (m: SalesModule) => t(`m.${m}.one` as never),
    many: (m: SalesModule) => t(`m.${m}.many` as never),
    count: (m: SalesModule, n: number) => t(`m.${m}.count` as never, { n } as never),
  };
}
export type SalesTx = ReturnType<typeof useSalesTx>;
