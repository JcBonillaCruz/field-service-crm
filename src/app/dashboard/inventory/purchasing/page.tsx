import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory, kitOf } from "@/lib/inventory";
import NoAccess from "@/components/customers/NoAccess";
import { loadInventory, loadVanKit } from "@/lib/inventory-server";
import { loadPurchasing } from "@/lib/purchasing-server";
import PurchasingView, { PurchTab } from "@/components/inventory/purchasing/PurchasingView";

export const dynamic = "force-dynamic";

// Paso 6.14 · Inventory → Purchasing: Órdenes · Por comprar · Proveedores (dueño, manager y oficina)
export default async function PurchasingPage({ searchParams }: { searchParams: { tab?: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) return <NoAccess />;
  const tab: PurchTab = searchParams.tab === "tobuy" || searchParams.tab === "suppliers" ? searchParams.tab : "orders";
  const [p, inv, kit] = await Promise.all([loadPurchasing(supabase, current.id), loadInventory(supabase, current.id), loadVanKit(supabase, current.id)]);
  return <PurchasingView tab={tab} {...p} items={inv.items} stock={inv.stock} locations={inv.locations} kit={kitOf(kit.kit)} />;
}
