import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import VanView from "@/components/inventory/VanView";

export const dynamic = "force-dynamic";

// Técnico: lo que trae en su van (la oficina ve las vans en Locations & Vans)
export default async function MyVanPage() {
  const { current } = await getSession();
  if (!current) redirect("/dashboard");
  if (canManageInventory(current.role)) redirect("/dashboard/inventory/locations");
  return <VanView companyId={current.id} />;
}
