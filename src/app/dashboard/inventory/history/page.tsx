import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import NoAccess from "@/components/customers/NoAccess";
import { loadLocationsAll, loadMovements } from "@/lib/inventory-server";
import MovementsView from "@/components/inventory/MovementsView";
import TransfersView from "@/components/inventory/TransfersView";
import CountsView from "@/components/inventory/CountsView";
import HistoryTabs, { HistTab } from "@/components/inventory/HistoryTabs";

export const dynamic = "force-dynamic";

// Paso 6.12 · History = Movements + Transfers + Counts (las pantallas de siempre, en pestañas)
export default async function InventoryHistoryPage({ searchParams }: { searchParams: { tab?: string; days?: string; location?: string; done?: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) return <NoAccess />;
  const tab: HistTab = searchParams.tab === "transfers" || searchParams.tab === "counts" ? searchParams.tab : "movements";
  const days = [7, 30, 90, 365].includes(Number(searchParams.days)) ? Number(searchParams.days) : 30;
  const opts = tab === "transfers" ? { kinds: ["transfer", "return"], days: 90, limit: 2000 } : tab === "counts" ? { kinds: ["count"], days: 365, limit: 5000 } : { days, limit: 5000 };
  const [locations, moves] = await Promise.all([loadLocationsAll(supabase, current.id), loadMovements(supabase, current.id, opts)]);
  return (
    <>
      <HistoryTabs active={tab} />
      {tab === "transfers" ? <TransfersView locations={locations} moves={moves.rows} done={Number(searchParams.done) || 0} />
        : tab === "counts" ? <CountsView locations={locations} moves={moves.rows} />
          : <MovementsView locations={locations} moves={moves.rows} days={days} initialLocation={searchParams.location ?? "all"} />}
    </>
  );
}
