"use client";

import FinanceOverview from "@/components/dashboard/FinanceOverview";
import type { MobileStats } from "@/lib/dashboard-server";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import CompanyBadge from "@/components/CompanyBadge";
import PeriodSelect from "@/components/dashboard/PeriodSelect";
import { BarChart, Donut, LineChart, Series, autoEvery } from "@/components/dashboard/charts";
import {
  AGING, DEFAULT_PERIOD, DashboardData, EMPTY_DATA, MONTHS, Period, Range, SubEvent,
  agingOf, bucketsOf, countBy, demoData, lastYear, periodRange, snapshotBy, subStats, sumBy, sumIn, topExpenses, yoy,
} from "@/lib/dashboard-data";

// Dashboard SOLO para computadora (1024 px o más). El de celular sigue en Dashboard.tsx, sin cambios.

// Pon aquí tu número de soporte cuando lo tengas, ej. "+1 (469) 555-0123". Vacío = enlace al Help center
const SUPPORT_PHONE: string = "";

const C = { teal: "#14a39a", tealDark: "#0f766e", orange: "#e8713a", amber: "#e8a94e", blue: "#3b82f6", violet: "#8b5cf6" };
const EXPENSE_COLORS = [C.teal, C.blue, C.amber, C.violet, C.orange, "#94a3b8"];
const SUB_TYPES: { type: SubEvent["type"]; label: string; color: string }[] = [
  { type: "signup", label: "Signups", color: C.teal },
  { type: "activation", label: "Activations", color: C.blue },
  { type: "cancellation", label: "Cancellations", color: C.orange },
  { type: "reactivation", label: "Reactivations", color: C.violet },
];
const OPS = [
  { label: "Jobs today", icon: "M9 6V4h6v2M4 6h16v13H4zM4 12h16" },
  { label: "Technicians on the road", icon: "M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" },
  { label: "Items low on stock", icon: "M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8" },
  { label: "Unread messages", icon: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z" },
];
const FOOTER_SOON = ["Payments", "Jobs", "Dispatch", "Van inventory"];

const TABS = ["Dashboard", "Announcements", "Help"] as const;
type Tab = (typeof TABS)[number];
type CardKey = "rev" | "mrr" | "active" | "arpu" | "churn" | "ltv" | "subsum" | "inc" | "exp";

export default function DesktopDashboard({ firstName, companyId, companyName, companyIndex, demo = false, real = null, stats = null }: {
  firstName: string; companyId: string; companyName: string; companyIndex: number; demo?: boolean; real?: DashboardData | null; stats?: MobileStats | null;
}) {
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [now, setNow] = useState<Date | null>(null);
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  const [own, setOwn] = useState<Partial<Record<CardKey, Period>>>({}); // periodo propio de cada tarjeta
  useEffect(() => setNow(new Date()), []);

  const data = useMemo(() => (now && demo ? demoData(now) : real ?? EMPTY_DATA), [now, demo, real]);
  const money = useMemo(() => {
    const f = new Intl.NumberFormat("en-US", { style: "currency", currency: data.currency });
    return (v: number) => f.format(v);
  }, [data.currency]);

  const per = (k: CardKey) => own[k] ?? period;
  const pick = (k: CardKey) => (p: Period) => setOwn((o) => ({ ...o, [k]: p }));
  const go = (t: Tab) => { setTab(t); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <div className="min-h-full bg-white">
      {/* Saludo + pestañas. Al bajar, el saludo se esconde y las pestañas se quedan arriba */}
      <div className="sticky -top-8 z-10 border-b border-slate-200 bg-[#fcfdfd]">
        <HeaderPattern />
        <div className="relative flex h-24 items-center justify-between gap-6 px-8">
          <div className="flex min-w-0 items-center gap-4">
            <span className="rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_1px_2px_rgba(15,40,60,0.06)]">
              <CompanyBadge id={companyId} name={companyName} index={companyIndex} size={44} />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-[22px] font-semibold leading-tight text-[#0b1f3a]">Hello, {firstName}</h1>
              <p className="mt-0.5 truncate text-[15px] text-slate-600">{companyName}</p>
            </div>
          </div>
          <Support onHelp={() => go("Help")} />
        </div>
        <div role="tablist" aria-label="Dashboard sections" className="relative flex h-12 items-end gap-8 px-8">
          {TABS.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`relative pb-3 text-[16px] font-medium transition-colors ${tab === t ? "text-[#0b1f3a]" : "text-slate-500 hover:text-[#0b1f3a]"}`}>
              {t}
              {tab === t && <span className="absolute inset-x-0 -bottom-px h-[3px] rounded-full bg-[#0f766e]" />}
            </button>
          ))}
        </div>
      </div>

      {tab === "Dashboard" ? (
        <div className="px-8 pb-4 pt-6">
          {demo && (
            <div className="mb-5 flex max-w-[1600px] items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
              <span>You’re viewing sample data. These numbers are examples, not your business.</span>
              <Link prefetch={false} href="/dashboard" className="shrink-0 font-semibold underline-offset-2 hover:underline">Exit sample data</Link>
            </div>
          )}
          <div className="inline-flex items-stretch rounded-lg border border-slate-200 bg-white">
            <span className="flex items-center rounded-l-lg border-r border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-600">Date Range</span>
            <PeriodSelect variant="field" value={period} ariaLabel="Date range for every card"
              onChange={(p) => { setPeriod(p); setOwn({}); }} />
          </div>
          {/* Resumen de finanzas: lo que entra, lo que sale, lo que te queda y consejos */}
          {stats && !demo && <div className="mt-6 max-w-[1600px] animate-[bp-fade_0.4s_ease-out]"><FinanceOverview st={stats} /></div>}
          {now ? (
            <Cards now={now} data={data} money={money} per={per} pick={pick} />
          ) : (
            <div className="mt-6 grid max-w-[1600px] grid-cols-1 gap-6 xl:grid-cols-2" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-[480px] rounded-xl border border-slate-200 bg-slate-50/80" />)}
            </div>
          )}
        </div>
      ) : tab === "Announcements" ? (
        <EmptyTab title="No announcements yet" text="Product updates and tips will appear here." />
      ) : (
        <EmptyTab title="Need help?" text="Documentation and support channels are coming soon." />
      )}

      <Footer onTab={go} />
    </div>
  );
}

