import type { SupabaseClient } from "@supabase/supabase-js";
import type { SiteAddress } from "@/lib/jobs";

// =====================================================================
// Maintenance plans (Paso 5.11): visitas que se repiten y se crean solas.
//   El plan guarda cliente, Job Site, tipo de trabajo, cada cuánto y cómo se cobra.
//   La base crea los trabajos de los próximos 60 días (maintenance_generate) sin duplicar:
//   salen en Schedule, Operations y My Jobs como cualquier trabajo, con plan_id.
// Sin el SQL paso-5.11 nada de esto aparece y lo demás sigue igual.
// =====================================================================
export type FreqKind = "days" | "months" | "seasonal";
export type PlanBilling = "per_visit" | "subscription" | "included";
export type PlanStatus = "active" | "paused" | "cancelled" | "finished";
export type PlanService = { item_id: string; name: string; qty: number };
export type Plan = {
  id: string; company_id: string; name: string; customer_id: string; customer_name: string; address_id: string | null; job_type_id: string | null;
  description: string | null; tech_notes: string | null; price: number; services: PlanService[];
  freq_kind: FreqKind; every_n: number; season_months: number[]; start_date: string; start_min: number; duration_min: number; arrival_window_min: number;
  tech_ids: string[]; skip_closed_days: boolean; end_kind: "never" | "count" | "date"; end_count: number | null; end_date: string | null;
  billing: PlanBilling; subscription_id: string | null; status: PlanStatus; last_error: string | null; created_by_name: string | null; created_at: string;
  // Cuentas que entrega maintenance_plans_list
  type_name?: string | null; type_color?: string | null; site?: SiteAddress; subscription_number?: string | null;
  visits_total?: number; visits_done?: number; visits_upcoming?: number; next_visit?: string | null; next_due?: string | null;
};
export type PlanJob = { job_id: string; number: string; status: string; cancelled: boolean; starts_at: string | null; techs: string[]; due_date: string | null };

