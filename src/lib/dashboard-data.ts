// Cálculos del dashboard: periodos, agrupación por mes o día, métricas y datos de ejemplo (?demo=1)

export const PERIODS = [
  "Last 3 Months",
  "Last 12 Months",
  "This Month",
  "Previous Month",
  "This Quarter",
  "Previous Quarter",
  "This Year",
  "Previous Year",
] as const;
export type Period = (typeof PERIODS)[number];
export const DEFAULT_PERIOD: Period = "Last 12 Months";

export type Point = { date: string; amount: number }; // date: "YYYY-MM-DD"
export type Expense = Point & { category: string };
export type OpenInvoice = { due: string; balance: number };
export type SubEvent = { date: string; type: "signup" | "activation" | "cancellation" | "reactivation" };

// Cuando existan Facturas, Pagos, Gastos y Suscripciones, el servidor llena esto y el dashboard se actualiza solo
export type DashboardData = {
  currency: string;
  invoices: Point[];           // Income: lo facturado
  payments: Point[];           // Receipts: lo cobrado
  refunds: Point[];            // se resta del Net Revenue
  expenses: Expense[];
  openInvoices: OpenInvoice[]; // facturas con saldo pendiente (Receivables)
  mrr: Point[];                // foto mensual del MRR
  activeSubs: Point[];         // foto mensual de suscripciones activas
  subEvents: SubEvent[];
};

export const EMPTY_DATA: DashboardData = {
  currency: "USD", invoices: [], payments: [], refunds: [], expenses: [], openInvoices: [], mrr: [], activeSubs: [], subEvents: [],
};

export type Range = { start: Date; end: Date; gran: "day" | "month" };
export type Bucket = { start: Date; end: Date; label: string; sub: string; title: string };

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = 86400000;
const sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const eod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const som = (y: number, m: number) => new Date(y, m, 1);
const eom = (y: number, m: number) => new Date(y, m + 1, 0, 23, 59, 59, 999);
const ms = (s: string) => new Date(s.length === 10 ? `${s}T00:00:00` : s).getTime();
const inRange = (s: string, r: Range) => { const x = ms(s); return x >= r.start.getTime() && x <= r.end.getTime(); };

export function periodRange(p: Period, now: Date): Range {
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate(), q = m - (m % 3);
  if (p === "Last 3 Months") return { start: new Date(y, m - 3, d), end: eod(now), gran: "month" };
  if (p === "Last 12 Months") return { start: new Date(y - 1, m, d), end: eod(now), gran: "month" };
  if (p === "This Month") return { start: som(y, m), end: eom(y, m), gran: "day" };
  if (p === "Previous Month") return { start: som(y, m - 1), end: eom(y, m - 1), gran: "day" };
  if (p === "This Quarter") return { start: som(y, q), end: eom(y, q + 2), gran: "month" };
  if (p === "Previous Quarter") return { start: som(y, q - 3), end: eom(y, q - 1), gran: "month" };
  if (p === "This Year") return { start: som(y, 0), end: eom(y, 11), gran: "month" };
  return { start: som(y - 1, 0), end: eom(y - 1, 11), gran: "month" };
}

