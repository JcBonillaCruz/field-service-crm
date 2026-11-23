import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory, kitOf } from "@/lib/inventory";
import { loadBoard, loadMovements } from "@/lib/inventory-server";
import InvDashboard from "@/components/inventory/InvDashboard";
import type { LocLite } from "@/components/inventory/StockVansBoard";

export const dynamic = "force-dynamic";

// Paso 6.12 · Dashboard de Inventario (dueño, manager y oficina). El técnico va directo a su van.
export default async function InventoryDashboardPage() {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) redirect("/dashboard/inventory/van");
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const days = Math.max(1, Math.ceil((now.getTime() - monthStart.getTime()) / 86400000));
  const [b, moves, report] = await Promise.all([
    loadBoard(supabase, current.id),
    loadMovements(supabase, current.id, { days, kinds: ["use", "receive", "adjust"], limit: 10000 }),
    supabase.rpc("job_reports", { p_company: current.id, p_from: monthStart.toISOString(), p_to: now.toISOString() }),
  ]);
  const since = monthStart.toISOString();
  const parts = ((report.data as { parts?: { missing: number; value: number | null }[] } | null)?.parts ?? []);
  const kit = kitOf(b.kit);
  return (
    <InvDashboard companyId={current.id} items={b.items} stock={b.stock} locations={b.locations} members={b.members} moves={moves.rows.filter((m) => m.created_at >= since)} needsSql={b.needsSql}
      unscanned={report.error ? null : { units: parts.reduce((a, p) => a + (Number(p.missing) || 0), 0), value: parts.reduce((a, p) => a + (Number(p.value) || 0), 0) }}
      kitSize={kit.length} canEdit={current.role === "owner" || current.role === "manager"}
      photos={b.photos} kit={kit} boardLocations={b.boardLocations.filter((l) => l.is_active) as LocLite[]} recent={b.moves} />
  );
}
