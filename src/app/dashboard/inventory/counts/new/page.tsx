import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import NoAccess from "@/components/customers/NoAccess";
import { loadInventory } from "@/lib/inventory-server";
import CountForm from "@/components/inventory/CountForm";

export const dynamic = "force-dynamic";

export default async function NewCountPage({ searchParams }: { searchParams: { location?: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) return <NoAccess />;
  const { items, stock, locations, barcodes } = await loadInventory(supabase, current.id);
  return <CountForm barcodes={barcodes} companyId={current.id} items={items} stock={stock} locations={locations} initialLocation={searchParams.location} />;
}
