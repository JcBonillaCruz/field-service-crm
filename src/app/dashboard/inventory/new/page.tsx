import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { InvCategory, InvLocation, canManageInventory } from "@/lib/inventory";
import NoAccess from "@/components/customers/NoAccess";
import InventoryItemForm from "@/components/inventory/InventoryItemForm";

export const dynamic = "force-dynamic";

export default async function NewInventoryItemPage({ searchParams }: { searchParams: { sku?: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) return <NoAccess />;
  const [locs, cats] = await Promise.all([
    supabase.from("inventory_locations").select("id, name, kind, is_default, assigned_user_id").eq("company_id", current.id).eq("is_active", true).order("is_default", { ascending: false }).order("name"),
    supabase.from("item_categories").select("id, name").eq("company_id", current.id).order("name"),
  ]);
  return <InventoryItemForm companyId={current.id} locations={(locs.data ?? []) as InvLocation[]} categories={(cats.data ?? []) as InvCategory[]}
    scannedSku={searchParams.sku?.slice(0, 120)} />;
}
