import { TeamMember, addDays, dayStart, receivesJobs, startOfMonth, startOfWeek } from "@/lib/jobs";
import { PdfBlock, PdfDoc, PdfRow, pdfFileName } from "@/lib/report-pdf";

// =====================================================================
// Reports de Jobs (Paso 5.10)
// job_reports() entrega las filas del periodo (visitas, trabajos, tiempos, piezas y conteos);
// aquí solo se suman. El dinero llega vacío a quien no le toca verlo (lo decide la base de datos):
//   revenue / value / materials / expenses / labor → dueño y manager (la oficina no recibe dinero)
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
  type_name?: string | null; materials?: number | null; expenses?: number | null;
};
export type RawTime = { user_id: string; job_id: string | null; kind: "shift" | "travel" | "on_site"; minutes: number };
export type RawLabor = { job_id: string; user_id: string; hours: number; pay_type: string | null; cost: number };
export type RawPart = {
  job_id: string; item_id: string | null; name: string; sku: string | null; unit: string | null;
  billed: number; scanned: number; missing: number; on_invoice: boolean; value: number | null;
};
export type RawCount = { user_id: string | null; name: string | null; units: number; value: number | null };
export type RawReport = {
  money: boolean; costs?: boolean; owner: boolean; visits: RawVisit[]; jobs: RawJob[]; times: RawTime[]; labor: RawLabor[] | null; parts: RawPart[]; counts: RawCount[];
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

// ---------- Profit & loss (dueño y manager) ----------
// Un renglón por trabajo terminado en el periodo: lo que se cobró, lo que costó y por qué se ganó o se perdió.
export type PnlJob = {
  job_id: string; number: string; customer: string; title: string | null; type: string; when: string | null; techs: string[];
  revenue: number; materials: number; labor: number; expenses: number; costs: number; profit: number; margin: number | null;
  invoice: string | null; reasons: string[]; loss: boolean;
};
export type PnlGroup = { key: string; name: string; jobs: number; revenue: number; costs: number; labor: number; profit: number; margin: number | null; losses: number };
export type PnlTotals = {
  jobs: number; revenue: number; materials: number; labor: number; expenses: number; costs: number; profit: number; margin: number | null;
  lossJobs: number; lossAmount: number; noPrice: number; lowJobs: number; unscannedValue: number; countValue: number; noRate: number;
};
export type Pnl = { jobs: PnlJob[]; byType: PnlGroup[]; byPerson: PnlGroup[]; totals: PnlTotals; findings: string[] };
export const LOW_MARGIN = 20; // menos de 20% de margen = "ganó poco"

export function buildPnl(raw: RawReport, team: TeamMember[]): Pnl {
  const members = new Map(team.map((m) => [m.user_id, m]));
  const nameOf = (uid: string) => members.get(uid)?.full_name ?? "Former team member";
  const laborBy = new Map<string, number>(), noRateJobs = new Set<string>(), noRatePeople = new Set<string>();
  for (const l of raw.labor ?? []) {
    laborBy.set(l.job_id, (laborBy.get(l.job_id) ?? 0) + n(l.cost));
    if (!l.pay_type) { noRateJobs.add(l.job_id); noRatePeople.add(l.user_id); }
  }
  const unscanned = new Map<string, number>();
  raw.parts.forEach((p) => unscanned.set(p.job_id, (unscanned.get(p.job_id) ?? 0) + n(p.value)));

  const jobs: PnlJob[] = raw.jobs.filter((j) => j.is_done).map((j) => {
    const revenue = n(j.revenue), materials = n(j.materials), labor = r2(laborBy.get(j.job_id) ?? 0), expenses = n(j.expenses);
    const costs = r2(materials + labor + expenses), profit = r2(revenue - costs);
    const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : null;
    const reasons: string[] = [];
    if (revenue <= 0) reasons.push("No price and no invoice");
    else if (profit < 0 || (margin ?? 100) < LOW_MARGIN) {
      const top = [["Labor", labor], ["Materials", materials], ["Expenses", expenses]].sort((a, b) => (b[1] as number) - (a[1] as number))[0];
      if ((top[1] as number) > 0) reasons.push(`${top[0]} took ${Math.round(((top[1] as number) / revenue) * 100)}% of the price`);
    }
    if (n(j.visits) > 1) reasons.push(`Needed ${j.visits} visits`);
    if ((unscanned.get(j.job_id) ?? 0) > 0) reasons.push(`${money0(unscanned.get(j.job_id))} in parts not scanned`);
    if (noRateJobs.has(j.job_id)) reasons.push("Labor not counted: no pay rate");
    if (!j.invoice_number && revenue > 0) reasons.push("Not invoiced yet (estimated price)");
    return {
      job_id: j.job_id, number: j.number, customer: j.customer_name, title: j.title, type: j.type_name || "No job type", when: j.completed_at,
      techs: (j.tech_ids ?? []).map(nameOf), revenue, materials, labor, expenses, costs, profit, margin,
      invoice: j.invoice_number, reasons, loss: profit < 0,
    };
  }).sort((a, b) => a.profit - b.profit);

  const group = (keyOf: (j: PnlJob, raw: RawJob) => { key: string; name: string }[]) => {
    const map = new Map<string, PnlGroup>();
    const src = new Map(raw.jobs.map((j) => [j.job_id, j]));
    for (const j of jobs) for (const k of keyOf(j, src.get(j.job_id)!)) {
      const g = map.get(k.key) ?? { key: k.key, name: k.name, jobs: 0, revenue: 0, costs: 0, labor: 0, profit: 0, margin: null, losses: 0 };
      g.jobs += 1; g.revenue = r2(g.revenue + j.revenue); g.costs = r2(g.costs + j.costs); g.labor = r2(g.labor + j.labor); g.profit = r2(g.profit + j.profit);
      if (j.loss) g.losses += 1;
      map.set(k.key, g);
    }
    return Array.from(map.values()).map((g) => ({ ...g, margin: g.revenue > 0 ? Math.round((g.profit / g.revenue) * 100) : null })).sort((a, b) => a.profit - b.profit);
  };
  const byType = group((j) => [{ key: j.type, name: j.type }]);
  // Por colaborador: el trabajo completo cuenta para cada persona que estuvo en él
  const byPerson = group((_, rj) => (rj.tech_ids?.length ? rj.tech_ids : [NOBODY]).map((uid) => ({ key: uid, name: uid === NOBODY ? "No collaborator" : nameOf(uid) })));

  const sum = (f: (j: PnlJob) => number) => r2(jobs.reduce((a, j) => a + f(j), 0));
  const revenue = sum((j) => j.revenue), profit = sum((j) => j.profit);
  const losers = jobs.filter((j) => j.loss);
  const totals: PnlTotals = {
    jobs: jobs.length, revenue, materials: sum((j) => j.materials), labor: sum((j) => j.labor), expenses: sum((j) => j.expenses), costs: sum((j) => j.costs),
    profit, margin: revenue > 0 ? Math.round((profit / revenue) * 100) : null,
    lossJobs: losers.length, lossAmount: r2(Math.abs(losers.reduce((a, j) => a + j.profit, 0))), noPrice: jobs.filter((j) => j.revenue <= 0).length,
    lowJobs: jobs.filter((j) => !j.loss && j.revenue > 0 && (j.margin ?? 100) < LOW_MARGIN).length,
    unscannedValue: r2(raw.parts.reduce((a, p) => a + n(p.value), 0)), countValue: r2(raw.counts.reduce((a, c) => a + n(c.value), 0)), noRate: noRatePeople.size,
  };

  // Lo que el manager le cuenta al dueño, en frases
  const findings: string[] = [];
  if (!jobs.length) findings.push("No jobs were finished in this period.");
  else {
    findings.push(`${jobs.length} job${jobs.length === 1 ? "" : "s"} finished: ${money0(revenue)} in revenue, ${money0(totals.costs)} in costs, ${money0(profit)} ${profit >= 0 ? "profit" : "loss"}${totals.margin != null ? ` (${totals.margin}% margin)` : ""}.`);
    if (totals.costs > 0) {
      const parts = [["labor", totals.labor], ["materials", totals.materials], ["expenses", totals.expenses]].filter((x) => (x[1] as number) > 0).sort((a, b) => (b[1] as number) - (a[1] as number));
      findings.push(`Biggest cost: ${parts[0][0]} (${money0(parts[0][1] as number)}, ${Math.round(((parts[0][1] as number) / totals.costs) * 100)}% of all costs).`);
    }
    if (losers.length) findings.push(`${losers.length} job${losers.length === 1 ? "" : "s"} lost money, ${money0(totals.lossAmount)} in total. The worst: ${losers.slice(0, 3).map((j) => `${j.number} ${j.customer} (${money0(j.profit)})`).join(", ")}.`);
    else findings.push("No job lost money.");
    if (totals.lowJobs) findings.push(`${totals.lowJobs} job${totals.lowJobs === 1 ? "" : "s"} made less than ${LOW_MARGIN}% margin.`);
    if (totals.noPrice) findings.push(`${totals.noPrice} finished job${totals.noPrice === 1 ? " has" : "s have"} no price and no invoice.`);
    const worstType = byType.find((g) => g.profit < 0), bestType = [...byType].sort((a, b) => b.profit - a.profit)[0];
    if (bestType && bestType.profit > 0 && byType.length > 1) findings.push(`Most profitable job type: ${bestType.name} (${money0(bestType.profit)}).`);
    if (worstType) findings.push(`Job type losing money: ${worstType.name} (${money0(worstType.profit)}).`);
  }
  if (totals.unscannedValue > 0) findings.push(`${money0(totals.unscannedValue)} in parts were charged but never scanned from a van.`);
  if (totals.countValue > 0) findings.push(`${money0(totals.countValue)} in parts (at cost) came up missing in inventory counts.`);
  if (totals.noRate > 0) findings.push(`${totals.noRate} collaborator${totals.noRate === 1 ? " has" : "s have"} no pay rate, so their labor counts as $0 and the profit looks higher than it is.`);
  return { jobs, byType, byPerson, totals, findings };
}

// El Profit & loss como PDF real (lo que el manager le entrega al dueño): se ve en el visor, se imprime o se descarga
export function pnlPdf(p: Pnl, o: { company: string; period: string; range: string; by: string }): PdfDoc {
  const t = p.totals, m = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v || 0);
  const pct = (v: number | null) => (v == null ? "-" : `${v}%`);
  const neg = (v: number) => (v < 0 ? ("neg" as const) : undefined);
  const groupCols = (first: string) => [{ label: first, width: 3.2 }, { label: "Jobs", width: 1, align: "right" as const }, { label: "Revenue", width: 1.8, align: "right" as const }, { label: "Costs", width: 1.8, align: "right" as const }, { label: "Profit", width: 1.8, align: "right" as const }, { label: "Margin", width: 1.1, align: "right" as const }];
  const groupRows = (g: PnlGroup[]): PdfRow[] => g.map((x) => ({ cells: [x.name, String(x.jobs), m(x.revenue), m(x.costs), { text: m(x.profit), tone: neg(x.profit) }, pct(x.margin)] }));
  const share = (v: number) => (t.revenue > 0 ? `${Math.round((v / t.revenue) * 100)}%` : "-");
  const blocks: PdfBlock[] = [
    { type: "kpis", items: [
      { label: "Revenue (before tax)", value: m(t.revenue) }, { label: "Costs", value: m(t.costs) },
      { label: t.profit >= 0 ? "Profit" : "Loss", value: m(t.profit), tone: t.profit < 0 ? "neg" : "pos" }, { label: "Margin", value: pct(t.margin) },
      { label: "Jobs that lost money", value: `${t.lossJobs} · ${m(t.lossAmount)}`, tone: t.lossJobs ? "neg" : undefined },
    ] },
    { type: "heading", text: "Summary" }, { type: "bullets", items: p.findings },
    { type: "heading", text: "Where the money went" },
    { type: "table", columns: [{ label: "Concept", width: 6 }, { label: "Amount", width: 2, align: "right" }, { label: "% of revenue", width: 1.4, align: "right" }], rows: [
      { cells: ["Revenue (before tax)", m(t.revenue), share(t.revenue)] }, { cells: ["- Labor", m(t.labor), share(t.labor)] },
      { cells: ["- Materials (at cost)", m(t.materials), share(t.materials)] }, { cells: ["- Expenses linked to invoices", m(t.expenses), share(t.expenses)] },
      { cells: [t.profit >= 0 ? "Profit" : "Loss", { text: m(t.profit), tone: t.profit < 0 ? "neg" : "pos" }, pct(t.margin)], style: "result" },
    ] },
  ];
  if (p.byType.length) blocks.push({ type: "heading", text: "By job type" }, { type: "table", columns: groupCols("Job type"), rows: groupRows(p.byType) });
  if (p.byPerson.length) blocks.push({ type: "heading", text: "By collaborator" }, { type: "table", columns: groupCols("Collaborator"), rows: groupRows(p.byPerson) },
    { type: "note", text: "A job with several collaborators counts in full for each of them." });
  blocks.push({ type: "heading", text: "Every job, from the biggest loss to the biggest profit" }, {
    type: "table",
    columns: [{ label: "Job", width: 3.6 }, { label: "Date", width: 1, align: "right" }, { label: "Revenue", width: 1.5, align: "right" }, { label: "Labor", width: 1.4, align: "right" }, { label: "Materials", width: 1.4, align: "right" }, { label: "Expenses", width: 1.4, align: "right" }, { label: "Profit", width: 1.5, align: "right" }, { label: "Margin", width: 1, align: "right" }],
    rows: [
      ...p.jobs.map((j): PdfRow => ({ cells: [
        { text: `${j.number} · ${j.customer || "No customer"}`, sub: [j.type, j.techs.join(", "), ...j.reasons].filter(Boolean).join(" · ") },
        shortDay(j.when), m(j.revenue), m(j.labor), m(j.materials), m(j.expenses), { text: m(j.profit), tone: neg(j.profit) }, pct(j.margin)] })),
      { cells: [`Total · ${t.jobs} jobs`, "", m(t.revenue), m(t.labor), m(t.materials), m(t.expenses), { text: m(t.profit), tone: neg(t.profit) }, pct(t.margin)], style: "total" },
    ],
  });
  blocks.push({ type: "note", text: "Revenue is the invoice before tax; without an invoice, the price on the job. Labor is on-site hours x pay rate. Materials are the parts on the job at cost." });
  return { title: "Profit & loss report", subtitle: `${o.period} (${o.range}) · prepared by ${o.by}`, company: o.company, blocks, footer: o.range, fileName: pdfFileName("profit-and-loss", o.company, o.range) };
}

// ---------- Ganancia de un trabajo (job_profit, dueño y manager) ----------
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
