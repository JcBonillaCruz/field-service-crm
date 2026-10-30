"use client";

import { useEffect, useMemo, useState } from "react";
import { money } from "@/lib/sales";
import type { Entry, LedgerKind } from "@/components/expenses/ExpensesWorkspace";

// =====================================================================
// Money In / Expenses — SOLO escritorio.
// · LedgerTracker: "paletas" (línea + bolita) por día / semana / mes, la más alta resaltada.
// · LedgerGlance: resumen rápido con barritas de rayitas (entradas, promedio, el más grande).
// =====================================================================
const pad = (n: number) => String(n).padStart(2, "0");
const toD = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WD = ["S", "M", "T", "W", "T", "F", "S"];
const whole = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: v >= 100 ? 0 : 2 }).format(v || 0);
const short$ = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}K` : `$${Math.round(v)}`);

type Bucket = { from: string; to: string; label: string; long: string; value: number; count: number };
type Unit = "day" | "week" | "month" | "year";

function buildBuckets(rows: Entry[], from: string, to: string): { unit: Unit; buckets: Bucket[] } {
  const a = toD(from), b = toD(to);
  const days = Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
  const months = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() + 1;
  const out: Bucket[] = [];
  let unit: Unit;
  if (days <= 10) {
    unit = "day";
    for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1))
      out.push({ from: key(d), to: key(d), label: WD[d.getDay()], long: d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }), value: 0, count: 0 });
  } else if (days <= 62) {
    unit = "week";
    for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 7)) {
      const e = new Date(d); e.setDate(e.getDate() + 6); if (e > b) e.setTime(b.getTime());
      out.push({ from: key(d), to: key(e), label: `${d.getDate()}`, long: `${MON[d.getMonth()]} ${d.getDate()} – ${e.getMonth() !== d.getMonth() ? MON[e.getMonth()] + " " : ""}${e.getDate()}`, value: 0, count: 0 });
    }
  } else if (months <= 24) {
    unit = "month";
    for (let d = new Date(a.getFullYear(), a.getMonth(), 1); d <= b; d.setMonth(d.getMonth() + 1)) {
      const e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      out.push({ from: key(d), to: key(e), label: MON[d.getMonth()].slice(0, 3), long: `${MON[d.getMonth()]} ${d.getFullYear()}`, value: 0, count: 0 });
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
  const { unit, buckets } = useMemo(() => buildBuckets(rows, range.from, range.to), [rows, range.from, range.to]);
  const max = Math.max(1, ...buckets.map((b) => b.value));
  const peak = buckets.reduce((p, b, i) => (b.value > buckets[p].value ? i : p), 0);
  const [hover, setHover] = useState<number | null>(null);
  const [grown, setGrown] = useState(false);
  useEffect(() => { setGrown(false); const t = setTimeout(() => setGrown(true), 80); return () => clearTimeout(t); }, [range.from, range.to, rows.length]);
  const hi = hover ?? peak;
  const used = buckets.filter((b) => b.count > 0).length;
  const avg = buckets.length ? realTotal / buckets.length : 0;
  const per = unit === "day" ? "day" : unit;
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
          <p className="text-[13px] text-slate-500">{verb} by {per} · {range.label}. Hover a bar to see that {per}.</p>
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-[minmax(0,230px)_minmax(0,1fr)] items-end gap-6">
        {/* Número grande */}
        <div className="pb-2">
          <p className="text-[42px] font-bold leading-none tracking-tight tabular-nums" style={{ color }}>{sign}{money(total)}</p>
          <p className="mt-2 text-[13px] leading-snug text-slate-500">{rows.length} {rows.length === 1 ? "entry" : "entries"} in {used} {used === 1 ? per : `${per}s`}</p>
          <div className="mt-4 space-y-1.5 text-[12.5px]">
            <p className="flex justify-between gap-2"><span className="text-slate-500">Avg per {per}</span><span className="font-semibold tabular-nums text-[#0b1f3a]">{money(avg)}</span></p>
            <p className="flex justify-between gap-2"><span className="text-slate-500">Best {per}</span><span className="truncate font-semibold text-[#0b1f3a]">{buckets[peak]?.value ? buckets[peak].long : "—"}</span></p>
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
          {hover !== null && <p className="pointer-events-none absolute right-0 top-0 text-[12px] font-medium text-slate-500 animate-[bp-fade_0.2s_ease-out]">{buckets[hover].long} · {buckets[hover].count} {buckets[hover].count === 1 ? "entry" : "entries"}</p>}
          {max > 1 && hover === null && <p className="pointer-events-none absolute right-0 top-0 text-[12px] text-slate-400">Top: {short$(max)}</p>}
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
  useEffect(() => { setOn(false); const t = setTimeout(() => setOn(true), 120); return () => clearTimeout(t); }, [rows.length, total]);
  const TICKS = 14;
  const cols: { label: string; value: string; fill: number; color: string; tip: string }[] = [
    { label: "Entries", value: String(rows.length), fill: Math.min(1, rows.length / TICKS), color: kind === "income" ? "#0f766e" : "#e11d48", tip: "How many you recorded" },
    { label: "Average", value: whole(avg), fill: largest ? avg / largest : 0, color: "#e8713a", tip: "Average vs. the largest one" },
    { label: "Largest", value: whole(largest), fill: total ? largest / total : 0, color: "#0b1f3a", tip: "Share of the total" },
  ];
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,40,60,0.05)]">
      <div className="flex items-center justify-between">
        <p className="text-[18px] font-semibold tracking-tight text-[#0b1f3a]">At a glance</p>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11.5px] font-semibold text-slate-500">{parties} {kind === "income" ? (parties === 1 ? "payer" : "payers") : (parties === 1 ? "vendor" : "vendors")}</span>
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
      <p className="mt-4 text-[12px] leading-snug text-slate-400">Colored lines show each number compared to the period: count, average vs. largest, and largest vs. total.</p>
    </div>
  );
}
