import type { SupabaseClient } from "@supabase/supabase-js";
import type { TeamMember } from "@/lib/jobs";
import { RawReport, buildPnl } from "@/lib/job-reports";
import { FinRange, addDaysIso, finRange, r2, spanLabel, tzMidnight } from "@/lib/finance-period";
import { CompanyReport, RepBucket, RepDoc, RepExpense, RepExtras, RepIncome, RepPayment, RepSource, buildBuckets, buildCompanyReport } from "@/lib/company-report";
import { loadPayroll } from "@/lib/payroll-server";
import { Financed, financingTotals } from "@/lib/financing";
import { withTypePay } from "@/lib/type-pay";

// Supabase entrega máximo 1000 filas por consulta: se pide por páginas hasta traer todo el periodo
type Page = PromiseLike<{ data: unknown[] | null; error: { message?: string } | null }>;
async function fetchAll<T>(page: (from: number, to: number) => Page): Promise<{ rows: T[]; error: boolean }> {
  const rows: T[] = [];
  for (let i = 0; i < 60; i++) {
    const { data, error } = await page(i * 1000, i * 1000 + 999);
    if (error) return { rows, error: true };
    rows.push(...((data ?? []) as T[]));
    if ((data ?? []).length < 1000) break;
  }
  return { rows, error: false };
}

export type CompanyReportLoad = {
  report: CompanyReport; extras: RepExtras; buckets: RepBucket[];
  needsExpensesSql: boolean; needsPayrollSql: boolean; needsFinancingSql: boolean;
};

// Lo que entró y salió entre dos fechas, tal como está anotado en Finances. Lo usan el reporte completo y la tarjeta del Home
// (Paso 5.10e), para que las dos cifras salgan siempre de la misma cuenta.
type SourceLoad = { src: RepSource; purchases: Financed[]; expensesError: boolean; financingError: boolean };
async function loadReportSource(supabase: SupabaseClient, companyId: string, lo: string, hi: string, today: string): Promise<SourceLoad> {
  // Antes de sumar: crea en Expenses los gastos que se repiten y ya tocan (renta, seguro…). Si falta el SQL 5.10d, no pasa nada.
  await supabase.rpc("recurring_expenses_run", { p_company: companyId, p_today: today }).then(() => null, () => null);
  // Paso 5.12: y las cuotas de las compras a pagos que ya tocan
  await supabase.rpc("financing_auto_run", { p_company: companyId, p_today: today }).then(() => null, () => null);
  const expenses = async () => {
    const full = await fetchAll<RepExpense>((a, b) => supabase.from("expenses").select("id, amount, expense_date, category, cost_type, doc_id, customer_id")
      .eq("company_id", companyId).gte("expense_date", lo).lte("expense_date", hi).order("expense_date").order("id").range(a, b));
    if (!full.error) return full;
    // Sin el SQL de Job Costing no existen esas columnas: se lee lo básico
    return fetchAll<RepExpense>((a, b) => supabase.from("expenses").select("id, amount, expense_date, category")
      .eq("company_id", companyId).gte("expense_date", lo).lte("expense_date", hi).order("expense_date").order("id").range(a, b));
  };
  const [pays, taxed, income, exps, finPays, finList] = await Promise.all([
    fetchAll<RepPayment>((a, b) => supabase.from("sales_payments").select("amount, paid_on, invoice_id")
      .eq("company_id", companyId).eq("kind", "payment").gte("paid_on", lo).lte("paid_on", hi).order("paid_on").order("id").range(a, b)),
    // Solo las facturas con impuesto (para separar la parte del pago que no es ingreso)
    fetchAll<RepDoc>((a, b) => supabase.from("sales_docs").select("id, total, tax_amount")
      .eq("company_id", companyId).eq("kind", "invoice").gt("tax_amount", 0).order("id").range(a, b)),
    fetchAll<RepIncome>((a, b) => supabase.from("other_income").select("amount, income_date, category")
      .eq("company_id", companyId).gte("income_date", lo).lte("income_date", hi).order("income_date").order("id").range(a, b)),
    expenses(),
    // Paso 5.10d: qué gastos son pagos de una compra a pagos, y cuánto se debe todavía
    fetchAll<{ expense_id: string | null; purchase_id: string }>((a, b) => supabase.from("financing_payments").select("expense_id, purchase_id")
      .eq("company_id", companyId).not("expense_id", "is", null).order("id").range(a, b)),
    supabase.rpc("financing_list", { p_company: companyId }),
  ]);
  const purchases = (finList.error ? [] : (finList.data ?? [])) as Financed[];
  const nameOf = new Map(purchases.map((f) => [f.id, f.name]));
  const financing: Record<string, string> = {};
  for (const p of finPays.rows) if (p.expense_id) financing[p.expense_id] = nameOf.get(p.purchase_id) ?? "Financed purchase";
  return {
    src: { payments: pays.rows, docs: taxed.rows, income: income.rows, expenses: exps.rows, financing },
    purchases, expensesError: exps.error, financingError: Boolean(finList.error),
  };
}

