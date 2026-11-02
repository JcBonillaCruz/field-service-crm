import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import { loadInventoryItem } from "@/lib/inventory-server";
import NoAccess from "@/components/customers/NoAccess";
import InventoryItemForm from "@/components/inventory/InventoryItemForm";

export const dynamic = "force-dynamic";

export default async function EditInventoryItemPage({ params }: { params: { id: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) return <NoAccess />;
  const data = await loadInventoryItem(supabase, current.id, params.id);
  if (!data) notFound();
  return <InventoryItemForm companyId={current.id} item={data.item} locations={data.locations} categories={data.categories} photos={data.photos} stock={data.stock} buying={data.buying} />;
}
