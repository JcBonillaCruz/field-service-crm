import type { TeamMember } from "@/lib/jobs";
import type { PayType } from "@/lib/operations";
import type { RawReport } from "@/lib/job-reports";
import { TimeEntry, byDay, isStale } from "@/lib/timesheets";
import { FinPeriod, money, r2, spanLabel, weekStartIso } from "@/lib/finance-period";
import { PdfBlock, PdfDoc, PdfRow, pdfFileName } from "@/lib/report-pdf";
import { TypePay, ruleFinder, typeCost, typeRuleText } from "@/lib/type-pay";

// =====================================================================
// Payroll por trabajador (Paso 5.10c) — Finances → Payroll, dueño y manager
//   Empleado directo (hourly)   = horas marcadas en Timesheets × tarifa por hora (+ overtime si tiene tarifa de overtime)
//   Subcontratista (per_job)    = trabajos terminados × tarifa por trabajo
//   Subcontratista (percent)    = su % del precio de cada trabajo terminado
//   Por tipo de trabajo (5.10f) = si tiene una regla para el tipo de ese trabajo (fijo o %), esa manda; si no, su tarifa general
//   Salary                      = salario anual repartido en el periodo
// "Mark as paid" guarda el pago y crea solo el gasto en Expenses. Aquí solo se calcula; el mismo cálculo
// sirve para la pantalla, la exportación y el reporte de la compañía.
// =====================================================================
export type PayRate = { user_id: string; pay_type: PayType; rate: number; overtime_rate: number | null };
export type PayrollPayment = {
  id: string; user_id: string; person_name: string; worker_type: string; period_from: string; period_to: string;
  pay_type: string | null; rate: number | null; hours: number; overtime_hours: number; jobs: number; calculated: number;
  amount: number; paid_on: string; payment_mode: string | null; reference: string | null; notes: string | null;
  expense_id: string | null; created_by_name: string | null; created_at: string;
};
export type PayrollData = { rates: PayRate[]; payments: PayrollPayment[] };
export type PayJob = {
  job_id: string; number: string; customer: string; when: string | null; revenue: number; cost: number; estimated: boolean;
  type: string | null; materials: number;
  how: string;       // cómo se pagó este trabajo: "$400.00 fixed", "30% of the job"… (vacío si no cobra por trabajo)
  byType: boolean;   // se pagó con una regla de su tipo de trabajo
  howSpec?: HowSpec; // Paso 6.2b: lo mismo como datos, para escribirlo en el idioma de quien lo ve
};
// Paso 6.2b: cómo se calculó cada cosa, como datos (las pantallas lo escriben en el idioma con basisText / flagText / howText)
export type HowSpec = { k: "perJob"; rate: number } | { k: "pct"; pct: number } | { k: "rule"; kind: string; amount: number; base: string | null };
export type BasisSpec =
  | { k: "none" } | { k: "hourly"; reg: number; rate: number; ot: number; otRate: number } | { k: "perJob"; n: number; rate: number }
  | { k: "percent"; pct: number; revenue: number; n: number } | { k: "salary"; rate: number; part: number }
  | { k: "mix"; groups: { count: number; type: string | null; how: HowSpec; byType: boolean }[] };
export type FlagSpec =
  | { k: "noRate" } | { k: "over"; min: number } | { k: "noHours" } | { k: "estimated" } | { k: "jobsSql" } | { k: "stale" }
  | { k: "other"; amount: number; spans: [string, string][] };
