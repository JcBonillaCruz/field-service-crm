import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import NoAccess from "@/components/customers/NoAccess";
import { loadInventory } from "@/lib/inventory-server";
import { loadPurchasing } from "@/lib/purchasing-server";
import SupplierForm from "@/components/inventory/purchasing/SupplierForm";

export const dynamic = "force-dynamic";

// Paso 6.14 · Proveedor: sus datos + lo que le compras + sus órdenes
export default async function SupplierPage({ params }: { params: { id: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) return <NoAccess />;
  const [p, inv] = await Promise.all([loadPurchasing(supabase, current.id), loadInventory(supabase, current.id)]);
  const supplier = p.suppliers.find((s) => s.id === params.id);
  if (!supplier) notFound();
  return <SupplierForm companyId={current.id} supplier={supplier} links={p.links.filter((l) => l.supplier_id === supplier.id)} items={inv.items}
    orders={p.orders.filter((o) => o.supplier_id === supplier.id)} />;
}
