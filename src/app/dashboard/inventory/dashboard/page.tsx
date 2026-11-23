import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import { loadInventory, loadMembers, loadMovements } from "@/lib/inventory-server";
import InvDashboard from "@/components/inventory/InvDashboard";

export const dynamic = "force-dynamic";

// Paso 6.12 · Dashboard de Inventario (dueño, manager y oficina). El técnico va directo a su van.
export default async function InventoryDashboardPage() {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) redirect("/dashboard/inventory/van");
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const days = Math.max(1, Math.ceil((now.getTime() - monthStart.getTime()) / 86400000));
  const [inv, members, moves, report, kit] = await Promise.all([
    loadInventory(supabase, current.id),
    loadMembers(supabase, current.id),
    loadMovements(supabase, current.id, { days, kinds: ["use", "receive", "adjust"], limit: 10000 }),
    supabase.rpc("job_reports", { p_company: current.id, p_from: monthStart.toISOString(), p_to: now.toISOString() }),
    supabase.from("inventory_settings").select("van_kit").eq("company_id", current.id).maybeSingle(),
  ]);
  const since = monthStart.toISOString();
  const monthMoves = moves.rows.filter((m) => m.created_at >= since);
  const parts = ((report.data as { parts?: { missing: number; value: number | null }[] } | null)?.parts ?? []);
  return (
    <InvDashboard companyId={current.id} items={inv.items} stock={inv.stock} locations={inv.locations} members={members} moves={monthMoves} needsSql={inv.needsSql}
      unscanned={report.error ? null : { units: parts.reduce((a, p) => a + (Number(p.missing) || 0), 0), value: parts.reduce((a, p) => a + (Number(p.value) || 0), 0) }}
      kitSize={Array.isArray(kit.data?.van_kit) ? (kit.data!.van_kit as unknown[]).length : 0}
      canEdit={current.role === "owner" || current.role === "manager"} />
  );
}
