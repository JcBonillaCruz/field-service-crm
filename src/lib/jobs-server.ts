import type { SupabaseClient } from "@supabase/supabase-js";
import type { PayerOption } from "@/components/expenses/ExpensesWorkspace";
import { ChecklistTemplate, DEFAULT_SETTINGS, JobSettings, JobTag, JobType, TeamMember } from "@/lib/jobs";

// Jobs: siempre en vivo (el calendario cambia todo el día)
export async function loadJobBasics(supabase: SupabaseClient, companyId: string) {
  let settings = await supabase.from("job_settings").select("*").eq("company_id", companyId).maybeSingle();
  // Compañía nueva: crea ajustes, tipos y etiquetas la primera vez
  if (!settings.error && !settings.data) {
    await supabase.rpc("job_ensure_setup", { p_company: companyId });
    settings = await supabase.from("job_settings").select("*").eq("company_id", companyId).maybeSingle();
  }
  const [types, tags, team, templates] = await Promise.all([
    supabase.from("job_types").select("id, name, color, default_duration_min, form_kind, position, is_active").eq("company_id", companyId).order("position").order("name"),
    supabase.from("job_tags").select("id, name, color").eq("company_id", companyId).order("name"),
    supabase.rpc("job_team", { p_company: companyId }),
    supabase.from("job_checklist_templates").select("id, name, job_type_id, items").eq("company_id", companyId).order("name"),
  ]);
  const s = (settings.data ?? {}) as Partial<JobSettings>;
  return {
    needsSql: Boolean(settings.error || types.error),
    settings: {
      ...DEFAULT_SETTINGS, ...s, company_id: companyId,
      day_start: String(s.day_start ?? DEFAULT_SETTINGS.day_start).slice(0, 5),
      day_end: String(s.day_end ?? DEFAULT_SETTINGS.day_end).slice(0, 5),
    } as JobSettings,
    types: (types.data ?? []) as JobType[],
    tags: (tags.data ?? []) as JobTag[],
    team: (team.data ?? []) as TeamMember[],
    templates: (templates.data ?? []) as ChecklistTemplate[],
  };
}

export async function loadCustomerOptions(supabase: SupabaseClient, companyId: string): Promise<PayerOption[]> {
  const { data } = await supabase.from("customers").select("id, display_name, company_name, email, phone").eq("company_id", companyId).order("display_name").limit(5000);
  return (data ?? []) as PayerOption[];
}
