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

// Fondo "tecnológico" suave: cuadrícula gris tenue con pulsos que se mueven (sin colores fuertes)
function TechBackdrop() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <pattern id="bpGrid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" fill="none" stroke="#e2e8f0" strokeWidth="0.8" /></pattern>
        <radialGradient id="bpFade" cx="50%" cy="0%" r="90%"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#fff" stopOpacity="0.95" /></radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bpGrid)" />
      {[[18, 30, 0], [62, 18, 1.2], [82, 64, 2.4], [36, 72, 3.1], [90, 26, 4.2]].map(([x, y, d], i) => (
        <circle key={i} cx={`${x}%`} cy={`${y}%`} r="2.2" fill="#94a3b8">
          <animate attributeName="opacity" values="0;.7;0" dur="4.5s" begin={`${d}s`} repeatCount="indefinite" />
          <animate attributeName="r" values="1.5;3.5;1.5" dur="4.5s" begin={`${d}s`} repeatCount="indefinite" />
        </circle>
      ))}
      <rect width="100%" height="100%" fill="url(#bpFade)" />
      <rect x="-30%" y="0" width="30%" height="100%" fill="#ffffff" opacity="0.55">
        <animate attributeName="x" values="-30%;130%" dur="6s" repeatCount="indefinite" />
      </rect>
    </svg>
  );
}

