import { TeamMember, addDays, dayStart, receivesJobs, startOfMonth, startOfWeek } from "@/lib/jobs";

// =====================================================================
// Reports de Jobs (Paso 5.10)
// job_reports() entrega las filas del periodo (visitas, trabajos, tiempos, piezas y conteos);
// aquí solo se suman. El dinero llega vacío a quien no le toca verlo (lo decide la base de datos):
//   revenue / value  → dueño y manager · labor → solo el dueño
// El mismo cálculo sirve para la pantalla y para la exportación.
// =====================================================================
export type RawVisit = {
  visit_id: string; job_id: string; visit_no: number; status: string; starts_at: string | null; arrival_window_min: number | null;
  on_my_way_at: string | null; started_at: string | null; finished_at: string | null; tech_ids: string[];
};
export type RawJob = {
  job_id: string; number: string; customer_name: string; title: string | null; status: string; completed_at: string | null;
  needs_followup: boolean; hold_reason: string | null; visits: number; tech_ids: string[]; scanned_units: number; is_done: boolean;
  invoice_number: string | null; invoice_status: string | null; revenue: number | null;
};
export type RawTime = { user_id: string; job_id: string | null; kind: "shift" | "travel" | "on_site"; minutes: number };
export type RawLabor = { job_id: string; user_id: string; hours: number; pay_type: string | null; cost: number };
export type RawPart = {
  job_id: string; item_id: string | null; name: string; sku: string | null; unit: string | null;
  billed: number; scanned: number; missing: number; on_invoice: boolean; value: number | null;
};
export type RawCount = { user_id: string | null; name: string | null; units: number; value: number | null };
export type RawReport = {
  money: boolean; owner: boolean; visits: RawVisit[]; jobs: RawJob[]; times: RawTime[]; labor: RawLabor[] | null; parts: RawPart[]; counts: RawCount[];
};

const n = (v: unknown) => Number(v) || 0;
const r2 = (v: number) => Math.round(v * 100) / 100;

// ---------- Periodos ----------
export type ReportPeriod = "week" | "last_week" | "month" | "last_month" | "3months" | "year";
export const REPORT_PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: "week", label: "This week" }, { value: "last_week", label: "Last week" }, { value: "month", label: "This month" },
  { value: "last_month", label: "Last month" }, { value: "3months", label: "Last 3 months" }, { value: "year", label: "This year" },
];
export function reportRange(p: ReportPeriod, weekStartsOn: number, today = new Date()): { from: Date; to: Date } {
  const t = dayStart(today), tomorrow = addDays(t, 1);
  if (p === "week") { const from = startOfWeek(t, weekStartsOn); return { from, to: addDays(from, 7) }; }
  if (p === "last_week") { const to = startOfWeek(t, weekStartsOn); return { from: addDays(to, -7), to }; }
  if (p === "month") { const from = startOfMonth(t); return { from, to: new Date(from.getFullYear(), from.getMonth() + 1, 1) }; }
  if (p === "last_month") { const to = startOfMonth(t); return { from: new Date(to.getFullYear(), to.getMonth() - 1, 1), to }; }
  if (p === "3months") return { from: new Date(t.getFullYear(), t.getMonth() - 3, t.getDate()), to: tomorrow };
  return { from: new Date(t.getFullYear(), 0, 1), to: new Date(t.getFullYear() + 1, 0, 1) };
}
export const rangeText = (from: Date, to: Date) => {
  const last = addDays(to, -1);
  const f = (d: Date, y: boolean) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(y ? { year: "numeric" } : {}) });
  return `${f(from, from.getFullYear() !== last.getFullYear())} – ${f(last, true)}`;
};

// ---------- Team performance ----------
export type PersonJob = {
  key: string; job_id: string; number: string; customer: string; title: string | null; visit_no: number; status: string; when: string | null;
  lateMin: number | null;   // null = no se pudo medir (sin hora agendada); 0 = llegó a tiempo
  siteMin: number; travelMin: number; revenue: number | null; held: boolean;
};
export type PersonRow = {
  user_id: string; name: string; member: TeamMember | null;
  jobsDone: number; visits: number; returns: number; held: number;
  measured: number; onTime: number; late: number; lateMinAvg: number; onTimePct: number | null;
  siteMin: number; travelMin: number; shiftMin: number; idleMin: number; utilPct: number | null; avgSiteMin: number;
  revenue: number | null; labor: number | null; noRate: boolean; salaried: boolean;
  jobs: PersonJob[];
};
export type TeamTotals = {
  jobsDone: number; visits: number; held: number; returns: number; measured: number; onTime: number; onTimePct: number | null;
  siteMin: number; travelMin: number; shiftMin: number; avgSiteMin: number; utilPct: number | null; revenue: number | null; labor: number | null;
};

