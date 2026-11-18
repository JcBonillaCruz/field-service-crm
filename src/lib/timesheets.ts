import { addDays, dayStart, isoDay, startOfMonth, startOfWeek } from "@/lib/jobs";

// =====================================================================
// Timesheets (Paso 5.7)
// Los tiempos se guardan solos en tech_time_entries desde el Paso 5.1:
//   shift   = entrada / salida del día (Clock in · Clock out)
//   travel  = traslado (On my way → Start)
//   on_site = en sitio (Start → Pause / Finish)
// Aquí solo se suman y se muestran. La oficina corrige con motivo (queda en tech_time_log).
// =====================================================================
export type TimeKind = "shift" | "travel" | "on_site";
export type TimeEntry = {
  id: string; user_id: string; kind: TimeKind; started_at: string; ended_at: string | null;
  job_id: string | null; job_number: string | null; customer_name: string | null; visit_no: number | null; note: string | null;
  is_manual: boolean; edited_by_name: string | null; edited_at: string | null;
  fix_reason: string | null; orig_started_at: string | null; orig_ended_at: string | null;
};
// Registro borrado por dueño/manager (sale tachado en la hoja, con quién y por qué)
export type RemovedTime = {
  id: string; entry_id: string | null; user_id: string; kind: TimeKind; old_started_at: string | null; old_ended_at: string | null;
  reason: string; actor_name: string | null; created_at: string;
};

export const KIND_META: Record<TimeKind, { label: string; short: string; color: string; soft: string }> = {
  shift: { label: "Work day", short: "Clocked", color: "#0f766e", soft: "#e9f7f4" },
  on_site: { label: "On site", short: "On site", color: "#d97706", soft: "#fff6e6" },
  travel: { label: "Travel", short: "Travel", color: "#6d28d9", soft: "#f3efff" },
};
export const KIND_OPTIONS = [
  { value: "shift", label: "Work day (clock in / clock out)" },
  { value: "on_site", label: "On site (working at a job)" },
  { value: "travel", label: "Travel (driving to a job)" },
];

// Un registro abierto por más de este tiempo casi seguro es un olvido (no marcó salida)
export const STALE_MIN: Record<TimeKind, number> = { shift: 16 * 60, on_site: 14 * 60, travel: 6 * 60 };
export const rawMinutes = (e: Pick<TimeEntry, "started_at" | "ended_at">, now: number) =>
  Math.max(0, ((e.ended_at ? new Date(e.ended_at).getTime() : now) - new Date(e.started_at).getTime()) / 60000);
export const isStale = (e: TimeEntry, now: number) => !e.ended_at && rawMinutes(e, now) > STALE_MIN[e.kind];
// Lo que cuenta para las horas: un olvido no suma (se corrige primero)
export const minutesOf = (e: TimeEntry, now: number) => (isStale(e, now) ? 0 : rawMinutes(e, now));

export type DaySum = {
  key: string; entries: TimeEntry[];
  shift: number; travel: number; site: number;
  worked: number;       // horas del día: entrada→salida; si no marcó entrada, traslado + en sitio
  other: number;        // tiempo del día que no fue ni traslado ni en sitio (taller, espera, comida)
  firstIn: string | null; lastOut: string | null;
  open: boolean; stale: boolean; edited: boolean; jobs: number;
};

export function sumDay(key: string, entries: TimeEntry[], now: number): DaySum {
  const list = [...entries].sort((a, b) => a.started_at.localeCompare(b.started_at));
  let shift = 0, travel = 0, site = 0;
  const jobs = new Set<string>();
  for (const e of list) {
    const m = minutesOf(e, now);
    if (e.kind === "shift") shift += m; else if (e.kind === "travel") travel += m; else site += m;
    if (e.job_id && e.kind === "on_site") jobs.add(e.job_id);
  }
  const shifts = list.filter((e) => e.kind === "shift");
  const span = shifts.length ? shifts : list;
  const open = span.some((e) => !e.ended_at);
  const worked = shifts.length ? shift : travel + site;
  return {
    key, entries: list, shift, travel, site, worked, other: Math.max(0, worked - travel - site),
    firstIn: span[0]?.started_at ?? null,
    lastOut: open || !span.length ? null : span.map((e) => e.ended_at as string).sort().at(-1) ?? null,
    open, stale: list.some((e) => isStale(e, now)), edited: list.some((e) => e.edited_at || e.is_manual), jobs: jobs.size,
  };
}