/* ═══ Tarjetas ═══ */
function Cards({ now, data, money, per, pick }: {
  now: Date;
  data: DashboardData;
  money: (v: number) => string;
  per: (k: CardKey) => Period;
  pick: (k: CardKey) => (p: Period) => void;
}) {
  const view = (k: CardKey) => { const r = periodRange(per(k), now); return { key: per(k), r, prev: lastYear(r), x: bucketsOf(r) }; };
  const count = (n: number) => Math.round(n).toLocaleString("en-US");
  const pct = (n: number) => `${n.toFixed(2)}%`;
  const asOf = (d: Date) => `On ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  const sum = (a: number[]) => a.reduce((s, v) => s + (v || 0), 0);
  const hasSubs = data.mrr.length > 0 || data.activeSubs.length > 0;

  // Net Revenue = lo cobrado menos reembolsos
  const rev = view("rev");
  const net = (r: Range) => sumIn(data.payments, r) - sumIn(data.refunds, r);
  const refunds = sumBy(data.refunds, rev.x, rev.r);
  const revSeries: Series[] = [{ key: "rev", label: "Net revenue", color: C.teal, values: sumBy(data.payments, rev.x, rev.r).map((v, i) => Math.max(0, v - refunds[i])) }];

  // Receivables por días de atraso (siempre al día de hoy)
  const aging = agingOf(data.openInvoices, now);
  const recvTotal = sum(aging);

  const stat = (k: CardKey) => { const v = view(k); return { ...v, cur: subStats(data, v.r, now), old: subStats(data, v.prev, now) }; };
  const mrr = stat("mrr"), act = stat("active"), arpu = stat("arpu"), churn = stat("churn"), ltv = stat("ltv");

  const ss = view("subsum");
  const subSeries: Series[] = SUB_TYPES.map((s) => ({ key: s.type, label: s.label, color: s.color, values: countBy(data.subEvents, s.type, ss.x, ss.r) }));

  const inc = view("inc");
  const incSeries: Series[] = [
    { key: "inc", label: "Income", color: C.blue, values: sumBy(data.invoices, inc.x, inc.r) },
    { key: "rec", label: "Receipts", color: C.teal, values: sumBy(data.payments, inc.x, inc.r) },
    { key: "exp", label: "Expenses", color: C.amber, values: sumBy(data.expenses, inc.x, inc.r) },
  ];

  const ex = view("exp");
  const top = topExpenses(data.expenses, ex.r);

  return (
    <div className="mt-6 max-w-[1600px] animate-[bp-fade_0.45s_ease-out] space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Net Revenue" period={rev.key} onPeriod={pick("rev")}>
          <Stat value={money(net(rev.r))} change={yoy(net(rev.r), net(rev.prev))} />
          <BarChart x={rev.x} series={revSeries} format={money} label="Net revenue" animKey={rev.key} />
        </Card>
        <Card title="Receivable Summary">
          <div className="flex h-[88px] items-start justify-between gap-6">
            <div>
              <p className="text-[15px] text-slate-500">Total Receivables</p>
              <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight tabular-nums text-[#0b1f3a]">{money(recvTotal)}</p>
            </div>
            <dl className="grid grid-cols-[auto_auto] items-center gap-x-4 gap-y-2.5 text-[15px]">
              <dt className="flex items-center gap-2 text-slate-600"><Swatch c={C.teal} />Current</dt>
              <dd className="text-right font-semibold tabular-nums text-[#0b1f3a]">{money(aging[0])}</dd>
              <dt className="flex items-center gap-2 text-slate-600"><Swatch c={C.amber} />Overdue</dt>
              <dd className="text-right font-semibold tabular-nums text-[#0b1f3a]">{money(recvTotal - aging[0])}</dd>
            </dl>
          </div>
          <BarChart x={AGING} wide every={1} format={money} label="Receivables by days overdue"
            series={[{ key: "aging", label: "Balance", color: C.amber, colors: [C.teal, C.amber, C.amber, C.amber, C.amber], values: aging }]} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="MRR" period={mrr.key} onPeriod={pick("mrr")}>
          <Stat value={money(mrr.cur.mrr)} change={yoy(mrr.cur.mrr, mrr.old.mrr)} />
          <LineChart x={mrr.x} area format={money} label="Monthly recurring revenue" animKey={mrr.key}
            series={[{ key: "mrr", label: "MRR", color: C.tealDark, values: snapshotBy(data.mrr, mrr.x, now) }]} />
        </Card>
        <div className="grid grid-cols-2 grid-rows-2 gap-6">
          <Mini title="Active Subscriptions" period={act.key} onPeriod={pick("active")} has={hasSubs}
            value={count(act.cur.active)} change={yoy(act.cur.active, act.old.active)} last={count(act.old.active)} />
          <Mini title="ARPU" period={arpu.key} onPeriod={pick("arpu")} has={hasSubs}
            value={money(arpu.cur.arpu)} change={yoy(arpu.cur.arpu, arpu.old.arpu)} last={money(arpu.old.arpu)} />
          <Mini title="Churn Rate" period={churn.key} onPeriod={pick("churn")} has={hasSubs} note={asOf(churn.cur.at)}
            value={pct(churn.cur.churn)} change={yoy(churn.cur.churn, churn.old.churn)} last={pct(churn.old.churn)} />
          <Mini title="LTV" period={ltv.key} onPeriod={pick("ltv")} has={hasSubs} note={asOf(ltv.cur.at)}
            value={money(ltv.cur.ltv)} change={yoy(ltv.cur.ltv, ltv.old.ltv)} last={money(ltv.old.ltv)} />
        </div>
      </div>

      <Card title="Subscription Summary" period={ss.key} onPeriod={pick("subsum")}>
        <Legend items={subSeries.map((s) => ({ label: s.label, color: s.color, value: count(sum(s.values)) }))} />
        <LineChart x={ss.x} series={subSeries} format={count} integer emptyText={null} animKey={ss.key}
          label="Signups, activations, cancellations and reactivations" />
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Income and Expense" period={inc.key} onPeriod={pick("inc")}>
          <Legend items={incSeries.map((s) => ({ label: `Total ${s.label}`, color: s.color, value: money(sum(s.values)) }))} />
          <BarChart x={inc.x} series={incSeries} format={money} every={autoEvery(inc.x.length, true)} animKey={inc.key}
            label="Income, receipts and expenses" />
        </Card>
        <Card title="Top Expenses" period={ex.key} onPeriod={pick("exp")} bodyClass="flex items-center justify-center p-6">
          {top.length > 0
            ? <Donut items={top} colors={EXPENSE_COLORS} format={money} label="Top expenses by category" />
            : <p className="text-[15px] text-slate-500">No expenses recorded for {ex.key.toLowerCase()}</p>}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Projects" bodyClass="flex min-h-[300px] flex-col items-center justify-center p-6 text-center">
          <p className="text-[15px] font-medium text-[#0b1f3a]">Add projects to this watchlist</p>
          <p className="mt-1.5 text-sm text-slate-500">Projects arrive with Jobs and Time tracking.</p>
        </Card>
        {/* Resumen de la operación: cada módulo tendrá además su propio dashboard */}
        <Card title="Operations" right={<SoonPill />}>
          <div className="grid grid-cols-2 gap-3">
            {OPS.map((o) => (
              <div key={o.label} className="rounded-lg border border-slate-100 bg-slate-50/70 p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e9f7f4] text-[#0f766e]"><Icon d={o.icon} /></span>
                <p className="mt-3 text-[22px] font-semibold leading-none text-slate-300">—</p>
                <p className="mt-1.5 text-sm text-slate-600">{o.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[13px] leading-relaxed text-slate-500">Today’s numbers from Jobs, Dispatch, Van inventory and Messages appear here as each module launches.</p>
        </Card>
      </div>
    </div>
  );
}

/* ═══ Piezas ═══ */
function Card({ title, period, onPeriod, right, children, bodyClass = "p-6", mini = false }: {
  title: string;
  period?: Period;
  onPeriod?: (p: Period) => void;
  right?: React.ReactNode;
  children: React.ReactNode;
  bodyClass?: string;
  mini?: boolean;
}) {
  return (
    <section className={`flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white ${mini ? "bp-mini" : ""}`}>
      <header className={`flex min-h-[56px] shrink-0 gap-x-3 gap-y-0.5 rounded-t-xl border-b border-slate-200 bg-[#f8fafb] px-5 py-2 ${mini ? "bp-mini-head" : "items-center justify-between"}`}>
        <h2 className="text-[15px] font-semibold text-[#0b1f3a]">{title}</h2>
        {period && onPeriod ? <PeriodSelect value={period} onChange={onPeriod} ariaLabel={`${title} period`} /> : right}
      </header>
      <div className={`flex-1 ${bodyClass}`}>{children}</div>
    </section>
  );
}

