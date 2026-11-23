import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory, kitOf } from "@/lib/inventory";
import NoAccess from "@/components/customers/NoAccess";
import { loadBoard, loadLocationsAll, loadMovements } from "@/lib/inventory-server";
import ReportsView from "@/components/inventory/ReportsView";
import InvReportAlerts from "@/components/inventory/InvReportAlerts";

export const dynamic = "force-dynamic";

export default async function InventoryReportsPage({ searchParams }: { searchParams: { days?: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) return <NoAccess />;
  const days = [7, 30, 90, 365].includes(Number(searchParams.days)) ? Number(searchParams.days) : 30;
  const [locations, moves, b, rev] = await Promise.all([
    loadLocationsAll(supabase, current.id),
    loadMovements(supabase, current.id, { days, kinds: ["use", "count", "transfer", "return"], limit: 10000 }),
    loadBoard(supabase, current.id),
    supabase.from("inventory_count_reversals").select("batch_id").eq("company_id", current.id),
  ]);
  // Paso 6.12d: los conteos revertidos ya no cuentan como faltante
  const gone = new Set(((rev.data ?? []) as { batch_id: string }[]).map((r) => r.batch_id));
  return (
    <ReportsView locations={locations} moves={moves.rows.filter((m) => !(m.kind === "count" && m.batch_id && gone.has(m.batch_id)))} days={days}>
      <InvReportAlerts items={b.items} stock={b.stock} locations={b.locations} members={b.members} kit={kitOf(b.kit)} moves={b.moves} company={current.name} />
    </ReportsView>
  );
}