// Agrupa por día (el día en que EMPEZÓ el registro). keyOf decide la zona horaria: en pantalla la del navegador,
// en la exportación la de la compañía.
export function byDay(entries: TimeEntry[], now: number, keyOf: (iso: string) => string = (iso) => isoDay(new Date(iso))): Map<string, DaySum> {
  const groups = new Map<string, TimeEntry[]>();
  for (const e of entries) { const k = keyOf(e.started_at); groups.set(k, [...(groups.get(k) ?? []), e]); }
  return new Map(Array.from(groups, ([k, list]) => [k, sumDay(k, list, now)]));
}

export type Totals = { worked: number; shift: number; travel: number; site: number; other: number; days: number; jobs: number; open: boolean; stale: boolean; edited: boolean };
export function totalOf(days: DaySum[]): Totals {
  const t: Totals = { worked: 0, shift: 0, travel: 0, site: 0, other: 0, days: 0, jobs: 0, open: false, stale: false, edited: false };
  for (const d of days) {
    t.worked += d.worked; t.shift += d.shift; t.travel += d.travel; t.site += d.site; t.other += d.other; t.jobs += d.jobs;
    if (d.worked > 0 || d.entries.length) t.days += 1;
    t.open = t.open || d.open; t.stale = t.stale || d.stale; t.edited = t.edited || d.edited;
  }
  return t;
}

// 7h 45m · 45m · —
export const hm = (min: number, empty = "—") => {
  const m = Math.round(min); if (m <= 0) return empty;
  const h = Math.floor(m / 60), r = m % 60;
  return h && r ? `${h}h ${r}m` : h ? `${h}h` : `${r}m`;
};
// Horas en decimal para Excel / nómina (7.75)
export const hoursDec = (min: number) => Math.round((min / 60) * 100) / 100;
export const fmtClock = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—");

// ---------- Periodos ----------
export type Period = "week" | "2weeks" | "month";
export const PERIOD_OPTIONS = [{ value: "week", label: "Week" }, { value: "2weeks", label: "2 weeks" }, { value: "month", label: "Month" }];
export function rangeOf(period: Period, anchor: Date, weekStartsOn: number): { from: Date; to: Date; days: Date[] } {
  const from = period === "month" ? startOfMonth(anchor) : startOfWeek(anchor, weekStartsOn);
  const to = period === "month" ? new Date(from.getFullYear(), from.getMonth() + 1, 1) : addDays(from, period === "2weeks" ? 14 : 7);
  const days: Date[] = [];
  for (let d = from; d < to; d = addDays(d, 1)) days.push(d);
  return { from, to, days };
}
export const moveAnchor = (period: Period, anchor: Date, dir: -1 | 1) =>
  period === "month" ? new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1) : addDays(dayStart(anchor), dir * (period === "2weeks" ? 14 : 7));
export function rangeLabel(period: Period, from: Date, to: Date): string {
  if (period === "month") return from.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const last = addDays(to, -1);
  const a = from.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const b = last.toLocaleDateString("en-US", from.getMonth() === last.getMonth() ? { day: "numeric" } : { month: "short", day: "numeric" });
  return `${a} – ${b}, ${last.getFullYear()}`;
}

// Mensajes claros para los errores de Timesheets
export function timeError(e: { message?: string; code?: string; hint?: string } | null | undefined): string {
  if (!e) return "";
  const m = `${e.message ?? ""} ${e.hint ?? ""}`;
  if ((m.includes("timesheet_entries") || m.includes("time_entry_") || m.includes("tech_time_log") || m.includes("is_manual")) && (m.includes("does not exist") || m.includes("Could not find")))
    return "Run paso-5.7-timesheets.sql in Supabase first.";
  if (e.hint) return e.hint;
  if (m.includes("NO_ACCESS")) return "You don't have permission to do this.";
  if (m.includes("tech_time_one_open")) return "This person already has an open entry of that kind. Close it first.";
  return "Something went wrong. Try again.";
}
export const needsTimeSql = (e: { message?: string; code?: string } | null | undefined) =>
  Boolean(e && (e.code === "PGRST202" || e.code === "42883" || e.code === "42P01" || /does not exist|Could not find/.test(e.message ?? "")));
