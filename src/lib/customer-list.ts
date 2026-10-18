import type { SupabaseClient } from "@supabase/supabase-js";

// Vistas, orden y búsqueda de la lista de clientes (los usan la lista y la exportación)
export const VIEWS = [
  { value: "all", label: "All Customers" },
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
] as const;

export const SORTS = [
  { value: "name", label: "Name", column: "display_name" },
  { value: "company", label: "Company name", column: "company_name" },
  { value: "email", label: "Email", column: "email" },
  { value: "created", label: "Created time", column: "created_at" },
] as const;

export type ListParams = { q: string; view: string; sort: string; dir: "asc" | "desc" };

export function readListParams(sp: Record<string, string | undefined>): ListParams {
  const view = VIEWS.some((v) => v.value === sp.view) ? sp.view! : "all";
  const sort = SORTS.some((s) => s.value === sp.sort) ? sp.sort! : "name";
  const dir = sp.dir === "desc" ? "desc" : "asc";
  return { q: (sp.q ?? "").trim(), view, sort, dir };
}

export function listQueryString(p: Partial<ListParams>) {
  const s = new URLSearchParams();
  if (p.q) s.set("q", p.q);
  if (p.view && p.view !== "all") s.set("view", p.view);
  if (p.sort && p.sort !== "name") s.set("sort", p.sort);
  if (p.dir === "desc") s.set("dir", "desc");
  const str = s.toString();
  return str ? `?${str}` : "";
}

export function customerListQuery(supabase: SupabaseClient, companyId: string, p: ListParams, select: string) {
  let query = supabase
    .from("customers")
    .select(select)
    .eq("company_id", companyId)
    .eq("is_archived", false);

  if (p.view === "residential" || p.view === "commercial") query = query.eq("customer_type", p.view);

  if (p.q) {
    const safe = p.q.replace(/[,()%*\\]/g, " ").trim();
    const digits = p.q.replace(/\D/g, "");
    const parts = [`display_name.ilike.%${safe}%`, `contact_search.ilike.%${safe.toLowerCase()}%`];
    if (digits.length >= 3) parts.push(`contact_search.like.%${digits}%`);
    query = query.or(parts.join(","));
  }

  const column = SORTS.find((s) => s.value === p.sort)!.column;
  query = query.order(column, { ascending: p.dir === "asc", nullsFirst: false });
  if (column !== "display_name") query = query.order("display_name");
  return query;
}
