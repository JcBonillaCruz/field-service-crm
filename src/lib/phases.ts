import type { SupabaseClient } from "@supabase/supabase-js";

// =====================================================================
// Fases del trabajo con peso (Paso 5.4)
// Cada tipo de trabajo trae su plantilla; al crear el trabajo se copia a job_phases.
// % de avance = peso de las fases terminadas / peso total.
// =====================================================================
export type PhaseStatus = "pending" | "in_progress" | "completed" | "blocked";
export type JobPhase = {
  id: string; job_id: string; position: number; name: string; weight: number; status: PhaseStatus;
  blocked_reason: string | null; started_at: string | null; completed_at: string | null; updated_at: string | null; updated_by_name: string | null;
};
export type PhaseTpl = { name: string; weight: number };
export type PhaseProgress = { job_id: string; pct: number; total: number; done: number; current_name: string | null; blocked: boolean };

export const PHASE_META: Record<PhaseStatus, { label: string; text: string; bg: string; ring: string }> = {
  pending: { label: "Pending", text: "text-slate-500", bg: "bg-slate-100", ring: "border-slate-300" },
  in_progress: { label: "In progress", text: "text-[#b45309]", bg: "bg-[#fff6e6]", ring: "border-[#f59e0b]" },
  completed: { label: "Completed", text: "text-[#0f766e]", bg: "bg-[#e9f7f4]", ring: "border-[#14a39a]" },
  blocked: { label: "Blocked", text: "text-[#be123c]", bg: "bg-[#fff1f2]", ring: "border-[#e11d48]" },
};

export const phasePct = (list: Pick<JobPhase, "weight" | "status">[]): number => {
  const total = list.reduce((a, p) => a + Number(p.weight || 0), 0);
  if (!total) return 0;
  return Math.round((100 * list.filter((p) => p.status === "completed").reduce((a, p) => a + Number(p.weight || 0), 0)) / total);
};
// Cuánto pesa cada fase dentro del trabajo, en % (para mostrar "50%")
export const phaseShare = (weight: number, list: Pick<JobPhase, "weight">[]): number => {
  const total = list.reduce((a, p) => a + Number(p.weight || 0), 0);
  return total ? Math.round((100 * Number(weight || 0)) / total) : 0;
};

// Avance por trabajo para Operations y Dashboard. Si el SQL del Paso 5.4 no se ha corrido, regresa vacío
// y todo sigue con el cálculo anterior.
export async function loadPhaseProgress(sb: SupabaseClient, companyId: string): Promise<Map<string, PhaseProgress>> {
  const map = new Map<string, PhaseProgress>();
  const { data, error } = await sb.rpc("job_phase_progress", { p_company: companyId });
  if (error || !data) return map;
  (data as PhaseProgress[]).forEach((r) => map.set(r.job_id, r));
  return map;
}
export function withPhases<T extends { id: string }>(jobs: T[], map: Map<string, PhaseProgress>): T[] {
  if (!map.size) return jobs;
  return jobs.map((j) => {
    const p = map.get(j.id);
    return p && p.total > 0 ? { ...j, phase_pct: p.pct, phase_total: p.total, phase_done: p.done, phase_now: p.current_name, phase_blocked: p.blocked } : j;
  });
}

export const cleanTpl = (v: unknown): PhaseTpl[] =>
  Array.isArray(v) ? v.map((x) => ({ name: String((x as PhaseTpl)?.name ?? "").trim(), weight: Number((x as PhaseTpl)?.weight) || 0 })).filter((x) => x.name) : [];
