"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FinPeriod, FinRange, REPORT_PERIODS, money } from "@/lib/finance-period";
import { CompanyReport, RepBucket, RepExtras, changeText, companyReportPdf, findings, statement } from "@/lib/company-report";
import ExportModal from "@/components/customers/ExportModal";
import PdfViewer from "@/components/ui/PdfViewer";
import type { PdfDoc } from "@/lib/report-pdf";
import { ExportIcon, Kpi, PeriodBar, PrintIcon, card, ghostBtn, tealBtn } from "@/components/finances/FinBits";

const tone = (v: number) => (v < 0 ? "text-[#be123c]" : "text-[#15803d]");
const BUCKET_TITLE: Partial<Record<FinPeriod, string>> = { month: "Week by week", quarter: "Month by month", year: "Month by month" };

// Finances → Reports (Paso 5.10c): el reporte de toda la compañía. Dueño y manager.
// Ingresos − costo de los trabajos = ganancia de los trabajos − gastos generales = ganancia real.
export default function CompanyReportView({ range, today, report: r, extras: x, buckets, needsExpensesSql, needsPayrollSql, companyName, preparedBy }: {
  range: FinRange; today: string; report: CompanyReport; extras: RepExtras; buckets: RepBucket[];
  needsExpensesSql: boolean; needsPayrollSql: boolean; companyName: string; preparedBy: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [exportOpen, setExportOpen] = useState(false);
  const [pdf, setPdf] = useState<PdfDoc | null>(null);
  const go = (p: FinPeriod, d: string) => start(() => router.push(`/dashboard/reports?p=${p}&d=${d}`));
  const q = `?p=${range.period === "quarter" || range.period === "year" ? "month" : range.period}&d=${range.from}`;
  const lines = statement(r);
  const notes = findings(r, x);
  const vs = (now: number, before: number | undefined) => (x.prev && !x.prev.empty && before !== undefined && changeText(now, before) ? `${changeText(now, before)} vs ${x.prevLabel}` : "");
  // La ganancia se compara en dólares (un % contra un mes en pérdida no dice nada)
  const netVs = x.prev && !x.prev.empty && r.net !== x.prev.net ? `${money(Math.abs(r.net - x.prev.net))} ${r.net >= x.prev.net ? "more" : "less"} than ${x.prevLabel}` : "";
  const share = (v: number) => (r.income > 0 ? Math.max(0, Math.min(100, (v / r.income) * 100)) : 0);
  const bars = [
    { label: "Materials", v: r.materials, color: "#2563eb" }, { label: "Labor paid", v: r.labor, color: "#f59e0b" },
    ...(r.jobOther > 0 ? [{ label: "Other job costs", v: r.jobOther, color: "#7c3aed" }] : []),
    { label: "General expenses", v: r.overheadTotal, color: "#64748b" },
    ...(r.financingTotal > 0 ? [{ label: "Financed purchases", v: r.financingTotal, color: "#0891b2" }] : []),
    { label: r.net >= 0 ? "Real profit" : "Real loss", v: r.net, color: r.net >= 0 ? "#16a34a" : "#e11d48" },
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
          <h1 className="text-[22px] font-semibold tracking-tight text-[#0b1f3a]">Reports</h1>
          <p className="text-[13px] text-slate-500">The whole company: what came in, what went out and what was really left.</p>
        </div>
        <button type="button" onClick={() => setExportOpen(true)} className={ghostBtn}><ExportIcon />Export</button>
        <button type="button" onClick={() => setPdf(companyReportPdf(r, x, buckets, { company: companyName, title: range.title, range: range.label, by: preparedBy || "the manager" }))} className={tealBtn}><PrintIcon />Print / PDF</button>
      </div>
      <div className="mt-4"><PeriodBar periods={REPORT_PERIODS} range={range} today={today} onGo={go} /></div>

      {needsExpensesSql && <p className="mt-4 rounded-xl border border-[#fcd38d] bg-[#fffbf3] px-4 py-3 text-[13px] text-[#92400e]">Expenses couldn&apos;t be read, so they count as $0 here. Run the Expenses SQL (Paso 3.36) in Supabase.</p>}
      {needsPayrollSql && <p className="mt-4 rounded-xl border border-[#fcd38d] bg-[#fffbf3] px-4 py-3 text-[13px] text-[#92400e]">Run <b>paso-5.10c-payroll.sql</b> in Supabase to see here how much payroll is still owed.</p>}

      <div className={`transition-opacity duration-200 ${pending ? "opacity-60" : ""}`}>
        <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Kpi art="revenue" title="Income" value={money(r.income)} hint={vs(r.income, x.prev?.income) || "Invoices collected + Money In"} />
          <Kpi art="parts" title="Cost of the jobs" value={money(r.jobCosts)} hint={`Materials ${money(r.materials)} · Labor ${money(r.labor)}`} />
          <Kpi art="idle" title="General expenses" value={money(r.overheadTotal)} hint={r.overhead[0] ? `Biggest: ${r.overhead[0].label}` : "Rent, fuel, insurance…"} />
          <Kpi art={r.net >= 0 ? "profit" : "value"} title={r.net >= 0 ? "Real profit" : "Real loss"} value={money(r.net)} hint={`${r.margin == null ? "No income in this period" : `${r.margin}% of income`}${netVs ? ` · ${netVs}` : ""}`} tone={tone(r.net)} />
        </div>

        <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-4">
            <section className={`${card} overflow-hidden`}>
              <div className="border-b border-slate-100 px-4 py-3 lg:px-5">
                <p className="text-[15px] font-semibold text-[#0b1f3a]">Income and expenses</p>
                <p className="text-[12.5px] text-slate-500">{range.label} · money that really came in and went out</p>
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
                <p className="text-[15px] font-semibold text-[#0b1f3a]">Where each dollar went</p>
                <p className="text-[12.5px] text-slate-500">Each line as a part of the income.</p>
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

            {buckets.length > 0 && (
              <section className={`${card} overflow-hidden`}>
                <div className="border-b border-slate-100 px-4 py-3 lg:px-5"><p className="text-[15px] font-semibold text-[#0b1f3a]">{BUCKET_TITLE[range.period]}</p></div>
                <div className="grid grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))] gap-x-3 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 lg:px-5"><span /><span className="text-right">Income</span><span className="text-right">Expenses</span><span className="text-right">Profit</span></div>
                <ul className="divide-y divide-slate-100">
                  {buckets.map((b) => (
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
              <p className="text-[14px] font-semibold text-[#0b1f3a]">Summary for the owner</p>
              <ul className="mt-2 space-y-2">
                {notes.map((f) => <li key={f} className="flex gap-2 text-[13px] leading-snug text-slate-600"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#14a39a]" />{f}</li>)}
              </ul>
            </section>

            {x.payroll && side("Payroll for this period", `/dashboard/payroll${q}`, "Open Payroll", <div className="mt-1.5">
              {pair(`Earned by ${x.payroll.people} ${x.payroll.people === 1 ? "person" : "people"}`, money(x.payroll.calculated))}
              {pair("Already paid", <span className="text-[#15803d]">{money(x.payroll.paid)}</span>)}
              {pair("Still owed", <span className={x.payroll.balance > 0.005 ? "text-[#be123c]" : ""}>{money(x.payroll.balance)}</span>)}
              <p className="mt-1.5 text-[12px] leading-snug text-slate-400">Only what is marked as paid counts as an expense above.</p>
            </div>)}

            {x.jobs && side("Jobs finished in this period", "/dashboard/jobs/reports?tab=pnl", "Open in Jobs", <div className="mt-1.5">
              {pair(`${x.jobs.jobs} job${x.jobs.jobs === 1 ? "" : "s"} · revenue before tax`, money(x.jobs.revenue))}
              {pair("Labor by pay rate", money(x.jobs.labor))}
              {pair("Parts at cost", money(x.jobs.materials))}
              {pair(x.jobs.profit >= 0 ? "Profit by job" : "Loss by job", <span className={tone(x.jobs.profit)}>{money(x.jobs.profit)}</span>)}
              <p className="mt-1.5 text-[12px] leading-snug text-slate-400">That report says how much each finished job left. This one says how much money really moved, so the two don&apos;t have to match.</p>
            </div>)}

            {x.financing && x.financing.count > 0 && side("Financed purchases", "/dashboard/financing", "Open Financing", <div className="mt-1.5">
              {pair("Paid in this period", money(r.financingTotal))}
              {pair(`Still owed on ${x.financing.count} purchase${x.financing.count === 1 ? "" : "s"}`, <span className="text-[#be123c]">{money(x.financing.owed)}</span>)}
              {pair("Payments per month", money(x.financing.monthly))}
              <p className="mt-1.5 text-[12px] leading-snug text-slate-400">{x.financing.overdue ? `${x.financing.overdue} payment${x.financing.overdue === 1 ? " is" : "s are"} past due. ` : ""}What is still owed is a debt, not an expense of this period.</p>
            </div>)}

            {side("Customers still owe", "/dashboard/invoices", "Invoices", <div className="mt-1.5">
              {pair(`${x.receivableCount} open invoice${x.receivableCount === 1 ? "" : "s"}`, money(x.receivable))}
              <p className="mt-1.5 text-[12px] leading-snug text-slate-400">Not counted as income until it&apos;s collected.</p>
            </div>)}
          </div>
        </div>

        <p className="mt-4 text-[12.5px] leading-relaxed text-slate-500">
          Everything here comes from what is recorded in Finances: payments on <Link prefetch={false} href="/dashboard/invoices" className="font-semibold text-[#0f766e] hover:underline">Invoices</Link>, <Link prefetch={false} href="/dashboard/income" className="font-semibold text-[#0f766e] hover:underline">Money In</Link> and <Link prefetch={false} href="/dashboard/expenses" className="font-semibold text-[#0f766e] hover:underline">Expenses</Link>. An expense that isn&apos;t written there isn&apos;t counted.
        </p>
      </div>

      {pdf && <PdfViewer doc={pdf} onClose={() => setPdf(null)} />}
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} initialModule="Company report" defaultScope="view"
        view={{ module: "Company report", label: range.title, ids: ["report"], columns: [], range: { from: range.from, to: range.to } }} />
    </div>
  );
}
