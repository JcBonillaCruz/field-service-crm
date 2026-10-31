import type { SupabaseClient } from "@supabase/supabase-js";
import { InvCategory, InvItem, InvLocation, InvMember, InvPhoto, InvStock } from "@/lib/inventory";

// Inventario: SIEMPRE en vivo (sin caché), las cantidades cambian todo el día
export async function loadInventory(supabase: SupabaseClient, companyId: string) {
  const [items, stock, locs, cats, photos] = await Promise.all([
    supabase.from("items").select("id, name, sku, unit, image_url, selling_price, cost_price, category_id, description, is_active, created_at")
      .eq("company_id", companyId).eq("track_inventory", true).order("name").limit(10000),
    supabase.from("inventory_stock").select("item_id, location_id, qty, min_qty").eq("company_id", companyId).limit(50000),
    supabase.from("inventory_locations").select("id, name, kind, is_default, assigned_user_id").eq("company_id", companyId).eq("is_active", true)
      .order("is_default", { ascending: false }).order("name"),
    supabase.from("item_categories").select("id, name").eq("company_id", companyId).order("name"),
    supabase.from("item_photos").select("id, item_id, url, path, position").eq("company_id", companyId).order("position").limit(30000),
  ]);
  const needsSql = Boolean(items.error || stock.error || locs.error);
  let locations = (locs.data ?? []) as InvLocation[];
  // Compañía nueva: crea la bodega principal la primera vez
  if (!needsSql && !locations.some((l) => l.kind === "warehouse")) {
    await supabase.rpc("inv_default_location", { p_company: companyId });
    const again = await supabase.from("inventory_locations").select("id, name, kind, is_default, assigned_user_id")
      .eq("company_id", companyId).eq("is_active", true).order("is_default", { ascending: false }).order("name");
    locations = (again.data ?? []) as InvLocation[];
  }
  return {
    needsSql,
    items: ((items.data ?? []) as InvItem[]).map((i) => ({ ...i, selling_price: Number(i.selling_price), cost_price: Number(i.cost_price) })),
    stock: ((stock.data ?? []) as InvStock[]).map((s) => ({ ...s, qty: Number(s.qty), min_qty: Number(s.min_qty) })),
    locations,
    categories: (cats.data ?? []) as InvCategory[],
    photos: (photos.data ?? []) as InvPhoto[],
  };
}

// Un solo producto (ficha y edición)
export async function loadInventoryItem(supabase: SupabaseClient, companyId: string, id: string) {
  const [item, stock, locs, cats, photos] = await Promise.all([
    supabase.from("items").select("id, name, sku, unit, image_url, selling_price, cost_price, category_id, description, is_active, created_at")
      .eq("company_id", companyId).eq("id", id).eq("track_inventory", true).maybeSingle(),
    supabase.from("inventory_stock").select("item_id, location_id, qty, min_qty").eq("item_id", id),
    supabase.from("inventory_locations").select("id, name, kind, is_default, assigned_user_id").eq("company_id", companyId).eq("is_active", true)
      .order("is_default", { ascending: false }).order("name"),
    supabase.from("item_categories").select("id, name").eq("company_id", companyId).order("name"),
    supabase.from("item_photos").select("id, item_id, url, path, position").eq("item_id", id).order("position"),
  ]);
  if (!item.data) return null;
  const it = item.data as InvItem;
  return {
    item: { ...it, selling_price: Number(it.selling_price), cost_price: Number(it.cost_price) },
    stock: ((stock.data ?? []) as InvStock[]).map((s) => ({ ...s, qty: Number(s.qty), min_qty: Number(s.min_qty) })),
    locations: (locs.data ?? []) as InvLocation[],
    categories: (cats.data ?? []) as InvCategory[],
    photos: (photos.data ?? []) as InvPhoto[],
  };
}

// Movimientos con el nombre del producto (los permisos de la base ya limitan qué ve cada quien)
export const MOVE_SELECT = "id, item_id, kind, qty, from_location, to_location, unit_cost, reason, note, actor_id, actor_name, responsible_id, responsible_name, expected_qty, counted_qty, batch_id, created_at, items ( name, sku, unit )";
export type MoveRow = {
  id: string; item_id: string; kind: string; qty: number; from_location: string | null; to_location: string | null; unit_cost: number | null;
  reason: string | null; note: string | null; actor_id: string | null; actor_name: string | null; responsible_id: string | null; responsible_name: string | null;
  expected_qty: number | null; counted_qty: number | null; batch_id: string | null; created_at: string; items: { name: string; sku: string | null; unit: string | null } | null;
};
export async function loadMovements(supabase: SupabaseClient, companyId: string, opts: { days?: number; kinds?: string[]; location?: string; limit?: number } = {}) {
  let q = supabase.from("inventory_movements").select(MOVE_SELECT).eq("company_id", companyId).order("created_at", { ascending: false }).limit(opts.limit ?? 3000);
  if (opts.days) q = q.gte("created_at", new Date(Date.now() - opts.days * 86400000).toISOString());
  if (opts.kinds?.length) q = q.in("kind", opts.kinds);
  if (opts.location) q = q.or(`from_location.eq.${opts.location},to_location.eq.${opts.location}`);
  const { data, error } = await q;
  return { rows: ((data ?? []) as unknown as MoveRow[]).map((m) => ({ ...m, qty: Number(m.qty), unit_cost: m.unit_cost == null ? null : Number(m.unit_cost) })), error };
}

export async function loadLocationsAll(supabase: SupabaseClient, companyId: string) {
  const { data } = await supabase.from("inventory_locations").select("id, name, kind, is_default, is_active, assigned_user_id, created_at")
    .eq("company_id", companyId).order("is_default", { ascending: false }).order("kind").order("name");
  return (data ?? []) as (InvLocation & { is_active: boolean; created_at: string })[];
}

export async function loadMembers(supabase: SupabaseClient, companyId: string) {
  const { data } = await supabase.rpc("inv_members", { p_company: companyId });
  return (data ?? []) as InvMember[];
}
