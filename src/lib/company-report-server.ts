import type { SupabaseClient } from "@supabase/supabase-js";
import type { TeamMember } from "@/lib/jobs";
import { RawReport, buildPnl } from "@/lib/job-reports";
import { FinRange, addDaysIso, finRange, r2, tzMidnight } from "@/lib/finance-period";
import { CompanyReport, RepBucket, RepDoc, RepExpense, RepExtras, RepIncome, RepPayment, RepSource, buildBuckets, buildCompanyReport } from "@/lib/company-report";
import { loadPayroll } from "@/lib/payroll-server";

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
  needsExpensesSql: boolean; needsPayrollSql: boolean;
};

// Todo en vivo y solo las fechas necesarias (el periodo y el anterior, para comparar)
export async function loadCompanyReport(supabase: SupabaseClient, companyId: string, range: FinRange, tz: string, weekStartsOn: number, today: string): Promise<CompanyReportLoad> {
  const prev = finRange(range.period, range.prev, weekStartsOn, today);
  const lo = prev.from, hi = range.to;
  const expenses = async () => {
    const full = await fetchAll<RepExpense>((a, b) => supabase.from("expenses").select("amount, expense_date, category, cost_type, doc_id, customer_id")
      .eq("company_id", companyId).gte("expense_date", lo).lte("expense_date", hi).order("expense_date").order("id").range(a, b));
    if (!full.error) return full;
    // Sin el SQL de Job Costing no existen esas columnas: se lee lo básico
    return fetchAll<RepExpense>((a, b) => supabase.from("expenses").select("amount, expense_date, category")
      .eq("company_id", companyId).gte("expense_date", lo).lte("expense_date", hi).order("expense_date").order("id").range(a, b));
  };
  const withPayroll = range.period === "week" || range.period === "month";
  const fromIso = tzMidnight(range.from, tz).toISOString(), toIso = tzMidnight(addDaysIso(range.to, 1), tz).toISOString();

  const [pays, taxed, income, exps, open, payroll, rep, team] = await Promise.all([
    fetchAll<RepPayment>((a, b) => supabase.from("sales_payments").select("amount, paid_on, invoice_id")
      .eq("company_id", companyId).eq("kind", "payment").gte("paid_on", lo).lte("paid_on", hi).order("paid_on").order("id").range(a, b)),
    // Solo las facturas con impuesto (para separar la parte del pago que no es ingreso)
    fetchAll<RepDoc>((a, b) => supabase.from("sales_docs").select("id, total, tax_amount")
      .eq("company_id", companyId).eq("kind", "invoice").gt("tax_amount", 0).order("id").range(a, b)),
    fetchAll<RepIncome>((a, b) => supabase.from("other_income").select("amount, income_date, category")
      .eq("company_id", companyId).gte("income_date", lo).lte("income_date", hi).order("income_date").order("id").range(a, b)),
    expenses(),
    fetchAll<{ total: number; amount_paid: number; written_off: number }>((a, b) => supabase.from("sales_docs").select("total, amount_paid, written_off")
      .eq("company_id", companyId).eq("kind", "invoice").not("status", "in", "(draft,void,written_off)").order("id").range(a, b)),
    withPayroll ? loadPayroll(supabase, companyId, range, tz, weekStartsOn) : Promise.resolve(null),
    // Con Payroll ya llegan los trabajos y el equipo del periodo; aquí solo hacen falta para trimestre y año
    withPayroll ? Promise.resolve(null) : supabase.rpc("job_reports", { p_company: companyId, p_from: fromIso, p_to: toIso }),
    withPayroll ? Promise.resolve(null) : supabase.rpc("job_team", { p_company: companyId }),
  ]);

  const src: RepSource = { payments: pays.rows, docs: taxed.rows, income: income.rows, expenses: exps.rows };
  const report = buildCompanyReport(src, range.from, range.to);
  const owed = open.rows.map((d) => r2(Number(d.total) - Number(d.amount_paid) - Number(d.written_off))).filter((v) => v > 0.005);
  const raw = payroll ? payroll.raw : rep && !rep.error ? (rep.data as RawReport) : null;
  const members = payroll ? payroll.team : ((team?.data ?? []) as TeamMember[]);
  const extras: RepExtras = {
    prev: buildCompanyReport(src, prev.from, prev.to), prevLabel: prev.title,
    receivable: r2(owed.reduce((a, v) => a + v, 0)), receivableCount: owed.length,
    jobs: raw && raw.labor ? buildPnl(raw, members).totals : null,
    payroll: payroll?.payroll?.totals ?? null,
  };
  return {
    report, extras, buckets: buildBuckets(src, range.period, range.from, range.to, weekStartsOn),
    needsExpensesSql: exps.error, needsPayrollSql: Boolean(payroll?.needsSql),
  };
}
