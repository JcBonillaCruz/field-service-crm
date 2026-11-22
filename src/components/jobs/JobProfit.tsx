"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { JobProfitData, needsReportSql } from "@/lib/job-reports";
import ReportArt from "@/components/jobs/reports/ReportArt";
import { jobProfitWithTypePay } from "@/lib/type-pay";

import { useTranslations } from "next-intl";
import { useJobsTx } from "@/i18n/useJobsTx";
// Ganancia de este trabajo (Paso 5.10). Dueño y manager: la base de datos no le entrega estos números a nadie más.
// Facturado (sin impuesto) − materiales al costo − mano de obra (horas en sitio × tarifa) − gastos ligados a la factura.
export default function JobProfit({ jobId, refreshKey = 0 }: { jobId: string; refreshKey?: number }) {
  const t = useTranslations("jobProfit");
  const { usd } = useJobsTx();
  const [p, setP] = useState<JobProfitData | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "sql" | "error">("loading");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const sb = createClient();
    sb.rpc("job_profit", { p_job: jobId }).then(async ({ data, error }) => {
      if (!alive) return;
      if (error) return setState(needsReportSql(error) ? "sql" : "error");
      // Paso 5.10f: si alguien tiene un pago propio para este tipo de trabajo, ese manda
      const d = await jobProfitWithTypePay(sb, jobId, data as JobProfitData).catch(() => data as JobProfitData);
      if (!alive) return;
      setP(d); setState("ok");
    });
    return () => { alive = false; };
  }, [jobId, refreshKey]);

  const title = (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-400">{t("title")}</h2>
      <span className="inline-flex items-center gap-1 text-[11.5px] text-slate-400">
        <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="4.5" y="9" width="11" height="7.5" rx="1.5" /><path d="M7 9V7a3 3 0 0 1 6 0v2" /></svg>{t("ownerOnly")}
      </span>
    </div>
  );
  if (state === "loading") return <section className="rounded-2xl border border-slate-200 bg-white p-5">{title}<div className="mt-3 h-16 animate-pulse rounded-xl bg-slate-100" /></section>;
  if (state === "sql") return <section className="rounded-2xl border border-slate-200 bg-white p-5">{title}<p className="mt-2 text-[13px] text-slate-500">{t.rich("runSql", { b: (c) => <b>{c}</b> })}</p></section>;
  if (state === "error" || !p) return <section className="rounded-2xl border border-slate-200 bg-white p-5">{title}<p className="mt-2 text-[13px] text-slate-500">{t("loadFail")}</p></section>;

  const revenue = Number(p.revenue) || 0, profit = Number(p.profit) || 0;
  const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : null;
  const done = p.status === "completed";
  const src = p.revenue_source === "invoice" ? t("srcInvoice", { n: p.invoice_number ?? "", draft: p.invoice_status === "draft" ? "yes" : "no", tax: Number(p.tax) > 0 ? "yes" : "no" })
    : p.revenue_source === "lines" ? t("srcLines") : p.revenue_source === "estimate" ? t("srcEstimate") : t("srcNone");
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
          <p className="text-[12.5px] text-slate-500">{margin != null ? t("margin", { n: margin }) : t("noPrice")}{done ? "" : t("soFar")}</p>
        </div>
      </div>
      <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
        {row(p.revenue_source === "invoice" ? t("invoiced") : t("price"), usd(revenue), src)}
        {row(t("materials"), usd(Number(p.materials)), t("materialsHint"))}
        <div>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-start justify-between gap-3 py-1.5 text-left">
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-[13.5px] text-slate-600">{t("labor")}
                <svg viewBox="0 0 20 20" className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${open ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.5 5l5 5-5 5" /></svg>
              </span>
              <span className="block text-[11.5px] text-slate-400">{t("laborHint")}</span>
            </span>
            <span className="shrink-0 text-[13.5px] tabular-nums text-slate-700">{usd(Number(p.labor))}</span>
          </button>
          {open && (
            <ul className="mb-2 space-y-1 rounded-xl bg-[#f6f9fc] px-3 py-2">
              {p.people.length === 0 ? <li className="text-[12.5px] text-slate-500">{t("nobody")}</li> : p.people.map((x) => (
                <li key={x.user_id} className="flex items-start justify-between gap-3 text-[12.5px]">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-700">{x.name}</span>
                    <span className="block text-slate-400">
                      {t("onSite", { h: Number(x.hours) })}{Number(x.travel) > 0 ? t("travel", { h: Number(x.travel) }) : ""} ·{" "}
                      {!x.pay_type ? <span className="text-[#b45309]">{t("noRate")}</span>
                        : x.by_type ? t("byType", { rule: x.by_type })
                        : x.pay_type === "hourly" ? t("perHour", { v: usd(Number(x.rate)) }) : x.pay_type === "percent" ? t("pctJob", { n: Number(x.rate) }) : x.pay_type === "per_job" ? t("perJob", { v: usd(Number(x.rate)) }) : t.has(`pay.${x.pay_type}` as never) ? t(`pay.${x.pay_type}` as never) : x.pay_type}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-700">{x.pay_type === "salary" ? t("salary") : usd(Number(x.cost))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {(Number(p.expenses) > 0 || p.revenue_source === "invoice") && row(t("expenses"), usd(Number(p.expenses)), p.expenses_count ? t("expLinked", { n: p.expenses_count }) : t("expNone"))}
        {row(t("profit"), usd(profit), undefined, true)}
        {p.revenue_source === "invoice" && row(t("collected"), usd(Number(p.collected)), Number(p.collected) >= Number(p.revenue) + Number(p.tax) - 0.005 && revenue > 0 ? t("paidFull") : undefined)}
      </div>
      {(p.missing_rates > 0 || p.salaried > 0) && (
        <p className="mt-3 rounded-lg bg-[#fff6e6] px-3 py-2 text-[12px] text-[#92400e]">
          {p.missing_rates > 0 && <>{t("missingRates", { n: p.missing_rates })}</>}
          {p.salaried > 0 && <>{t("salaried")}</>}
        </p>
      )}
    </section>
  );
}
