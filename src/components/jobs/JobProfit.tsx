"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usd } from "@/lib/jobs";
import { JobProfitData, PAY_LABEL, needsReportSql } from "@/lib/job-reports";
import ReportArt from "@/components/jobs/reports/ReportArt";

// Ganancia de este trabajo (Paso 5.10). SOLO el dueño: la base de datos no le entrega estos números a nadie más.
// Facturado (sin impuesto) − materiales al costo − mano de obra (horas en sitio × tarifa) − gastos ligados a la factura.
export default function JobProfit({ jobId, refreshKey = 0 }: { jobId: string; refreshKey?: number }) {
  const [p, setP] = useState<JobProfitData | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "sql" | "error">("loading");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    createClient().rpc("job_profit", { p_job: jobId }).then(({ data, error }) => {
      if (!alive) return;
      if (error) return setState(needsReportSql(error) ? "sql" : "error");
      setP(data as JobProfitData); setState("ok");
    });
    return () => { alive = false; };
  }, [jobId, refreshKey]);

  const title = (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-400">Job profit</h2>
      <span className="inline-flex items-center gap-1 text-[11.5px] text-slate-400">
        <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="4.5" y="9" width="11" height="7.5" rx="1.5" /><path d="M7 9V7a3 3 0 0 1 6 0v2" /></svg>Only you see this
      </span>
    </div>
  );
  if (state === "loading") return <section className="rounded-2xl border border-slate-200 bg-white p-5">{title}<div className="mt-3 h-16 animate-pulse rounded-xl bg-slate-100" /></section>;
  if (state === "sql") return <section className="rounded-2xl border border-slate-200 bg-white p-5">{title}<p className="mt-2 text-[13px] text-slate-500">Run <b>paso-5.10-reports.sql</b> in Supabase to see the profit of this job.</p></section>;
  if (state === "error" || !p) return <section className="rounded-2xl border border-slate-200 bg-white p-5">{title}<p className="mt-2 text-[13px] text-slate-500">The profit couldn&apos;t load. Reload the page to try again.</p></section>;

  const revenue = Number(p.revenue) || 0, profit = Number(p.profit) || 0;
  const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : null;
  const done = p.status === "completed";
  const src = p.revenue_source === "invoice" ? `Invoice ${p.invoice_number ?? ""}${p.invoice_status === "draft" ? " (draft)" : ""}${Number(p.tax) > 0 ? ", before tax" : ""}`
    : p.revenue_source === "lines" ? "Services & materials on the job (no invoice yet)" : p.revenue_source === "estimate" ? "Estimated price (no invoice yet)" : "No price on this job yet";
  const row = (label: string, value: string, hint?: string, strong = false) => (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="min-w-0"><span className={`block text-[13.5px] ${strong ? "font-semibold text-[#0b1f3a]" : "text-slate-600"}`}>{label}</span>{hint && <span className="block text-[11.5px] text-slate-400">{hint}</span>}</span>
      <span className={`shrink-0 text-[13.5px] tabular-nums ${strong ? "font-semibold text-[#0b1f3a]" : "text-slate-700"}`}>{value}</span>
    </div>
  );

  return (
    <section className="group rounded-2xl border border-slate-200 bg-white p-5">
      {title}
      <div className="mt-3 flex items-center gap-3">
        <ReportArt kind="profit" size={46} />
        <div className="min-w-0">
          <p className={`text-[24px] font-semibold leading-tight tabular-nums ${revenue <= 0 ? "text-slate-400" : profit >= 0 ? "text-[#15803d]" : "text-[#be123c]"}`}>{revenue <= 0 && profit === 0 ? "—" : usd(profit)}</p>
          <p className="text-[12.5px] text-slate-500">{margin != null ? `${margin}% margin` : "No price yet"}{done ? "" : " · so far, the job isn't finished"}</p>
        </div>
      </div>
      <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
        {row(p.revenue_source === "invoice" ? "Invoiced" : "Price", usd(revenue), src)}
        {row("− Materials", usd(Number(p.materials)), "Parts on the job, at your cost")}
        <div>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-start justify-between gap-3 py-1.5 text-left">
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-[13.5px] text-slate-600">− Labor
                <svg viewBox="0 0 20 20" className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${open ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.5 5l5 5-5 5" /></svg>
              </span>
              <span className="block text-[11.5px] text-slate-400">On-site hours × pay rate</span>
            </span>
            <span className="shrink-0 text-[13.5px] tabular-nums text-slate-700">{usd(Number(p.labor))}</span>
          </button>
          {open && (
            <ul className="mb-2 space-y-1 rounded-xl bg-[#f6f9fc] px-3 py-2">
              {p.people.length === 0 ? <li className="text-[12.5px] text-slate-500">Nobody assigned yet.</li> : p.people.map((x) => (
                <li key={x.user_id} className="flex items-start justify-between gap-3 text-[12.5px]">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-700">{x.name}</span>
                    <span className="block text-slate-400">
                      {Number(x.hours)}h on site{Number(x.travel) > 0 ? ` · ${Number(x.travel)}h travel` : ""} ·{" "}
                      {!x.pay_type ? <span className="text-[#b45309]">no pay rate</span>
                        : x.pay_type === "hourly" ? `${usd(Number(x.rate))}/h` : x.pay_type === "percent" ? `${Number(x.rate)}% of the job` : x.pay_type === "per_job" ? `${usd(Number(x.rate))} per job` : PAY_LABEL[x.pay_type] ?? x.pay_type}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-700">{x.pay_type === "salary" ? "Salary" : usd(Number(x.cost))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {(Number(p.expenses) > 0 || p.revenue_source === "invoice") && row("− Expenses", usd(Number(p.expenses)), p.expenses_count ? `${p.expenses_count} expense${p.expenses_count === 1 ? "" : "s"} linked to the invoice` : "None linked to the invoice")}
        {row("= Profit", usd(profit), undefined, true)}
        {p.revenue_source === "invoice" && row("Collected so far", usd(Number(p.collected)), Number(p.collected) >= Number(p.revenue) + Number(p.tax) - 0.005 && revenue > 0 ? "Paid in full" : undefined)}
      </div>
      {(p.missing_rates > 0 || p.salaried > 0) && (
        <p className="mt-3 rounded-lg bg-[#fff6e6] px-3 py-2 text-[12px] text-[#92400e]">
          {p.missing_rates > 0 && <>{p.missing_rates} collaborator{p.missing_rates === 1 ? " has" : "s have"} no pay rate, so that labor counts as $0. Add it in Team → Edit. </>}
          {p.salaried > 0 && <>Salaried collaborators don&apos;t add labor cost per job.</>}
        </p>
      )}
    </section>
  );
}