// El mismo periodo, un año antes (para "Year on Year")
export function lastYear(r: Range): Range {
  const back = (d: Date) => new Date(d.getFullYear() - 1, d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
  return { start: back(r.start), end: back(r.end), gran: r.gran };
}

export function bucketsOf(r: Range): Bucket[] {
  const out: Bucket[] = [];
  if (r.gran === "day") {
    for (let d = sod(r.start); d <= r.end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      out.push({ start: d, end: eod(d), label: String(d.getDate()), sub: MONTHS[d.getMonth()], title: `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` });
    }
    return out;
  }
  let y = r.start.getFullYear(), m = r.start.getMonth();
  while (som(y, m) <= r.end) {
    out.push({ start: som(y, m), end: eom(y, m), label: MONTHS[m], sub: String(y), title: `${MONTHS[m]} ${y}` });
    m += 1;
    if (m > 11) { m = 0; y += 1; }
  }
  return out;
}

export const sumIn = (pts: Point[], r: Range) => pts.reduce((a, p) => (inRange(p.date, r) ? a + p.amount : a), 0);

export function sumBy(pts: Point[], bs: Bucket[], r: Range): number[] {
  const out = bs.map(() => 0);
  for (const p of pts) {
    if (!inRange(p.date, r)) continue;
    const x = ms(p.date);
    const i = bs.findIndex((b) => x >= b.start.getTime() && x <= b.end.getTime());
    if (i >= 0) out[i] += p.amount;
  }
  return out;
}

export const countBy = (evs: SubEvent[], type: SubEvent["type"], bs: Bucket[], r: Range) =>
  sumBy(evs.filter((e) => e.type === type).map((e) => ({ date: e.date, amount: 1 })), bs, r);

// "Foto": último valor registrado en o antes de una fecha (MRR, suscripciones activas)
export function valueAt(pts: Point[], at: Date): number {
  let best = -Infinity, v = 0;
  for (const p of pts) {
    const x = ms(p.date);
    if (x <= at.getTime() && x > best) { best = x; v = p.amount; }
  }
  return v;
}

// Para gráficas de línea: los meses que todavía no llegan van vacíos (la línea se detiene)
export const snapshotBy = (pts: Point[], bs: Bucket[], now: Date) =>
  bs.map((b) => (b.start > now ? NaN : valueAt(pts, b.end < now ? b.end : now)));

export const AGING = [
  { label: "Current", title: "Current (not due yet)" },
  { label: "1–15", title: "1–15 days overdue" },
  { label: "16–30", title: "16–30 days overdue" },
  { label: "31–45", title: "31–45 days overdue" },
  { label: "> 45", title: "Over 45 days overdue" },
];

export function agingOf(inv: OpenInvoice[], now: Date): number[] {
  const out = [0, 0, 0, 0, 0];
  const today = sod(now).getTime();
  for (const i of inv) {
    const late = Math.floor((today - ms(i.due)) / DAY);
    out[late <= 0 ? 0 : late <= 15 ? 1 : late <= 30 ? 2 : late <= 45 ? 3 : 4] += i.balance;
  }
  return out;
}

export function topExpenses(ex: Expense[], r: Range) {
  const by: Record<string, number> = {};
  for (const e of ex) if (inRange(e.date, r)) by[e.category] = (by[e.category] ?? 0) + e.amount;
  const list = Object.keys(by).map((label) => ({ label, value: by[label] })).sort((a, b) => b.value - a.value);
  if (list.length <= 6) return list;
  return [...list.slice(0, 5), { label: "Other", value: list.slice(5).reduce((a, x) => a + x.value, 0) }];
}

export function subStats(d: DashboardData, r: Range, now: Date) {
  const at = r.end < now ? r.end : now;
  const mrr = valueAt(d.mrr, at), active = valueAt(d.activeSubs, at), startActive = valueAt(d.activeSubs, r.start);
  const cancels = d.subEvents.filter((e) => e.type === "cancellation" && inRange(e.date, r)).length;
  const churn = startActive > 0 ? (cancels / startActive) * 100 : 0;
  const months = Math.max(1, (at.getTime() - r.start.getTime()) / (30.44 * DAY));
  const arpu = active > 0 ? mrr / active : 0;
  const monthlyChurn = churn / 100 / months;
  return { mrr, active, arpu, churn, ltv: monthlyChurn > 0 ? arpu / monthlyChurn : 0, at };
}

export const yoy = (cur: number, prev: number) => (prev ? ((cur - prev) / Math.abs(prev)) * 100 : 0);

// Datos de ejemplo para ver las gráficas antes de tener facturas reales: /dashboard?demo=1
export function demoData(now: Date): DashboardData {
  let seed = 20261019;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const iso = (y: number, m: number, d: number) => {
    const t = new Date(y, m, d);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  };
  const cats = ["Parts & materials", "Fuel", "Vehicle maintenance", "Tools & equipment", "Advertising", "Insurance", "Software"];
  const out: DashboardData = { currency: "USD", invoices: [], payments: [], refunds: [], expenses: [], openInvoices: [], mrr: [], activeSubs: [], subEvents: [] };
  let subs = 8;
  for (let k = 26; k >= 0; k--) {
    const base = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const y = base.getFullYear(), m = base.getMonth();
    const last = k === 0 ? now.getDate() : new Date(y, m + 1, 0).getDate();
    const season = 1 + 0.5 * Math.sin(((m - 3) / 12) * 2 * Math.PI); // más trabajo en verano
    const jobs = Math.round((5 + rnd() * 5) * season * (last / 30));
    for (let j = 0; j < jobs; j++) {
      const day = 1 + Math.floor(rnd() * last);
      const amount = Math.round((150 + rnd() * 1250) / 5) * 5;
      out.invoices.push({ date: iso(y, m, day), amount });
      const age = Math.floor((now.getTime() - new Date(y, m, day).getTime()) / DAY);
      if (rnd() < 0.85 && age > 3) out.payments.push({ date: iso(y, m, Math.min(last, day + Math.floor(rnd() * 10))), amount });
      else if (age < 75) out.openInvoices.push({ due: iso(y, m, day + 15), balance: amount });
    }
    if (rnd() < 0.3) out.refunds.push({ date: iso(y, m, 1 + Math.floor(rnd() * last)), amount: Math.round(60 + rnd() * 200) });
    const nEx = 4 + Math.floor(rnd() * 5);
    for (let j = 0; j < nEx; j++) {
      const c = cats[Math.min(cats.length - 1, Math.floor(rnd() * rnd() * cats.length * 1.6))];
      out.expenses.push({ date: iso(y, m, 1 + Math.floor(rnd() * last)), amount: Math.round(40 + rnd() * 650), category: c });
    }
    const sign = 1 + Math.floor(rnd() * 4 * season), act = Math.max(0, sign - Math.floor(rnd() * 2));
    const cancel = Math.floor(rnd() * 2.4), react = rnd() < 0.25 ? 1 : 0;
    const ev = (n: number, type: SubEvent["type"]) => {
      for (let j = 0; j < n; j++) out.subEvents.push({ date: iso(y, m, 1 + Math.floor(rnd() * last)), type });
    };
    ev(sign, "signup"); ev(act, "activation"); ev(cancel, "cancellation"); ev(react, "reactivation");
    subs = Math.max(0, subs + act + react - cancel);
    out.activeSubs.push({ date: iso(y, m, last), amount: subs });
    out.mrr.push({ date: iso(y, m, last), amount: subs * 49 });
  }
  return out;
}
