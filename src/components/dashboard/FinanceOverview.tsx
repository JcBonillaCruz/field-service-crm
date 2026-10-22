"use client";

import { useEffect, useMemo, useState } from "react";
import type { MobileStats } from "@/lib/dashboard-server";
import { InsightsCard, useCountUp } from "@/components/dashboard/MobileWidgets";

const $ = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v || 0);
const short = (v: number) => (Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1)}K` : `$${Math.round(v)}`);

// Curva suave (Catmull-Rom → Bézier) por los puntos
function smooth(pts: [number, number][]) {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

function Spark({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(1, ...values.map(Math.abs)), min = Math.min(0, ...values);
  const pts = values.map((v, i) => [(i / Math.max(1, values.length - 1)) * 100, 28 - ((v - min) / (max - min || 1)) * 24] as [number, number]);
  return <svg viewBox="0 0 100 30" className="h-8 w-full" preserveAspectRatio="none"><path d={smooth(pts)} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>;
}

function Kpi({ label, value, sub, color, tone, series }: { label: string; value: number; sub: string; color: string; tone: string; series: number[] }) {
  const v = useCountUp(value);
  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(15,40,60,0.08)]">
      <p className={`text-[12px] font-semibold uppercase tracking-wide ${tone}`}>{label}</p>
      <p className="mt-1 text-[24px] font-bold tabular-nums text-[#0b1f3a]">{value < 0 ? "-" : ""}{$(Math.abs(v))}</p>
      <p className="text-[12px] text-slate-500">{sub}</p>
      <div className="mt-2 opacity-80 transition-opacity group-hover:opacity-100"><Spark values={series} color={color} /></div>
    </div>
  );
}

// Anillo animado (margen, cobranza, cierre de cotizaciones)
function Ring({ pct, label, sub, color }: { pct: number; label: string; sub: string; color: string }) {
  const [p, setP] = useState(0);
  useEffect(() => { const t = setTimeout(() => setP(Math.max(0, Math.min(1, pct))), 150); return () => clearTimeout(t); }, [pct]);
  const r = 34, c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 84 84" className="h-[84px] w-[84px] -rotate-90">
        <circle cx="42" cy="42" r={r} fill="none" stroke="#eef2f6" strokeWidth="9" />
        <circle cx="42" cy="42" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p)} style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1)" }} />
        <text x="42" y="47" textAnchor="middle" fontSize="16" fontWeight="700" fill="#0b1f3a" transform="rotate(90 42 42)">{Math.round(pct * 100)}%</text>
      </svg>
      <div><p className="text-[14px] font-semibold text-[#0b1f3a]">{label}</p><p className="text-[12px] text-slate-500">{sub}</p></div>
    </div>
  );
}

const CAT_COLORS = ["#0f766e", "#e8713a", "#2563eb", "#7c3aed", "#f59e0b", "#be123c", "#64748b"];

export default function FinanceOverview({ st }: { st: MobileStats }) {
  const n = st.months.length;
  const [hover, setHover] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t); }, []);
  const profitM = st.receipts.map((r, i) => r - st.expenses[i]);
  const profitYtd = st.ytdReceived - st.ytdExpenses;
  const margin = st.ytdReceived > 0 ? profitYtd / st.ytdReceived : 0;
  const collect = st.income12 > 0 ? Math.min(1, st.receipts12 / st.income12) : 0;
  const decided = st.quoteStats.accepted + st.quoteStats.declined;
  const win = decided ? st.quoteStats.accepted / decided : 0;

  // Gráfica de curvas
  const W = 760, H = 260, L = 50, R = 12, T = 14, B = 30;
  const max = Math.max(1, ...st.receipts, ...st.expenses, ...profitM);
  const min = Math.min(0, ...profitM);
  const x = (i: number) => L + (i / (n - 1)) * (W - L - R);
  const y = (v: number) => T + (H - T - B) * (1 - (v - min) / (max - min || 1));
  const line = (vals: number[]) => smooth(vals.map((v, i) => [x(i), y(v)]));
  const area = (vals: number[]) => `${line(vals)} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const ticks = useMemo(() => [0, 0.25, 0.5, 0.75, 1].map((f) => min + (max - min) * f), [max, min]);
  const hi = hover ?? n - 1;

  const totalCat = st.expenseByCat.reduce((a, [, v]) => a + v, 0);
  let acc = 0;

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Received this year" value={st.ytdReceived} sub={`${$(st.receipts12)} in the last 12 months`} color="#14b8a6" tone="text-[#0f766e]" series={st.receipts} />
        <Kpi label="Spent this year" value={st.ytdExpenses} sub="Supplies, payroll, fuel…" color="#f97316" tone="text-[#e11d48]" series={st.expenses} />
        <Kpi label="Net profit" value={profitYtd} sub={st.ytdReceived ? `${Math.round(margin * 100)}% margin` : "Add payments and expenses"} color="#0b1f3a" tone={profitYtd >= 0 ? "text-[#047857]" : "text-[#e11d48]"} series={profitM} />
        <Kpi label="Customers owe you" value={st.total} sub={`${$(st.overdue)} overdue`} color="#f59e0b" tone="text-[#b45309]" series={st.income} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[15px] font-semibold text-[#0b1f3a]">Cash flow · last 12 months</p>
              <p className="text-[12px] text-slate-500">What came in, what went out, and what you kept</p>
            </div>
            <div className="flex gap-4 text-[12px] text-slate-600">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#14b8a6]" />Received</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#f97316]" />Spent</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed border-[#0b1f3a]" />Profit</span>
            </div>
          </div>
          <div className="relative mt-3">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" onMouseLeave={() => setHover(null)}>
              <defs>
                <linearGradient id="bpRec" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#14b8a6" stopOpacity="0.28" /><stop offset="100%" stopColor="#14b8a6" stopOpacity="0" /></linearGradient>
                <linearGradient id="bpExp" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#f97316" stopOpacity="0.16" /><stop offset="100%" stopColor="#f97316" stopOpacity="0" /></linearGradient>
                <clipPath id="bpReveal"><rect x="0" y="0" height={H} width={mounted ? W : 0} style={{ transition: "width 1.4s cubic-bezier(.2,.8,.2,1)" }} /></clipPath>
              </defs>
              {ticks.map((t, k) => (
                <g key={k}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#eef2f6" /><text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">{short(t)}</text></g>
              ))}
              <g clipPath="url(#bpReveal)">
                <path d={area(st.receipts)} fill="url(#bpRec)" />
                <path d={area(st.expenses)} fill="url(#bpExp)" />
                <path d={line(st.receipts)} fill="none" stroke="#14b8a6" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d={line(st.expenses)} fill="none" stroke="#f97316" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                <path d={line(profitM)} fill="none" stroke="#0b1f3a" strokeWidth="1" strokeDasharray="4 4" />
              </g>
              {st.months.map((m, i) => (
                <g key={i}>
                  <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill={hi === i ? "#0f766e" : "#94a3b8"} fontWeight={hi === i ? 700 : 400}>{m}</text>
                  <rect x={x(i) - (W - L - R) / (n - 1) / 2} y={T} width={(W - L - R) / (n - 1)} height={H - T - B} fill="transparent" onMouseEnter={() => setHover(i)} />
                </g>
              ))}
              <line x1={x(hi)} x2={x(hi)} y1={T} y2={H - B} stroke="#0f766e" strokeOpacity="0.25" strokeDasharray="3 3" />
              {([[st.receipts[hi], "#14b8a6"], [st.expenses[hi], "#f97316"], [profitM[hi], "#0b1f3a"]] as const).map(([v, c], k) => (
                <circle key={k} cx={x(hi)} cy={y(v)} r="3.5" fill="#fff" stroke={c} strokeWidth="1.4" />
              ))}
            </svg>
            <div className="pointer-events-none absolute top-1 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-[12px] shadow-lg backdrop-blur"
              style={{ left: `clamp(0px, calc(${(x(hi) / W) * 100}% - 70px), calc(100% - 150px))` }}>
              <p className="font-semibold text-[#0b1f3a]">{st.months[hi]}</p>
              <p className="text-[#0f766e]">Received {$(st.receipts[hi])}</p>
              <p className="text-[#ea580c]">Spent {$(st.expenses[hi])}</p>
              <p className={profitM[hi] >= 0 ? "font-semibold text-[#047857]" : "font-semibold text-[#e11d48]"}>Profit {$(profitM[hi])}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
            <Ring pct={margin} label="Profit margin" sub={st.ytdReceived ? "Of what you collected this year, you kept this much" : "Shows once you record payments"} color={margin >= 0.3 ? "#10b981" : margin >= 0.15 ? "#f59e0b" : "#ef4444"} />
            <Ring pct={collect} label="Collection rate" sub="Paid vs invoiced, last 12 months" color="#14b8a6" />
            <Ring pct={win} label="Quote win rate" sub={decided ? `${st.quoteStats.accepted} won · ${st.quoteStats.declined} lost` : "Shows after customers answer quotes"} color="#6366f1" />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-[15px] font-semibold text-[#0b1f3a]">Where your money goes</p>
            {totalCat === 0 ? <p className="mt-2 text-[13px] text-slate-500">Add expenses to see your spending by category.</p> : (
              <div className="mt-3 flex items-center gap-4">
                <svg viewBox="0 0 42 42" className="h-28 w-28 shrink-0 -rotate-90">
                  {st.expenseByCat.slice(0, 7).map(([name, v], k) => {
                    const frac = v / totalCat; const dash = `${frac * 100} ${100 - frac * 100}`; const off = -acc * 100; acc += frac;
                    return <circle key={name} cx="21" cy="21" r="15.915" fill="none" stroke={CAT_COLORS[k % CAT_COLORS.length]} strokeWidth="6" strokeDasharray={dash} strokeDashoffset={off} style={{ transition: "stroke-dasharray 1s ease" }}><title>{`${name}: ${$(v)}`}</title></circle>;
                  })}
                </svg>
                <ul className="min-w-0 flex-1 space-y-1.5 text-[12px]">
                  {st.expenseByCat.slice(0, 5).map(([name, v], k) => (
                    <li key={name} className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CAT_COLORS[k % CAT_COLORS.length] }} /><span className="min-w-0 flex-1 truncate text-slate-600">{name}</span><span className="font-semibold tabular-nums text-[#0b1f3a]">{Math.round((v / totalCat) * 100)}%</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      <InsightsCard st={st} />
    </section>
  );
}
