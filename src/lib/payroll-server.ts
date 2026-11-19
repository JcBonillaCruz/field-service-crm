import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/session";
import type { TeamMember } from "@/lib/jobs";
import type { RawReport } from "@/lib/job-reports";
import type { TimeEntry } from "@/lib/timesheets";
import { FinPeriod, addDaysIso, dayKeyIn, safeTz, tzMidnight } from "@/lib/finance-period";
import { Payroll, PayrollData, buildPayroll, needsPayrollSql, payrollError } from "@/lib/payroll";

// Dinero de toda la compañía (Payroll, Finances → Reports): dueño y manager
export const canSeeCompanyMoney = (role: string | null | undefined) => role === "owner" || role === "manager";

// Compañía, zona horaria y primer día de la semana (los mismos de Jobs → Settings)
export async function financeContext() {
  const { supabase, current, user } = await getSession();
  if (!current) return { supabase, current: null, user, tz: "America/Chicago", weekStartsOn: 0, today: "" };
  const { data } = await supabase.from("job_settings").select("timezone, week_starts_on").eq("company_id", current.id).maybeSingle();
  const tz = safeTz(data?.timezone as string | undefined, headers().get("x-vercel-ip-timezone"));
  return { supabase, current, user, tz, weekStartsOn: Number(data?.week_starts_on ?? 0) || 0, today: dayKeyIn(tz)(new Date()) };
}

// Los tiempos del periodo. Supabase entrega máximo 1000 filas por llamada: si llega justo a ese tope, se pide por páginas.
async function loadEntries(supabase: SupabaseClient, companyId: string, fromIso: string, toIso: string): Promise<{ entries: TimeEntry[]; ok: boolean }> {
  const args = { p_company: companyId, p_from: fromIso, p_to: toIso };
  const first = await supabase.rpc("timesheet_entries", args);
  if (first.error) return { entries: [], ok: false };
  let list = (Array.isArray(first.data) ? first.data : []) as TimeEntry[];
  if (list.length === 1000) {
    list = [];
    for (let page = 0; page < 40; page++) {
      const r = await supabase.rpc("timesheet_entries", args).order("started_at").order("id").range(page * 1000, page * 1000 + 999);
      if (r.error) break;
      const chunk = (r.data ?? []) as TimeEntry[];
      list.push(...chunk);
      if (chunk.length < 1000) break;
    }
  }
  return { entries: list, ok: true };
}

export type PayrollLoad = { payroll: Payroll | null; team: TeamMember[]; raw: RawReport | null; needsSql: boolean; error: string; timeReady: boolean };

export async function loadPayroll(supabase: SupabaseClient, companyId: string, range: { from: string; to: string; period: FinPeriod }, tz: string, weekStartsOn: number): Promise<PayrollLoad> {
  const fromIso = tzMidnight(range.from, tz).toISOString(), toIso = tzMidnight(addDaysIso(range.to, 1), tz).toISOString();
  const [data, team, time, rep] = await Promise.all([
    supabase.rpc("payroll_data", { p_company: companyId, p_from: range.from, p_to: range.to }),
    supabase.rpc("job_team", { p_company: companyId }),
    loadEntries(supabase, companyId, fromIso, toIso),
    supabase.rpc("job_reports", { p_company: companyId, p_from: fromIso, p_to: toIso }),
  ]);
  const members = (team.data ?? []) as TeamMember[];
  const raw = rep.error ? null : (rep.data as RawReport);
  if (data.error) return { payroll: null, team: members, raw, needsSql: needsPayrollSql(data.error), error: payrollError(data.error), timeReady: time.ok };
  const d = (data.data ?? { rates: [], payments: [] }) as PayrollData;
  const payroll = buildPayroll({
    team: members, rates: d.rates ?? [], payments: d.payments ?? [], entries: time.entries, raw,
    from: range.from, to: range.to, period: range.period, weekStartsOn, dayKey: dayKeyIn(tz), now: Date.now(),
  });
  return { payroll, team: members, raw, needsSql: false, error: "", timeReady: time.ok };
}
