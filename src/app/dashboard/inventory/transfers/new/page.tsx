import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import NoAccess from "@/components/customers/NoAccess";
import { loadInventory, loadVanKit } from "@/lib/inventory-server";
import { kitOf } from "@/lib/inventory";
import TransferForm from "@/components/inventory/TransferForm";

export const dynamic = "force-dynamic";

export default async function NewTransferPage({ searchParams }: { searchParams: { to?: string; from?: string; restock?: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) return <NoAccess />;
  const [{ items, stock, locations, barcodes }, kit] = await Promise.all([loadInventory(supabase, current.id), loadVanKit(supabase, current.id)]);
  return <TransferForm barcodes={barcodes} companyId={current.id} items={items} stock={stock} locations={locations} initialTo={searchParams.to} initialFrom={searchParams.from}
    restock={searchParams.restock === "1"} kit={kitOf(kit.kit)} />;
}
