import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import { loadInventory } from "@/lib/inventory-server";
import InventoryWorkspace from "@/components/inventory/InventoryWorkspace";
import TechnicianSoon from "@/components/inventory/TechnicianSoon";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) return <TechnicianSoon />;
  const data = await loadInventory(supabase, current.id);
  return <InventoryWorkspace companyId={current.id} {...data} />;
}
