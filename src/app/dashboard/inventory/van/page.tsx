import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import VanView from "@/components/inventory/VanView";

export const dynamic = "force-dynamic";

// Técnico: lo que trae en su van (la oficina ve las vans en Locations & Vans)
export default async function MyVanPage({ searchParams }: { searchParams: { request?: string } }) {
  const { supabase, current, user } = await getSession();
  if (!current) redirect("/dashboard");
  if (canManageInventory(current.role)) redirect("/dashboard/inventory/locations");
  // Paso 6.12f: ¿la empresa deja que el técnico pida resurtido?
  const { data } = await supabase.from("inventory_settings").select("tech_can_request").eq("company_id", current.id).maybeSingle();
  return <VanView companyId={current.id} userName={user.fullName || user.email || ""} canRequest={(data as { tech_can_request?: boolean } | null)?.tech_can_request !== false} autoRequest={searchParams.request === "1"} />;
}
