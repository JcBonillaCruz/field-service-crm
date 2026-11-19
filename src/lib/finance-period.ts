// =====================================================================
// Periodos de Finances (Payroll y Reports) · Paso 5.10c
// Todo se maneja como días "YYYY-MM-DD" de la zona horaria de la compañía, para que el servidor (UTC)
// y el teléfono del dueño cuenten la misma semana y el mismo mes. El periodo va en la dirección: ?p=month&d=2026-11-01
// =====================================================================
export type FinPeriod = "week" | "2weeks" | "month" | "quarter" | "year";
export type FinRange = { period: FinPeriod; from: string; to: string; label: string; title: string; prev: string; next: string; isCurrent: boolean };

export const PAYROLL_PERIODS: { value: FinPeriod; label: string }[] = [
  { value: "week", label: "Weekly" }, { value: "2weeks", label: "Every 2 weeks" }, { value: "month", label: "Monthly" },
];
export const REPORT_PERIODS: { value: FinPeriod; label: string }[] = [
  { value: "week", label: "Weekly" }, { value: "month", label: "Monthly" }, { value: "quarter", label: "Quarterly" }, { value: "year", label: "Yearly" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const isIsoDay = (v: unknown): v is string => typeof v === "string" && ISO.test(v);
const utc = (day: string) => { const [y, m, d] = day.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const fmt = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
export const addDaysIso = (day: string, n: number) => { const d = utc(day); d.setUTCDate(d.getUTCDate() + n); return fmt(d); };
const ymd = (y: number, m: number, d: number) => fmt(new Date(Date.UTC(y, m, d)));
export const weekStartIso = (day: string, weekStartsOn = 0) => addDaysIso(day, -((utc(day).getUTCDay() - weekStartsOn + 7) % 7));
export const daysBetweenIso = (a: string, b: string) => Math.round((utc(b).getTime() - utc(a).getTime()) / 86400000);

// "Hoy" y el día de un instante, en la zona horaria de la compañía
export const safeTz = (...zones: (string | null | undefined)[]) => {
  for (const z of [...zones, "America/Chicago"]) { try { if (z) { new Intl.DateTimeFormat("en-US", { timeZone: z }); return z; } } catch { /* siguiente */ } }
  return "UTC";
};
export const dayKeyIn = (tz: string) => {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  return (d: Date | string) => f.format(typeof d === "string" ? new Date(d) : d);
};
// La medianoche de ese día en esa zona horaria, como instante exacto (para pedir tiempos y trabajos)
export function tzMidnight(day: string, tz: string): Date {
  const guess = new Date(`${day}T00:00:00Z`);
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(guess).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return new Date(guess.getTime() - (asUtc - guess.getTime()));
}

const dShort = (day: string, year = false) => utc(day).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", ...(year ? { year: "numeric" } : {}) });
export const spanLabel = (from: string, to: string) =>
  from === to ? dShort(from, true) : `${dShort(from, from.slice(0, 4) !== to.slice(0, 4))} – ${dShort(to, true)}`;

// Quincenas siempre alineadas igual (no dependen de por dónde se navegó): se cuentan desde una semana fija
const EPOCH = "2024-01-07"; // domingo
function twoWeekStart(day: string, weekStartsOn: number) {
  const ws = weekStartIso(day, weekStartsOn);
  const weeks = Math.floor(daysBetweenIso(weekStartIso(EPOCH, weekStartsOn), ws) / 7);
  return addDaysIso(ws, -(((weeks % 2) + 2) % 2) * 7);
}

export function finRange(period: FinPeriod, anchor: string, weekStartsOn: number, today: string): FinRange {
  const a = isIsoDay(anchor) ? anchor : today;
  const [y, m] = a.split("-").map(Number);
  let from: string, to: string, prev: string, next: string, title: string;
  if (period === "week" || period === "2weeks") {
    const len = period === "week" ? 7 : 14;
    from = period === "week" ? weekStartIso(a, weekStartsOn) : twoWeekStart(a, weekStartsOn);
    to = addDaysIso(from, len - 1); prev = addDaysIso(from, -len); next = addDaysIso(from, len);
    title = period === "week" ? "Week" : "2 weeks";
  } else if (period === "month") {
    from = ymd(y, m - 1, 1); to = ymd(y, m, 0); prev = ymd(y, m - 2, 1); next = ymd(y, m, 1);
    title = utc(from).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" });
  } else if (period === "quarter") {
    const q = Math.floor((m - 1) / 3);
    from = ymd(y, q * 3, 1); to = ymd(y, q * 3 + 3, 0); prev = ymd(y, q * 3 - 3, 1); next = ymd(y, q * 3 + 3, 1);
    title = `Q${q + 1} ${y}`;
  } else {
    from = `${y}-01-01`; to = `${y}-12-31`; prev = `${y - 1}-01-01`; next = `${y + 1}-01-01`; title = String(y);
  }
  const label = spanLabel(from, to);
  return { period, from, to, label, title: period === "week" || period === "2weeks" ? label : title, prev, next, isCurrent: today >= from && today <= to };
}

export const pickPeriod = (v: string | undefined, allowed: { value: FinPeriod }[], fallback: FinPeriod): FinPeriod =>
  (allowed.some((p) => p.value === v) ? v : fallback) as FinPeriod;

export const money = (v: number | null | undefined) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(v) || 0);
export const r2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;