function Mini({ title, period, onPeriod, value, note, change, has, last }: {
  title: string; period: Period; onPeriod: (p: Period) => void; value: string; note?: string; change: number; has: boolean; last: string;
}) {
  return (
    <Card mini title={title} period={period} onPeriod={onPeriod} bodyClass="flex flex-col p-5">
      <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="text-[26px] font-semibold leading-none tracking-tight tabular-nums text-[#0b1f3a]">{value}</span>
        {note && <span className="text-sm text-slate-500">{note}</span>}
      </p>
      <p className="mt-3.5 flex items-center gap-2 text-sm text-slate-500"><Change v={change} />Year on Year</p>
      <p className="mt-auto pt-4 text-center text-[13px] text-slate-500">{has ? `Same period last year: ${last}` : "No data found."}</p>
    </Card>
  );
}

function Stat({ value, change }: { value: string; change: number }) {
  return (
    <div className="h-[88px]">
      <p className="text-[28px] font-semibold leading-none tracking-tight tabular-nums text-[#0b1f3a]">{value}</p>
      <p className="mt-3.5 flex items-center gap-2 text-sm text-slate-500"><Change v={change} />Year on Year</p>
    </div>
  );
}

function Change({ v }: { v: number }) {
  const r = Math.round(v);
  const tone = r > 0 ? "bg-emerald-50 text-emerald-700" : r < 0 ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500";
  return <span className={`rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${tone}`}>{r > 0 ? "+" : r < 0 ? "−" : ""}{Math.abs(r)}%</span>;
}

