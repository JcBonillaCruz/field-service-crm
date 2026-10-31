import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import NoAccess from "@/components/customers/NoAccess";
import { loadLocationsAll, loadMembers } from "@/lib/inventory-server";
import LocationsView from "@/components/inventory/LocationsView";

export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) return <NoAccess />;
  const [locations, members, stock, items] = await Promise.all([
    loadLocationsAll(supabase, current.id),
    loadMembers(supabase, current.id),
    supabase.from("inventory_stock").select("item_id, location_id, qty, min_qty").eq("company_id", current.id).limit(50000),
    supabase.from("items").select("id, cost_price").eq("company_id", current.id).eq("track_inventory", true).limit(10000),
  ]);
  const cost = new Map((items.data ?? []).map((i) => [i.id as string, Number(i.cost_price)]));
  const stats: Record<string, { units: number; value: number; low: number; items: number }> = {};
  for (const s of stock.data ?? []) {
    const k = s.location_id as string, q = Number(s.qty), m = Number(s.min_qty);
    const t = (stats[k] ??= { units: 0, value: 0, low: 0, items: 0 });
    if (q > 0) { t.units += q; t.items += 1; t.value += q * (cost.get(s.item_id as string) ?? 0); }
    if (m > 0 && q <= m) t.low += 1;
  }
  return <LocationsView locations={locations} members={members} stats={stats} canEdit={current.role === "owner" || current.role === "manager"} />;
}
