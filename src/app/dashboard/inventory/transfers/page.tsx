import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import NoAccess from "@/components/customers/NoAccess";
import { loadLocationsAll, loadMovements } from "@/lib/inventory-server";
import TransfersView from "@/components/inventory/TransfersView";

export const dynamic = "force-dynamic";

export default async function TransfersPage({ searchParams }: { searchParams: { done?: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) return <NoAccess />;
  const [locations, moves] = await Promise.all([loadLocationsAll(supabase, current.id), loadMovements(supabase, current.id, { kinds: ["transfer", "return"], days: 90, limit: 2000 })]);
  return <TransfersView locations={locations} moves={moves.rows} done={Number(searchParams.done) || 0} />;
}
