import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import NoAccess from "@/components/customers/NoAccess";
import { loadInventory } from "@/lib/inventory-server";
import { loadPurchaseOrder, loadPurchasing } from "@/lib/purchasing-server";
import PoDetail from "@/components/inventory/purchasing/PoDetail";

export const dynamic = "force-dynamic";

export default async function PurchaseOrderPage({ params, searchParams }: { params: { id: string }; searchParams: { saved?: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) return <NoAccess />;
  const [one, p, inv] = await Promise.all([loadPurchaseOrder(supabase, current.id, params.id), loadPurchasing(supabase, current.id), loadInventory(supabase, current.id)]);
  if (!one) notFound();
  return <PoDetail companyId={current.id} company={current.name} po={one.po} lines={one.lines} supplier={p.suppliers.find((s) => s.id === one.po.supplier_id) ?? null}
    links={p.links} items={inv.items} locations={inv.locations} saved={searchParams.saved} />;
}