// Todo en vivo y solo las fechas necesarias (el periodo y el anterior, para comparar)
export async function loadCompanyReport(supabase: SupabaseClient, companyId: string, range: FinRange, tz: string, weekStartsOn: number, today: string): Promise<CompanyReportLoad> {
  const prev = finRange(range.period, range.prev, weekStartsOn, today);
  const withPayroll = range.period === "week" || range.period === "month";
  const fromIso = tzMidnight(range.from, tz).toISOString(), toIso = tzMidnight(addDaysIso(range.to, 1), tz).toISOString();

  const [source, open, payroll, rep, team] = await Promise.all([
    loadReportSource(supabase, companyId, prev.from, range.to, today),
    fetchAll<{ total: number; amount_paid: number; written_off: number }>((a, b) => supabase.from("sales_docs").select("total, amount_paid, written_off")
      .eq("company_id", companyId).eq("kind", "invoice").not("status", "in", "(draft,void,written_off)").order("id").range(a, b)),
    withPayroll ? loadPayroll(supabase, companyId, range, tz, weekStartsOn) : Promise.resolve(null),
    // Con Payroll ya llegan los trabajos y el equipo del periodo; aquí solo hacen falta para trimestre y año
    withPayroll ? Promise.resolve(null) : supabase.rpc("job_reports", { p_company: companyId, p_from: fromIso, p_to: toIso }),
    withPayroll ? Promise.resolve(null) : supabase.rpc("job_team", { p_company: companyId }),
  ]);
  const { src } = source;
  const ft = financingTotals(source.purchases, today);

  const report = buildCompanyReport(src, range.from, range.to);
  const owed = open.rows.map((d) => r2(Number(d.total) - Number(d.amount_paid) - Number(d.written_off))).filter((v) => v > 0.005);
  const raw = payroll ? payroll.raw : rep && !rep.error ? await withTypePay(supabase, companyId, rep.data as RawReport) : null;
  const members = payroll ? payroll.team : ((team?.data ?? []) as TeamMember[]);
  const extras: RepExtras = {
    prev: buildCompanyReport(src, prev.from, prev.to), prevLabel: prev.title,
    receivable: r2(owed.reduce((a, v) => a + v, 0)), receivableCount: owed.length,
    jobs: raw && raw.labor ? buildPnl(raw, members).totals : null,
    payroll: payroll?.payroll?.totals ?? null,
    financing: source.financingError ? null : { count: ft.open, owed: ft.owed, monthly: ft.monthly, overdue: ft.overdue },
  };
  return {
    report, extras, buckets: buildBuckets(src, range.period, range.from, range.to, weekStartsOn),
    needsExpensesSql: source.expensesError, needsPayrollSql: Boolean(payroll?.needsSql), needsFinancingSql: source.financingError,
  };
}

// ---------- Paso 5.10e: tarjeta "This month's report" del Home (dueño y manager) ----------
// El mes en curso con la misma cuenta que Finances → Reports, pero ligera: sin Payroll ni trabajos.
// Se compara contra los mismos días del mes pasado (del 1 al día de hoy), no contra el mes pasado completo.
export type MonthCard = {
  title: string; day: string; today: string; soFar: string; prevDay: string;
  income: number; jobCosts: number; overhead: number; financing: number; expenses: number; net: number; margin: number | null; empty: boolean;
  prev: { label: string; to: string; income: number; expenses: number; net: number } | null;
  owed: number;              // lo que todavía se debe de compras a pagos (hoy)
  weeks: RepBucket[];
};
export async function loadMonthCard(supabase: SupabaseClient, companyId: string, weekStartsOn: number, today: string): Promise<MonthCard> {
  const range = finRange("month", today, weekStartsOn, today);
  const prev = finRange("month", range.prev, weekStartsOn, today);
  const sameDay = addDaysIso(prev.from, Number(today.slice(8, 10)) - 1);
  const prevTo = sameDay < prev.to ? sameDay : prev.to;       // 31 de marzo → 28 de febrero
  const { src, purchases } = await loadReportSource(supabase, companyId, prev.from, range.to, today);
  const r = buildCompanyReport(src, range.from, range.to);
  const p = buildCompanyReport(src, prev.from, prevTo);
  // "Nov 1 – 18" (sin el año ni el mes repetido)
  const short = (a: string, b: string) => spanLabel(a, b).replace(/, \d{4}$/, "").replace(/ – [A-Za-z]+ /, " – ");
  return {
    title: range.title, day: range.from, today, soFar: short(range.from, today), prevDay: prev.from,
    income: r.income, jobCosts: r.jobCosts, overhead: r.overheadTotal, financing: r.financingTotal, expenses: r.expenses, net: r.net, margin: r.margin, empty: r.empty,
    prev: p.empty ? null : { label: short(prev.from, prevTo), to: prevTo, income: p.income, expenses: p.expenses, net: p.net },
    owed: financingTotals(purchases, today).owed,
    weeks: buildBuckets(src, "month", range.from, range.to, weekStartsOn).filter((w) => w.from <= today),
  };
}
