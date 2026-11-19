import type { SupabaseClient } from "@supabase/supabase-js";
import type { Financed } from "@/lib/financing";

// Paso 5.12 · Financing: la cuota mensual entra sola a Expenses en su fecha.
// financing_auto_run usa el mismo camino que "Record payment". Sin el SQL nuevo (o sin permiso) no pasa nada.
export const runFinancingAuto = (supabase: SupabaseClient, companyId: string, today: string) =>
  supabase.rpc("financing_auto_run", { p_company: companyId, p_today: today }).then((r) => Number(r.data) || 0, () => 0);

export type AutoFlags = Record<string, { on: boolean; since: string }>;
// ¿Qué compras tienen encendido "anotar sola la cuota"? null = falta correr el SQL del paso 5.12
export async function loadAutoFlags(supabase: SupabaseClient, companyId: string): Promise<AutoFlags | null> {
  const { data, error } = await supabase.from("financed_purchases").select("id, auto_record, auto_since").eq("company_id", companyId).limit(500);
  if (error) return null;
  const out: AutoFlags = {};
  ((data ?? []) as { id: string; auto_record: boolean; auto_since: string }[]).forEach((r) => { out[r.id] = { on: Boolean(r.auto_record), since: r.auto_since }; });
  return out;
}

// Resumen para Expenses: compras a pagos que siguen abiertas (solo dueño y manager reciben datos)
export type FinBrief = { id: string; name: string; monthly: number; owed: number; next_due: string | null; auto: boolean; needsManual: boolean };
export async function loadFinancingBrief(supabase: SupabaseClient, companyId: string, today: string): Promise<FinBrief[]> {
  const [{ data, error }, flags] = await Promise.all([supabase.rpc("financing_list", { p_company: companyId }), loadAutoFlags(supabase, companyId)]);
  if (error || !data) return [];
  return ((Array.isArray(data) ? data : []) as Financed[]).filter((f) => Number(f.owed) > 0.004).map((f) => {
    const fl = flags?.[f.id];
    const auto = Boolean(fl?.on);
    // Cuota con fecha anterior a cuando se encendió: no se crea sola, hay que registrarla a mano
    const needsManual = Boolean(f.next_due && f.next_due <= today && (!auto || (fl && f.next_due < fl.since)));
    return { id: f.id, name: f.name, monthly: Math.min(Number(f.owed), Number(f.monthly_payment)), owed: Number(f.owed), next_due: f.next_due, auto, needsManual };
  }).sort((a, b) => String(a.next_due ?? "9").localeCompare(String(b.next_due ?? "9")));
}
