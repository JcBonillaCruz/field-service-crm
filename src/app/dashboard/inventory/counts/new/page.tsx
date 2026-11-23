import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import NoAccess from "@/components/customers/NoAccess";
import { loadInventory } from "@/lib/inventory-server";
import CountForm from "@/components/inventory/CountForm";

export const dynamic = "force-dynamic";

// ?from=<conteo revertido> → "Corregir": abre el conteo nuevo con los números del anterior para cambiar solo lo que estaba mal
export default async function NewCountPage({ searchParams }: { searchParams: { location?: string; from?: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) return <NoAccess />;
  const [{ items, stock, locations, barcodes }, prev] = await Promise.all([
    loadInventory(supabase, current.id),
    searchParams.from
      ? supabase.from("inventory_movements").select("item_id, counted_qty, from_location, to_location").eq("company_id", current.id).eq("batch_id", searchParams.from).eq("kind", "count")
      : Promise.resolve({ data: null }),
  ]);
  const rows = (prev.data ?? []) as { item_id: string; counted_qty: number | null; from_location: string | null; to_location: string | null }[];
  const prefill = rows.length ? Object.fromEntries(rows.map((r) => [r.item_id, String(Number(r.counted_qty ?? 0))])) : undefined;
  const loc = searchParams.location ?? rows[0]?.from_location ?? rows[0]?.to_location ?? undefined;
  return <CountForm barcodes={barcodes} companyId={current.id} items={items} stock={stock} locations={locations} initialLocation={loc}
    company={current.name} prefill={prefill} fromBatch={prefill ? searchParams.from : undefined} />;
}