const HELD = new Set(["on_hold", "paused"]);
// Minutos tarde contra la ventana de llegada (cita 9:00 con ventana de 60 min → a tiempo hasta las 10:00)
export function lateMinutes(v: Pick<RawVisit, "starts_at" | "started_at" | "arrival_window_min">): number | null {
  if (!v.starts_at || !v.started_at) return null;
  const limit = new Date(v.starts_at).getTime() + n(v.arrival_window_min) * 60000;
  return Math.max(0, Math.round((new Date(v.started_at).getTime() - limit) / 60000));
}

export function buildTeam(raw: RawReport, team: TeamMember[]): { rows: PersonRow[]; totals: TeamTotals } {
  const members = new Map(team.map((m) => [m.user_id, m]));
  const jobs = new Map(raw.jobs.map((j) => [j.job_id, j]));
  const rows = new Map<string, PersonRow>();
  const doneBy = new Map<string, Set<string>>(), heldBy = new Map<string, Set<string>>(), siteJobs = new Map<string, Set<string>>();
  const row = (uid: string) => {
    let r = rows.get(uid);
    if (!r) {
      const m = members.get(uid) ?? null;
      r = {
        user_id: uid, name: m?.full_name ?? "Former team member", member: m, jobsDone: 0, visits: 0, returns: 0, held: 0,
        measured: 0, onTime: 0, late: 0, lateMinAvg: 0, onTimePct: null, siteMin: 0, travelMin: 0, shiftMin: 0, idleMin: 0, utilPct: null, avgSiteMin: 0,
        revenue: raw.money ? 0 : null, labor: raw.labor ? 0 : null, noRate: false, salaried: false, jobs: [],
      };
      rows.set(uid, r);
    }
    return r;
  };
  const setOf = (map: Map<string, Set<string>>, k: string) => map.get(k) ?? map.set(k, new Set()).get(k)!;
  // Todo el que recibe trabajos sale en la lista, aunque no haya tenido nada en el periodo
  team.filter(receivesJobs).forEach((m) => row(m.user_id));

  // Minutos por persona y trabajo (para el detalle)
  const perJob = new Map<string, { site: number; travel: number }>();
  for (const t of raw.times) {
    const r = row(t.user_id), m = n(t.minutes);
    if (t.kind === "shift") r.shiftMin += m; else if (t.kind === "travel") r.travelMin += m; else r.siteMin += m;
    if (t.job_id && t.kind !== "shift") {
      const k = `${t.user_id}|${t.job_id}`, x = perJob.get(k) ?? { site: 0, travel: 0 };
      if (t.kind === "travel") x.travel += m; else { x.site += m; setOf(siteJobs, t.user_id).add(t.job_id); }
      perJob.set(k, x);
    }
  }

  const lateSum = new Map<string, number>();
  for (const v of raw.visits) {
    const j = jobs.get(v.job_id);
    const late = lateMinutes(v);
    const held = HELD.has(v.status) || Boolean(j?.needs_followup && j.status !== "completed");
    for (const uid of v.tech_ids ?? []) {
      const r = row(uid);
      r.visits += 1;
      if (v.visit_no > 1) r.returns += 1;
      if (v.status === "completed" && j?.status === "completed") setOf(doneBy, uid).add(v.job_id);
      if (held) setOf(heldBy, uid).add(v.job_id);
      if (late != null) { r.measured += 1; if (late > 0) { r.late += 1; lateSum.set(uid, (lateSum.get(uid) ?? 0) + late); } else r.onTime += 1; }
      const t = perJob.get(`${uid}|${v.job_id}`);
      r.jobs.push({
        key: `${v.visit_id}|${uid}`, job_id: v.job_id, number: j?.number ?? "", customer: j?.customer_name ?? "", title: j?.title ?? null, visit_no: v.visit_no,
        status: v.status, when: v.finished_at ?? v.started_at, lateMin: late, siteMin: t?.site ?? 0, travelMin: t?.travel ?? 0,
        revenue: raw.money && j?.status === "completed" ? n(j.revenue) : null, held,
      });
    }
  }
  for (const l of raw.labor ?? []) {
    const r = row(l.user_id);
    r.labor = r2((r.labor ?? 0) + n(l.cost));
    if (!l.pay_type) r.noRate = true;
    if (l.pay_type === "salary") r.salaried = true;
  }

  const list = Array.from(rows.values());
  for (const r of list) {
    const done = doneBy.get(r.user_id) ?? new Set<string>();
    r.jobsDone = done.size;
    r.held = heldBy.get(r.user_id)?.size ?? 0;
    r.onTimePct = r.measured ? Math.round((r.onTime / r.measured) * 100) : null;
    r.lateMinAvg = r.late ? Math.round((lateSum.get(r.user_id) ?? 0) / r.late) : 0;
    const sj = siteJobs.get(r.user_id)?.size ?? 0;
    r.avgSiteMin = sj ? r.siteMin / sj : 0;
    r.idleMin = r.shiftMin > 0 ? Math.max(0, r.shiftMin - r.siteMin - r.travelMin) : 0;
    r.utilPct = r.shiftMin > 0 ? Math.min(100, Math.round(((r.siteMin + r.travelMin) / r.shiftMin) * 100)) : null;
    if (raw.money) r.revenue = r2(Array.from(done).reduce((a, id) => a + n(jobs.get(id)?.revenue), 0));
    r.jobs.sort((a, b) => (b.when ?? "").localeCompare(a.when ?? ""));
  }
  list.sort((a, b) => b.jobsDone - a.jobsDone || b.visits - a.visits || b.siteMin - a.siteMin || a.name.localeCompare(b.name));

  // Totales del equipo: cada trabajo y cada visita cuentan una sola vez aunque tengan varios colaboradores
  const doneJobs = raw.jobs.filter((j) => j.status === "completed" && raw.visits.some((v) => v.job_id === j.job_id && v.status === "completed"));
  let measured = 0, onTime = 0;
  raw.visits.forEach((v) => { const l = lateMinutes(v); if (l != null) { measured += 1; if (l === 0) onTime += 1; } });
  const sum = (f: (r: PersonRow) => number) => list.reduce((a, r) => a + f(r), 0);
  const siteMin = sum((r) => r.siteMin), travelMin = sum((r) => r.travelMin), shiftMin = sum((r) => r.shiftMin);
  const sitePairs = Array.from(siteJobs.values()).reduce((a, s) => a + s.size, 0);
  const clocked = list.filter((r) => r.shiftMin > 0);
  const busy = clocked.reduce((a, r) => a + r.siteMin + r.travelMin, 0), clock = clocked.reduce((a, r) => a + r.shiftMin, 0);
  const heldJobs = new Set<string>(); heldBy.forEach((s) => s.forEach((id) => heldJobs.add(id)));
  return {
    rows: list,
    totals: {
      jobsDone: doneJobs.length, visits: raw.visits.length, held: heldJobs.size, returns: raw.visits.filter((v) => v.visit_no > 1).length,
      measured, onTime, onTimePct: measured ? Math.round((onTime / measured) * 100) : null,
      siteMin, travelMin, shiftMin, avgSiteMin: sitePairs ? siteMin / sitePairs : 0, utilPct: clock > 0 ? Math.min(100, Math.round((busy / clock) * 100)) : null,
      revenue: raw.money ? r2(doneJobs.reduce((a, j) => a + n(j.revenue), 0)) : null,
      labor: raw.labor ? r2(raw.labor.reduce((a, l) => a + n(l.cost), 0)) : null,
    },
  };
}

