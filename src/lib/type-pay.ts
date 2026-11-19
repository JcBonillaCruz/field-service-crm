import type { SupabaseClient } from "@supabase/supabase-js";
import type { RawReport } from "@/lib/job-reports";

// =====================================================================
// Pago por tipo de trabajo (Paso 5.10f)
// Un colaborador que cobra "por trabajo" o "por porcentaje" puede tener un pago distinto para cada tipo de trabajo:
//   Installation → $400 fijos · Service call → 30% · Tune-Up → $60 …
// Los tipos sin fila se pagan con su tarifa general (la de siempre). Quien cobra por hora o por salario no usa esta tabla.
// El % se puede calcular sobre el precio completo del trabajo ("job") o sobre el precio menos las piezas al costo ("no_parts").
// Tabla member_job_rates: la leen dueño y manager (RLS); se escribe solo con team_save_pay_rates().
// Si el SQL 5.10f no se ha corrido, todo sigue calculándose con la tarifa general.
// =====================================================================
export type TypeKind = "fixed" | "percent";
export type TypeBase = "job" | "no_parts";
export type TypeRate = { user_id: string; job_type_id: string; pay_kind: TypeKind; amount: number; percent_base: TypeBase };
// jobType: trabajo → su tipo (solo los trabajos que hicieron falta)
export type TypePay = { rates: TypeRate[]; jobType: Record<string, string | null> };

export const TYPE_KINDS: { value: TypeKind; label: string }[] = [{ value: "fixed", label: "Fixed amount" }, { value: "percent", label: "Percent" }];
export const TYPE_BASES: { value: TypeBase; label: string }[] = [{ value: "job", label: "Of the whole job" }, { value: "no_parts", label: "Without parts" }];

const n = (v: unknown) => Number(v) || 0;
const r2 = (v: number) => Math.round(v * 100) / 100;
const usd = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
const byType = (v: unknown) => v === "per_job" || v === "percent";

// Lo que se paga por un trabajo con esa regla. materials = piezas del trabajo al costo.
export function typeCost(rule: Pick<TypeRate, "pay_kind" | "amount" | "percent_base">, revenue: number, materials: number): number {
  if (rule.pay_kind === "fixed") return r2(n(rule.amount));
  const base = rule.percent_base === "no_parts" ? Math.max(0, n(revenue) - n(materials)) : n(revenue);
  return r2(base * (n(rule.amount) / 100));
}
export const typeRuleText = (rule: Pick<TypeRate, "pay_kind" | "amount" | "percent_base">) =>
  rule.pay_kind === "fixed" ? `${usd(n(rule.amount))} fixed` : `${n(rule.amount)}% ${rule.percent_base === "no_parts" ? "without parts" : "of the job"}`;

export function ruleFinder(tp: TypePay | null) {
  const map = new Map((tp?.rates ?? []).map((r) => [`${r.user_id}|${r.job_type_id}`, r]));
  return (userId: string, jobId: string): TypeRate | null => {
    const t = tp?.jobType[jobId];
    return t ? map.get(`${userId}|${t}`) ?? null : null;
  };
}

// Las reglas de la compañía y el tipo de cada trabajo. Sin reglas (o sin el SQL) → null y nada cambia.
export async function loadTypePay(supabase: SupabaseClient, companyId: string, jobIds: string[]): Promise<TypePay | null> {
  const { data, error } = await supabase.from("member_job_rates").select("user_id, job_type_id, pay_kind, amount, percent_base").eq("company_id", companyId);
  if (error || !data?.length) return null;
  const rates = (data as TypeRate[]).map((r) => ({ ...r, amount: n(r.amount) }));
  const ids = Array.from(new Set(jobIds.filter(Boolean)));
  const jobType: Record<string, string | null> = {};
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
  const got = await Promise.all(chunks.map((c) => supabase.from("jobs").select("id, job_type_id").eq("company_id", companyId).in("id", c)));
  for (const g of got) for (const j of ((g.error ? [] : g.data) ?? []) as { id: string; job_type_id: string | null }[]) jobType[j.id] = j.job_type_id;
  return { rates, jobType };
}

// La mano de obra de job_reports() con el pago por tipo aplicado (Team performance, Profit & loss, reporte de la compañía)
export function applyTypePay(raw: RawReport, tp: TypePay | null): RawReport {
  if (!tp || !raw.labor?.length) return raw;
  const find = ruleFinder(tp), jobs = new Map(raw.jobs.map((j) => [j.job_id, j]));
  return {
    ...raw,
    labor: raw.labor.map((l) => {
      const rule = byType(l.pay_type) ? find(l.user_id, l.job_id) : null, j = jobs.get(l.job_id);
      return rule && j ? { ...l, cost: typeCost(rule, n(j.revenue), n(j.materials)) } : l;
    }),
  };
}
export async function withTypePay(supabase: SupabaseClient, companyId: string, raw: RawReport): Promise<RawReport> {
  if (!raw?.labor?.length) return raw;
  const mine = new Set(raw.labor.filter((l) => byType(l.pay_type)).map((l) => l.job_id));
  if (!mine.size) return raw;
  return applyTypePay(raw, await loadTypePay(supabase, companyId, Array.from(mine)).catch(() => null));
}

// La tarjeta "Job profit" de un trabajo (job_profit) con el pago por tipo aplicado a cada persona
type ProfitLike = {
  revenue: number; materials: number; labor: number; profit: number;
  people: { user_id: string; pay_type: string | null; rate: number | null; cost: number; by_type?: string }[];
};
export async function jobProfitWithTypePay<T extends ProfitLike>(supabase: SupabaseClient, jobId: string, p: T): Promise<T> {
  const users = (p.people ?? []).filter((x) => byType(x.pay_type)).map((x) => x.user_id);
  if (!users.length) return p;
  const job = await supabase.from("jobs").select("company_id, job_type_id").eq("id", jobId).maybeSingle();
  const j = job.data as { company_id: string; job_type_id: string | null } | null;
  if (job.error || !j?.job_type_id) return p;
  const { data, error } = await supabase.from("member_job_rates").select("user_id, job_type_id, pay_kind, amount, percent_base")
    .eq("company_id", j.company_id).eq("job_type_id", j.job_type_id).in("user_id", users);
  if (error || !data?.length) return p;
  const rules = new Map((data as TypeRate[]).map((r) => [r.user_id, r]));
  let diff = 0;
  const people = p.people.map((x) => {
    const rule = byType(x.pay_type) ? rules.get(x.user_id) : undefined;
    if (!rule) return x;
    const cost = typeCost(rule, n(p.revenue), n(p.materials));
    diff += cost - n(x.cost);
    return { ...x, cost, by_type: typeRuleText(rule) };
  });
  return { ...p, people, labor: r2(n(p.labor) + diff), profit: r2(n(p.profit) - diff) };
}
