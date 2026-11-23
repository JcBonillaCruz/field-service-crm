import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import NoAccess from "@/components/customers/NoAccess";
import { loadInventory } from "@/lib/inventory-server";
import { loadPurchasing } from "@/lib/purchasing-server";
import PoForm from "@/components/inventory/purchasing/PoForm";

export const dynamic = "force-dynamic";

// Paso 6.14 · Nueva orden de compra. Desde "Por comprar" llega con ?supplier=…&lines=itemId:qty,…
export default async function NewPurchaseOrderPage({ searchParams }: { searchParams: { supplier?: string; lines?: string; item?: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) return <NoAccess />;
  const [p, inv] = await Promise.all([loadPurchasing(supabase, current.id), loadInventory(supabase, current.id)]);
  const initialLines = (searchParams.lines ?? (searchParams.item ? `${searchParams.item}:1` : "")).split(",").map((x) => x.split(":"))
    .filter(([id]) => id).map(([item, qty]) => ({ item, qty: Math.max(1, Number(qty) || 1) })).slice(0, 300);
  // Desde la ficha de un producto: su proveedor preferido
  const pref = searchParams.item ? p.links.find((l) => l.item_id === searchParams.item && l.is_preferred)?.supplier_id : undefined;
  return <PoForm companyId={current.id} suppliers={p.suppliers} links={p.links} items={inv.items} buying={p.buying} locations={inv.locations} barcodes={inv.barcodes}
    initialSupplier={searchParams.supplier ?? pref} initialLines={initialLines} />;
}