function Legend({ items }: { items: { label: string; color: string; value: string }[] }) {
  return (
    <div className="mb-6 flex flex-wrap gap-x-12 gap-y-4">
      {items.map((it) => (
        <div key={it.label}>
          <p className="flex items-center gap-2 text-[15px] text-slate-600"><Swatch c={it.color} />{it.label}</p>
          <p className="mt-2 text-[24px] font-semibold leading-none tabular-nums text-[#0b1f3a]">{it.value}</p>
        </div>
      ))}
    </div>
  );
}

const Swatch = ({ c }: { c: string }) => <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: c }} />;
const SoonPill = () => <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-400">Soon</span>;
const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

function EmptyTab({ title, text }: { title: string; text: string }) {
  return (
    <div className="px-8 py-24 text-center">
      <p className="text-lg font-semibold text-[#0b1f3a]">{title}</p>
      <p className="mt-1 text-[15px] text-slate-500">{text}</p>
    </div>
  );
}

function Support({ onHelp }: { onHelp: () => void }) {
  if (SUPPORT_PHONE) {
    return (
      <div className="shrink-0 text-right">
        <p className="text-[15px] text-slate-600">BrightPro Support: <a href={`tel:${SUPPORT_PHONE.replace(/[^\d+]/g, "")}`} className="font-semibold text-[#0b1f3a] hover:underline">{SUPPORT_PHONE}</a></p>
        <p className="mt-0.5 text-[13px] text-slate-400">Monday to Friday</p>
      </div>
    );
  }
  return (
    <div className="shrink-0 text-right">
      <p className="text-[15px] text-slate-600">Need a hand?</p>
      <button type="button" onClick={onHelp} className="mt-0.5 text-[15px] font-semibold text-[#0f766e] hover:underline">Visit the Help center</button>
    </div>
  );
}