export type PayDay = { key: string; minutes: number };
export type PayStatus = "paid" | "partial" | "unpaid" | "none";
export type PayRow = {
  user_id: string; name: string; member: TeamMember | null; workerType: "employee" | "subcontractor";
  payType: PayType | null; rate: number | null; overtimeRate: number | null;
  minutes: number; regMinutes: number; otMinutes: number; overMinutes: number; days: PayDay[];
  jobs: PayJob[]; jobCount: number; jobRevenue: number; typeRules: number;
  calculated: number; basis: string; basisSpec: BasisSpec; flagSpecs: FlagSpec[];
  paid: number; payments: PayrollPayment[]; otherPayments: PayrollPayment[]; balance: number; status: PayStatus;
  flags: string[];
};
export type PayGroup = { people: number; calculated: number; paid: number; balance: number };
export type PayTotals = PayGroup & { minutes: number; unpaidPeople: number; noRate: number; employees: PayGroup; subs: PayGroup };
export type Payroll = { rows: PayRow[]; totals: PayTotals; jobsReady: boolean };

const n = (v: unknown) => Number(v) || 0;
export const hoursOf = (min: number) => Math.round((min / 60) * 100) / 100;
export const hoursText = (min: number) => `${hoursOf(min)} h`;
const WEEK_MIN = 40 * 60;
// Parte del salario anual que toca en el periodo
const SALARY_PART: Partial<Record<FinPeriod, number>> = { week: 52, "2weeks": 26, month: 12, quarter: 4, year: 1 };

