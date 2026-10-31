import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";

// La lista vive en el layout (InventoryWorkspace). El técnico va directo a su van.
export default async function InventoryIndexPage() {
  const { current } = await getSession();
  if (current && !canManageInventory(current.role)) redirect("/dashboard/inventory/van");
  return null;
}
