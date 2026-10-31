import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import NoAccess from "@/components/customers/NoAccess";
import { loadLocationsAll, loadMovements } from "@/lib/inventory-server";
import CountsView from "@/components/inventory/CountsView";

export const dynamic = "force-dynamic";

export default async function CountsPage() {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) return <NoAccess />;
  const [locations, moves] = await Promise.all([loadLocationsAll(supabase, current.id), loadMovements(supabase, current.id, { kinds: ["count"], days: 365, limit: 5000 })]);
  return <CountsView locations={locations} moves={moves.rows} />;
}
