import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import NoAccess from "@/components/customers/NoAccess";
import { loadInventory, loadVanKit } from "@/lib/inventory-server";
import { kitOf } from "@/lib/inventory";
import TransferForm from "@/components/inventory/TransferForm";

export const dynamic = "force-dynamic";

export default async function NewTransferPage({ searchParams }: { searchParams: { to?: string; from?: string; restock?: string; request?: string } }) {
  const { supabase, current, user } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) return <NoAccess />;
  const [{ items, stock, locations, barcodes }, kit, req] = await Promise.all([
    loadInventory(supabase, current.id), loadVanKit(supabase, current.id),
    // Paso 6.13: "Revisar" una solicitud del técnico → la transferencia llega con lo que pidió
    searchParams.request ? supabase.from("inventory_restock_requests").select("id, location_id, items, status").eq("company_id", current.id).eq("id", searchParams.request).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const r = req.data as { id: string; location_id: string; items: { item_id: string; qty: number }[] | null; status: string } | null;
  const request = r && r.status === "open" ? { id: r.id, lines: (Array.isArray(r.items) ? r.items : []).map((i) => ({ item_id: i.item_id, qty: Number(i.qty) || 1 })) } : undefined;
  return <TransferForm request={request} userName={user.fullName || user.email || ""} barcodes={barcodes} companyId={current.id} items={items} stock={stock} locations={locations} initialTo={r?.location_id ?? searchParams.to} initialFrom={searchParams.from}
    restock={searchParams.restock === "1"} kit={kitOf(kit.kit)} />;
}