// ---------- Unscanned parts ----------
export type PartLine = {
  key: string; job_id: string; number: string; customer: string; when: string | null; name: string; sku: string | null; unit: string | null;
  billed: number; scanned: number; missing: number; onInvoice: boolean; value: number | null; shared: number; // shared = cuántos colaboradores tuvo el trabajo
};
export type NoScanJob = { job_id: string; number: string; customer: string; title: string | null; when: string | null; revenue: number | null };
export type PartsRow = {
  user_id: string; name: string; member: TeamMember | null;
  units: number; value: number | null; jobs: number; lines: PartLine[];
  noScan: NoScanJob[]; countUnits: number; countValue: number | null;
};
export type PartsTotals = { units: number; value: number | null; jobs: number; doneJobs: number; noScanJobs: number; countUnits: number; countValue: number | null };
export const NOBODY = "none"; // trabajos sin colaborador

export function buildParts(raw: RawReport, team: TeamMember[]): { rows: PartsRow[]; totals: PartsTotals } {
  const members = new Map(team.map((m) => [m.user_id, m]));
  const jobs = new Map(raw.jobs.map((j) => [j.job_id, j]));
  const rows = new Map<string, PartsRow>();
  const row = (uid: string, fallback?: string | null) => {
    let r = rows.get(uid);
    if (!r) {
      const m = members.get(uid) ?? null;
      r = { user_id: uid, name: uid === NOBODY ? "No collaborator" : m?.full_name ?? fallback ?? "Former team member", member: m, units: 0, value: raw.money ? 0 : null, jobs: 0, lines: [], noScan: [], countUnits: 0, countValue: raw.money ? 0 : null };
      rows.set(uid, r);
    }
    return r;
  };
  const techsOf = (j: RawJob | undefined) => (j?.tech_ids?.length ? j.tech_ids : [NOBODY]);

  for (const p of raw.parts) {
    const j = jobs.get(p.job_id), techs = techsOf(j);
    for (const uid of techs) {
      const r = row(uid);
      r.units += n(p.missing);
      if (raw.money) r.value = r2((r.value ?? 0) + n(p.value));
      r.lines.push({
        key: `${p.job_id}|${p.item_id ?? p.name}|${uid}`, job_id: p.job_id, number: j?.number ?? "", customer: j?.customer_name ?? "", when: j?.completed_at ?? null,
        name: p.name, sku: p.sku, unit: p.unit, billed: n(p.billed), scanned: n(p.scanned), missing: n(p.missing), onInvoice: p.on_invoice,
        value: raw.money ? n(p.value) : null, shared: techs.length,
      });
    }
  }
  const done = raw.jobs.filter((j) => j.is_done);
  const flagged = new Set(raw.parts.map((p) => p.job_id));
  // Terminados sin ninguna pieza escaneada (y sin piezas cobradas pendientes: esos ya salen arriba)
  const noScan = done.filter((j) => n(j.scanned_units) === 0 && !flagged.has(j.job_id));
  for (const j of noScan) for (const uid of techsOf(j)) {
    row(uid).noScan.push({ job_id: j.job_id, number: j.number, customer: j.customer_name, title: j.title, when: j.completed_at, revenue: raw.money ? n(j.revenue) : null });
  }
  for (const c of raw.counts) {
    const r = row(c.user_id ?? `count:${c.name ?? "Warehouse"}`, c.name || "Warehouse");
    r.countUnits += n(c.units);
    if (raw.money) r.countValue = r2((r.countValue ?? 0) + n(c.value));
  }
  const list = Array.from(rows.values());
  for (const r of list) {
    r.jobs = new Set(r.lines.map((l) => l.job_id)).size;
    r.lines.sort((a, b) => (b.when ?? "").localeCompare(a.when ?? "") || a.name.localeCompare(b.name));
    r.noScan.sort((a, b) => (b.when ?? "").localeCompare(a.when ?? ""));
  }
  list.sort((a, b) => (b.value ?? 0) - (a.value ?? 0) || b.units - a.units || b.countUnits - a.countUnits || b.noScan.length - a.noScan.length || a.name.localeCompare(b.name));
  return {
    rows: list,
    totals: {
      units: raw.parts.reduce((a, p) => a + n(p.missing), 0), value: raw.money ? r2(raw.parts.reduce((a, p) => a + n(p.value), 0)) : null,
      jobs: flagged.size, doneJobs: done.length, noScanJobs: noScan.length,
      countUnits: raw.counts.reduce((a, c) => a + n(c.units), 0), countValue: raw.money ? r2(raw.counts.reduce((a, c) => a + n(c.value), 0)) : null,
    },
  };
}

