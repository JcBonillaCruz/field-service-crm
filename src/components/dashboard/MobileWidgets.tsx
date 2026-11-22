"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSwipe } from "@/components/ui/useSwipe";
import type { MobileStats } from "@/lib/dashboard-server";
import { useTranslations } from "next-intl";
import { Insight, InsightL, buildInsights, tipOfTheDay } from "@/lib/insights";
import { useFinTx } from "@/i18n/useFinTx";

// Paso 6.2b: textos, dinero y meses en el idioma de quien lo ve
function useMw() {
  const t = useTranslations("mobileFin");
  const fx = useFinTx();
  const fd = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(fx.tag, { month: "short", day: "numeric" }).replace(".", "");
  return { t, fx, $: fx.money, mon: fx.monName, fd };
}
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

type Detail = "earned" | "spent" | "profit" | null;
type HeroTab = "earned" | "spent" | "pending";
const HERO_TABS: { id: HeroTab; label: string; color: string; soft: string; icon: string }[] = [
  { id: "earned", label: "Earned", color: "#059669", soft: "#ecfdf5", icon: "M12 19V5M5 12l7-7 7 7" },
  { id: "spent", label: "Spent", color: "#e11d48", soft: "#fff1f2", icon: "M12 5v14M5 12l7 7 7-7" },
  { id: "pending", label: "Pending", color: "#b45309", soft: "#fff7e8", icon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2" },
];
// Tarjeta principal del inicio de Finances (celular) · Paso 5.13
// Tres pestañas que también se deslizan con el dedo: lo ganado en el año, lo gastado en el año y lo pendiente
// (lo que te deben los clientes y lo que tú debes de compras a pagos). Abajo, siempre, la ganancia del año.
export function MobileHero({ st }: { st: MobileStats }) {
  const { t: tx, fx, $, mon } = useMw();
  const months = st.months.map(mon);
  const profit = st.ytdReceived - st.ytdExpenses;
  const year = new Date().getFullYear();
  const [tab, setTab] = useState<HeroTab>("earned");
  const [detail, setDetail] = useState<Detail>(null);
  const [pick, setPick] = useState<number | null>(null);
  const [grown, setGrown] = useState(false);
  useEffect(() => { setGrown(false); setPick(null); setDetail(null); const k = setTimeout(() => setGrown(true), 80); return () => clearTimeout(k); }, [tab]);
  const ti = HERO_TABS.findIndex((h) => h.id === tab);
  const swipe = useSwipe(() => ti > 0 && setTab(HERO_TABS[ti - 1].id), () => ti < HERO_TABS.length - 1 && setTab(HERO_TABS[ti + 1].id));
  const T = HERO_TABS[ti];
  const series = tab === "spent" ? st.expenses : st.receipts;
  const max = Math.max(1, ...series);
  const best = series.reduce((p, v, i) => (v > series[p] ? i : p), 0);
  const sel = pick ?? best;
  const withData = series.filter((v) => v > 0).length;
  const avg = withData ? series.reduce((a, v) => a + v, 0) / withData : 0;
  const total = tab === "spent" ? st.ytdExpenses : st.ytdReceived;
  const owe = st.owe && st.owe.count > 0 ? st.owe : null;
  const stat = (label: string, value: string, sub?: string) => (
    <div className="min-w-0 rounded-2xl bg-slate-50 px-3 py-2.5"><p className="truncate text-[11.5px] font-medium text-slate-500">{label}</p><p className="truncate text-[15px] font-semibold tabular-nums text-[#0b1f3a]">{value}</p>{sub && <p className="truncate text-[11.5px] text-slate-400">{sub}</p>}</div>
  );
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_20px_rgba(15,40,60,0.05)]"
      onTouchStart={(e) => { e.stopPropagation(); swipe.onTouchStart(e); }} onTouchEnd={(e) => { e.stopPropagation(); swipe.onTouchEnd(e); }}>
      {/* Pestañas */}
      <div className="grid grid-cols-3 gap-1 border-b border-slate-100 bg-slate-50/70 p-1.5" role="tablist">
        {HERO_TABS.map((h) => { const on = h.id === tab; return (
          <button key={h.id} type="button" role="tab" aria-selected={on} onClick={() => setTab(h.id)}
            className={`flex items-center justify-center gap-1.5 rounded-2xl py-2 text-[13.5px] font-semibold transition-all duration-200 active:scale-95 ${on ? "bg-white shadow-[0_2px_8px_rgba(15,40,60,0.10)]" : "text-slate-500"}`} style={on ? { color: h.color } : undefined}>
            <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: on ? h.soft : "transparent" }}>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d={h.icon} /></svg>
            </span>{tx(`tab_${h.id}` as never)}
          </button>
        ); })}
      </div>

      <div key={tab} className="px-4 pb-4 pt-4 animate-[bp-fade_0.25s_ease-out]">
        {tab !== "pending" ? (
          <>
            <p className="text-[13px] font-medium text-slate-500">{tab === "earned" ? tx("totalEarned", { year }) : tx("totalSpent", { year })}</p>
            <p className="mt-0.5 text-[34px] font-bold leading-none tracking-tight tabular-nums" style={{ color: T.color }}>{tab === "spent" && total > 0 ? "−" : ""}{$(total)}</p>
            {/* Por mes: se toca una barra para ver ese mes */}
            <div className="mt-4 flex items-center justify-between text-[12px]">
              <span className="font-semibold text-[#0b1f3a]">{months[sel]}: {$(series[sel] ?? 0)}</span>
              <span className="text-slate-400">{pick === null ? (series[best] > 0 ? tx("bestMonth") : tx("byMonth")) : tx("tapClear")}</span>
            </div>
            <div className="mt-2 flex h-24 items-end gap-1" data-noswipe>
              {series.map((v, i) => (
                <button key={i} type="button" onClick={() => setPick(pick === i ? null : i)} aria-label={`${months[i]}: ${$(v)}`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                  <span className="w-full rounded-md transition-[height] duration-700 ease-out" style={{ height: v > 0 ? `${grown ? Math.max(8, (v / max) * 100) : 0}%` : "3px", background: v > 0 ? (i === sel ? T.color : `${T.color}40`) : "#e8edf2", transitionDelay: `${i * 25}ms` }} />
                  <span className={`text-[8.5px] leading-none ${i === sel ? "font-bold text-[#0b1f3a]" : "text-slate-400"}`}>{(months[i] ?? "").slice(0, 3)}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {stat(tx("avgMonth"), $(avg), withData ? tx("monthsActive", { n: withData }) : tx("noActivity"))}
              {tab === "earned" ? stat(tx("invoicedYear"), $(st.ytdInvoiced), tx("sentCustomers"))
                : stat(tx("biggestCat"), st.expenseByCat[0] ? $(st.expenseByCat[0][1]) : "—", st.expenseByCat[0] ? fx.cat(st.expenseByCat[0][0]) : tx("nothingYet"))}
            </div>
            <button type="button" onClick={() => setDetail(detail === tab ? null : tab)} aria-expanded={detail === tab} className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl border border-slate-200 py-2 text-[13px] font-semibold text-[#0f766e] active:bg-[#f6fbfa]">
              {detail === tab ? tx("hide") : tab === "earned" ? tx("seePayments") : tx("seeWhere")}
            </button>
          </>
        ) : (
          <>
            <p className="text-[13px] font-medium text-slate-500">{tx("owe")}</p>
            <p className="mt-0.5 text-[34px] font-bold leading-none tracking-tight tabular-nums text-[#0b1f3a]">{$(st.total)}</p>
            <div className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-2 px-3 py-2.5"><span className="h-2 w-2 rounded-full bg-[#10b981]" /><span className="flex-1 text-[13.5px] text-slate-600">{tx("notDue")}</span><span className="text-[15px] font-semibold tabular-nums text-[#0b1f3a]">{$(st.current)}</span></div>
              <Link prefetch={false} href="/dashboard/invoices?view=overdue" className="flex items-center gap-2 px-3 py-2.5 active:bg-[#fff1f2]">
                <span className={`h-2 w-2 rounded-full ${st.overdue > 0 ? "bg-[#f43f5e]" : "bg-slate-300"}`} /><span className="flex-1 text-[13.5px] text-slate-600">{tx("overdue")}{st.overdue > 0 ? ` · ${tx("collectFirst")}` : ""}</span>
                <span className={`text-[15px] font-semibold tabular-nums ${st.overdue > 0 ? "text-[#e11d48]" : "text-[#0b1f3a]"}`}>{$(st.overdue)}</span>
                <svg viewBox="0 0 20 20" className="h-4 w-4 text-slate-300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.5 4.5 13 10l-5.5 5.5" /></svg>
              </Link>
              <div className="flex items-center gap-2 px-3 py-2.5"><span className="h-2 w-2 rounded-full bg-[#60a5fa]" /><span className="flex-1 text-[13.5px] text-slate-600">{tx("quotesWaiting")}</span><span className="text-[15px] font-semibold tabular-nums text-[#0b1f3a]">{$(st.quoteStats.openValue)}</span></div>
            </div>
            {owe && (
              <>
                <p className="mt-4 text-[13px] font-medium text-slate-500">{tx("youOwe")}</p>
                <Link prefetch={false} href="/dashboard/financing" className="mt-1.5 flex items-center gap-3 rounded-2xl border border-slate-100 px-3 py-2.5 active:bg-slate-50">
                  <span className="min-w-0 flex-1"><span className="block text-[20px] font-bold leading-tight tabular-nums text-[#0b1f3a]">{$(owe.total)}</span>
                    <span className="block truncate text-[12px] text-slate-500">{tx("oweLine", { amt: $(owe.monthly), n: owe.count })}{owe.nextDue ? ` · ${tx("next", { date: new Date(`${owe.nextDue}T12:00:00`).toLocaleDateString(fx.tag, { month: "short", day: "numeric" }).replace(".", "") })}` : ""}</span></span>
                  <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.5 4.5 13 10l-5.5 5.5" /></svg>
                </Link>
              </>
            )}
          </>
        )}
        {detail && detail !== "profit" && <HeroDetail st={st} detail={detail} onClose={() => setDetail(null)} />}
      </div>

      {/* Siempre a la vista: lo que quedó en el año */}
      <button type="button" onClick={() => setDetail(detail === "profit" ? null : "profit")} aria-expanded={detail === "profit"} className="flex w-full items-center gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-left active:bg-slate-100">
        <span className="flex-1 text-[13.5px] font-medium text-slate-600">{profit >= 0 ? tx("profitIn", { year }) : tx("lossIn", { year })} <span className="text-slate-400">· {tx("earnedMinus")}</span></span>
        <span className={`text-[17px] font-bold tabular-nums ${profit >= 0 ? "text-[#0f766e]" : "text-[#e11d48]"}`}>{profit < 0 ? "−" : ""}{$(Math.abs(profit))}</span>
        <svg viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 transition-transform duration-300 ${detail === "profit" ? "rotate-180 text-[#0f766e]" : "text-slate-300"}`} fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
      </button>
      {detail === "profit" && <div className="px-4 pb-4"><HeroDetail st={st} detail="profit" onClose={() => setDetail(null)} /></div>}
    </div>
  );
}

// Detalle dentro de la tarjeta: historial de cobros, gastos o ganancia por mes
function HeroDetail({ st, detail, onClose }: { st: MobileStats; detail: Exclude<Detail, null>; onClose: () => void }) {
  const { t: tx, fx, $, mon, fd } = useMw();
  const months = st.months.map(mon);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(false); const k = setTimeout(() => setMounted(true), 60); return () => clearTimeout(k); }, [detail]);
  const profitM = st.receipts.map((r, i) => r - st.expenses[i]);
  const series = detail === "earned" ? st.receipts : detail === "spent" ? st.expenses : profitM;
  const max = Math.max(1, ...series.map(Math.abs));
  const color = detail === "earned" ? "#10b981" : detail === "spent" ? "#f43f5e" : "#0f766e";
  const title = detail === "earned" ? tx("moneyReceived") : detail === "spent" ? tx("moneySpent") : tx("profitByMonth");
  const total = detail === "earned" ? st.ytdReceived : detail === "spent" ? st.ytdExpenses : st.ytdReceived - st.ytdExpenses;
  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <div className="flex items-end justify-between">
        <div><p className="text-[13px] text-slate-500">{title} · {new Date().getFullYear()}</p><p className={`text-[26px] font-bold leading-tight tabular-nums ${detail === "spent" || total < 0 ? "text-[#e11d48]" : "text-[#0b1f3a]"}`}>{detail === "spent" ? "-" : ""}{$(Math.abs(total))}</p></div>
        <p className="pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{tx("last12")}</p>
      </div>
      <div className="mt-3 flex h-28 items-end gap-1.5">
        {series.map((v, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[8px] font-semibold tabular-nums text-slate-500">{v ? short(v) : ""}</span>
            <div className="w-full rounded-t-md transition-all duration-700" style={{ height: mounted && v ? `${Math.max(4, (Math.abs(v) / max) * 78)}px` : "2px", background: v < 0 ? "#f43f5e" : color, opacity: v ? 1 : 0.2, transitionDelay: `${i * 30}ms` }} />
            <span className="text-[8px] text-slate-400">{months[i]}</span>
          </div>
        ))}
      </div>
      <div className="mt-4">
        {detail === "earned" && (
          <>
            <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-slate-400">{tx("recentPayments")}</p>
            {st.recentPayments.length === 0 && <p className="py-4 text-center text-sm text-slate-500">{tx("noPayments")}</p>}
            <ul className="divide-y divide-slate-100">
              {st.recentPayments.map((p, i) => (
                <li key={i} className="flex items-center gap-3 py-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ecfdf5] text-[#059669]"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-medium text-[#0b1f3a]">{p.customer || tx("payment")}</span><span className="text-[12px] text-slate-500">{fd(p.date)}{p.number ? ` · ${p.number}` : ""}{p.mode ? ` · ${fx.pay(p.mode)}` : ""}</span></span>
                  <span className="font-semibold tabular-nums text-[#059669]">+{$(p.amount)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {detail === "spent" && (
          <>
            {st.expenseByCat.length > 0 && <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-400">{tx("whereWent")}</p>}
            <ul className="mb-4 space-y-2">
              {st.expenseByCat.slice(0, 5).map(([n, v]) => (
                <li key={n}><div className="flex justify-between text-[13px]"><span className="text-slate-600">{fx.cat(n)}</span><span className="font-semibold tabular-nums text-[#e11d48]">-{$(v)}</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#fb7185] transition-all duration-700" style={{ width: mounted ? `${(v / (st.expenseByCat[0][1] || 1)) * 100}%` : "0%" }} /></div></li>
              ))}
            </ul>
            <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-slate-400">{tx("recentExpenses")}</p>
            {st.recentExpenses.length === 0 && <p className="py-4 text-center text-sm text-slate-500">{tx("noExpenses")}</p>}
            <ul className="divide-y divide-slate-100">
              {st.recentExpenses.map((e, i) => (
                <li key={i} className="flex items-center gap-3 py-2.5"><span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-medium text-[#0b1f3a]">{e.vendor || fx.cat(e.category)}</span><span className="text-[12px] text-slate-500">{fd(e.date)} · {fx.cat(e.category)}</span></span><span className="font-semibold tabular-nums text-[#e11d48]">-{$(e.amount)}</span></li>
              ))}
            </ul>
            <Link prefetch={false} href="/dashboard/expenses" className="mt-3 block rounded-xl border border-slate-200 py-2.5 text-center text-sm font-medium text-[#0f766e]">{tx("openExpenses")}</Link>
          </>
        )}
        {detail === "profit" && (
          <>
            <div className="mb-1 grid grid-cols-4 gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><span>{tx("month")}</span><span className="text-right">{tx("in")}</span><span className="text-right">{tx("out")}</span><span className="text-right">{tx("kept")}</span></div>
            <ul className="divide-y divide-slate-100">
              {months.map((m, i) => ({ m, i })).reverse().map(({ m, i }) => (
                <li key={i} className="grid grid-cols-4 gap-2 py-2 text-[13px]">
                  <span className="font-medium text-[#0b1f3a]">{m}</span>
                  <span className="text-right tabular-nums text-[#059669]">+{short(st.receipts[i])}</span>
                  <span className="text-right tabular-nums text-[#e11d48]">-{short(st.expenses[i])}</span>
                  <span className={`text-right font-semibold tabular-nums ${profitM[i] >= 0 ? "text-[#0b1f3a]" : "text-[#e11d48]"}`}>{profitM[i] < 0 ? "-" : ""}{short(Math.abs(profitM[i]))}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <button type="button" onClick={onClose} className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl bg-slate-50 py-2 text-[13px] font-medium text-slate-500 active:bg-slate-100">
        {tx("hideDetails")}
        <svg viewBox="0 0 20 20" className="h-4 w-4 rotate-180" fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
      </button>
    </div>
  );
}

// Cuentas por cobrar: su propia tarjeta, con barras que se tocan y explican
export function ReceivablesCard({ st, mounted }: { st: MobileStats; mounted: boolean }) {
  const { t: tx, $ } = useMw();
  const AGING = [0, 1, 2, 3, 4].map((k) => tx(`ag${k}` as never));
  const AGING_SHORT = [0, 1, 2, 3, 4].map((k) => tx(`ags${k}` as never));
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  const max = Math.max(1, ...st.aging);
  const i = sel ?? (st.aging.findIndex((v) => v > 0) >= 0 ? st.aging.findIndex((v) => v > 0) : 0);
  return (
    <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-left">
        <div>
          <p className="text-[15px] font-semibold text-[#0b1f3a]">{tx("owe")}</p>
          <p className="mt-0.5 text-[22px] font-bold tabular-nums text-[#0b1f3a]">{$(st.total)}</p>
        </div>
        <svg viewBox="0 0 20 20" className={`h-5 w-5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
      </button>
      <div className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-100">
        <div className="flex items-center gap-2 px-3 py-2.5"><span className="h-2 w-2 rounded-full bg-[#10b981]" /><span className="flex-1 text-[13.5px] text-slate-600">{tx("notDue")}</span><span className="text-[15px] font-semibold tabular-nums text-[#0b1f3a]">{$(st.current)}</span></div>
        <Link prefetch={false} href="/dashboard/invoices?view=overdue" className="flex items-center gap-2 px-3 py-2.5 active:bg-[#fff1f2]">
          <span className={`h-2 w-2 rounded-full ${st.overdue > 0 ? "bg-[#f43f5e]" : "bg-slate-300"}`} /><span className="flex-1 text-[13.5px] text-slate-600">{tx("overdue")}</span>
          <span className={`text-[15px] font-semibold tabular-nums ${st.overdue > 0 ? "text-[#e11d48]" : "text-[#0b1f3a]"}`}>{$(st.overdue)}</span>
          <svg viewBox="0 0 20 20" className="h-4 w-4 text-slate-300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.5 4.5 13 10l-5.5 5.5" /></svg>
        </Link>
      </div>
      {open && (
        <div className="mt-4 animate-[bp-fade_0.2s_ease-out]">
          <p className="mb-2 text-[13px] font-semibold text-[#0b1f3a]">{tx("byDays")}</p>
          <div className="mb-3 rounded-xl bg-slate-50 px-3 py-2 text-[13px] text-slate-600">
            <b className="text-[#0b1f3a]">{AGING[i]}:</b> {tx("invoices", { n: st.agingCount[i] })} · {$(st.aging[i])}
            <span className="block text-[12px] text-slate-500">{i === 0 ? tx("agNote0") : i <= 2 ? tx("agNote1") : tx("agNote2")}</span>
          </div>
          <div className="flex h-28 items-end gap-3 border-b border-slate-100 pb-1">
            {AGING.map((l, k) => (
              <button key={k} type="button" aria-label={l} onClick={() => setSel(k)} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] font-semibold tabular-nums text-slate-500">{st.aging[k] ? short(st.aging[k]) : ""}</span>
                <span className={`w-full max-w-[34px] rounded-t-md transition-all duration-700 ${k === 0 ? "bg-[#34d399]" : k <= 2 ? "bg-[#fbbf24]" : "bg-[#f87171]"} ${i === k ? "ring-2 ring-offset-2 ring-[#0f766e]/40" : "opacity-80"}`}
                  style={{ height: mounted && st.aging[k] ? `${Math.max(6, (st.aging[k] / max) * 80)}px` : "3px", transitionDelay: `${k * 80}ms` }} />
              </button>
            ))}
          </div>
          <div className="mt-1 flex gap-3">{AGING_SHORT.map((l, k) => <span key={k} className={`flex-1 text-center text-[9px] ${i === k ? "font-semibold text-[#0f766e]" : "text-slate-400"}`}>{l}</span>)}</div>
        </div>
      )}
    </div>
  );
}

// Barras de ingresos y gastos que se tocan: ejes, montos y por qué subió o bajó
export function MoneyChart({ st, mounted }: { st: MobileStats; mounted: boolean }) {
  const { t: tx, mon } = useMw();
  const months = st.months.map(mon);
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
  const why = st.receipts[i] === 0 && st.expenses[i] === 0 ? tx("whyNone")
    : change === null ? tx("whyFirst", { amt: short(st.receipts[i]) })
      : `${tx("whyChange", { up: change >= 0 ? "yes" : "no", pct: Math.abs(Math.round(change * 100)), month: months[i - 1], from: short(prev), to: short(st.receipts[i]) })}${st.expenses[i] > st.receipts[i] ? ` ${tx("whyMore")}` : ""}`;
  return (
    <div>
      <div className="mb-2 rounded-2xl bg-slate-50 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-[#0b1f3a]">{months[i]}{i === n - 1 ? ` · ${tx("thisMonth")}` : ""}</p>
          <p className={`text-[13px] font-bold tabular-nums ${profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>{tx("profit")} {profit >= 0 ? "+" : "-"}{short(Math.abs(profit))}</p>
        </div>
        <div className="mt-1.5 grid grid-cols-3 gap-1 text-[11px]">
          <p><span className="text-blue-600">{tx("invoiced")}</span><br /><b className="text-[13px] tabular-nums text-[#0b1f3a]">{short(st.income[i])}</b></p>
          <p><span className="text-teal-600">{tx("received")}</span><br /><b className="text-[13px] tabular-nums text-[#0b1f3a]">{short(st.receipts[i])}</b></p>
          <p><span className="text-orange-500">{tx("spent")}</span><br /><b className="text-[13px] tabular-nums text-[#0b1f3a]">{short(st.expenses[i])}</b></p>
        </div>
        <p className="mt-1.5 text-[12px] text-slate-500">{why}</p>
      </div>
      <svg data-noswipe viewBox={`0 0 ${W} ${H}`} className="w-full touch-none select-none" role="img" aria-label={tx("chartAria")}>
        {[0, max / 2, max].map((v) => (
          <g key={v}>
            <line x1={L} x2={W} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeDasharray={v ? "3 3" : undefined} />
            <text x={L - 5} y={y(v) + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{short(v)}</text>
          </g>
        ))}
        {months.map((m, k) => {
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
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#3b82f6]" />{tx("invoiced")}</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#14b8a6]" />{tx("received")}</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#f97316]" />{tx("spent")}</span>
      </div>
      <p className="mt-1 text-center text-[11px] text-slate-400">{tx("tapMonth")}</p>
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
  const { t: tx, fx } = useMw();
  const ti = useTranslations("insights");
  const L: InsightL = { t: ti as unknown as InsightL["t"], $: fx.money0, cat: fx.cat };
  const list = buildInsights(st, L);
  const [idx, setIdx] = useState(0);
  const shown = compact ? list.slice(0, 3) : list;
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${neutral ? "bg-slate-100 text-[#0f766e]" : "bg-gradient-to-br from-[#fff3e8] to-[#e9f7f4] text-[#e8713a]"}`}>
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></svg>
        </span>
        <div><p className="text-[15px] font-semibold text-[#0b1f3a]">{tx("insTitle")}</p><p className="text-[11px] text-slate-400">{tx("insSub")}</p></div>
      </div>
      <div className="space-y-2">
        {shown.length === 0 && <p className="rounded-2xl bg-slate-50 px-3 py-3 text-[13px] text-slate-500">{tx("insEmpty")}</p>}
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
                  {x.href && <Link prefetch={false} href={x.href} className={`mt-1.5 inline-block text-[13px] font-semibold ${neutral ? "pl-[34px] text-[#0f766e]" : `pl-6 ${fg}`}`}>{x.cta} →</Link>}
                </div>
              )}
            </button>
          );
        })}
      </div>
      {tip && <div className="mt-3 rounded-2xl border border-dashed border-[#bfe7de] bg-[#f6fbfa] px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0f766e]">{tx("tipTitle")}</p>
        <p className="mt-0.5 text-[13px] text-slate-600">{tipOfTheDay(L.t)}</p>
      </div>}
    </div>
  );
}
