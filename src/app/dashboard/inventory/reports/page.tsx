import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import NoAccess from "@/components/customers/NoAccess";
import { loadLocationsAll, loadMovements } from "@/lib/inventory-server";
import ReportsView from "@/components/inventory/ReportsView";

export const dynamic = "force-dynamic";

export default async function InventoryReportsPage({ searchParams }: { searchParams: { days?: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) return <NoAccess />;
  const days = [7, 30, 90, 365].includes(Number(searchParams.days)) ? Number(searchParams.days) : 30;
  const [locations, moves] = await Promise.all([loadLocationsAll(supabase, current.id), loadMovements(supabase, current.id, { days, kinds: ["use", "count", "transfer", "return"], limit: 10000 })]);
  return <ReportsView locations={locations} moves={moves.rows} days={days} />;
}
