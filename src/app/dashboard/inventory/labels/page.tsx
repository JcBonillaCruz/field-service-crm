import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import { loadInventory } from "@/lib/inventory-server";
import NoAccess from "@/components/customers/NoAccess";
import LabelDesigner from "@/components/inventory/LabelDesigner";

export const dynamic = "force-dynamic";

// Diseñar e imprimir etiquetas con código de barras (hojas de stickers o impresora de etiquetas)
export default async function LabelsPage({ searchParams }: { searchParams: { items?: string; qty?: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) return <NoAccess />;
  const { items, stock } = await loadInventory(supabase, current.id);
  const ids = (searchParams.items ?? "").split(",").filter(Boolean).slice(0, 300);
  const onHand = (id: string) => stock.filter((s) => s.item_id === id).reduce((a, s) => a + Math.max(0, s.qty), 0);
  const initial = ids.map((id) => ({ id, qty: searchParams.qty === "stock" ? Math.max(1, Math.round(onHand(id))) : 1 }));
  return <LabelDesigner companyName={current.name}
    items={items.filter((i) => i.sku).map((i) => ({ id: i.id, name: i.name, sku: i.sku as string, price: i.selling_price, unit: i.unit }))}
    initial={initial} stock={Object.fromEntries(items.map((i) => [i.id, onHand(i.id)]))} />;
}
