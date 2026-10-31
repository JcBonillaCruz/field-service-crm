import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import NoAccess from "@/components/customers/NoAccess";
import { loadLocationsAll, loadMembers } from "@/lib/inventory-server";
import LocationForm from "@/components/inventory/LocationForm";

export const dynamic = "force-dynamic";

export default async function NewLocationPage({ searchParams }: { searchParams: { kind?: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) return <NoAccess />;
  const [members, locations] = await Promise.all([loadMembers(supabase, current.id), loadLocationsAll(supabase, current.id)]);
  return <LocationForm companyId={current.id} members={members} taken={locations.filter((l) => l.kind === "van" && l.is_active && l.assigned_user_id).map((l) => l.assigned_user_id as string)}
    initialKind={searchParams.kind === "warehouse" ? "warehouse" : "van"} canEdit={current.role === "owner" || current.role === "manager"} />;
}
