import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import { loadMovements } from "@/lib/inventory-server";
import UsageView from "@/components/inventory/UsageView";

export const dynamic = "force-dynamic";

// Técnico: lo que ha usado y lo que le han resurtido (la base solo le deja ver lo suyo)
export default async function MyUsagePage() {
  const { supabase, current, user } = await getSession();
  if (!current) redirect("/dashboard");
  if (canManageInventory(current.role)) redirect("/dashboard/inventory/reports");
  const { rows } = await loadMovements(supabase, current.id, { days: 60, limit: 1000 });
  return <UsageView moves={rows} userId={user.id} />;
}
