import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import { loadInventoryItem } from "@/lib/inventory-server";
import NoAccess from "@/components/customers/NoAccess";
import InventoryItemDetail from "@/components/inventory/InventoryItemDetail";

export const dynamic = "force-dynamic";

export default async function InventoryItemPage({ params, searchParams }: { params: { id: string }; searchParams: { created?: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) return <NoAccess />;
  const data = await loadInventoryItem(supabase, current.id, params.id);
  if (!data) notFound();
  return <InventoryItemDetail companyId={current.id} {...data} justCreated={searchParams.created === "1"} />;
}
