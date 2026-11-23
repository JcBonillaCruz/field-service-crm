"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { intlTag } from "@/i18n/config";
import ReportArt from "@/components/jobs/reports/ReportArt";
import SelectMenu from "@/components/ui/SelectMenu";
import { leadLabel } from "@/lib/lead-sources";
import { MK_COLORS, MkRaw, MkResult, MkRow, NO_SOURCE, buildRoi, roiTone } from "@/lib/marketing-roi";
import type { PdfBlock, PdfTone } from "@/lib/report-pdf";

// =====================================================================
// Marketing ROI (Paso 6.16-M) — dueño y manager.
//   · variant "card": Home (Dashboard y pestaña Finances), con su propio selector de periodo
//   · variant "report": Finances → Reports, en el periodo del reporte
// =====================================================================
type Period = "month" | "3months" | "year" | "12months";
const PERIODS: Period[] = ["month", "3months", "year", "12months"];
const startOf = (p: Period, today: string) => {
  const [y, m] = today.split("-").map(Number);
  const iso = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, "0")}-01`;
  if (p === "month") return iso(y, m);
  if (p === "year") return iso(y, 1);
  const back = p === "3months" ? 2 : 11;
  const d = new Date(Date.UTC(y, m - 1 - back, 1));
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1);
};
// Lo mínimo que hay que cargar para que funcionen los cuatro periodos del Home
export const cardWindow = (today: string) => ({ from: [startOf("12months", today), startOf("year", today)].sort()[0], to: today });

const TONE = {
  neg: "bg-[#fff1f2] text-[#be123c]", warn: "bg-[#fff7e6] text-[#b45309]", pos: "bg-[#eafaf1] text-[#15803d]", muted: "bg-slate-100 text-slate-400",
} as const;

function useMk() {
  const t = useTranslations("mkRoi");
  const tl = useTranslations("lead");
  const tag = intlTag(useLocale());
  const usd0 = (v: number) => new Intl.NumberFormat(tag, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.round(Number(v) || 0));
  const usd = (v: number) => new Intl.NumberFormat(tag, { style: "currency", currency: "USD" }).format(Number(v) || 0);
  const name = (r: MkRow) => (r.key === NO_SOURCE ? t("noSource") : leadLabel(tl, r.source) || t("noSource"));
  const roiText = (v: number | null) => (v == null ? "—" : usd(v));
  return { t, tag, usd0, usd, name, roiText };
}

// Frases fijas que explican los números (las mismas en pantalla y en el PDF)
function useFindings() {
  const { t, usd0, usd, name } = useMk();
  return (m: MkResult, untaggedCustomers: number) => {
    const out: string[] = [];
    const tg = m.totals;
    const tagged = m.rows.filter((r) => r.key !== NO_SOURCE && r.spent > 0);
    const noSrc = m.rows.find((r) => r.key === NO_SOURCE);
    if (tagged.length && tg.roi != null) out.push(t("fTotal", { spent: usd0(tagged.reduce((a, r) => a + r.spent, 0)), back: usd0(tg.collectedPaid), roi: usd(tg.roi) }));
    if (m.best) out.push(t("fBest", { name: name(m.best), roi: usd(m.best.roi ?? 0), per: m.best.perCustomer != null ? t("fPer", { v: usd0(m.best.perCustomer) }) : "" }));
    for (const r of m.losers.slice(0, 3)) out.push(r.collected > 0 ? t("fLow", { name: name(r), spent: usd0(r.spent), back: usd0(r.collected) }) : t("fZero", { name: name(r), spent: usd0(r.spent) }));
    const free = m.rows.filter((r) => r.key !== NO_SOURCE && r.spent === 0 && r.collected > 0).sort((a, b) => b.collected - a.collected)[0];
    if (free) out.push(t("fFree", { name: name(free), back: usd0(free.collected) }));
    if (noSrc && noSrc.spent > 0) out.push(t("fUntaggedSpend", { v: usd0(noSrc.spent) }));
    if (untaggedCustomers > 0) out.push(t("fUntaggedCust", { n: untaggedCustomers }));
    if (!out.length) out.push(t("fNothing"));
    return out;
  };
}

export default function MarketingRoi({ raw, today, variant = "card", from, to, rangeLabel }: {
  raw: MkRaw; today: string; variant?: "card" | "report"; from?: string; to?: string; rangeLabel?: string;
}) {
  const { t, tag, usd0, usd, name, roiText } = useMk();
  const explain = useFindings();
  const [period, setPeriod] = useState<Period>("year");
  const a = variant === "report" ? from ?? raw.from : startOf(period, today);
  const b = variant === "report" ? to ?? raw.to : today;
  const m = useMemo(() => buildRoi(raw, a, b), [raw, a, b]);
  const notes = explain(m, raw.untaggedCustomers);
  const [open, setOpen] = useState(variant === "report");
  const max = Math.max(1, ...m.rows.map((r) => Math.max(r.spent, r.collected)));
  // Sin formatRange: el servidor y el navegador lo escriben con espacios distintos (error de hidratación)
  const fs = new Intl.DateTimeFormat(tag, { month: "short", day: "numeric", timeZone: "UTC" });
  const fl = new Intl.DateTimeFormat(tag, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const clean = (v: string) => v.replace(/[\u202f\u00a0]/g, " ").replace(/\./g, "");
  const span = rangeLabel ?? `${clean((a.slice(0, 4) === b.slice(0, 4) ? fs : fl).format(new Date(`${a}T00:00:00Z`)))} – ${clean(fl.format(new Date(`${b}T00:00:00Z`)))}`;
  const colorOf = (r: MkRow, i: number) => (r.key === NO_SOURCE ? "#94a3b8" : MK_COLORS[i % MK_COLORS.length]);
  const kpis = [
    { label: t("spent"), value: usd0(m.totals.spent), note: t("spentNote"), tone: "text-[#0b1f3a]" },
    { label: t("collected"), value: usd0(m.totals.collectedPaid), note: t("collectedNote"), tone: "text-[#0b1f3a]" },
    { label: t("perDollar"), value: roiText(m.totals.roi), note: m.totals.roi == null ? t("perDollarNone") : m.totals.roi < 1 ? t("perDollarLoss") : t("perDollarNote"),
      tone: m.totals.roi == null ? "text-slate-400" : m.totals.roi < 1 ? "text-[#be123c]" : "text-[#15803d]" },
    { label: t("perCustomer"), value: m.totals.perCustomer == null ? "—" : usd0(m.totals.perCustomer), note: t("perCustomerNote", { n: m.totals.newPaid }), tone: "text-[#0b1f3a]" },
  ];

  return (
    <section aria-label={t("title")} className="group rounded-2xl border border-slate-200 bg-white transition-shadow duration-200 hover:shadow-[0_8px_24px_rgba(15,40,60,0.07)]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3 px-4 pt-4 lg:px-5">
        <div className="mr-auto flex min-w-0 items-center gap-3">
          <span className="shrink-0 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"><ReportArt kind="marketing" size={44} /></span>
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-semibold leading-tight text-[#0b1f3a] lg:text-[18px]">{t("title")}</h2>
            <p className="truncate text-[12.5px] text-slate-500"><span className="hidden sm:inline">{t("sub")} · </span>{span}</p>
          </div>
        </div>
        {variant === "card" && (
          <div className="w-full sm:w-48"><SelectMenu ariaLabel={t("period")} value={period} onChange={(v) => setPeriod(v as Period)}
            options={PERIODS.map((p) => ({ value: p, label: t(`p.${p}`) }))} /></div>
        )}
      </div>

      {raw.needsSql && <p className="mx-4 mt-3 rounded-xl border border-[#fcd38d] bg-[#fffbf3] px-3.5 py-2.5 text-[12.5px] text-[#92400e] lg:mx-5">{t("needsSql")}</p>}

      {m.empty ? (
        <div className="px-4 pb-1 pt-4 lg:px-5">
          <p className="text-[14.5px] font-semibold text-[#0b1f3a]">{t("emptyTitle")}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{t("emptyText")}</p>
        </div>
      ) : (
        <div className="px-4 pt-4 lg:px-5">
          {/* Celular: una cifra por renglón · computadora: cuatro columnas */}
          <dl className="divide-y divide-slate-100 sm:grid sm:grid-cols-2 sm:gap-4 sm:divide-y-0 xl:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="flex min-w-0 items-center justify-between gap-3 py-2.5 sm:flex-col sm:items-start sm:justify-start sm:gap-0 sm:py-0">
                <div className="min-w-0 sm:contents">
                  <dt className="text-[13px] font-medium text-slate-500 sm:text-[12.5px]">{k.label}</dt>
                  <dd className="mt-0.5 max-w-full truncate text-[11.5px] text-slate-400 sm:order-3 sm:mt-1">{k.note}</dd>
                </div>
                <dd className={`shrink-0 text-[18px] font-semibold tabular-nums sm:order-2 sm:mt-1 sm:text-[24px] sm:leading-tight ${k.tone}`}>{k.value}</dd>
              </div>
            ))}
          </dl>

          {/* Por fuente */}
          <div className="mt-5">
            <div className="hidden grid-cols-[minmax(0,1.6fr)_repeat(5,minmax(0,1fr))] gap-x-3 border-b border-slate-100 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:grid">
              <span>{t("h.source")}</span><span className="text-right">{t("h.spent")}</span><span className="text-right">{t("h.new")}</span>
              <span className="text-right">{t("h.collected")}</span><span className="text-right">{t("h.perDollar")}</span><span className="text-right">{t("h.perCustomer")}</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {(open ? m.rows : m.rows.slice(0, 5)).map((r, i) => {
                const tone = r.spent > 0 ? roiTone(r.roi) : "muted";
                return (
                  <li key={r.key} className="py-2.5 md:grid md:grid-cols-[minmax(0,1.6fr)_repeat(5,minmax(0,1fr))] md:items-center md:gap-x-3">
                    <div className="flex min-w-0 items-center justify-between gap-3 md:block">
                      <p className="flex min-w-0 items-center gap-2 text-[14px] font-semibold text-[#0b1f3a]">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorOf(r, i) }} />
                        <span className="truncate">{name(r)}</span>
                      </p>
                      <span className={`shrink-0 rounded-md px-2 py-0.5 text-[12px] font-bold tabular-nums md:hidden ${TONE[tone]}`}>{r.spent > 0 ? t("perDollarShort", { v: roiText(r.roi) }) : t("noSpend")}</span>
                      {/* Barras: gastado vs cobrado (solo computadora) */}
                      <div className="mt-1.5 hidden space-y-1 md:block" aria-hidden="true">
                        <span className="block h-1.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full origin-left animate-[bp-grow-x_0.6s_ease-out] rounded-full bg-[#e8713a]" style={{ width: `${(r.spent / max) * 100}%` }} /></span>
                        <span className="block h-1.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full origin-left animate-[bp-grow-x_0.6s_ease-out] rounded-full bg-[#14a39a]" style={{ width: `${(r.collected / max) * 100}%` }} /></span>
                      </div>
                    </div>
                    <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[12.5px] md:contents">
                      <div className="flex justify-between md:block md:text-right"><dt className="text-slate-500 md:hidden">{t("h.spent")}</dt><dd className="font-medium tabular-nums text-[#0b1f3a] md:text-[13.5px]">{r.spent > 0 ? usd0(r.spent) : "—"}</dd></div>
                      <div className="flex justify-between md:block md:text-right"><dt className="text-slate-500 md:hidden">{t("h.new")}</dt><dd className="font-medium tabular-nums text-[#0b1f3a] md:text-[13.5px]">{r.newCustomers}</dd></div>
                      <div className="flex justify-between md:block md:text-right"><dt className="text-slate-500 md:hidden">{t("h.collected")}</dt><dd className="font-medium tabular-nums text-[#0b1f3a] md:text-[13.5px]">{usd0(r.collected)}</dd></div>
                      <div className="hidden md:block md:text-right"><dd><span className={`inline-block rounded-md px-2 py-0.5 text-[12.5px] font-bold tabular-nums ${TONE[tone]}`}>{r.spent > 0 ? roiText(r.roi) : t("noSpend")}</span></dd></div>
                      <div className="flex justify-between md:block md:text-right"><dt className="text-slate-500 md:hidden">{t("h.perCustomer")}</dt><dd className="font-medium tabular-nums text-[#0b1f3a] md:text-[13.5px]">{r.perCustomer != null ? usd0(r.perCustomer) : "—"}</dd></div>
                    </dl>
                  </li>
                );
              })}
            </ul>
            {m.rows.length > 5 && (
              <button type="button" onClick={() => setOpen(!open)} className="mt-1 text-[13px] font-semibold text-[#0f766e] hover:underline">
                {open ? t("showLess") : t("showAll", { n: m.rows.length })}
              </button>
            )}
            <p className="mt-2 hidden items-center gap-4 text-[11.5px] text-slate-400 md:flex">
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-[#e8713a]" />{t("legendSpent")}</span>
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-[#14a39a]" />{t("legendCollected")}</span>
            </p>
          </div>

          {/* Explícame esto */}
          <div className="mt-4 rounded-xl bg-[#f6fbfa] px-3.5 py-3">
            <p className="text-[13px] font-semibold text-[#0b1f3a]">{t("explain")}</p>
            <ul className="mt-1.5 space-y-1.5">
              {notes.map((n) => <li key={n} className="flex gap-2 text-[13px] leading-snug text-slate-600"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#14a39a]" />{n}</li>)}
            </ul>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-3 lg:px-5">
        <p className="mr-auto min-w-0 text-[12px] leading-relaxed text-slate-400">{t("footer")}</p>
        <Link prefetch={false} href="/dashboard/expenses?new=marketing" className="inline-flex h-9 items-center whitespace-nowrap rounded-lg bg-[#0f766e] px-3 text-[13px] font-semibold text-white transition-all hover:-translate-y-px hover:bg-[#0b5f59]">{t("addSpend")}</Link>
        <Link prefetch={false} href="/dashboard/settings/lead-sources" className="inline-flex h-9 items-center whitespace-nowrap rounded-lg border border-slate-200 px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">{t("sources")}</Link>
      </div>
    </section>
  );
}

// ---------- PDF (Finances → Reports): mismas cifras y frases ----------
export function useMarketingPdf() {
  const { t, usd0, roiText, name } = useMk();
  const explain = useFindings();
  return (raw: MkRaw, from: string, to: string): PdfBlock[] => {
    const m = buildRoi(raw, from, to);
    if (m.empty) return [];
    const tone = (r: MkRow): PdfTone | undefined => (r.spent > 0 && (r.roi ?? 0) < 1 ? "neg" : r.spent > 0 && (r.roi ?? 0) >= 2 ? "pos" : undefined);
    return [
      { type: "heading", text: t("title") },
      { type: "kpis", items: [
        { label: t("spent"), value: usd0(m.totals.spent) }, { label: t("collected"), value: usd0(m.totals.collectedPaid) },
        { label: t("perDollar"), value: roiText(m.totals.roi), tone: m.totals.roi == null ? undefined : m.totals.roi < 1 ? "neg" : "pos" },
        { label: t("perCustomer"), value: m.totals.perCustomer == null ? "-" : usd0(m.totals.perCustomer) },
      ] },
      { type: "table", columns: [
        { label: t("h.source"), width: 3 }, { label: t("h.spent"), width: 1.6, align: "right" }, { label: t("h.new"), width: 1.3, align: "right" },
        { label: t("h.collected"), width: 1.7, align: "right" }, { label: t("h.perDollar"), width: 1.5, align: "right" }, { label: t("h.perCustomer"), width: 1.6, align: "right" },
      ], rows: m.rows.map((r) => ({ cells: [name(r), r.spent > 0 ? usd0(r.spent) : "-", String(r.newCustomers), usd0(r.collected),
        { text: r.spent > 0 ? roiText(r.roi) : t("noSpend"), tone: tone(r) }, r.perCustomer != null ? usd0(r.perCustomer) : "-"] })) },
      { type: "bullets", items: explain(m, raw.untaggedCustomers) },
    ];
  };
}

