import type { SupabaseClient } from "@supabase/supabase-js";
import type { ItemOption } from "@/lib/sales-server";
import type { JobType } from "@/lib/jobs";
import { TPL_COLS, WorkTemplate, tplError, tplOf } from "@/lib/templates";

// Paso 6.10: datos de la pantalla de plantillas (lista y formulario)
export async function loadTemplates(supabase: SupabaseClient, companyId: string) {
  const [tpls, types] = await Promise.all([
    supabase.from("work_templates").select(TPL_COLS).eq("company_id", companyId).order("is_active", { ascending: false }).order("position").order("name").limit(1000),
    supabase.from("job_types").select("id, name, color, default_duration_min, form_kind, position, is_active").eq("company_id", companyId).order("position").order("name"),
  ]);
  return {
    needsSql: Boolean(tpls.error && tplError(tpls.error) === "sql"),
    list: ((tpls.data ?? []) as Record<string, unknown>[]).map(tplOf) as WorkTemplate[],
    types: (types.data ?? []) as JobType[],
  };
}

export async function loadTemplateForm(supabase: SupabaseClient, companyId: string, id?: string) {
  const [one, types, items] = await Promise.all([
    id ? supabase.from("work_templates").select(TPL_COLS).eq("company_id", companyId).eq("id", id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabase.from("job_types").select("id, name, color, default_duration_min, form_kind, position, is_active").eq("company_id", companyId).order("position").order("name"),
    supabase.from("items").select("id, name, sku, selling_price, description, unit, image_url, item_type").eq("company_id", companyId).eq("is_active", true).order("name").limit(5000),
  ]);
  return {
    template: one.data ? tplOf(one.data as Record<string, unknown>) : null,
    types: (types.data ?? []) as JobType[],
    items: (items.data ?? []) as ItemOption[],
  };
}
