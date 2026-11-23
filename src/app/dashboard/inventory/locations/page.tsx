import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory, kitOf } from "@/lib/inventory";
import NoAccess from "@/components/customers/NoAccess";
import { loadBoard } from "@/lib/inventory-server";
import StockVansBoard, { LocLite } from "@/components/inventory/StockVansBoard";

export const dynamic = "force-dynamic";

// Paso 6.12c · Stock & Vans: almacenes y vans con lo que traen y botones directos
export default async function LocationsPage() {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) return <NoAccess />;
  const b = await loadBoard(supabase, current.id, { allLocations: true });
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f4f6f8] px-4 pb-24 pt-5 lg:px-8 lg:pb-10 lg:pt-7">
      <StockVansBoard items={b.items} stock={b.stock} locations={b.boardLocations as LocLite[]} members={b.members} kit={kitOf(b.kit)} moves={b.moves}
        canEdit={current.role === "owner" || current.role === "manager"} />
    </div>
  );
}
