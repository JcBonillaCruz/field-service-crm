"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MobileStats } from "@/lib/dashboard-server";
import { Insight, buildInsights, tipOfTheDay } from "@/lib/insights";

const $ = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v || 0);
const short = (v: number) => (Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1)}K` : `$${Math.round(v)}`);

export function useCountUp(value: number, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0; const t0 = performance.now();
    const tick = (t: number) => { const p = Math.min(1, (t - t0) / ms); setV(value * (1 - Math.pow(1 - p, 3))); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return v;
}

// Tarjeta principal (clara y suave; se ve bien con tema claro u oscuro del teléfono)
export function MobileHero({ st }: { st: MobileStats }) {
  const earned = useCountUp(st.ytdReceived);
  const profit = st.ytdReceived - st.ytdExpenses;
  const year = new Date().getFullYear();
  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#d9efe9] bg-white px-5 pb-5 pt-5 shadow-[0_8px_24px_rgba(15,118,110,0.08)]">
      <span className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-[#d7f1eb] blur-2xl animate-[bp-float_8s_ease-in-out_infinite]" />
      <span className="pointer-events-none absolute -bottom-16 -left-10 h-36 w-36 rounded-full bg-[#fdebdc] blur-2xl animate-[bp-float_10s_ease-in-out_infinite_reverse]" />
      <div className="relative">
        <p className="flex items-center gap-2 text-[13px] font-medium text-slate-500">
          <span className="h-2 w-2 rounded-full bg-[#10b981] shadow-[0_0_0_4px_rgba(16,185,129,0.15)] animate-pulse" />Received in {year}
        </p>
        <p className="mt-1 text-[38px] font-bold leading-none tracking-tight tabular-nums text-[#0b1f3a]">{$(earned)}</p>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {([["Earned", st.ytdReceived, "bg-[#ecfdf5] text-[#047857]", "M12 19V5M5 12l7-7 7 7"], ["Spent", st.ytdExpenses, "bg-[#fff1f2] text-[#e11d48]", "M12 5v14M5 12l7 7 7-7"],
            ["Profit", profit, profit >= 0 ? "bg-[#eef8f5] text-[#0f766e]" : "bg-[#fff1f2] text-[#e11d48]", "M3 17l6-6 4 4 8-8M15 7h6v6"]] as const).map(([l, v, tone, d]) => (
            <div key={l} className={`rounded-2xl px-3 py-2.5 ${tone.split(" ")[0]}`}>
              <p className={`flex items-center gap-1 text-[11px] font-semibold ${tone.split(" ")[1]}`}>
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>{l}
              </p>
              <p className={`mt-0.5 text-[16px] font-bold tabular-nums ${l === "Spent" ? "text-[#e11d48]" : l === "Profit" && v < 0 ? "text-[#e11d48]" : "text-[#0b1f3a]"}`}>{l === "Spent" ? "-" : ""}{short(Math.abs(v))}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const AGING = ["Current", "1–15 days", "16–30 days", "31–45 days", "45+ days"];
// Cuentas por cobrar: su propia tarjeta, con barras que se tocan y explican
export function ReceivablesCard({ st, mounted }: { st: MobileStats; mounted: boolean }) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  const max = Math.max(1, ...st.aging);
  const i = sel ?? (st.aging.findIndex((v) => v > 0) >= 0 ? st.aging.findIndex((v) => v > 0) : 0);
  return (
    <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-left">
        <div>
          <p className="text-[13px] font-medium text-slate-500">Receivables · what customers owe you</p>
          <p className="mt-0.5 text-[24px] font-bold tabular-nums text-[#0b1f3a]">{$(st.total)}</p>
        </div>
        <svg viewBox="0 0 20 20" className={`h-5 w-5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
      </button>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-[#ecfdf5] px-3 py-2"><p className="text-[11px] font-semibold text-[#047857]">Current (not due yet)</p><p className="text-[16px] font-bold tabular-nums text-[#0b1f3a]">{$(st.current)}</p></div>
        <Link href="/dashboard/invoices?view=overdue" className="rounded-2xl bg-[#fff1f2] px-3 py-2 active:scale-[0.98]"><p className="text-[11px] font-semibold text-[#e11d48]">Overdue →</p><p className="text-[16px] font-bold tabular-nums text-[#0b1f3a]">{$(st.overdue)}</p></Link>
      </div>
      {open && (
        <div className="mt-4 animate-[bp-fade_0.2s_ease-out]">
          <p className="mb-2 text-[13px] font-semibold text-[#0b1f3a]">Unpaid invoices by days overdue</p>
          <div className="mb-3 rounded-xl bg-slate-50 px-3 py-2 text-[13px] text-slate-600">
            <b className="text-[#0b1f3a]">{AGING[i]}:</b> {st.agingCount[i]} {st.agingCount[i] === 1 ? "invoice" : "invoices"} · {$(st.aging[i])}
            <span className="block text-[12px] text-slate-500">{i === 0 ? "Not due yet. No action needed." : i <= 2 ? "Recently late. A friendly reminder usually works." : "Long overdue. Call the customer or offer a payment plan."}</span>
          </div>
          <div className="flex h-28 items-end gap-3 border-b border-slate-100 pb-1">
            {AGING.map((l, k) => (
              <button key={l} type="button" onClick={() => setSel(k)} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] font-semibold tabular-nums text-slate-500">{st.aging[k] ? short(st.aging[k]) : ""}</span>
                <span className={`w-full max-w-[34px] rounded-t-md transition-all duration-700 ${k === 0 ? "bg-[#34d399]" : k <= 2 ? "bg-[#fbbf24]" : "bg-[#f87171]"} ${i === k ? "ring-2 ring-offset-2 ring-[#0f766e]/40" : "opacity-80"}`}
                  style={{ height: mounted && st.aging[k] ? `${Math.max(6, (st.aging[k] / max) * 80)}px` : "3px", transitionDelay: `${k * 80}ms` }} />
              </button>
            ))}
          </div>
          <div className="mt-1 flex gap-3">{AGING.map((l, k) => <span key={l} className={`flex-1 text-center text-[9px] ${i === k ? "font-semibold text-[#0f766e]" : "text-slate-400"}`}>{l.replace(" days", "")}</span>)}</div>
        </div>
      )}
    </div>
  );
}