// Fondo del encabezado: íconos de línea muy suaves (facturas, pagos, agenda, van, herramientas)
const PATTERN: [string, number, number, number][] = [
  ["M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6", 22, 14, -12],
  ["M3 7h18v10H3zM3 11h18M7 15h2", 96, 54, 8],
  ["M4 20V10M10 20V4M16 20v-7M22 20H2", 168, 12, -6],
  ["M4 5h16v15H4zM4 9h16M8 3v4M16 3v4", 236, 58, 10],
  ["M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", 306, 16, -8],
  ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6.5v11", 372, 56, 6],
  ["M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8 6.2 21l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.4 2.4-2.5-.6-.6-2.5z", 438, 14, 14],
  ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 12l2.5 2.5 4.5-5", 500, 54, -10],
];

function HeaderPattern() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <pattern id="bp-dash-pattern" width="560" height="96" patternUnits="userSpaceOnUse">
          {PATTERN.map(([d, x, y, r]) => (
            <path key={`${x}-${y}`} d={d} transform={`translate(${x} ${y}) rotate(${r} 12 12) scale(1.25)`}
              fill="none" stroke="#e3e9ee" strokeWidth="1.2" opacity="0.45" strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#bp-dash-pattern)" />
    </svg>
  );
}

/* ═══ Pie de página ═══ */
function Footer({ onTab }: { onTab: (t: Tab) => void }) {
  const link = "text-[15px] text-slate-600 hover:text-[#0f766e]";
  return (
    <footer className="mt-10 grid grid-cols-1 border-t border-slate-200 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="flex flex-col items-center px-8 py-12 text-center">
        <h2 className="text-lg font-semibold text-[#0b1f3a]">Manage your business on the move</h2>
        <p className="mt-2 max-w-md text-[15px] leading-relaxed text-slate-500">See what customers owe, follow today’s work and add customers right from your phone.</p>
        <div className="mt-8 flex items-end justify-center gap-12">
          <PhoneArt />
          <div className="flex flex-col items-center gap-3 pb-1">
            <Qr />
            <span className="text-sm font-medium text-slate-700">Scan to open on your phone</span>
          </div>
        </div>
      </div>
      <div className="flex flex-col bg-[#f8fafb] px-10 py-12">
        <div className="grid grid-cols-3 gap-8">
          <div>
            <h3 className="text-sm font-semibold text-[#0b1f3a]">BrightPro modules</h3>
            <ul className="mt-4 space-y-3">
              <li><Link prefetch={false} href="/dashboard/customers" className={link}>Customers</Link></li>
              {FOOTER_SOON.map((m) => <li key={m} className="flex items-center gap-2 text-[15px] text-slate-400">{m}<SoonPill /></li>)}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#0b1f3a]">Help &amp; support</h3>
            <ul className="mt-4 space-y-3">
              <li><button type="button" onClick={() => onTab("Help")} className={link}>Help center</button></li>
              <li><button type="button" onClick={() => onTab("Announcements")} className={link}>Announcements</button></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#0b1f3a]">Quick links</h3>
            <ul className="mt-4 space-y-3">
              <li><Link prefetch={false} href="/dashboard/customers/new" className={link}>New customer</Link></li>
              <li><Link prefetch={false} href="/dashboard/customers/import" className={link}>Import customers</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-slate-200 pt-6">
          {SUPPORT_PHONE && (
            <p className="mb-3 text-[15px] text-slate-600">Talk to us Monday to Friday: <a href={`tel:${SUPPORT_PHONE.replace(/[^\d+]/g, "")}`} className="font-semibold text-[#0b1f3a]">{SUPPORT_PHONE}</a></p>
          )}
          <p className="text-sm text-slate-400" suppressHydrationWarning>© {new Date().getFullYear()} BrightPro. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

function PhoneArt() {
  const bars: [number, number][] = [[24, 36], [42, 58], [60, 28], [78, 46], [96, 66], [114, 40]];
  return (
    <svg viewBox="0 0 150 260" className="h-56 w-auto" aria-hidden="true">
      <rect x="3" y="3" width="144" height="254" rx="24" fill="#fff" stroke="#0b1f3a" strokeWidth="5" />
      <rect x="55" y="12" width="40" height="8" rx="4" fill="#0b1f3a" />
      <rect x="16" y="32" width="118" height="58" rx="10" fill="#1a2744" />
      <rect x="26" y="44" width="46" height="5" rx="2.5" fill="#fff" opacity="0.55" />
      <rect x="26" y="56" width="72" height="11" rx="3" fill="#fff" />
      <rect x="26" y="75" width="30" height="5" rx="2.5" fill="#14a39a" />
      <rect x="62" y="75" width="30" height="5" rx="2.5" fill="#e8a94e" />
      {bars.map(([x, h], i) => <rect key={x} x={x} y={196 - h} width="12" height={h} rx="3" fill={i % 2 ? "#e8a94e" : "#14a39a"} />)}
      <line x1="16" y1="196" x2="134" y2="196" stroke="#e2e8f0" strokeWidth="2" />
      <rect x="16" y="210" width="118" height="32" rx="8" fill="#e9f7f4" />
      <rect x="28" y="222" width="52" height="8" rx="4" fill="#0f766e" opacity="0.7" />
    </svg>
  );
}

// QR que abre field-service-crm-seven.vercel.app (hay que regenerarlo cuando pongamos el dominio propio)
const QR = ["fed663f8", "825aca08", "baccd2e8", "ba7e72e8", "ba724ae8", "82fa4a08", "feaaabf8", "00310800", "a34b1928", "2c95db18", "7ab953e8", "1198b1c0", "2659bf08", "18e1db18", "6b47d088", "c413a500", "e3510b08", "3cc3bf38", "df1fbec8", "3891be80", "fa009fd0", "00d318e8", "fe9fca88", "8221b888", "ba369fd0", "ba41ace8", "bab51c98", "82369cc0", "fef98ac8"];

function Qr() {
  let d = "";
  QR.forEach((row, y) => {
    const bits = parseInt(row, 16);
    for (let x = 0; x < 29; x++) if ((bits >>> (31 - x)) & 1) d += `M${x} ${y}h1v1h-1z`;
  });
  return (
    <svg viewBox="-4 -4 37 37" className="h-32 w-32 rounded-lg border border-slate-200 bg-white" shapeRendering="crispEdges" role="img" aria-label="QR code that opens BrightPro on your phone">
      <path d={d} fill="#0b1f3a" />
    </svg>
  );
}
