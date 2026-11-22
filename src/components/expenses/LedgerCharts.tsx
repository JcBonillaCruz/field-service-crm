"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useFinTx } from "@/i18n/useFinTx";
import type { Entry, LedgerKind } from "@/components/expenses/ExpensesWorkspace";

// =====================================================================
// Money In / Expenses — SOLO escritorio.
// · LedgerTracker: "paletas" (línea + bolita) por día / semana / mes, la más alta resaltada.
// · LedgerGlance: resumen rápido con barritas de rayitas (entradas, promedio, el más grande).
// =====================================================================
const pad = (n: number) => String(n).padStart(2, "0");
const toD = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// Paso 6.2b: nombres de días y meses en el idioma de quien lo ve
const monOf = (d: Date, tag: string) => d.toLocaleDateString(tag, { month: "short" }).replace(".", "");
const whole = (v: number, tag = "en-US") => new Intl.NumberFormat(tag, { style: "currency", currency: "USD", maximumFractionDigits: v >= 100 ? 0 : 2 }).format(v || 0);
const short$ = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}K` : `$${Math.round(v)}`);

type Bucket = { from: string; to: string; label: string; long: string; value: number; count: number };
type Unit = "day" | "week" | "month" | "year";

function buildBuckets(rows: Entry[], from: string, to: string, tag: string): { unit: Unit; buckets: Bucket[] } {
  const es = tag.startsWith("es");
  let a = toD(from), b = toD(to);
  // "All time": la gráfica empieza en el mes del primer registro y termina en el último (no desde el año 2000)
  if (b.getTime() - a.getTime() > 400 * 86400000 && rows.length) {
    const ds = rows.map((r) => r.date).sort();
    const f = toD(ds[0]), l = toD(ds[ds.length - 1]);
    a = new Date(Math.max(a.getTime(), new Date(f.getFullYear(), f.getMonth(), 1).getTime()));
    b = new Date(Math.min(b.getTime(), new Date(l.getFullYear(), l.getMonth() + 1, 0).getTime()));
  }
  const days = Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
  const months = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() + 1;
  const out: Bucket[] = [];
  let unit: Unit;
  if (days <= 10) {
    unit = "day";
    for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1))
      out.push({ from: key(d), to: key(d), label: d.toLocaleDateString(tag, { weekday: "narrow" }).toUpperCase(), long: d.toLocaleDateString(tag, { weekday: "long", month: "short", day: "numeric" }), value: 0, count: 0 });
  } else if (days <= 62) {
    unit = "week";
    for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 7)) {
      const e = new Date(d); e.setDate(e.getDate() + 6); if (e > b) e.setTime(b.getTime());
      out.push({ from: key(d), to: key(e), label: `${d.getDate()}`, long: es ? `${d.getDate()}${e.getMonth() !== d.getMonth() ? " " + monOf(d, tag) : ""} – ${e.getDate()} ${monOf(e, tag)}` : `${monOf(d, tag)} ${d.getDate()} – ${e.getMonth() !== d.getMonth() ? monOf(e, tag) + " " : ""}${e.getDate()}`, value: 0, count: 0 });
    }
  } else if (months <= 24) {
    unit = "month";
    for (let d = new Date(a.getFullYear(), a.getMonth(), 1); d <= b; d.setMonth(d.getMonth() + 1)) {
      const e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      out.push({ from: key(d), to: key(e), label: monOf(d, tag).slice(0, 3), long: `${monOf(d, tag)} ${d.getFullYear()}`, value: 0, count: 0 });
    }
  } else {
    unit = "year";
    for (let y = a.getFullYear(); y <= b.getFullYear(); y++) out.push({ from: `${y}-01-01`, to: `${y}-12-31`, label: String(y).slice(2), long: String(y), value: 0, count: 0 });
  }
  rows.forEach((r) => { const k = out.find((x) => r.date >= x.from && r.date <= x.to); if (k) { k.value += Number(r.amount) || 0; k.count++; } });
  return { unit, buckets: out };
}

const THEME: Record<LedgerKind, { dot: string; soft: string; stick: string; iconBg: string; icon: string }> = {
  income: { dot: "#14a39a", soft: "#e9f7f4", stick: "#b8e4dc", iconBg: "#e9f7f4", icon: "M12 19V5M5 12l7-7 7 7" },
  expense: { dot: "#f43f5e", soft: "#fff1f2", stick: "#fbc7d0", iconBg: "#fff1f2", icon: "M12 5v14M5 12l7 7 7-7" },
};

export function LedgerTracker({ kind, rows, range, total, realTotal, color, sign, verb, title }: {
  kind: LedgerKind; rows: Entry[]; range: { from: string; to: string; label: string }; total: number; realTotal: number; color: string; sign: string; verb: string; title: string;
}) {
  const th = THEME[kind];
  const t = useTranslations("ledgerCharts");
  const fx = useFinTx();
  const money = fx.money;
  const { unit, buckets } = useMemo(() => buildBuckets(rows, range.from, range.to, fx.tag), [rows, range.from, range.to, fx.tag]);
  const max = Math.max(1, ...buckets.map((b) => b.value));
  const peak = buckets.reduce((p, b, i) => (b.value > buckets[p].value ? i : p), 0);
  const [hover, setHover] = useState<number | null>(null);
  const [grown, setGrown] = useState(false);
  useEffect(() => { setGrown(false); const t = setTimeout(() => setGrown(true), 80); return () => clearTimeout(t); }, [range.from, range.to, rows.length]);
  const hi = hover ?? peak;
  const used = buckets.filter((b) => b.count > 0).length;
  const avg = buckets.length ? realTotal / buckets.length : 0;
  const many = buckets.length > 14;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,40,60,0.05)]">
      <span className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full opacity-60 blur-3xl" style={{ background: th.soft }} />
      <div className="relative flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: th.iconBg, color }}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={th.icon} /></svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[22px] font-semibold tracking-tight text-[#0b1f3a]">{title}</p>
          <p className="text-[13px] text-slate-500">{t("sub", { verb, unit, range: range.label })}</p>
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-[minmax(0,230px)_minmax(0,1fr)] items-end gap-6">
        {/* Número grande */}
        <div className="pb-2">
          <p className="text-[42px] font-bold leading-none tracking-tight tabular-nums" style={{ color }}>{sign}{money(total)}</p>
          <p className="mt-2 text-[13px] leading-snug text-slate-500">{t("countIn", { n: rows.length, used, unit })}</p>
          <div className="mt-4 space-y-1.5 text-[12.5px]">
            <p className="flex justify-between gap-2"><span className="text-slate-500">{t("avgPer", { unit })}</span><span className="font-semibold tabular-nums text-[#0b1f3a]">{money(avg)}</span></p>
            <p className="flex justify-between gap-2"><span className="text-slate-500">{t("best", { unit })}</span><span className="truncate font-semibold text-[#0b1f3a]">{buckets[peak]?.value ? buckets[peak].long : "—"}</span></p>
          </div>
        </div>

        {/* Paletas */}
        <div className="relative h-[230px]" onMouseLeave={() => setHover(null)}>
          <div className="absolute inset-x-0 bottom-[44px] top-[34px] flex items-end justify-between gap-1">
            {buckets.map((b, i) => {
              const on = i === hi;
              const h = b.value > 0 ? Math.max(10, (b.value / max) * 100) : 4;
              return (
                <button key={b.from} type="button" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} aria-label={`${b.long}: ${money(b.value)}`}
                  className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end focus:outline-none">
                  {/* fondo de la columna resaltada */}
                  <span className={`absolute -bottom-[44px] top-[-34px] w-full max-w-[52px] rounded-full transition-all duration-200 ${on ? "bg-gradient-to-b from-transparent via-slate-50 to-slate-100 opacity-100" : "opacity-0"}`} />
                  {/* precio arriba */}
                  {on && (
                    <span className="absolute z-10 -translate-y-2 whitespace-nowrap rounded-full bg-[#0b1f3a] px-2.5 py-1 text-[12px] font-semibold text-white shadow-lg animate-[bp-pop-in_0.2s_ease-out]"
                      style={{ bottom: `calc(${grown ? h : 0}% + 14px)` }}>{money(b.value)}</span>
                  )}
                  {/* palito + bolita */}
                  <span className="relative flex w-full flex-col items-center transition-[height] duration-700 ease-[cubic-bezier(.2,.8,.2,1)]" style={{ height: `${grown ? h : 0}%`, transitionDelay: `${i * 35}ms` }}>
                    <span className={`h-3 w-3 shrink-0 rounded-full transition-all duration-200 ${on ? "scale-125" : "group-hover:scale-110"}`}
                      style={{ background: b.value > 0 ? (on ? color : th.dot) : "#cbd5e1", boxShadow: on ? `0 0 0 4px ${th.soft}, 0 4px 14px ${color}55` : undefined }} />
                    <span className="mt-1 w-[2px] flex-1 rounded-full transition-colors" style={{ background: on ? color : b.value > 0 ? th.stick : "#e2e8f0" }} />
                  </span>
                  {/* etiqueta abajo */}
                  <span className={`absolute -bottom-[42px] flex items-center justify-center rounded-full font-semibold transition-all duration-200 ${many ? "h-7 w-7 text-[10.5px]" : "h-9 w-9 text-[13px]"} ${on ? "bg-[#0b1f3a] text-white shadow-md" : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"}`}>
                    {b.label}
                  </span>
                </button>
              );
            })}
          </div>
          {hover !== null && <p className="pointer-events-none absolute right-0 top-0 text-[12px] font-medium text-slate-500 animate-[bp-fade_0.2s_ease-out]">{buckets[hover].long} · {t("entries", { n: buckets[hover].count })}</p>}
          {max > 1 && hover === null && <p className="pointer-events-none absolute right-0 top-0 text-[12px] text-slate-400">{t("top", { v: short$(max) })}</p>}
        </div>
      </div>
    </div>
  );
}

