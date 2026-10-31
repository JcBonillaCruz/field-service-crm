import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import { loadInventory } from "@/lib/inventory-server";
import InventoryWorkspace from "@/components/inventory/InventoryWorkspace";
import TechnicianSoon from "@/components/inventory/TechnicianSoon";

export const dynamic = "force-dynamic";

// Igual que Customers/Items: la lista vive aquí. Al abrir un producto → 3 paneles (menú, lista compacta, ficha).
// Nuevo / Editar / Scan / Settings → solo el menú y esa pantalla.
export default async function InventoryLayout({ children }: { children: React.ReactNode }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) return <TechnicianSoon />;
  const data = await loadInventory(supabase, current.id);
  return <InventoryWorkspace companyId={current.id} {...data}>{children}</InventoryWorkspace>;
}
