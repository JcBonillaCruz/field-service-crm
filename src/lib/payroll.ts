import type { TeamMember } from "@/lib/jobs";
import type { PayType } from "@/lib/operations";
import type { RawReport } from "@/lib/job-reports";
import { TimeEntry, byDay, isStale } from "@/lib/timesheets";
import { FinPeriod, money, r2, spanLabel, weekStartIso } from "@/lib/finance-period";

// =====================================================================
// Payroll por trabajador (Paso 5.10c) — Finances → Payroll, dueño y manager
//   Empleado directo (hourly)   = horas marcadas en Timesheets × tarifa por hora (+ overtime si tiene tarifa de overtime)
//   Subcontratista (per_job)    = trabajos terminados × tarifa por trabajo
//   Subcontratista (percent)    = su % del precio de cada trabajo terminado
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
export type PayJob = { job_id: string; number: string; customer: string; when: string | null; revenue: number; cost: number; estimated: boolean };
export type PayDay = { key: string; minutes: number };
export type PayStatus = "paid" | "partial" | "unpaid" | "none";
export type PayRow = {
  user_id: string; name: string; member: TeamMember | null; workerType: "employee" | "subcontractor";
  payType: PayType | null; rate: number | null; overtimeRate: number | null;
  minutes: number; regMinutes: number; otMinutes: number; overMinutes: number; days: PayDay[];
  jobs: PayJob[]; jobCount: number; jobRevenue: number;
  calculated: number; basis: string;
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
}): Payroll {
  const members = new Map(o.team.map((m) => [m.user_id, m]));
  const rates = new Map(o.rates.map((r) => [r.user_id, r]));
  const inRange = (k: string) => k >= o.from && k <= o.to;
  const jobsReady = Boolean(o.raw && o.raw.money);

  // Horas por persona y por día (mismas reglas que Timesheets: un olvido de salida no suma)
  const entriesBy = new Map<string, TimeEntry[]>();
  for (const e of o.entries) entriesBy.set(e.user_id, [...(entriesBy.get(e.user_id) ?? []), e]);

  // Trabajos terminados en el periodo, por persona (lo que le toca se calcula abajo con su tarifa)
  const done = new Map((o.raw?.jobs ?? []).filter((j) => j.is_done).map((j) => [j.job_id, j]));
  const jobsBy = new Map<string, PayJob[]>();
  done.forEach((j) => {
    for (const uid of j.tech_ids ?? []) {
      jobsBy.set(uid, [...(jobsBy.get(uid) ?? []), { job_id: j.job_id, number: j.number, customer: j.customer_name, when: j.completed_at, revenue: n(j.revenue), cost: 0, estimated: !j.invoice_number }]);
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
    const jobs = (jobsBy.get(uid) ?? []).map((j) => ({ ...j, cost: payType === "per_job" ? r2(n(r)) : payType === "percent" ? r2(j.revenue * (n(r) / 100)) : 0 }))
      .sort((a, b) => (a.when ?? "").localeCompare(b.when ?? ""));
    const jobRevenue = r2(jobs.reduce((a, j) => a + j.revenue, 0));
    const flags: string[] = [];
    let calculated = 0, basis = "", regMinutes = minutes, otMinutes = 0, overMinutes = 0;

    if (!payType) {
      basis = "No pay rate saved";
      if (minutes > 0 || jobs.length) flags.push("No pay rate: set it in Team → Edit so the amount is calculated.");
    } else if (payType === "hourly") {
      if (ot && over > 0) { otMinutes = over; regMinutes = minutes - over; } else overMinutes = over;
      calculated = r2((regMinutes / 60) * n(r) + (otMinutes / 60) * n(ot));
      basis = `${hoursText(regMinutes)} × ${money(r)}/h${otMinutes > 0 ? ` + ${hoursText(otMinutes)} overtime × ${money(ot)}/h` : ""}`;
      if (overMinutes > 0) flags.push(`${hoursText(overMinutes)} over 40 in a week, paid at the regular rate (no overtime rate saved).`);
      if (minutes <= 0) flags.push("No hours clocked in this period.");
    } else if (payType === "per_job") {
      calculated = r2(jobs.reduce((a, j) => a + j.cost, 0));
      basis = `${jobs.length} job${jobs.length === 1 ? "" : "s"} × ${money(r)}`;
    } else if (payType === "percent") {
      calculated = r2(jobs.reduce((a, j) => a + j.cost, 0));
      basis = `${n(r)}% of ${money(jobRevenue)} (${jobs.length} job${jobs.length === 1 ? "" : "s"})`;
      if (jobs.some((j) => j.estimated && j.revenue > 0)) flags.push("Some jobs have no invoice yet: their % uses the estimated price.");
    } else {
      const part = SALARY_PART[o.period] ?? 12;
      calculated = r2(n(r) / part);
      basis = `${money(r)} per year ÷ ${part}`;
    }
    if ((payType === "per_job" || payType === "percent") && !jobsReady) flags.push("Jobs couldn't be read: run paso-5.10b-reports-manager.sql in Supabase.");
    if (mine.some((e) => isStale(e, o.now) && inRange(o.dayKey(e.started_at)))) flags.push("A missed clock-out is not counted. Fix it in Timesheets.");

    // Pagos de ESTE periodo (los que caen completos dentro). Los de otro periodo que se cruza solo se avisan.
    const payments = pays.filter((p) => p.period_from >= o.from && p.period_to <= o.to);
    const otherPayments = pays.filter((p) => !(p.period_from >= o.from && p.period_to <= o.to));
    const paid = r2(payments.reduce((a, p) => a + n(p.amount), 0));
    const balance = r2(Math.max(0, calculated - paid));
    const status: PayStatus = paid > 0 && balance < 0.005 ? "paid" : paid > 0 ? "partial" : calculated > 0 ? "unpaid" : "none";
    if (otherPayments.length) flags.push(`Also has ${money(otherPayments.reduce((a, p) => a + n(p.amount), 0))} paid for ${otherPayments.map((p) => spanLabel(p.period_from, p.period_to)).filter((v, i, l) => l.indexOf(v) === i).join(", ")}.`);

    // Sin tarifa y sin nada en el periodo: no sale (dueño u oficina que no cobra por aquí)
    if (!rate && minutes <= 0 && !jobs.length && !pays.length) return;
    const workerType = (m?.worker_type ?? (pays[0]?.worker_type === "subcontractor" ? "subcontractor" : "employee")) as "employee" | "subcontractor";
    rows.push({
      user_id: uid, name: m?.full_name ?? pays[0]?.person_name ?? "Former team member", member: m, workerType,
      payType, rate: r, overtimeRate: ot, minutes, regMinutes, otMinutes, overMinutes, days, jobs, jobCount: jobs.length, jobRevenue,
      calculated, basis, paid, payments, otherPayments, balance, status, flags,
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

export const rateText = (r: Pick<PayRow, "payType" | "rate" | "overtimeRate">) =>
  !r.payType ? "No pay rate" : r.payType === "hourly" ? `${money(r.rate)}/h${r.overtimeRate ? ` · OT ${money(r.overtimeRate)}/h` : ""}`
    : r.payType === "per_job" ? `${money(r.rate)} per job` : r.payType === "percent" ? `${n(r.rate)}% of the job` : `${money(r.rate)} per year`;

export const needsPayrollSql = (e: { message?: string; code?: string } | null | undefined) =>
  Boolean(e && (e.code === "PGRST202" || e.code === "42883" || e.code === "42P01" || /does not exist|Could not find/.test(e.message ?? "")));
export function payrollError(e: { message?: string; code?: string; hint?: string } | null | undefined): string {
  if (!e) return "";
  if (needsPayrollSql(e)) return "Run paso-5.10c-payroll.sql in Supabase first.";
  if (e.hint) return e.hint;
  if ((e.message ?? "").includes("NO_ACCESS")) return "You don't have permission to do this.";
  return "Something went wrong. Try again.";
}