export const HORIZON_DAYS = 60; // con cuánta anticipación se crean las visitas
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Cada cuánto: las opciones del formulario y cómo se guardan
export type FreqPreset = "weekly" | "biweekly" | "monthly" | "n_months" | "seasonal" | "n_days";
export const FREQ_PRESETS: { value: FreqPreset; label: string }[] = [
  { value: "weekly", label: "Every week" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Every month" },
  { value: "n_months", label: "Every few months" },
  { value: "seasonal", label: "By season (pick the months)" },
  { value: "n_days", label: "Custom (every N days)" },
];
export function presetOf(p: Pick<Plan, "freq_kind" | "every_n">): FreqPreset {
  if (p.freq_kind === "seasonal") return "seasonal";
  if (p.freq_kind === "months") return p.every_n === 1 ? "monthly" : "n_months";
  return p.every_n === 7 ? "weekly" : p.every_n === 14 ? "biweekly" : "n_days";
}
export function freqFromPreset(preset: FreqPreset, n: number): { freq_kind: FreqKind; every_n: number } {
  if (preset === "weekly") return { freq_kind: "days", every_n: 7 };
  if (preset === "biweekly") return { freq_kind: "days", every_n: 14 };
  if (preset === "monthly") return { freq_kind: "months", every_n: 1 };
  if (preset === "n_months") return { freq_kind: "months", every_n: Math.max(2, n) };
  if (preset === "seasonal") return { freq_kind: "seasonal", every_n: 1 };
  return { freq_kind: "days", every_n: Math.max(1, n) };
}
export function freqLabel(p: Pick<Plan, "freq_kind" | "every_n" | "season_months">): string {
  if (p.freq_kind === "seasonal") return (p.season_months ?? []).length ? `Each ${[...p.season_months].sort((a, b) => a - b).map((m) => MONTHS[m - 1]).join(" & ")}` : "By season";
  if (p.freq_kind === "months") return p.every_n === 1 ? "Every month" : p.every_n === 12 ? "Every year" : `Every ${p.every_n} months`;
  return p.every_n === 7 ? "Every week" : p.every_n === 14 ? "Every 2 weeks" : p.every_n === 1 ? "Every day" : `Every ${p.every_n} days`;
}

export const BILLING: { value: PlanBilling; label: string; hint: string }[] = [
  { value: "per_visit", label: "Bill each visit", hint: "When the visit is finished it goes to \"To invoice\", like any other job." },
  { value: "subscription", label: "Covered by a subscription", hint: "The customer already pays with a subscription. Visits close without an invoice." },
  { value: "included", label: "Included / no charge", hint: "Warranty or courtesy visits. They close without an invoice." },
];
export const billingLabel = (p: Pick<Plan, "billing" | "subscription_number">) =>
  p.billing === "subscription" ? `Subscription${p.subscription_number ? ` ${p.subscription_number}` : ""}` : p.billing === "included" ? "Included" : "Billed each visit";

// "finished" = ya no se crean más visitas; si todavía falta alguna por hacer se dice así
export function planState(p: Pick<Plan, "status" | "visits_upcoming">): { label: string; cls: string } {
  if (p.status === "paused") return { label: "Paused", cls: "bg-[#fff6e6] text-[#b45309]" };
  if (p.status === "cancelled") return { label: "Cancelled", cls: "bg-slate-200 text-slate-500" };
  if (p.status === "finished") return (p.visits_upcoming ?? 0) > 0 ? { label: "Last visits booked", cls: "bg-[#eef4ff] text-[#2563eb]" } : { label: "Finished", cls: "bg-slate-200 text-slate-500" };
  return { label: "Active", cls: "bg-[#e7f6f1] text-[#0f766e]" };
}
export const endLabel = (p: Pick<Plan, "end_kind" | "end_count" | "end_date">) =>
  p.end_kind === "count" ? `Ends after ${p.end_count} visit${p.end_count === 1 ? "" : "s"}` : p.end_kind === "date" && p.end_date ? `Ends ${dayText(p.end_date)}` : "No end date";

export const dayText = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
export const whenText = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

export function planError(e: { message?: string; hint?: string; code?: string } | null | undefined): string {
  if (!e) return "";
  const m = `${e.message ?? ""} ${e.hint ?? ""}`;
  if ((m.includes("BAD_PLAN") || m.includes("NO_ACCESS") || m.includes("NOT_FOUND")) && e.hint) return e.hint;
  if (m.includes("NO_ACCESS")) return "You don't have permission to do this.";
  if (m.includes("maintenance_") && (m.includes("does not exist") || m.includes("Could not find"))) return "Run paso-5.11-maintenance-plans.sql in Supabase first.";
  return "Something went wrong. Try again.";
}

export async function loadPlans(sb: SupabaseClient, companyId: string): Promise<{ plans: Plan[]; needsSql: boolean }> {
  const { data, error } = await sb.rpc("maintenance_plans_list", { p_company: companyId });
  if (error) return { plans: [], needsSql: !`${error.message}`.includes("NO_ACCESS") };
  return { plans: ((data ?? []) as Plan[]).map((p) => ({ ...p, price: Number(p.price) || 0, services: Array.isArray(p.services) ? p.services : [], season_months: p.season_months ?? [], tech_ids: p.tech_ids ?? [] })), needsSql: false };
}

// Trabajos que salieron de un plan (para la etiqueta "Plan" en Operations y Schedule). Sin el SQL nuevo: vacío.
export async function loadPlanJobIds(sb: SupabaseClient, companyId: string): Promise<Set<string>> {
  const { data, error } = await sb.from("jobs").select("id").eq("company_id", companyId).not("plan_id", "is", null).order("created_at", { ascending: false }).limit(3000);
  return new Set(error ? [] : ((data ?? []) as { id: string }[]).map((r) => r.id));
}
