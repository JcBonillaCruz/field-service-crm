import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import NoAccess from "@/components/customers/NoAccess";
import { loadInventory } from "@/lib/inventory-server";
import TransferForm from "@/components/inventory/TransferForm";

export const dynamic = "force-dynamic";

export default async function NewTransferPage({ searchParams }: { searchParams: { to?: string; from?: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) return <NoAccess />;
  const { items, stock, locations } = await loadInventory(supabase, current.id);
  return <TransferForm companyId={current.id} items={items} stock={stock} locations={locations} initialTo={searchParams.to} initialFrom={searchParams.from} />;
}