export function buildPayroll(o: {
  team: TeamMember[]; rates: PayRate[]; payments: PayrollPayment[]; entries: TimeEntry[]; raw: RawReport | null;
  from: string; to: string; period: FinPeriod; weekStartsOn: number; dayKey: (iso: string) => string; now: number;
  typePay?: TypePay | null;
}): Payroll {
  const members = new Map(o.team.map((m) => [m.user_id, m]));
  const rates = new Map(o.rates.map((r) => [r.user_id, r]));
  const inRange = (k: string) => k >= o.from && k <= o.to;
  const jobsReady = Boolean(o.raw && o.raw.money);
  const findRule = ruleFinder(o.typePay ?? null);
  const rulesOf = new Map<string, number>();
  for (const t of o.typePay?.rates ?? []) rulesOf.set(t.user_id, (rulesOf.get(t.user_id) ?? 0) + 1);

  // Horas por persona y por día (mismas reglas que Timesheets: un olvido de salida no suma)
  const entriesBy = new Map<string, TimeEntry[]>();
  for (const e of o.entries) entriesBy.set(e.user_id, [...(entriesBy.get(e.user_id) ?? []), e]);

  // Trabajos terminados en el periodo, por persona (lo que le toca se calcula abajo con su tarifa)
  const done = new Map((o.raw?.jobs ?? []).filter((j) => j.is_done).map((j) => [j.job_id, j]));
  const jobsBy = new Map<string, PayJob[]>();
  done.forEach((j) => {
    for (const uid of j.tech_ids ?? []) {
      jobsBy.set(uid, [...(jobsBy.get(uid) ?? []), { job_id: j.job_id, number: j.number, customer: j.customer_name, when: j.completed_at, revenue: n(j.revenue), cost: 0, estimated: !j.invoice_number,
        type: j.type_name ?? null, materials: n(j.materials), how: "", byType: false }]);
    }
  });

  const paysBy = new Map<string, PayrollPayment[]>();
  for (const p of o.payments) paysBy.set(p.user_id, [...(paysBy.get(p.user_id) ?? []), p]);

  const ids = new Set<string>([...Array.from(rates.keys()), ...Array.from(entriesBy.keys()), ...Array.from(jobsBy.keys()), ...Array.from(paysBy.keys())]);
  const rows: PayRow[] = [];
  ids.forEach((uid) => {
    const m = members.get(uid) ?? null;
    const pays = paysBy.get(uid) ?? [];
    const rate = rates.get(uid) ?? null;
    const mine = entriesBy.get(uid) ?? [];
    const days: PayDay[] = Array.from(byDay(mine, o.now, o.dayKey).values()).filter((d) => inRange(d.key) && d.worked > 0)
      .map((d) => ({ key: d.key, minutes: d.worked })).sort((a, b) => a.key.localeCompare(b.key));
    const minutes = days.reduce((a, d) => a + d.minutes, 0);
    // Más de 40 h en una misma semana
    const perWeek = new Map<string, number>();
    days.forEach((d) => { const w = weekStartIso(d.key, o.weekStartsOn); perWeek.set(w, (perWeek.get(w) ?? 0) + d.minutes); });
    const over = Array.from(perWeek.values()).reduce((a, v) => a + Math.max(0, v - WEEK_MIN), 0);

    const payType = rate?.pay_type ?? null, r = rate ? n(rate.rate) : null, ot = rate?.overtime_rate != null && n(rate.overtime_rate) > 0 ? n(rate.overtime_rate) : null;
    const perJob = payType === "per_job" || payType === "percent";
    const jobs = (jobsBy.get(uid) ?? []).map((j): PayJob => {
      const rule = perJob ? findRule(uid, j.job_id) : null;
      if (rule) return { ...j, cost: typeCost(rule, j.revenue, j.materials), how: typeRuleText(rule), byType: true, howSpec: { k: "rule", kind: rule.pay_kind, amount: n(rule.amount), base: rule.percent_base ?? null } };
      return payType === "per_job" ? { ...j, cost: r2(n(r)), how: `${money(r)} per job`, howSpec: { k: "perJob", rate: n(r) } }
        : payType === "percent" ? { ...j, cost: r2(j.revenue * (n(r) / 100)), how: `${n(r)}% of the job`, howSpec: { k: "pct", pct: n(r) } } : j;
    }).sort((a, b) => (a.when ?? "").localeCompare(b.when ?? ""));
    const someByType = jobs.some((j) => j.byType);
    // "2 Installation ($400.00 fixed) + 3 Service call (30% of the job) + 1 at $80.00 per job"
    const mixBasis = () => {
      const groups = new Map<string, number>();
      jobs.forEach((j) => { const k = j.byType ? `${j.type ?? "Job"} (${j.how})` : `at ${j.how}`; groups.set(k, (groups.get(k) ?? 0) + 1); });
      return Array.from(groups, ([k, c]) => `${c} ${k}`).join(" + ");
    };
    const pctEstimated = jobs.some((j) => j.estimated && j.revenue > 0 && j.how.includes("%"));
    const jobRevenue = r2(jobs.reduce((a, j) => a + j.revenue, 0));
    const flags: string[] = [];
    const flagSpecs: FlagSpec[] = [];
    const flag = (f: FlagSpec, en: string) => { flagSpecs.push(f); flags.push(en); };
    const mixSpec = (): BasisSpec => {
      const g = new Map<string, { count: number; type: string | null; how: HowSpec; byType: boolean }>();
      jobs.forEach((j) => { const k = j.byType ? `${j.type ?? "Job"} (${j.how})` : `at ${j.how}`; const x = g.get(k); if (x) x.count++; else if (j.howSpec) g.set(k, { count: 1, type: j.type, how: j.howSpec, byType: j.byType }); });
      return { k: "mix", groups: Array.from(g.values()) };
    };
    let basisSpec: BasisSpec = { k: "none" };
    let calculated = 0, basis = "", regMinutes = minutes, otMinutes = 0, overMinutes = 0;

    if (!payType) {
      basis = "No pay rate saved";
      if (minutes > 0 || jobs.length) flag({ k: "noRate" }, "No pay rate: set it in Team → Edit so the amount is calculated.");
    } else if (payType === "hourly") {
      if (ot && over > 0) { otMinutes = over; regMinutes = minutes - over; } else overMinutes = over;
      calculated = r2((regMinutes / 60) * n(r) + (otMinutes / 60) * n(ot));
      basis = `${hoursText(regMinutes)} × ${money(r)}/h${otMinutes > 0 ? ` + ${hoursText(otMinutes)} overtime × ${money(ot)}/h` : ""}`;
      basisSpec = { k: "hourly", reg: regMinutes, rate: n(r), ot: otMinutes, otRate: n(ot) };
      if (overMinutes > 0) flag({ k: "over", min: overMinutes }, `${hoursText(overMinutes)} over 40 in a week, paid at the regular rate (no overtime rate saved).`);
      if (minutes <= 0) flag({ k: "noHours" }, "No hours clocked in this period.");
    } else if (payType === "per_job") {
      calculated = r2(jobs.reduce((a, j) => a + j.cost, 0));
      basis = someByType ? mixBasis() : `${jobs.length} job${jobs.length === 1 ? "" : "s"} × ${money(r)}`;
      basisSpec = someByType ? mixSpec() : { k: "perJob", n: jobs.length, rate: n(r) };
      if (pctEstimated) flag({ k: "estimated" }, "Some jobs have no invoice yet: their % uses the estimated price.");
    } else if (payType === "percent") {
      calculated = r2(jobs.reduce((a, j) => a + j.cost, 0));
      basis = someByType ? mixBasis() : `${n(r)}% of ${money(jobRevenue)} (${jobs.length} job${jobs.length === 1 ? "" : "s"})`;
      basisSpec = someByType ? mixSpec() : { k: "percent", pct: n(r), revenue: jobRevenue, n: jobs.length };
      if (pctEstimated) flag({ k: "estimated" }, "Some jobs have no invoice yet: their % uses the estimated price.");
    } else {
      const part = SALARY_PART[o.period] ?? 12;
      calculated = r2(n(r) / part);
      basis = `${money(r)} per year ÷ ${part}`;
      basisSpec = { k: "salary", rate: n(r), part };
    }
    if ((payType === "per_job" || payType === "percent") && !jobsReady) flag({ k: "jobsSql" }, "Jobs couldn't be read: run paso-5.10b-reports-manager.sql in Supabase.");
    if (mine.some((e) => isStale(e, o.now) && inRange(o.dayKey(e.started_at)))) flag({ k: "stale" }, "A missed clock-out is not counted. Fix it in Timesheets.");

    // Pagos de ESTE periodo (los que caen completos dentro). Los de otro periodo que se cruza solo se avisan.
    const payments = pays.filter((p) => p.period_from >= o.from && p.period_to <= o.to);
    const otherPayments = pays.filter((p) => !(p.period_from >= o.from && p.period_to <= o.to));
    const paid = r2(payments.reduce((a, p) => a + n(p.amount), 0));
    const balance = r2(Math.max(0, calculated - paid));
    const status: PayStatus = paid > 0 && balance < 0.005 ? "paid" : paid > 0 ? "partial" : calculated > 0 ? "unpaid" : "none";
    if (otherPayments.length) flag({ k: "other", amount: r2(otherPayments.reduce((a, p) => a + n(p.amount), 0)), spans: otherPayments.map((p): [string, string] => [p.period_from, p.period_to]).filter((v, i, l) => l.findIndex((x) => x[0] === v[0] && x[1] === v[1]) === i) }, `Also has ${money(otherPayments.reduce((a, p) => a + n(p.amount), 0))} paid for ${otherPayments.map((p) => spanLabel(p.period_from, p.period_to)).filter((v, i, l) => l.indexOf(v) === i).join(", ")}.`);

    // Sin tarifa y sin nada en el periodo: no sale (dueño u oficina que no cobra por aquí)
    if (!rate && minutes <= 0 && !jobs.length && !pays.length) return;
    const workerType = (m?.worker_type ?? (pays[0]?.worker_type === "subcontractor" ? "subcontractor" : "employee")) as "employee" | "subcontractor";
    rows.push({
      user_id: uid, name: m?.full_name ?? pays[0]?.person_name ?? "Former team member", member: m, workerType,
      payType, rate: r, overtimeRate: ot, minutes, regMinutes, otMinutes, overMinutes, days, jobs, jobCount: jobs.length, jobRevenue,
      typeRules: perJob ? rulesOf.get(uid) ?? 0 : 0,
      calculated, basis, basisSpec, flagSpecs, paid, payments, otherPayments, balance, status, flags,
    });
  });
  rows.sort((a, b) => Number(a.workerType === "subcontractor") - Number(b.workerType === "subcontractor") || b.calculated - a.calculated || a.name.localeCompare(b.name));

  const group = (list: PayRow[]): PayGroup => ({
    people: list.length, calculated: r2(list.reduce((a, x) => a + x.calculated, 0)), paid: r2(list.reduce((a, x) => a + x.paid, 0)), balance: r2(list.reduce((a, x) => a + x.balance, 0)),
  });
  return {
    rows, jobsReady,
    totals: {
      ...group(rows), minutes: rows.reduce((a, x) => a + x.minutes, 0),
      unpaidPeople: rows.filter((x) => x.balance > 0.005).length, noRate: rows.filter((x) => !x.payType).length,
      employees: group(rows.filter((x) => x.workerType === "employee")), subs: group(rows.filter((x) => x.workerType === "subcontractor")),
    },
  };
}

