import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import NoAccess from "@/components/customers/NoAccess";
import { loadInventory, loadLocationsAll, loadMembers, loadVanKit } from "@/lib/inventory-server";
import LocationForm from "@/components/inventory/LocationForm";
import { kitOf } from "@/lib/inventory";

export const dynamic = "force-dynamic";

// Paso 6.12: nueva Van / Truck (técnico, vehículo, foto y kit estándar) o Warehouse (dirección, Main)
export default async function NewLocationPage({ searchParams }: { searchParams: { kind?: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) return <NoAccess />;
  const [members, locations, inv, kit] = await Promise.all([loadMembers(supabase, current.id), loadLocationsAll(supabase, current.id), loadInventory(supabase, current.id), loadVanKit(supabase, current.id)]);
  return <LocationForm companyId={current.id} members={members} taken={locations.filter((l) => l.kind === "van" && l.is_active && l.assigned_user_id).map((l) => l.assigned_user_id as string)}
    initialKind={searchParams.kind === "warehouse" ? "warehouse" : "van"} canEdit={current.role === "owner" || current.role === "manager"}
    items={inv.items} barcodes={inv.barcodes} kit={kitOf(kit.kit).filter((k) => inv.items.some((i) => i.id === k.item_id))} extraSql={kit.kitSql} />;
}
