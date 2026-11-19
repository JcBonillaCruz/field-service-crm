import Link from "next/link";
import ReportArt from "@/components/jobs/reports/ReportArt";
import { money } from "@/lib/finance-period";
import { changeText } from "@/lib/company-report";
import type { MonthCard } from "@/lib/company-report-server";

// =====================================================================
// Home → "This month's report" (Paso 5.10e) — dueño y manager.
// Ingreso, gastos y ganancia real del mes en curso, con la misma cuenta que Finances → Reports,
// y el botón que abre el reporte completo. No guarda nada: solo lee.
// =====================================================================
const usd0 = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.round(Number(v) || 0));
const Arrow = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform duration-150 group-hover/btn:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 10h11M11 5.5l4.5 4.5-4.5 4.5" /></svg>
);

export default function MonthReportCard({ data: d }: { data: MonthCard }) {
  const href = `/dashboard/reports?p=month&d=${d.day}`;
  const loss = d.net < 0;
  const vs = (now: number, before: number) => (d.prev && changeText(now, before) ? `${changeText(now, before)} vs ${d.prev.label}` : "");
  // La ganancia se compara en dólares (un % contra un mes en pérdida no dice nada)
  const netVs = d.prev && d.net !== d.prev.net ? `${usd0(Math.abs(d.net - d.prev.net))} ${d.net >= d.prev.net ? (loss ? "better" : "more") : (loss ? "worse" : "less")} than ${d.prev.label}` : "";
  const figures = [
    { label: "Income", value: d.income, tone: "text-[#0b1f3a]", dot: "#14a39a", note: vs(d.income, d.prev?.income ?? 0) || "Invoices collected + Money In" },
    { label: "Expenses", value: d.expenses, tone: "text-[#0b1f3a]", dot: "#e8713a", note: vs(d.expenses, d.prev?.expenses ?? 0) || "Job costs, general expenses and financing" },
    { label: loss ? "Real loss" : "Real profit", value: d.net, tone: loss ? "text-[#be123c]" : "text-[#15803d]", dot: loss ? "#e11d48" : "#16a34a", note: netVs || (d.margin != null ? `${d.margin}% of the income` : "What was really left") },
  ];
  // A dónde se fue el ingreso: si se gastó más de lo que entró, la barra se mide contra lo gastado
  const base = Math.max(d.income, d.expenses);
  const parts = [
    { label: "Cost of the jobs", v: d.jobCosts, color: "#2563eb" },
    { label: "General expenses", v: d.overhead, color: "#64748b" },
    { label: "Financed purchases", v: d.financing, color: "#0891b2" },
    { label: "Real profit", v: Math.max(0, d.net), color: "#16a34a" },
  ].filter((p) => p.v > 0);
  const weeks = d.weeks.slice(-5);

  return (
    <section aria-label="This month's report" className="group rounded-2xl border border-slate-200 bg-white transition-shadow duration-200 hover:shadow-[0_8px_24px_rgba(15,40,60,0.07)]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3 px-4 pt-4 lg:px-5">
        <div className="mr-auto flex min-w-0 items-center gap-3">
          <span className="shrink-0 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"><ReportArt kind="profit" size={44} /></span>
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-semibold leading-tight text-[#0b1f3a] lg:text-[18px]">This month&apos;s report</h2>
            <p className="truncate text-[12.5px] text-slate-500">{d.title} · {d.soFar} so far</p>
          </div>
        </div>
        <Link prefetch={false} href={`/dashboard/reports?p=month&d=${d.prevDay}`} className="hidden h-10 items-center rounded-xl px-3 text-[13.5px] font-semibold text-[#0f766e] hover:bg-[#e9f7f4] sm:inline-flex">Last month</Link>
        <Link prefetch={false} href={href} className="group/btn hidden h-10 items-center gap-2 rounded-xl bg-[#0f766e] px-4 text-[13.5px] font-semibold text-white shadow-sm transition-all duration-150 hover:-translate-y-px hover:bg-[#0b5f59] hover:shadow-md sm:inline-flex">
          Open full report<Arrow />
        </Link>
      </div>

      {d.empty ? (
        <div className="px-4 pb-1 pt-4 lg:px-5">
          <p className="text-[14.5px] font-semibold text-[#0b1f3a]">Nothing recorded in Finances this month yet</p>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-500">The report fills in by itself when an invoice is paid or when money is written in Money In or Expenses.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link prefetch={false} href="/dashboard/income" className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">Add Money In</Link>
            <Link prefetch={false} href="/dashboard/expenses" className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">Add an expense</Link>
          </div>
        </div>
      ) : (
        <div className={`grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-5 px-4 pt-4 lg:px-5 ${weeks.length > 1 ? "xl:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)]" : ""}`}>
          <div className="min-w-0">
            {/* Celular: una cifra por renglón · computadora: tres columnas */}
            <dl className="divide-y divide-slate-100 sm:grid sm:grid-cols-3 sm:gap-4 sm:divide-y-0">
              {figures.map((f) => (
                <div key={f.label} className="flex min-w-0 items-center justify-between gap-3 py-2.5 sm:flex-col sm:items-start sm:justify-start sm:gap-0 sm:py-0">
                  <div className="min-w-0 sm:contents">
                    <dt className="flex items-center gap-1.5 text-[13px] font-medium text-slate-500 sm:text-[12.5px]"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: f.dot }} />{f.label}</dt>
                    <dd className="mt-0.5 max-w-full truncate text-[11.5px] text-slate-400 sm:order-3 sm:mt-1">{f.note}</dd>
                  </div>
                  <dd className={`shrink-0 text-[18px] font-semibold tabular-nums sm:order-2 sm:mt-1 sm:text-[24px] sm:leading-tight ${f.tone}`}>{usd0(f.value)}</dd>
                </div>
              ))}
            </dl>

            {base > 0 && (
              <div className="mt-4 sm:mt-5">
                <p className="text-[12px] font-medium text-slate-500">{loss ? `Expenses were ${usd0(-d.net)} more than the income` : "Where the income went"}</p>
                <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100" role="img"
                  aria-label={parts.map((p) => `${p.label} ${Math.round((p.v / base) * 100)}%`).join(", ")}>
                  {parts.map((p) => <span key={p.label} className="h-full border-r-2 border-white last:border-r-0" style={{ width: `${(p.v / base) * 100}%`, backgroundColor: p.color }} />)}
                </div>
                <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
                  {parts.map((p) => (
                    <li key={p.label} className="flex items-center gap-1.5 text-[12.5px] text-slate-600">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />{p.label}
                      <span className="font-semibold tabular-nums text-[#0b1f3a]">{usd0(p.v)}</span>
                      <span className="tabular-nums text-slate-400">{Math.round((p.v / base) * 100)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {weeks.length > 1 && (
            <div className="hidden min-w-0 border-l border-slate-100 pl-8 xl:block">
              <p className="text-[12px] font-medium text-slate-500">Profit week by week</p>
              <ul className="mt-1.5">
                {weeks.map((w) => (
                  <li key={w.from} className="flex items-center justify-between gap-3 py-1 text-[13px]">
                    <span className="truncate text-slate-600">{w.label}</span>
                    <span className={`shrink-0 font-semibold tabular-nums ${w.net < 0 ? "text-[#be123c]" : w.net > 0 ? "text-[#15803d]" : "text-slate-400"}`}>{usd0(w.net)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 px-4 py-3 lg:px-5">
        <p className="mr-auto min-w-0 text-[12px] leading-relaxed text-slate-400">
          Money that really came in and went out, as recorded in Finances.
          {d.owed > 0 && <> Still owed on financed purchases: <span className="font-semibold text-slate-500">{money(d.owed)}</span> (not subtracted).</>}
        </p>
        {/* Celular: los botones abajo, a lo ancho */}
        <div className="flex w-full items-center gap-2 sm:hidden">
          <Link prefetch={false} href={href} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0f766e] px-4 text-[14px] font-semibold text-white active:scale-[0.98]">Open full report<Arrow /></Link>
          <Link prefetch={false} href={`/dashboard/reports?p=month&d=${d.prevDay}`} className="inline-flex h-11 items-center rounded-xl border border-slate-200 px-3.5 text-[13.5px] font-semibold text-[#0f766e]">Last month</Link>
        </div>
      </div>
    </section>
  );
}
