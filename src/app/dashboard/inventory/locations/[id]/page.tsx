import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import NoAccess from "@/components/customers/NoAccess";
import { loadLocationExtra, loadLocationsAll, loadMembers, loadMovements } from "@/lib/inventory-server";
import { VAN_TABS, VanTab, asPeriod, histRange, loadVanHistory } from "@/lib/van-history";
import type { LocExtra } from "@/components/inventory/LocationForm";
import LocationDetail from "@/components/inventory/LocationDetail";

export const dynamic = "force-dynamic";

// Paso 6.13 · Ficha de la van / almacén con pestañas (Stock now · Used · Received · Counts · Not scanned)
// El técnico puede abrir SOLO su van y nunca recibe costos.
export default async function LocationPage({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string; p?: string } }) {
  const { supabase, current, user } = await getSession();
  if (!current) redirect("/dashboard");
  const manager = canManageInventory(current.role);
  const locations = await loadLocationsAll(supabase, current.id);
  const location = locations.find((l) => l.id === params.id);
  if (!location) { if (!manager) return <NoAccess />; notFound(); }
  const mine = location.kind === "van" && location.assigned_user_id === user.id;
  if (!manager && !mine) return <NoAccess />;
  const showCost = manager;

  const tab: VanTab = VAN_TABS.includes(searchParams.tab as VanTab) ? (searchParams.tab as VanTab) : "stock";
  const period = asPeriod(searchParams.p);
  const range = histRange(period);
  const locName = (id: string | null) => locations.find((l) => l.id === id)?.name ?? "—";
  const [members, stock, moves, ex, hist] = await Promise.all([
    manager ? loadMembers(supabase, current.id) : Promise.resolve([]),
    supabase.from("inventory_stock").select("item_id, qty, min_qty, items ( name, sku, unit, cost_price, image_url )").eq("location_id", params.id).limit(10000),
    loadMovements(supabase, current.id, { location: params.id, limit: 40 }),
    loadLocationExtra(supabase, params.id),
    loadVanHistory(supabase, current.id, location, range, showCost, locName),
  ]);
  type S = { item_id: string; qty: number; min_qty: number; items: { name: string; sku: string | null; unit: string | null; cost_price: number; image_url: string | null } | null };
  const rows = ((stock.data ?? []) as unknown as S[]).filter((r) => r.items).map((r) => ({
    ...r, qty: Number(r.qty), min_qty: Number(r.min_qty), items: r.items ? { ...r.items, cost_price: showCost ? Number(r.items.cost_price) : 0 } : null,
  }));
  const techName = members.find((m) => m.user_id === location.assigned_user_id)?.full_name ?? (mine ? user.fullName || null : null);
  return <LocationDetail extra={ex.extra as LocExtra} location={location} locations={locations} rows={rows}
    moves={moves.rows.map((m) => (showCost ? m : { ...m, unit_cost: null }))} techName={techName}
    canEdit={current.role === "owner" || current.role === "manager"} manager={manager} tab={tab} period={period} hist={hist} />;
}
