import type { SupabaseClient } from "@supabase/supabase-js";
import { InvCategory, InvItem, InvLocation, InvPhoto, InvStock } from "@/lib/inventory";

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