// Barras de ingresos y gastos que se tocan: ejes, montos y por qué subió o bajó
export function MoneyChart({ st, mounted }: { st: MobileStats; mounted: boolean }) {
  const n = st.months.length;
  const [sel, setSel] = useState<number>(n - 1);
  const max = Math.max(1, ...st.income, ...st.receipts, ...st.expenses);
  const W = 340, H = 190, L = 38, B = 22, T = 8;
  const cw = (W - L - 4) / n, bw = Math.max(3, Math.min(6, cw / 4.2));
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const i = sel;
  const profit = st.receipts[i] - st.expenses[i];
  const prev = i > 0 ? st.receipts[i - 1] : 0;
  const change = prev > 0 ? (st.receipts[i] - prev) / prev : null;
  const why = st.receipts[i] === 0 && st.expenses[i] === 0 ? "No money in or out this month."
    : change === null ? `First month with payments: ${short(st.receipts[i])} received.`
      : `${change >= 0 ? "Up" : "Down"} ${Math.abs(Math.round(change * 100))}% vs ${st.months[i - 1]} (${short(prev)} → ${short(st.receipts[i])}).${st.expenses[i] > st.receipts[i] ? " You spent more than you collected." : ""}`;
  return (
    <div>
      <div className="mb-2 rounded-2xl bg-slate-50 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-[#0b1f3a]">{st.months[i]}{i === n - 1 ? " · this month" : ""}</p>
          <p className={`text-[13px] font-bold tabular-nums ${profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>Profit {profit >= 0 ? "+" : "-"}{short(Math.abs(profit))}</p>
        </div>
        <div className="mt-1.5 grid grid-cols-3 gap-1 text-[11px]">
          <p><span className="text-blue-600">Invoiced</span><br /><b className="text-[13px] tabular-nums text-[#0b1f3a]">{short(st.income[i])}</b></p>
          <p><span className="text-teal-600">Received</span><br /><b className="text-[13px] tabular-nums text-[#0b1f3a]">{short(st.receipts[i])}</b></p>
          <p><span className="text-orange-500">Spent</span><br /><b className="text-[13px] tabular-nums text-[#0b1f3a]">{short(st.expenses[i])}</b></p>
        </div>
        <p className="mt-1.5 text-[12px] text-slate-500">{why}</p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full touch-none select-none" role="img" aria-label="Income and expense by month">
        {[0, max / 2, max].map((t) => (
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
                return <rect key={b} x={x0 - bw * 1.6 + b * bw * 1.1} y={H - B - h} width={bw} height={h} rx={bw / 2} fill={c} opacity={sel === k ? 1 : 0.45} style={{ transition: `height .7s ease ${k * 30}ms, y .7s ease ${k * 30}ms, opacity .2s` }} />;
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
      <p className="mt-1 text-center text-[11px] text-slate-400">Tap a month to see what happened</p>
    </div>
  );
}

const TONE: Record<Insight["tone"], [string, string, string]> = {
  good: ["bg-[#ecfdf5]", "text-[#047857]", "M5 12.5 9.5 17 19 7"],
  warn: ["bg-[#fff7ed]", "text-[#c2410c]", "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"],
  bad: ["bg-[#fff1f2]", "text-[#e11d48]", "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9 9l6 6M15 9l-6 6"],
  info: ["bg-[#eef6ff]", "text-[#2563eb]", "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01"],
};
// Consejos de finanzas: lo que pasa hoy con tu dinero y qué hacer (cambia cada día)
export function InsightsCard({ st, compact = false }: { st: MobileStats; compact?: boolean }) {
  const list = buildInsights(st);
  const [idx, setIdx] = useState(0);
  const shown = compact ? list.slice(0, 3) : list;
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#fff3e8] to-[#e9f7f4] text-[#e8713a]">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></svg>
        </span>
        <div><p className="text-[15px] font-semibold text-[#0b1f3a]">Money insights</p><p className="text-[11px] text-slate-400">Updated with your numbers every day</p></div>
      </div>
      <div className="space-y-2">
        {shown.length === 0 && <p className="rounded-2xl bg-slate-50 px-3 py-3 text-[13px] text-slate-500">Record payments and expenses to get personalized advice here.</p>}
        {shown.map((x, k) => {
          const [bg, fg, d] = TONE[x.tone];
          return (
            <button key={k} type="button" onClick={() => setIdx(idx === k ? -1 : k)} className={`w-full rounded-2xl px-3 py-2.5 text-left transition-all active:scale-[0.99] ${bg}`}>
              <p className={`flex items-start gap-2 text-[13px] font-semibold ${fg}`}>
                <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>{x.title}
              </p>
              {idx === k && (
                <div className="animate-[bp-fade_0.2s_ease-out]">
                  <p className="mt-1 pl-6 text-[13px] text-slate-600">{x.body}</p>
                  {x.href && <Link href={x.href} className={`mt-1.5 inline-block pl-6 text-[13px] font-semibold ${fg}`}>{x.cta} →</Link>}
                </div>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-3 rounded-2xl border border-dashed border-[#bfe7de] bg-[#f6fbfa] px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0f766e]">Tip of the day</p>
        <p className="mt-0.5 text-[13px] text-slate-600">{tipOfTheDay()}</p>
      </div>
    </div>
  );
}
