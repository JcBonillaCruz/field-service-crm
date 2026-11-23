import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import NoAccess from "@/components/customers/NoAccess";
import { loadLocationExtra, loadLocationsAll, loadMembers } from "@/lib/inventory-server";
import LocationForm, { LocExtra } from "@/components/inventory/LocationForm";

export const dynamic = "force-dynamic";

export default async function EditLocationPage({ params }: { params: { id: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) return <NoAccess />;
  const [members, locations, ex] = await Promise.all([loadMembers(supabase, current.id), loadLocationsAll(supabase, current.id), loadLocationExtra(supabase, params.id)]);
  const location = locations.find((l) => l.id === params.id);
  if (!location) notFound();
  return <LocationForm companyId={current.id} members={members} location={{ ...location, ...(ex.extra as LocExtra) }} extraSql={ex.extraSql}
    taken={locations.filter((l) => l.id !== location.id && l.kind === "van" && l.is_active && l.assigned_user_id).map((l) => l.assigned_user_id as string)}
    initialKind={location.kind} canEdit={current.role === "owner" || current.role === "manager"} />;
}
