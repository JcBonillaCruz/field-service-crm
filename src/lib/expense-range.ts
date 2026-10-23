// Rangos de fechas de Expenses. Se usan igual en el servidor (para filtrar en Supabase con gte/lte)
// y en el navegador (para armar el enlace con la fecha local de quien usa la app).
export type RangeKey = "month" | "3m" | "6m" | "year" | "custom";
export const RANGES: { key: RangeKey; label: string }[] = [
  { key: "month", label: "This month" },
  { key: "3m", label: "Last 3 months" },
  { key: "6m", label: "Last 6 months" },
  { key: "year", label: "This year" },
  { key: "custom", label: "Custom" },
];
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => { const t = new Date(y, m, d); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };
const isDate = (v?: string | null) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));

// "Hoy" en la zona horaria indicada (en el servidor usamos la del visitante que manda Vercel)
export function todayIn(timeZone?: string | null) {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: timeZone || undefined, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
  catch { const d = new Date(); return iso(d.getFullYear(), d.getMonth(), d.getDate()); }
}

export function resolveRange(key: string | undefined, today: string, from?: string, to?: string): { key: RangeKey; from: string; to: string; label: string } {
  const [y, m] = today.split("-").map(Number); const mi = m - 1;
  const k = (RANGES.some((r) => r.key === key) ? key : "month") as RangeKey;
  if (k === "custom" && isDate(from) && isDate(to)) {
    const [a, b] = from! <= to! ? [from!, to!] : [to!, from!];
    return { key: k, from: a, to: b, label: `${short(a)} – ${short(b)}` };
  }
  const endOfMonth = iso(y, mi + 1, 0);
  if (k === "3m") return { key: k, from: iso(y, mi - 2, 1), to: endOfMonth, label: "Last 3 months" };
  if (k === "6m") return { key: k, from: iso(y, mi - 5, 1), to: endOfMonth, label: "Last 6 months" };
  if (k === "year") return { key: k, from: `${y}-01-01`, to: `${y}-12-31`, label: "This year" };
  return { key: "month", from: iso(y, mi, 1), to: endOfMonth, label: "This month" };
}

export function short(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
