"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCountUp } from "@/components/dashboard/MobileWidgets";
import { COST_TYPES, Profit } from "@/lib/job-costing";
import { fmtD } from "@/lib/sales";

// =====================================================================
// Rentabilidad: Total Cobrado · Total de Gastos (Material / Mano de obra / Otros) · Ganancia y margen.
// La usan la lista de Gastos (filtrada por cliente) y el perfil del cliente.
// =====================================================================
const fmt = (v: number, currency = "USD") => {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: Math.abs(v) >= 10000 ? 0 : 2 }).format(v || 0); }
  catch { return `$${(v || 0).toFixed(2)}`; }
};
const Ico = ({ d, className = "h-5 w-5" }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

function Card({ tone, icon, label, children, delay, tip }: { tone: { bg: string; fg: string; blob: string }; icon: string; label: string; children: React.ReactNode; delay: number; tip: string }) {
  return (
    <div title={tip} className="group relative min-w-0 overflow-hidden rounded-2xl border border-white p-4 ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(15,40,60,0.09)] animate-[bp-pop-in_0.45s_cubic-bezier(.2,.8,.2,1)_both] sm:p-5"
      style={{ background: tone.bg, animationDelay: `${delay}ms` }}>
      <span className="pointer-events-none absolute -bottom-12 -right-8 h-32 w-32 rounded-full opacity-70 transition-transform duration-700 group-hover:-translate-x-3 group-hover:scale-125" style={{ background: tone.blob }} />
      <div className="relative flex items-start justify-between gap-2">
        <p className="pt-0.5 text-[11.5px] font-bold uppercase tracking-wide" style={{ color: tone.fg }}>{label}</p>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-[0_4px_12px_rgba(15,40,60,0.08)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" style={{ color: tone.fg }}><Ico d={icon} className="h-[18px] w-[18px]" /></span>
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}

export function ProfitSummary({ p, currency = "USD", period }: { p: Profit; currency?: string; period?: string }) {
  const col = useCountUp(p.collected, 1000);
  const cost = useCountUp(p.costs, 1000);
  const prof = useCountUp(Math.abs(p.profit), 1100);
  const [grow, setGrow] = useState(false);
  useEffect(() => { setGrow(false); const t = setTimeout(() => setGrow(true), 150); return () => clearTimeout(t); }, [p.costs, p.material, p.labor]);
  const parts = COST_TYPES.map((c) => ({ ...c, v: p[c.value] }));
  const pos = p.profit >= 0;
  const pct = p.margin === null ? null : Math.round(p.margin * 100);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3">
      {/* Total Cobrado */}
      <Card delay={0} label="Total collected" icon="M12 19V5M5 12l7-7 7 7" tone={{ bg: "linear-gradient(135deg,#e6f6f2,#f3fbf9)", fg: "#0f766e", blob: "#c9ece3" }}
        tip="Payments on this customer's invoices + Money In linked to this customer">
        <p className="mt-2 text-[26px] font-bold leading-none tracking-tight tabular-nums text-[#0b1f3a]">{fmt(col, currency)}</p>
        <div className="mt-3 space-y-1 text-[12.5px]">
          <p className="flex justify-between gap-2"><span className="text-slate-500">Paid invoices</span><span className="font-semibold tabular-nums text-[#0b1f3a]">{fmt(p.fromInvoices, currency)}</span></p>
          <p className="flex justify-between gap-2"><span className="text-slate-500">Money In / cash jobs</span><span className="font-semibold tabular-nums text-[#0b1f3a]">{fmt(p.fromMoneyIn, currency)}</span></p>
        </div>
      </Card>

      {/* Total de Gastos */}
      <Card delay={80} label="Total costs" icon="M12 5v14M5 12l7 7 7-7" tone={{ bg: "linear-gradient(135deg,#fdecee,#fff6f6)", fg: "#e11d48", blob: "#f8d3d8" }}
        tip="Expenses assigned to this customer, split by type">
        <p className="mt-2 text-[26px] font-bold leading-none tracking-tight tabular-nums text-[#0b1f3a]">{fmt(cost, currency)}</p>
        {/* barra apilada Material / Mano de obra / Otros */}
        <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-white/80 ring-1 ring-slate-200/60">
          {parts.filter((x) => x.v > 0).map((x, i) => (
            <span key={x.value} className="h-full transition-[width] duration-700 ease-[cubic-bezier(.2,.8,.2,1)]" style={{ width: grow && p.costs ? `${(x.v / p.costs) * 100}%` : "0%", background: x.color, transitionDelay: `${i * 120}ms` }} />
          ))}
        </div>
        <div className="mt-2 space-y-1 text-[12.5px]">
          {parts.map((x) => (
            <p key={x.value} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5 text-slate-500"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: x.color }} /><span className="truncate">{x.label}</span></span>
              <span className="font-semibold tabular-nums text-[#0b1f3a]">{fmt(x.v, currency)}</span>
            </p>
          ))}
        </div>
      </Card>

      {/* Ganancia */}
      <Card delay={160} label="Net profit" icon="M3 17l6-6 4 4 8-8M15 7h6v6"
        tone={pos ? { bg: "linear-gradient(135deg,#e8edfb,#f5f7fe)", fg: "#3b5bdb", blob: "#d3dcf6" } : { bg: "linear-gradient(135deg,#fdecee,#fff6f6)", fg: "#e11d48", blob: "#f8d3d8" }}
        tip="Total collected − Total costs">
        <p className="mt-2 text-[26px] font-bold leading-none tracking-tight tabular-nums" style={{ color: pos ? "#047857" : "#e11d48" }}>{p.profit < 0 ? "-" : ""}{fmt(prof, currency)}</p>
        <div className="mt-3 flex items-center gap-3">
          <MarginRing pct={pct} pos={pos} />
          <p className="min-w-0 text-[12.5px] leading-snug text-slate-500">
            {pct === null ? "Margin shows once you collect money from this customer." : pos ? <>You keep <b className="text-[#0b1f3a]">{pct}¢</b> of every dollar{period ? ` · ${period}` : ""}.</> : <>This customer is costing you more than they paid{period ? ` · ${period}` : ""}.</>}
          </p>
        </div>
      </Card>
    </div>
  );
}

function MarginRing({ pct, pos }: { pct: number | null; pos: boolean }) {
  const [v, setV] = useState(0);
  useEffect(() => { const t = setTimeout(() => setV(Math.max(0, Math.min(100, pct ?? 0))), 200); return () => clearTimeout(t); }, [pct]);
  const r = 20, c = 2 * Math.PI * r;
  const color = !pos ? "#e11d48" : (pct ?? 0) >= 30 ? "#10b981" : (pct ?? 0) >= 15 ? "#f59e0b" : "#ef4444";
  return (
    <svg viewBox="0 0 52 52" className="h-[52px] w-[52px] shrink-0 -rotate-90">
      <circle cx="26" cy="26" r={r} fill="none" stroke="#ffffff" strokeWidth="6" />
      <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: "stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)" }} />
      <text x="26" y="30" textAnchor="middle" fontSize="12" fontWeight="700" fill="#0b1f3a" transform="rotate(90 26 26)">{pct === null ? "—" : `${pct}%`}</text>
    </svg>
  );
}

