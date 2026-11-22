import type { MobileStats } from "@/lib/dashboard-server";

// stat/statLabel/more: extras que solo usa la vista de escritorio (panel grande al pasar el mouse)
export type Insight = { tone: "good" | "warn" | "bad" | "info"; title: string; body: string; href?: string; cta?: string; stat?: number; statKind?: "money" | "pct"; statLabel?: string; more?: string };

// Paso 6.2b: los textos llegan en el idioma de quien lo ve (t = namespace "insights", $ = dinero sin centavos)
export type InsightL = { t: (key: string, values?: Record<string, string | number>) => string; $: (v: number) => string; cat?: (name: string) => string };
const pct = (v: number) => `${Math.round(v * 100)}%`;

// Lo que está pasando con tu dinero, en palabras simples, con qué hacer
export function buildInsights(st: MobileStats, L: InsightL): Insight[] {
  const { t, $ } = L;
  const out: Insight[] = [];
  const n = st.receipts.length;
  const thisM = st.receipts[n - 1] ?? 0, lastM = st.receipts[n - 2] ?? 0;
  const spentM = st.expenses[n - 1] ?? 0, spentLast = st.expenses[n - 2] ?? 0;
  const profitYtd = st.ytdReceived - st.ytdExpenses;
  const margin = st.ytdReceived > 0 ? profitYtd / st.ytdReceived : 0;

  if (st.ytdReceived > 0 && profitYtd < 0) out.push({ tone: "bad", title: t("lossT"), stat: profitYtd, statKind: "money", statLabel: t("lossS"), more: t("lossM"), body: t("lossB", { spent: $(st.ytdExpenses), got: $(st.ytdReceived) }), href: "/dashboard/expenses", cta: t("ctaReview") });
  else if (st.ytdReceived > 0 && margin < 0.2) out.push({ tone: "warn", title: t("lowT", { pct: pct(margin) }), stat: margin, statKind: "pct", statLabel: t("lowS"), more: t("lowM"), body: t("lowB"), href: "/dashboard/items", cta: t("ctaPrices") });
  else if (st.ytdReceived > 0 && margin >= 0.4) out.push({ tone: "good", title: t("goodT", { pct: pct(margin) }), stat: profitYtd, statKind: "money", statLabel: t("goodS"), more: t("goodM"), body: t("goodB", { amt: $(profitYtd) }) });

  if (st.overdue > 0) {
    const late = st.agingCount.slice(1).reduce((a, b) => a + b, 0);
    out.push({ tone: "warn", title: t("overT", { amt: $(st.overdue) }), stat: st.overdue, statKind: "money", statLabel: t("overS"), more: t("overM"), body: t("overB", { n: late }), href: "/dashboard/invoices?view=overdue", cta: t("ctaRemind") });
  }
  if (lastM > 0) {
    const ch = (thisM - lastM) / lastM;
    out.push(ch >= 0
      ? { tone: "good", title: t("upT", { pct: pct(ch) }), stat: thisM, statKind: "money", statLabel: t("monthS"), more: t("upM"), body: t("upB", { now: $(thisM), last: $(lastM) }) }
      : { tone: "info", title: t("downT", { pct: pct(-ch) }), stat: thisM, statKind: "money", statLabel: t("monthS"), more: t("downM"), body: t("downB", { now: $(thisM), last: $(lastM) }) });
  }
  if (spentLast > 0 && spentM > spentLast * 1.25) out.push({ tone: "warn", title: t("spendT", { pct: pct((spentM - spentLast) / spentLast) }), stat: spentM, statKind: "money", statLabel: t("spendS"), more: t("spendM"), body: t("spendB", { now: $(spentM), last: $(spentLast) }), href: "/dashboard/expenses", cta: t("ctaExpenses") });
  const totalCat = st.expenseByCat.reduce((a, [, v]) => a + v, 0);
  if (st.expenseByCat[0] && totalCat > 0 && st.expenseByCat[0][1] / totalCat > 0.4) out.push({ tone: "info", title: t("catT", { cat: (L.cat ?? ((x: string) => x))(st.expenseByCat[0][0]), pct: pct(st.expenseByCat[0][1] / totalCat) }), stat: st.expenseByCat[0][1], statKind: "money", statLabel: t("catS"), more: t("catM"), body: t("catB"), href: "/dashboard/expenses", cta: t("ctaExpenses") });
  if (st.quoteStats.open > 0) out.push({ tone: "info", title: t("quoteT", { amt: $(st.quoteStats.openValue) }), stat: st.quoteStats.openValue, statKind: "money", statLabel: t("quoteS"), more: t("quoteM"), body: t("quoteB", { n: st.quoteStats.open }), href: "/dashboard/quotes?view=sent", cta: t("ctaFollow") });
  const decided = st.quoteStats.accepted + st.quoteStats.declined;
  if (decided >= 3) {
    const win = st.quoteStats.accepted / decided;
    out.push({ tone: win >= 0.5 ? "good" : "warn", title: t("winT", { pct: pct(win) }), stat: win, statKind: "pct", statLabel: t("winS", { won: st.quoteStats.accepted, lost: st.quoteStats.declined }), href: "/dashboard/quotes", cta: t("ctaQuotes"), more: win >= 0.5 ? t("winHighM") : t("winLowM"), body: win >= 0.5 ? t("winHighB") : t("winLowB") });
  }
  if (st.ytdExpenses === 0) out.push({ tone: "info", title: t("noExpT"), body: t("noExpB"), href: "/dashboard/expenses", cta: t("ctaAddExpense") });
  return out;
}

// Un consejo distinto cada día (20 en total, en el idioma de quien lo ve: t("tip0") … t("tip19"))
export const TIP_COUNT = 20;
export const tipOfTheDay = (t: InsightL["t"], d = new Date()) => t(`tip${(Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000)) % TIP_COUNT}`);
