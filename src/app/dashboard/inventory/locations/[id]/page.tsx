import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import NoAccess from "@/components/customers/NoAccess";
import { loadLocationsAll, loadMembers, loadMovements } from "@/lib/inventory-server";
import LocationDetail from "@/components/inventory/LocationDetail";

export const dynamic = "force-dynamic";

export default async function LocationPage({ params }: { params: { id: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) return <NoAccess />;
  const [locations, members, stock, moves] = await Promise.all([
    loadLocationsAll(supabase, current.id),
    loadMembers(supabase, current.id),
    supabase.from("inventory_stock").select("item_id, qty, min_qty, items ( name, sku, unit, cost_price, image_url )").eq("location_id", params.id).limit(10000),
    loadMovements(supabase, current.id, { location: params.id, limit: 40 }),
  ]);
  const location = locations.find((l) => l.id === params.id);
  if (!location) notFound();
  type S = { item_id: string; qty: number; min_qty: number; items: { name: string; sku: string | null; unit: string | null; cost_price: number; image_url: string | null } | null };
  const rows = ((stock.data ?? []) as unknown as S[]).filter((r) => r.items).map((r) => ({ ...r, qty: Number(r.qty), min_qty: Number(r.min_qty) }));
  return <LocationDetail location={location} locations={locations} rows={rows} moves={moves.rows}
    techName={members.find((m) => m.user_id === location.assigned_user_id)?.full_name ?? null} canEdit={current.role === "owner" || current.role === "manager"} />;
}