// ---------- Perfil del cliente: resumen + ganancia por trabajo ----------
export function CustomerProfitPanel({ p, customerId, currency = "USD" }: { p: Profit; customerId: string; currency?: string }) {
  const expensesHref = `/dashboard/expenses?range=all&customer=${customerId}`;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#e9f7f4] to-[#eef6ff] text-[#0f766e]"><Ico d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-[#0b1f3a]">Financial summary · Profitability</h2>
          <p className="text-[12.5px] text-slate-500">All time · what you collected, what you spent and what you kept with this customer</p>
        </div>
        <Link prefetch={false} href={expensesHref} className="group inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-semibold text-[#0f766e] transition-all hover:-translate-y-0.5 hover:border-[#0f766e] hover:shadow-sm">
          See expenses<svg viewBox="0 0 20 20" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" fill="currentColor"><path d="M7.3 5.3a1 1 0 0 1 1.4 0l4 4a1 1 0 0 1 0 1.4l-4 4a1 1 0 0 1-1.4-1.4L10.6 10 7.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
        </Link>
      </div>

      {!p.ready && <p className="mb-4 rounded-xl bg-[#fff7ef] px-4 py-3 text-[13px] text-[#9a3412]">Run <b>paso-job-costing.sql</b> in Supabase to start assigning expenses to customers. Collected money already shows below.</p>}
      <ProfitSummary p={p} currency={currency} />

      {/* Ganancia por trabajo (cada invoice es un trabajo) */}
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-[#0b1f3a]">Profit by job</h3>
          <span className="text-[12px] text-slate-400">Each invoice is a job</span>
        </div>
        {p.jobs.length === 0 ? (
          <p className="rounded-xl bg-[#f6fbfa] px-4 py-5 text-center text-[13px] text-slate-500">When you collect an invoice or assign an expense to one of this customer&apos;s invoices, each job&apos;s profit shows up here.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead><tr className="bg-[#f8fafb] text-left text-[11.5px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2.5">Job</th><th className="px-3 py-2.5 text-right">Collected</th><th className="px-3 py-2.5 text-right">Material</th><th className="px-3 py-2.5 text-right">Labor</th><th className="px-3 py-2.5 text-right">Other</th><th className="px-3 py-2.5 text-right">Profit</th>
              </tr></thead>
              <tbody>
                {p.jobs.map((j) => {
                  const m = j.collected > 0 ? Math.round((j.profit / j.collected) * 100) : null;
                  return (
                    <tr key={j.id} className="border-t border-slate-100 transition-colors hover:bg-[#f6fbfa]">
                      <td className="px-3 py-2.5"><Link prefetch={false} href={`/dashboard/invoices/${j.id}`} className="font-semibold text-[#0f766e] hover:underline">{j.number}</Link><span className="block text-[11.5px] text-slate-400">{fmtD(j.date)}</span></td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#0b1f3a]">{fmt(j.collected, currency)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{fmt(j.material, currency)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{fmt(j.labor, currency)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{fmt(j.other, currency)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={`font-bold tabular-nums ${j.profit >= 0 ? "text-[#047857]" : "text-[#e11d48]"}`}>{fmt(j.profit, currency)}</span>
                        {m !== null && <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-bold ${j.profit >= 0 ? "bg-[#ecfdf5] text-[#047857]" : "bg-[#fff1f2] text-[#e11d48]"}`}>{m}%</span>}
                      </td>
                    </tr>
                  );
                })}
                {p.unassigned.costs > 0 && (
                  <tr className="border-t border-slate-100 bg-slate-50/60 text-slate-500">
                    <td className="px-3 py-2.5 italic">Not tied to an invoice</td>
                    <td className="px-3 py-2.5 text-right">—</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmt(p.unassigned.material, currency)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmt(p.unassigned.labor, currency)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmt(p.unassigned.other, currency)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#e11d48]">-{fmt(p.unassigned.costs, currency)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