type Detail = "earned" | "spent" | "profit" | null;
// Tarjeta principal: lo recibido en el año; Earned / Spent / Profit se tocan y muestran su historial
export function MobileHero({ st }: { st: MobileStats }) {
  const earned = useCountUp(st.ytdReceived);
  const profit = st.ytdReceived - st.ytdExpenses;
  const year = new Date().getFullYear();
  const [detail, setDetail] = useState<Detail>(null);
  const tiles: [Exclude<Detail, null>, string, number, string, string][] = [
    ["earned", "Earned", st.ytdReceived, "M12 19V5M5 12l7-7 7 7", "text-[#059669]"],
    ["spent", "Spent", st.ytdExpenses, "M12 5v14M5 12l7 7 7-7", "text-[#e11d48]"],
    ["profit", "Profit", profit, "M3 17l6-6 4 4 8-8M15 7h6v6", profit >= 0 ? "text-[#0f766e]" : "text-[#e11d48]"],
  ];
  return (
    <>
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white px-5 pb-5 pt-5 shadow-[0_6px_20px_rgba(15,40,60,0.06)]">
        <TechBackdrop />
        <div className="relative">
          <p className="flex items-center gap-2 text-[13px] font-medium text-slate-500">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10b981] opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#10b981]" /></span>
            Received in {year} · live
          </p>
          <p className="mt-1 text-[38px] font-bold leading-none tracking-tight tabular-nums text-[#0b1f3a]">{$(earned)}</p>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {tiles.map(([k, l, v, d, tone]) => (
              <button key={k} type="button" onClick={() => setDetail(k)}
                className="group rounded-2xl border border-slate-200 bg-white/90 px-3 py-2.5 text-left backdrop-blur transition-all active:scale-95">
                <p className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                  <span className="flex items-center gap-1"><svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${tone}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>{l}</span>
                  <svg viewBox="0 0 20 20" className="h-3 w-3 text-slate-300 transition-transform group-active:translate-x-0.5" fill="currentColor"><path d="M7.3 5.3a1 1 0 0 1 1.4 0l4 4a1 1 0 0 1 0 1.4l-4 4a1 1 0 0 1-1.4-1.4L10.6 10 7.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
                </p>
                <p className={`mt-0.5 text-[16px] font-bold tabular-nums ${k === "spent" || v < 0 ? "text-[#e11d48]" : "text-[#0b1f3a]"}`}>{k === "spent" ? "-" : v < 0 ? "-" : ""}{short(Math.abs(v))}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
      <HeroDetail st={st} detail={detail} onClose={() => setDetail(null)} />
    </>
  );
}

// Hoja de detalle: historial de cobros, gastos o ganancia por mes
function HeroDetail({ st, detail, onClose }: { st: MobileStats; detail: Detail; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(false); if (detail) { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t); } }, [detail]);
  if (!detail) return null;
  const profitM = st.receipts.map((r, i) => r - st.expenses[i]);
  const series = detail === "earned" ? st.receipts : detail === "spent" ? st.expenses : profitM;
  const max = Math.max(1, ...series.map(Math.abs));
  const color = detail === "earned" ? "#10b981" : detail === "spent" ? "#f43f5e" : "#0f766e";
  const title = detail === "earned" ? "Money received" : detail === "spent" ? "Money spent" : "Profit by month";
  const total = detail === "earned" ? st.ytdReceived : detail === "spent" ? st.ytdExpenses : st.ytdReceived - st.ytdExpenses;
  const fd = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-slate-900/40 animate-[bp-fade_0.2s_ease-out]" onClick={onClose}>
      <div className="max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-white pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-[bp-sheet_0.3s_cubic-bezier(.2,.8,.2,1)]" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <div><p className="text-[13px] text-slate-500">{title} · {new Date().getFullYear()}</p><p className={`text-[26px] font-bold tabular-nums ${detail === "spent" || total < 0 ? "text-[#e11d48]" : "text-[#0b1f3a]"}`}>{detail === "spent" ? "-" : ""}{$(Math.abs(total))}</p></div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500"><svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg></button>
        </div>
        <div className="px-5 pt-4">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-400">Last 12 months</p>
          <div className="flex h-32 items-end gap-1.5">
            {series.map((v, i) => (
              <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[8px] font-semibold tabular-nums text-slate-500">{v ? short(v) : ""}</span>
                <div className="w-full rounded-t-md transition-all duration-700" style={{ height: mounted && v ? `${Math.max(4, (Math.abs(v) / max) * 90)}px` : "2px", background: v < 0 ? "#f43f5e" : color, opacity: v ? 1 : 0.2, transitionDelay: `${i * 35}ms` }} />
                <span className="text-[8px] text-slate-400">{st.months[i]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-5 px-5">
          {detail === "earned" && (
            <>
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-400">Recent payments</p>
              {st.recentPayments.length === 0 && <p className="py-4 text-center text-sm text-slate-500">No payments yet.</p>}
              <ul className="divide-y divide-slate-100">
                {st.recentPayments.map((p, i) => (
                  <li key={i} className="flex items-center gap-3 py-2.5 animate-[bp-fade_0.3s_ease-out_both]" style={{ animationDelay: `${i * 30}ms` }}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ecfdf5] text-[#059669]"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-medium text-[#0b1f3a]">{p.customer || "Payment"}</span><span className="text-[12px] text-slate-500">{fd(p.date)}{p.number ? ` · ${p.number}` : ""}{p.mode ? ` · ${p.mode}` : ""}</span></span>
                    <span className="font-semibold tabular-nums text-[#059669]">+{$(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {detail === "spent" && (
            <>
              {st.expenseByCat.length > 0 && <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-400">Where it went</p>}
              <ul className="mb-4 space-y-2">
                {st.expenseByCat.slice(0, 5).map(([n, v]) => (
                  <li key={n}><div className="flex justify-between text-[13px]"><span className="text-slate-600">{n}</span><span className="font-semibold tabular-nums text-[#e11d48]">-{$(v)}</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#fb7185] transition-all duration-700" style={{ width: mounted ? `${(v / (st.expenseByCat[0][1] || 1)) * 100}%` : "0%" }} /></div></li>
                ))}
              </ul>
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-400">Recent expenses</p>
              {st.recentExpenses.length === 0 && <p className="py-4 text-center text-sm text-slate-500">No expenses yet.</p>}
              <ul className="divide-y divide-slate-100">
                {st.recentExpenses.map((e, i) => (
                  <li key={i} className="flex items-center gap-3 py-2.5"><span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-medium text-[#0b1f3a]">{e.vendor || e.category}</span><span className="text-[12px] text-slate-500">{fd(e.date)} · {e.category}</span></span><span className="font-semibold tabular-nums text-[#e11d48]">-{$(e.amount)}</span></li>
                ))}
              </ul>
              <Link href="/dashboard/expenses" className="mt-3 block rounded-xl border border-slate-200 py-2.5 text-center text-sm font-medium text-[#0f766e]">Open Expenses →</Link>
            </>
          )}
          {detail === "profit" && (
            <>
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-400">Month by month</p>
              <ul className="divide-y divide-slate-100">
                {st.months.map((m, i) => ({ m, i })).reverse().map(({ m, i }) => (
                  <li key={i} className="grid grid-cols-4 gap-2 py-2 text-[13px]">
                    <span className="font-medium text-[#0b1f3a]">{m}</span>
                    <span className="text-right tabular-nums text-[#059669]">+{short(st.receipts[i])}</span>
                    <span className="text-right tabular-nums text-[#e11d48]">-{short(st.expenses[i])}</span>
                    <span className={`text-right font-semibold tabular-nums ${profitM[i] >= 0 ? "text-[#0b1f3a]" : "text-[#e11d48]"}`}>{profitM[i] < 0 ? "-" : ""}{short(Math.abs(profitM[i]))}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-slate-400">Received · Spent · Profit</p>
            </>
          )}
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
        <div className="rounded-2xl bg-[#e9f7f4] px-3 py-2"><p className="text-[11px] font-semibold text-[#0f766e]">Current (not due yet)</p><p className="text-[16px] font-bold tabular-nums text-[#0b1f3a]">{$(st.current)}</p></div>
        <Link href="/dashboard/invoices?view=overdue" className="rounded-2xl bg-[#f43f5e] px-3 py-2 text-white shadow-[0_4px_12px_rgba(244,63,94,0.25)] active:scale-[0.98]"><p className="text-[11px] font-semibold text-white/90">Overdue →</p><p className="text-[16px] font-bold tabular-nums">{$(st.overdue)}</p></Link>
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
      <svg data-noswipe viewBox={`0 0 ${W} ${H}`} className="w-full touch-none select-none" role="img" aria-label="Income and expense by month">
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
export function InsightsCard({ st, compact = false, neutral = false, tip = true }: { st: MobileStats; compact?: boolean; neutral?: boolean; tip?: boolean }) {
  const list = buildInsights(st);
  const [idx, setIdx] = useState(0);
  const shown = compact ? list.slice(0, 3) : list;
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${neutral ? "bg-slate-100 text-[#0f766e]" : "bg-gradient-to-br from-[#fff3e8] to-[#e9f7f4] text-[#e8713a]"}`}>
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></svg>
        </span>
        <div><p className="text-[15px] font-semibold text-[#0b1f3a]">Money insights</p><p className="text-[11px] text-slate-400">Updated with your numbers every day</p></div>
      </div>
      <div className="space-y-2">
        {shown.length === 0 && <p className="rounded-2xl bg-slate-50 px-3 py-3 text-[13px] text-slate-500">Record payments and expenses to get personalized advice here.</p>}
        {shown.map((x, k) => {
          const [bg, fg, d] = TONE[x.tone];
          return (
            <button key={k} type="button" onClick={() => setIdx(idx === k ? -1 : k)}
              className={`w-full rounded-2xl px-3 py-2.5 text-left transition-all active:scale-[0.99] ${neutral ? `border ${idx === k ? "border-[#bfe7de] bg-[#f6fbfa]" : "border-slate-100 bg-slate-50/70"}` : bg}`}>
              <p className={`flex items-start gap-2.5 text-[13px] font-semibold ${neutral ? "text-[#0b1f3a]" : fg}`}>
                <span className={neutral ? `flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ${fg}` : ""}>
                  <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
                </span>
                <span className="flex-1 pt-0.5">{x.title}</span>
                {neutral && <svg viewBox="0 0 20 20" className={`mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform ${idx === k ? "rotate-180" : ""}`} fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>}
              </p>
              {idx === k && (
                <div className="animate-[bp-fade_0.2s_ease-out]">
                  <p className={`mt-1 text-[13px] text-slate-600 ${neutral ? "pl-[34px]" : "pl-6"}`}>{x.body}</p>
                  {x.href && <Link href={x.href} className={`mt-1.5 inline-block text-[13px] font-semibold ${neutral ? "pl-[34px] text-[#0f766e]" : `pl-6 ${fg}`}`}>{x.cta} →</Link>}
                </div>
              )}
            </button>
          );
        })}
      </div>
      {tip && <div className="mt-3 rounded-2xl border border-dashed border-[#bfe7de] bg-[#f6fbfa] px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0f766e]">Tip of the day</p>
        <p className="mt-0.5 text-[13px] text-slate-600">{tipOfTheDay()}</p>
      </div>}
    </div>
  );
}
