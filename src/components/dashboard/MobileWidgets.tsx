"use client";

import { useEffect, useState } from "react";
import type { MobileStats } from "@/lib/dashboard-server";

const $ = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v || 0);
const short = (v: number) => (Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}K` : `$${Math.round(v)}`);

// Número que sube solo al entrar
function useCountUp(value: number, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0; const t0 = performance.now();
    const tick = (t: number) => { const p = Math.min(1, (t - t0) / ms); setV(value * (1 - Math.pow(1 - p, 3))); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return v;
}

// Tarjeta principal del celular: lo ganado en el año, lo gastado y la ganancia, con fondo en movimiento
export function MobileHero({ st, onAging, agingOpen }: { st: MobileStats; onAging: () => void; agingOpen: boolean }) {
  const earned = useCountUp(st.ytdReceived);
  const profit = st.ytdReceived - st.ytdExpenses;
  const year = new Date().getFullYear();
  return (
    <div className="relative overflow-hidden rounded-3xl bg-[#0b1f3a] px-5 pb-5 pt-5 text-white shadow-[0_14px_34px_rgba(11,31,58,0.28)]">
      {/* luces suaves que se mueven */}
      <span className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-[#14a39a]/40 blur-3xl animate-[bp-float_7s_ease-in-out_infinite]" />
      <span className="pointer-events-none absolute -bottom-20 -left-12 h-52 w-52 rounded-full bg-[#e8713a]/30 blur-3xl animate-[bp-float_9s_ease-in-out_infinite_reverse]" />
      <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.07)_50%,transparent_70%)] bg-[length:250%_100%] animate-[bp-sheen_6s_linear_infinite]" />
      <div className="relative">
        <p className="flex items-center gap-2 text-[13px] font-medium text-white/70">
          <span className="h-2 w-2 rounded-full bg-[#34d399] shadow-[0_0_0_4px_rgba(52,211,153,0.2)] animate-pulse" />Received in {year}
        </p>
        <p className="mt-1 text-[40px] font-bold leading-none tracking-tight tabular-nums">{$(earned)}</p>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {([["Earned", st.ytdReceived, "text-[#6ee7b7]", "M12 19V5M5 12l7-7 7 7"], ["Spent", st.ytdExpenses, "text-[#fdba74]", "M12 5v14M5 12l7 7 7-7"],
            ["Profit", profit, profit >= 0 ? "text-[#6ee7b7]" : "text-[#fca5a5]", "M3 17l6-6 4 4 8-8M15 7h6v6"]] as const).map(([l, v, tone, d]) => (
            <div key={l} className="rounded-2xl bg-white/[0.08] px-3 py-2.5 backdrop-blur-sm">
              <p className="flex items-center gap-1 text-[11px] font-medium text-white/60">
                <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${tone}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>{l}
              </p>
              <p className={`mt-0.5 text-[15px] font-semibold tabular-nums ${l === "Profit" ? tone : "text-white"}`}>{short(v)}</p>
            </div>
          ))}
        </div>
        <button type="button" onClick={onAging} className="mt-4 flex w-full items-center justify-between rounded-2xl bg-white/[0.06] px-4 py-2.5 text-left text-[13px] transition-colors active:bg-white/[0.12]">
          <span>Receivables <b className="ml-1 text-[15px]">{$(st.total)}</b></span>
          <span className="flex items-center gap-3"><span className="text-[#6ee7b7]">Current {short(st.current)}</span><span className="text-[#fca5a5]">Overdue {short(st.overdue)}</span>
            <svg viewBox="0 0 20 20" className={`h-4 w-4 text-white/60 transition-transform ${agingOpen ? "rotate-180" : ""}`} fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg></span>
        </button>
      </div>
    </div>
  );
}

// Barras de ingresos y gastos que se tocan: ejes con montos y meses, todo visible sin deslizar
export function MoneyChart({ st, mounted }: { st: MobileStats; mounted: boolean }) {
  const [sel, setSel] = useState<number | null>(null);
  const n = st.months.length;
  const max = Math.max(1, ...st.income, ...st.receipts, ...st.expenses);
  const W = 340, H = 190, L = 38, B = 22, T = 8;
  const cw = (W - L - 4) / n, bw = Math.max(3, Math.min(6, cw / 4.2));
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const ticks = [0, max / 2, max];
  const i = sel ?? n - 1;
  const profit = st.receipts[i] - st.expenses[i];
  return (
    <div>
      <div className="mb-2 grid grid-cols-4 gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-center text-[11px]">
        <div><p className="font-semibold text-slate-700">{st.months[i]}</p><p className="text-slate-400">{sel == null ? "This month" : "Selected"}</p></div>
        <div><p className="text-blue-600">Invoiced</p><p className="font-semibold tabular-nums text-[#0b1f3a]">{short(st.income[i])}</p></div>
        <div><p className="text-teal-600">Received</p><p className="font-semibold tabular-nums text-[#0b1f3a]">{short(st.receipts[i])}</p></div>
        <div><p className="text-orange-500">Spent</p><p className="font-semibold tabular-nums text-[#0b1f3a]">{short(st.expenses[i])}</p><p className={`text-[10px] font-semibold ${profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>{profit >= 0 ? "+" : ""}{short(profit)}</p></div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full touch-none select-none" role="img" aria-label="Income and expense by month">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeDasharray={t ? "3 3" : undefined} />
            <text x={L - 5} y={y(t) + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{short(t)}</text>
          </g>
        ))}
        {st.months.map((m, k) => {
          const x0 = L + k * cw + cw / 2;
          const bars: [number, string][] = [[st.income[k], "#3b82f6"], [st.receipts[k], "#14b8a6"], [st.expenses[k], "#f97316"]];
          return (
            <g key={k} onPointerDown={() => setSel(k)} onPointerEnter={(e) => e.pointerType === "mouse" && setSel(k)} className="cursor-pointer">
              <rect x={L + k * cw} y={T} width={cw} height={H - T - B} fill={sel === k ? "#e9f7f4" : "transparent"} rx="4" />
              {bars.map(([v, c], b) => {
                const h = mounted ? Math.max(v ? 2 : 0, (H - T - B) - (y(v) - T)) : 0;
                return <rect key={b} x={x0 - bw * 1.6 + b * bw * 1.1} y={H - B - h} width={bw} height={h} rx={bw / 2} fill={c} opacity={sel == null || sel === k ? 1 : 0.35}
                  style={{ transition: `height .7s ease ${k * 30}ms, y .7s ease ${k * 30}ms, opacity .2s` }} />;
              })}
              <text x={x0} y={H - 6} textAnchor="middle" fontSize="8.5" fill={sel === k ? "#0f766e" : "#94a3b8"} fontWeight={sel === k ? 700 : 400}>{m}</text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-center gap-4 text-[11px] text-slate-500">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#3b82f6]" />Invoiced</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#14b8a6]" />Received</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#f97316]" />Spent</span>
      </div>
    </div>
  );
}
