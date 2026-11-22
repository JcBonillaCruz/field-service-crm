"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FinPeriod, FinRange, REPORT_PERIODS } from "@/lib/finance-period";
import { useFinTx } from "@/i18n/useFinTx";
import { CompanyReport, RepBucket, RepExtras, RepL, RepTx, changeText, companyReportPdf, findings, statement } from "@/lib/company-report";
import ExportModal from "@/components/customers/ExportModal";
import PdfViewer from "@/components/ui/PdfViewer";
import type { PdfDoc } from "@/lib/report-pdf";
import { ExportIcon, Kpi, PeriodBar, PrintIcon, card, ghostBtn, tealBtn } from "@/components/finances/FinBits";

const tone = (v: number) => (v < 0 ? "text-[#be123c]" : "text-[#15803d]");

// Finances → Reports (Paso 5.10c): el reporte de toda la compañía. Dueño y manager.
// Ingresos − costo de los trabajos = ganancia de los trabajos − gastos generales = ganancia real.
export default function CompanyReportView({ range, today, report: r, extras: x, buckets, needsExpensesSql, needsPayrollSql, companyName, preparedBy }: {
  range: FinRange; today: string; report: CompanyReport; extras: RepExtras; buckets: RepBucket[];
  needsExpensesSql: boolean; needsPayrollSql: boolean; companyName: string; preparedBy: string;
}) {
  const t = useTranslations("compRep");
  const fx = useFinTx();
  const money = fx.money;
  const L: RepL = { t: t as unknown as RepTx, money, cat: fx.cat };
  const title = fx.finTitle(range), rangeLabel = fx.span(range.from, range.to), prevLabel = fx.prevTitle(range);
  // Las etiquetas de cada pedazo del periodo en el idioma: semanas "15 – 21 nov", meses "noviembre"
  const parts = buckets.map((b) => ({ ...b, label: range.period === "month" ? fx.spanShort(b.from, b.to) : fx.monthLong(b.from, false) }));
  const bucketTitle = range.period === "month" ? t("weekByWeek") : t("monthByMonth");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [exportOpen, setExportOpen] = useState(false);
  const [pdf, setPdf] = useState<PdfDoc | null>(null);
  const go = (p: FinPeriod, d: string) => start(() => router.push(`/dashboard/reports?p=${p}&d=${d}`));
  const q = `?p=${range.period === "quarter" || range.period === "year" ? "month" : range.period}&d=${range.from}`;
  const lines = statement(r, L);
  const notes = findings(r, x, L, prevLabel);
  const vs = (now: number, before: number | undefined) => (x.prev && !x.prev.empty && before !== undefined && changeText(now, before) ? t("vs", { change: changeText(now, before), label: prevLabel }) : "");
  // La ganancia se compara en dólares (un % contra un mes en pérdida no dice nada)
  const netVs = x.prev && !x.prev.empty && r.net !== x.prev.net ? t("netVs", { amount: money(Math.abs(r.net - x.prev.net)), more: r.net >= x.prev.net ? "yes" : "no", label: prevLabel }) : "";
  const share = (v: number) => (r.income > 0 ? Math.max(0, Math.min(100, (v / r.income) * 100)) : 0);
  const bars = [
    { label: t("materials"), v: r.materials, color: "#2563eb" }, { label: t("laborPaid"), v: r.labor, color: "#f59e0b" },
    ...(r.jobOther > 0 ? [{ label: t("otherJobCosts"), v: r.jobOther, color: "#7c3aed" }] : []),
    { label: t("general"), v: r.overheadTotal, color: "#64748b" },
    ...(r.financingTotal > 0 ? [{ label: t("financedPurchases"), v: r.financingTotal, color: "#0891b2" }] : []),
    { label: r.net >= 0 ? t("realProfit") : t("realLoss"), v: r.net, color: r.net >= 0 ? "#16a34a" : "#e11d48" },
  ];
  const side = (title: string, href: string, linkText: string, children: React.ReactNode) => (
    <section className={`${card} px-4 py-3.5`}>
      <div className="flex items-center justify-between gap-2"><p className="text-[14px] font-semibold text-[#0b1f3a]">{title}</p>
        <Link prefetch={false} href={href} className="shrink-0 text-[12.5px] font-semibold text-[#0f766e] hover:underline">{linkText} →</Link></div>
      {children}
    </section>
  );
  const pair = (label: string, value: React.ReactNode) => (
    <div className="flex items-center justify-between gap-3 py-1 text-[13px]"><span className="text-slate-500">{label}</span><span className="font-semibold tabular-nums text-[#0b1f3a]">{value}</span></div>
  );

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[#f4f6f8] px-3 pb-24 pt-4 lg:px-6 lg:pb-8 lg:pt-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight text-[#0b1f3a]">{t("title")}</h1>
          <p className="text-[13px] text-slate-500">{t("subtitle")}</p>
        </div>
        <button type="button" onClick={() => setExportOpen(true)} className={ghostBtn}><ExportIcon />{t("export")}</button>
        <button type="button" onClick={() => setPdf(companyReportPdf(r, x, parts, { company: companyName, title, range: rangeLabel, by: preparedBy || t("theManager"), prevLabel }, L))} className={tealBtn}><PrintIcon />{t("printPdf")}</button>
      </div>
      <div className="mt-4"><PeriodBar periods={REPORT_PERIODS} range={range} today={today} onGo={go} /></div>

      {needsExpensesSql && <p className="mt-4 rounded-xl border border-[#fcd38d] bg-[#fffbf3] px-4 py-3 text-[13px] text-[#92400e]">{t("needsExpenses")}</p>}
      {needsPayrollSql && <p className="mt-4 rounded-xl border border-[#fcd38d] bg-[#fffbf3] px-4 py-3 text-[13px] text-[#92400e]">{t.rich("needsPayroll", { b: (c) => <b>{c}</b> })}</p>}

      <div className={`transition-opacity duration-200 ${pending ? "opacity-60" : ""}`}>
        <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Kpi art="revenue" title={t("income")} value={money(r.income)} hint={vs(r.income, x.prev?.income) || t("kIncomeHint")} />
          <Kpi art="parts" title={t("jobCosts")} value={money(r.jobCosts)} hint={t("kCostHint", { m: money(r.materials), l: money(r.labor) })} />
          <Kpi art="idle" title={t("general")} value={money(r.overheadTotal)} hint={r.overhead[0] ? t("kBiggest", { label: fx.cat(r.overhead[0].label) }) : t("kGeneralHint")} />
          <Kpi art={r.net >= 0 ? "profit" : "value"} title={r.net >= 0 ? t("realProfit") : t("realLoss")} value={money(r.net)} hint={`${r.margin == null ? t("noIncome") : t("pctOfIncome", { n: r.margin })}${netVs ? ` · ${netVs}` : ""}`} tone={tone(r.net)} />
        </div>

        <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-4">
            <section className={`${card} overflow-hidden`}>
              <div className="border-b border-slate-100 px-4 py-3 lg:px-5">
                <p className="text-[15px] font-semibold text-[#0b1f3a]">{t("incomeExpenses")}</p>
                <p className="text-[12.5px] text-slate-500">{t("incomeExpensesSub", { range: rangeLabel })}</p>
              </div>
              <div className="px-2 pb-2 lg:px-3">
                {lines.map((l, i) => l.kind === "head" ? (
                  <p key={i} className="px-2 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-wide text-[#0f766e]">{l.label}</p>
                ) : (
                  <div key={i} title={l.hint} className={`grid grid-cols-[minmax(0,1fr)_auto_3.2rem] items-baseline gap-x-3 rounded-lg px-2 ${
                    l.kind === "result" ? `my-1.5 py-2.5 ${(l.amount ?? 0) < 0 ? "bg-[#fff1f2]" : "bg-[#eefaf3]"}` : l.kind === "total" ? "border-t border-slate-200 py-2" : l.kind === "sub" ? "py-0.5" : "py-1.5"}`}>
                    <span className={`min-w-0 ${l.kind === "sub" ? "pl-4 text-[12.5px] text-slate-400" : l.kind === "result" ? "text-[15px] font-semibold text-[#0b1f3a]" : l.kind === "total" ? "text-[13.5px] font-semibold text-[#0b1f3a]" : "text-[13.5px] text-slate-700"}`}>
                      <span className="block">{l.label}</span>
                      {l.kind === "line" && l.hint && <span className="hidden truncate text-[11.5px] text-slate-400 sm:block">{l.hint}</span>}
                    </span>
                    <span className={`text-right tabular-nums ${l.kind === "sub" ? "text-[12.5px] text-slate-400" : l.kind === "result" ? `text-[16px] font-semibold ${tone(l.amount ?? 0)}` : l.kind === "total" ? "text-[13.5px] font-semibold text-[#0b1f3a]" : `text-[13.5px] font-medium ${(l.amount ?? 0) < 0 ? "text-[#be123c]" : "text-[#0b1f3a]"}`}`}>{money(l.amount)}</span>
                    <span className="text-right text-[12px] tabular-nums text-slate-400">{l.pct == null ? "" : `${l.pct}%`}</span>
                  </div>
                ))}
              </div>
            </section>

            {r.income > 0 && (
              <section className={`${card} px-4 py-3.5 lg:px-5`}>
                <p className="text-[15px] font-semibold text-[#0b1f3a]">{t("whereDollar")}</p>
                <p className="text-[12.5px] text-slate-500">{t("whereDollarSub")}</p>
                <ul className="mt-3 space-y-2.5">
                  {bars.map((b) => (
                    <li key={b.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-[13px] sm:grid-cols-[9.5rem_minmax(0,1fr)_auto]">
                      <span className="truncate text-slate-600">{b.label}</span>
                      <span className="order-3 col-span-2 h-2.5 overflow-hidden rounded-full bg-slate-100 sm:order-none sm:col-span-1"><span className="block h-full origin-left animate-[bp-grow-x_0.6s_ease-out] rounded-full" style={{ width: `${share(Math.abs(b.v))}%`, background: b.color }} /></span>
                      <span className="text-right tabular-nums sm:w-[8.5rem]"><b className="font-semibold text-[#0b1f3a]">{money(b.v)}</b> <span className="text-slate-400">{Math.round((b.v / r.income) * 100)}%</span></span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {parts.length > 0 && (
              <section className={`${card} overflow-hidden`}>
                <div className="border-b border-slate-100 px-4 py-3 lg:px-5"><p className="text-[15px] font-semibold text-[#0b1f3a]">{bucketTitle}</p></div>
                <div className="grid grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))] gap-x-3 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 lg:px-5"><span /><span className="text-right">{t("income")}</span><span className="text-right">{t("expenses")}</span><span className="text-right">{t("profit")}</span></div>
                <ul className="divide-y divide-slate-100">
                  {parts.map((b) => (
                    <li key={b.from}>
                      <Link prefetch={false} href={`/dashboard/reports?p=${range.period === "month" ? "week" : "month"}&d=${b.from}`} className="grid grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))] items-center gap-x-3 px-4 py-2.5 text-[13.5px] tabular-nums transition-colors hover:bg-[#f6fbfa] lg:px-5">
                        <span className="truncate font-medium text-[#0b1f3a]">{b.label}</span><span className="truncate text-right text-slate-600">{money(b.income)}</span><span className="truncate text-right text-slate-600">{money(b.costs)}</span>
                        <span className={`truncate text-right font-semibold ${b.income === 0 && b.costs === 0 ? "text-slate-300" : tone(b.net)}`}>{money(b.net)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <div className="min-w-0 space-y-4">
            <section className={`${card} px-4 py-3.5`}>
              <p className="text-[14px] font-semibold text-[#0b1f3a]">{t("ownerSummary")}</p>
              <ul className="mt-2 space-y-2">
                {notes.map((f) => <li key={f} className="flex gap-2 text-[13px] leading-snug text-slate-600"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#14a39a]" />{f}</li>)}
              </ul>
            </section>

            {x.payroll && side(t("payrollHead"), `/dashboard/payroll${q}`, t("openPayroll"), <div className="mt-1.5">
              {pair(t("earnedBy", { n: x.payroll.people }), money(x.payroll.calculated))}
              {pair(t("alreadyPaid"), <span className="text-[#15803d]">{money(x.payroll.paid)}</span>)}
              {pair(t("stillOwed"), <span className={x.payroll.balance > 0.005 ? "text-[#be123c]" : ""}>{money(x.payroll.balance)}</span>)}
              <p className="mt-1.5 text-[12px] leading-snug text-slate-400">{t("payrollNote")}</p>
            </div>)}

            {x.jobs && side(t("jobsFinished"), "/dashboard/jobs/reports?tab=pnl", t("openJobs"), <div className="mt-1.5">
              {pair(t("jobsRevenue", { n: x.jobs.jobs }), money(x.jobs.revenue))}
              {pair(t("laborRate"), money(x.jobs.labor))}
              {pair(t("partsCost"), money(x.jobs.materials))}
              {pair(x.jobs.profit >= 0 ? t("profitByJob") : t("lossByJob"), <span className={tone(x.jobs.profit)}>{money(x.jobs.profit)}</span>)}
              <p className="mt-1.5 text-[12px] leading-snug text-slate-400">{t("jobsNote")}</p>
            </div>)}

            {x.financing && x.financing.count > 0 && side(t("financedPurchases"), "/dashboard/financing", t("openFinancing"), <div className="mt-1.5">
              {pair(t("paidPeriod"), money(r.financingTotal))}
              {pair(t("owedOn", { n: x.financing.count }), <span className="text-[#be123c]">{money(x.financing.owed)}</span>)}
              {pair(t("perMonth"), money(x.financing.monthly))}
              <p className="mt-1.5 text-[12px] leading-snug text-slate-400">{x.financing.overdue ? `${t("pastDue", { n: x.financing.overdue })} ` : ""}{t("debtNote")}</p>
            </div>)}

            {side(t("custOwe"), "/dashboard/invoices", t("invoices"), <div className="mt-1.5">
              {pair(t("openInvoices", { n: x.receivableCount }), money(x.receivable))}
              <p className="mt-1.5 text-[12px] leading-snug text-slate-400">{t("custOweNote")}</p>
            </div>)}
          </div>
        </div>

        <p className="mt-4 text-[12.5px] leading-relaxed text-slate-500">
          {t.rich("footer", {
            inv: (c) => <Link prefetch={false} href="/dashboard/invoices" className="font-semibold text-[#0f766e] hover:underline">{c}</Link>,
            mi: (c) => <Link prefetch={false} href="/dashboard/income" className="font-semibold text-[#0f766e] hover:underline">{c}</Link>,
            ex: (c) => <Link prefetch={false} href="/dashboard/expenses" className="font-semibold text-[#0f766e] hover:underline">{c}</Link>,
          })}
        </p>
      </div>

      {pdf && <PdfViewer doc={pdf} onClose={() => setPdf(null)} />}
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} initialModule="Company report" defaultScope="view"
        view={{ module: "Company report", label: title, ids: ["report"], columns: [], range: { from: range.from, to: range.to } }} />
    </div>
  );
}