// ---------- Paso 6.2b: los textos de Payroll en el idioma de quien lo ve ----------
// t = traductor del namespace "payLib" · money = dinero en el idioma · span = rango de fechas en el idioma
export type PayL = { t: (key: string, values?: Record<string, string | number>) => string; money: (v: number | null | undefined) => string; span: (from: string, to: string) => string };

export function howText(h: HowSpec | undefined, L: PayL): string {
  if (!h) return "";
  if (h.k === "perJob") return L.t("howPerJob", { rate: L.money(h.rate) });
  if (h.k === "pct") return L.t("howPct", { pct: h.pct });
  return h.kind === "fixed" ? L.t("ruleFixed", { amt: L.money(h.amount) }) : h.base === "no_parts" ? L.t("rulePctNoParts", { pct: h.amount }) : L.t("howPct", { pct: h.amount });
}
export function basisText(r: Pick<PayRow, "basisSpec">, L: PayL): string {
  const b = r.basisSpec, { t, money } = L;
  switch (b.k) {
    case "none": return t("bNone");
    case "hourly": return b.ot > 0 ? t("bHourlyOt", { reg: hoursText(b.reg), rate: money(b.rate), ot: hoursText(b.ot), otRate: money(b.otRate) }) : t("bHourly", { reg: hoursText(b.reg), rate: money(b.rate) });
    case "perJob": return t("bPerJob", { n: b.n, rate: money(b.rate) });
    case "percent": return t("bPercent", { pct: b.pct, rev: money(b.revenue), n: b.n });
    case "salary": return t("bSalary", { rate: money(b.rate), part: b.part });
    case "mix": return b.groups.map((g) => (g.byType ? t("mixType", { c: g.count, type: g.type ?? t("job"), how: howText(g.how, L) }) : t("mixAt", { c: g.count, how: howText(g.how, L) }))).join(" + ");
  }
}
export function flagText(f: FlagSpec, L: PayL): string {
  if (f.k === "over") return L.t("fOver", { h: hoursText(f.min) });
  if (f.k === "other") return L.t("fOther", { amt: L.money(f.amount), spans: f.spans.map(([a, b]) => L.span(a, b)).join(", ") });
  return L.t(`f_${f.k}`);
}
export const rateText = (r: Pick<PayRow, "payType" | "rate" | "overtimeRate"> & { typeRules?: number }, L: PayL) =>
  (!r.payType ? L.t("rNone") : r.payType === "hourly" ? `${L.t("rHourly", { rate: L.money(r.rate) })}${r.overtimeRate ? L.t("rOt", { rate: L.money(r.overtimeRate) }) : ""}`
    : r.payType === "per_job" ? L.t("howPerJob", { rate: L.money(r.rate) }) : r.payType === "percent" ? L.t("howPct", { pct: n(r.rate) }) : L.t("rSalary", { rate: L.money(r.rate) }))
  + (r.typeRules ? L.t("rByType", { n: r.typeRules }) : "");

