import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import NoAccess from "@/components/customers/NoAccess";
import { MOVE_SELECT, MoveRow, loadLocationsAll } from "@/lib/inventory-server";
import CountDetail, { Reversal } from "@/components/inventory/CountDetail";

export const dynamic = "force-dynamic";

// Paso 6.12d · Un conteo: lo esperado vs. lo contado, PDF / Excel, y (dueño o manager) corregir o revertir con motivo
export default async function CountPage({ params }: { params: { batch: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) return <NoAccess />;
  const [moves, rev, locations] = await Promise.all([
    supabase.from("inventory_movements").select(MOVE_SELECT).eq("company_id", current.id).eq("batch_id", params.batch).eq("kind", "count").order("created_at"),
    supabase.from("inventory_count_reversals").select("reason, reversed_by_name, role, created_at").eq("company_id", current.id).eq("batch_id", params.batch).maybeSingle(),
    loadLocationsAll(supabase, current.id),
  ]);
  const rows = ((moves.data ?? []) as unknown as MoveRow[]).map((m) => ({ ...m, qty: Number(m.qty), unit_cost: m.unit_cost == null ? null : Number(m.unit_cost) }));
  if (!rows.length) notFound();
  const locId = rows.find((m) => m.from_location || m.to_location);
  const location = locations.find((l) => l.id === (locId?.from_location ?? locId?.to_location)) ?? null;
  return <CountDetail companyId={current.id} batch={params.batch} rows={rows} location={location} company={current.name} reversal={(rev.error ? null : rev.data) as Reversal | null}
    reverseSql={!rev.error} canReverse={current.role === "owner" || current.role === "manager"} />;
}
