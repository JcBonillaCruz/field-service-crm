import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import NoAccess from "@/components/customers/NoAccess";
import { loadInventory } from "@/lib/inventory-server";
import { loadPurchaseOrder, loadPurchasing } from "@/lib/purchasing-server";
import PoForm from "@/components/inventory/purchasing/PoForm";

export const dynamic = "force-dynamic";

export default async function EditPurchaseOrderPage({ params }: { params: { id: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) return <NoAccess />;
  const [one, p, inv] = await Promise.all([loadPurchaseOrder(supabase, current.id, params.id), loadPurchasing(supabase, current.id), loadInventory(supabase, current.id)]);
  if (!one) notFound();
  if (one.po.status !== "draft" && one.po.status !== "ordered") redirect(`/dashboard/inventory/purchasing/${params.id}`);
  return <PoForm companyId={current.id} po={one.po} poLines={one.lines} suppliers={p.suppliers} links={p.links} items={inv.items} buying={p.buying} locations={inv.locations} barcodes={inv.barcodes} />;
}
