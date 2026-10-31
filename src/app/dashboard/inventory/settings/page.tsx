import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory, InvCategory } from "@/lib/inventory";
import NoAccess from "@/components/customers/NoAccess";
import InventorySettings from "@/components/inventory/InventorySettings";

export const dynamic = "force-dynamic";

export default async function InventorySettingsPage() {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) return <NoAccess />;
  const [cats, items, settings] = await Promise.all([
    supabase.from("item_categories").select("id, name").eq("company_id", current.id).order("name"),
    supabase.from("items").select("category_id").eq("company_id", current.id).eq("track_inventory", true).not("category_id", "is", null).limit(10000),
    supabase.from("inventory_settings").select("alert_frequency").eq("company_id", current.id).maybeSingle(),
  ]);
  const counts: Record<string, number> = {};
  (items.data ?? []).forEach((r) => { const k = r.category_id as string; counts[k] = (counts[k] ?? 0) + 1; });
  return <InventorySettings companyId={current.id} categories={(cats.data ?? []) as InvCategory[]} counts={counts} needsSql={Boolean(cats.error)}
    frequency={(settings.data?.alert_frequency as "once" | "daily" | "weekly") ?? "once"} canEditAlerts={current.role === "owner" || current.role === "manager"} />;
}
