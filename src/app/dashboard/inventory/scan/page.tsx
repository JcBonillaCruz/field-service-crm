import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import { loadInventory } from "@/lib/inventory-server";
import ScanFlow from "@/components/inventory/ScanFlow";
import TechScan from "@/components/inventory/TechScan";

export const dynamic = "force-dynamic";

export default async function InventoryScanPage() {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) return <TechScan companyId={current.id} />;
  const { locations, needsSql } = await loadInventory(supabase, current.id);
  return <ScanFlow companyId={current.id} locations={locations} needsSql={needsSql} />;
}