// La nómina del periodo como PDF real (para imprimir, firmar o mandar al contador)
// pay = forma de pago guardada (en inglés) escrita en el idioma
export function payrollPdf(p: Payroll, o: { company: string; range: string; by: string }, L: PayL, pay: (m: string) => string = (m) => m): PdfDoc {
  const t = p.totals, { money } = L, tx = L.t;
  const cols = [{ label: tx("person"), width: 3.6 }, { label: tx("hours"), width: 1, align: "right" as const }, { label: tx("jobs"), width: 0.8, align: "right" as const }, { label: tx("earned"), width: 1.6, align: "right" as const }, { label: tx("paid"), width: 1.6, align: "right" as const }, { label: tx("stillOwed"), width: 1.6, align: "right" as const }];
  const line = (r: PayRow): PdfRow => ({ cells: [
    { text: r.name, sub: [r.calculated > 0 ? basisText(r, L) : rateText(r, L), ...r.payments.map((x) => tx("paidOn", { amt: money(x.amount), date: String(x.paid_on).slice(0, 10), how: x.payment_mode ? ` (${pay(x.payment_mode)}${x.reference ? ` ${x.reference}` : ""})` : "" }))].filter(Boolean).join(" · ") },
    r.minutes > 0 ? String(hoursOf(r.minutes)) : "-", r.jobCount ? String(r.jobCount) : "-", money(r.calculated), money(r.paid), { text: money(r.balance), tone: r.balance > 0.005 ? "neg" : undefined }] });
  const total = (label: string, g: PayGroup): PdfRow => ({ cells: [label, "", "", money(g.calculated), money(g.paid), { text: money(g.balance), tone: g.balance > 0.005 ? "neg" : undefined }], style: "total" });
  const emp = p.rows.filter((r) => r.workerType === "employee"), subs = p.rows.filter((r) => r.workerType === "subcontractor");
  const blocks: PdfBlock[] = [{ type: "kpis", items: [
    { label: tx("earnedPeriod"), value: money(t.calculated) }, { label: tx("alreadyPaid"), value: money(t.paid), tone: "pos" },
    { label: tx("stillToPay"), value: money(t.balance), tone: t.balance > 0.005 ? "neg" : undefined }, { label: tx("hoursClocked"), value: `${hoursOf(t.minutes)} h` },
  ] }];
  if (emp.length) blocks.push({ type: "heading", text: tx("empHead", { n: emp.length }) }, { type: "table", columns: cols, rows: [...emp.map(line), total(tx("empTotal"), t.employees)] });
  if (subs.length) blocks.push({ type: "heading", text: tx("subsHead", { n: subs.length }) }, { type: "table", columns: cols, rows: [...subs.map(line), total(tx("subsTotal"), t.subs)] });
  if (!p.rows.length) blocks.push({ type: "bullets", items: [tx("nothing")] });
  blocks.push({ type: "note", text: tx("pdfNote") });
  return { title: tx("title"), subtitle: tx("subtitle", { range: o.range, by: o.by }), company: o.company, blocks, footer: o.range, fileName: pdfFileName("payroll", o.company, o.range) };
}

export const needsPayrollSql = (e: { message?: string; code?: string } | null | undefined) =>
  Boolean(e && (e.code === "PGRST202" || e.code === "42883" || e.code === "42P01" || /does not exist|Could not find/.test(e.message ?? "")));
export function payrollError(e: { message?: string; code?: string; hint?: string } | null | undefined): string {
  if (!e) return "";
  if (needsPayrollSql(e)) return "Run paso-5.10c-payroll.sql in Supabase first.";
  if (e.hint) return e.hint;
  if ((e.message ?? "").includes("NO_ACCESS")) return "You don't have permission to do this.";
  return "Something went wrong. Try again.";
}