// Resumen rápido con barritas de rayitas (como "Proposal progress")
export function LedgerGlance({ kind, rows }: { kind: LedgerKind; rows: Entry[] }) {
  const amounts = rows.map((r) => Number(r.amount) || 0);
  const total = amounts.reduce((a, b) => a + b, 0);
  const largest = amounts.length ? Math.max(...amounts) : 0;
  const avg = amounts.length ? total / amounts.length : 0;
  const parties = new Set(rows.map((r) => (r.party || "").trim().toLowerCase()).filter(Boolean)).size;
  const [on, setOn] = useState(false);
  const t = useTranslations("ledgerCharts");
  const fx = useFinTx();
  useEffect(() => { setOn(false); const k = setTimeout(() => setOn(true), 120); return () => clearTimeout(k); }, [rows.length, total]);
  const TICKS = 14;
  const cols: { label: string; value: string; fill: number; color: string; tip: string }[] = [
    { label: t("entriesLabel"), value: String(rows.length), fill: Math.min(1, rows.length / TICKS), color: kind === "income" ? "#0f766e" : "#e11d48", tip: t("tipEntries") },
    { label: t("average"), value: whole(avg, fx.tag), fill: largest ? avg / largest : 0, color: "#e8713a", tip: t("tipAverage") },
    { label: t("largest"), value: whole(largest, fx.tag), fill: total ? largest / total : 0, color: "#0b1f3a", tip: t("tipLargest") },
  ];
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,40,60,0.05)]">
      <div className="flex items-center justify-between">
        <p className="text-[18px] font-semibold tracking-tight text-[#0b1f3a]">{t("glance")}</p>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11.5px] font-semibold text-slate-500">{t("parties", { n: parties, kind })}</span>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {cols.map((c, ci) => (
          <div key={c.label} title={c.tip} className="group border-l-2 pl-3 transition-transform duration-200 hover:-translate-y-0.5" style={{ borderColor: c.color }}>
            <p className="text-[12px] text-slate-500">{c.label}</p>
            <p className="mt-1 truncate text-[19px] font-bold tabular-nums tracking-tight text-[#0b1f3a]">{c.value}</p>
            <div className="mt-4 flex h-[70px] items-end justify-between">
              {Array.from({ length: TICKS }).map((_, i) => {
                const lit = i < Math.round(c.fill * TICKS);
                return (
                  <span key={i} className="w-[2px] rounded-full transition-all duration-500"
                    style={{ height: on ? "100%" : "0%", background: lit ? c.color : "#e2e8f0", opacity: lit ? 1 : 0.9, transitionDelay: `${ci * 120 + i * 25}ms` }} />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[12px] leading-snug text-slate-400">{t("glanceNote")}</p>
    </div>
  );
}

// =====================================================================
// CELULAR: tarjeta del total, parecida al tracker de escritorio pero hecha para el dedo.
// Toca una paleta y arriba te dice cuánto fue ese día / semana / mes.
// =====================================================================
export function LedgerMobileHero({ kind, rows, range, total, realTotal, color, sign, verb }: {
  kind: LedgerKind; rows: Entry[]; range: { from: string; to: string; label: string }; total: number; realTotal: number; color: string; sign: string; verb: string;
}) {
  const th = THEME[kind];
  const t = useTranslations("ledgerCharts");
  const fx = useFinTx();
  const money = fx.money;
  const { unit, buckets } = useMemo(() => buildBuckets(rows, range.from, range.to, fx.tag), [rows, range.from, range.to, fx.tag]);
  const max = Math.max(1, ...buckets.map((b) => b.value));
  const peak = buckets.reduce((p, b, i) => (b.value > buckets[p].value ? i : p), 0);
  const [sel, setSel] = useState<number | null>(null);
  const [grown, setGrown] = useState(false);
  useEffect(() => { setGrown(false); setSel(null); const t = setTimeout(() => setGrown(true), 120); return () => clearTimeout(t); }, [range.from, range.to, rows.length]);
  const hi = sel ?? peak;
  const amounts = rows.map((r) => Number(r.amount) || 0);
  const largest = amounts.length ? Math.max(...amounts) : 0;
  const avg = amounts.length ? realTotal / amounts.length : 0;
  const tight = buckets.length > 8;
  const b = buckets[hi];

  return (
    <div className="relative mt-4 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,40,60,0.07)] animate-[bp-pop-in_0.45s_cubic-bezier(.2,.8,.2,1)_both]">
      <span className="pointer-events-none absolute -right-14 -top-16 h-48 w-48 rounded-full opacity-80 blur-2xl animate-[bp-float_10s_ease-in-out_infinite]" style={{ background: th.soft }} />
      <span className="pointer-events-none absolute -left-10 bottom-10 h-28 w-28 rounded-full opacity-50 blur-2xl" style={{ background: th.soft }} />
      <div className="relative px-5 pt-5">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-[13.5px] font-medium text-slate-500">
            <span className="relative inline-flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: th.dot }} /><span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: th.dot }} /></span>
            {verb} · {range.label}
          </p>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-[0_4px_12px_rgba(15,40,60,0.08)]" style={{ color }}>
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={th.icon} /></svg>
          </span>
        </div>
        <p className="mt-1.5 text-[34px] font-bold leading-none tracking-tight tabular-nums" style={{ color }}>{sign}{money(total)}</p>

        {/* Lo que tocaste (o la mejor semana) */}
        <div key={hi} className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full bg-[#0b1f3a] py-1 pl-1 pr-3 text-[12.5px] text-white shadow-md animate-[bp-pop-in_0.25s_ease-out]">
          <span className="rounded-full bg-white/15 px-2 py-0.5 font-semibold">{sel === null ? t("best", { unit }) : b?.long}</span>
          <span className="truncate font-semibold tabular-nums">{money(b?.value ?? 0)}</span>
          {sel === null && b?.value ? <span className="truncate text-white/60">{b.long}</span> : <span className="shrink-0 text-white/60">{t("entries", { n: b?.count ?? 0 })}</span>}
        </div>

        {/* Barras que se tocan: una por semana (o día / mes), con su fecha abajo */}
        <div className="mt-4 flex h-[120px] items-end gap-1.5">
          {buckets.map((x, i) => {
            const on = i === hi;
            const h = x.value > 0 ? Math.max(10, (x.value / max) * 100) : 0;
            const lab = unit === "week" ? `${Number(x.from.slice(8))}–${Number(x.to.slice(8))}` : x.label;
            return (
              <button key={x.from} type="button" onClick={() => setSel(sel === i ? null : i)} aria-label={`${x.long}: ${money(x.value)}`} aria-pressed={on}
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5 active:scale-95">
                <span className="flex w-full flex-1 items-end justify-center">
                  <span className="w-full max-w-[34px] rounded-lg transition-[height,background-color] duration-700 ease-[cubic-bezier(.2,.8,.2,1)]"
                    style={{ height: x.value > 0 ? `${grown ? h : 0}%` : "4px", background: x.value > 0 ? (on ? color : th.stick) : "#e8edf2", transitionDelay: `${i * 40}ms` }} />
                </span>
                <span className={`w-full truncate text-center leading-none ${tight ? "text-[9.5px]" : "text-[11px]"} ${on ? "font-bold text-[#0b1f3a]" : "font-medium text-slate-400"}`}>{lab}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Resumen rápido */}
      <div className="relative mt-4 grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 bg-slate-50/60">
        {([[t("entriesLabel"), String(rows.length)], [t("average"), whole(avg, fx.tag)], [t("largest"), whole(largest, fx.tag)]] as const).map(([l, v], i) => (
          <div key={l} className="px-3 py-3 text-center animate-[bp-fade_0.4s_ease-out_both]" style={{ animationDelay: `${200 + i * 80}ms` }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{l}</p>
            <p className="mt-0.5 truncate text-[15px] font-bold tabular-nums text-[#0b1f3a]">{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
