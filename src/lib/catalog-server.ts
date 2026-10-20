import type { SupabaseClient } from "@supabase/supabase-js";
import { BUILTIN_VIEWS, CatalogModule, ViewDef } from "@/lib/catalog-views";

// Vistas guardadas (la base de datos ya filtra quién puede ver cada una)
export async function loadViews(supabase: SupabaseClient, companyId: string, module: CatalogModule): Promise<ViewDef[]> {
  const { data } = await supabase.from("list_views")
    .select("id, name, is_favorite, criteria, match, columns, visibility, roles, user_id")
    .eq("company_id", companyId).eq("module", module).order("created_at");
  return (data ?? []).map((v) => ({
    id: v.id, name: v.name, is_favorite: v.is_favorite, criteria: v.criteria ?? [], match: v.match === "any" ? "any" : "all",
    columns: Array.isArray(v.columns) && v.columns.length ? v.columns : ["name"], visibility: v.visibility, roles: v.roles ?? [], user_id: v.user_id,
  }));
}

export async function findView(supabase: SupabaseClient, companyId: string, module: CatalogModule, id: string) {
  const builtin = BUILTIN_VIEWS[module].find((v) => v.id === id);
  if (builtin) return builtin;
  return (await loadViews(supabase, companyId, module)).find((v) => v.id === id) ?? null;
}

export async function loadHistory(supabase: SupabaseClient, entity: "item" | "coupon", id: string) {
  const { data } = await supabase.from("catalog_history").select("id, action, actor_name, changes, created_at")
    .eq("entity", entity).eq("entity_id", id).order("created_at", { ascending: false }).limit(200);
  return data ?? [];
}