// ---------- Ganancia de un trabajo (job_profit, solo el dueño) ----------
export type JobProfitData = {
  revenue: number; revenue_source: "invoice" | "lines" | "estimate" | "none"; tax: number;
  invoice_number: string | null; invoice_status: string | null; collected: number;
  materials: number; labor: number; missing_rates: number; salaried: number; expenses: number; expenses_count: number; profit: number; status: string;
  people: { user_id: string; name: string; hours: number; travel: number; pay_type: string | null; rate: number | null; cost: number }[];
};
export const PAY_LABEL: Record<string, string> = { hourly: "Hourly", per_job: "Per job", percent: "% of the job", salary: "Salary" };

export const qty = (v: number) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100));
export const money0 = (v: number | null | undefined) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(v) || 0);
export const shortDay = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—");

export const needsReportSql = (e: { message?: string; code?: string } | null | undefined) =>
  Boolean(e && (e.code === "PGRST202" || e.code === "42883" || e.code === "42P01" || /does not exist|Could not find/.test(e.message ?? "")));
export function reportError(e: { message?: string; code?: string; hint?: string } | null | undefined): string {
  if (!e) return "";
  if (needsReportSql(e)) return "Run paso-5.10-reports.sql in Supabase first.";
  if (e.hint) return e.hint;
  if ((e.message ?? "").includes("NO_ACCESS")) return "You don't have permission to see this.";
  return "The report couldn't load. Try again.";
}
