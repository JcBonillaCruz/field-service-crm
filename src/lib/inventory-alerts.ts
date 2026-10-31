import type { SupabaseClient } from "@supabase/supabase-js";
import { pushToCompany } from "@/lib/push";

const GAP: Record<string, number> = { once: Infinity, daily: 86400000, weekly: 7 * 86400000 };

// Avisa al celular por las alertas de stock bajo abiertas, según la frecuencia elegida en Inventory → Settings:
//   once   → un solo aviso cuando el producto llega al mínimo
//   daily  → se repite cada día mientras siga bajo
//   weekly → se repite cada semana mientras siga bajo
export async function processInventoryAlerts(db: SupabaseClient, companyId?: string) {
  let q = db.from("inventory_alerts").select("id, company_id, qty, min_qty, last_notified_at, items ( name ), inventory_locations ( name )")
    .is("resolved_at", null).limit(2000);
  if (companyId) q = q.eq("company_id", companyId);
  const { data } = await q;
  const rows = (data ?? []) as unknown as { id: string; company_id: string; qty: number; min_qty: number; last_notified_at: string | null; items: { name: string } | null; inventory_locations: { name: string } | null }[];
  if (!rows.length) return 0;
  const companies = Array.from(new Set(rows.map((r) => r.company_id)));
  const { data: settings } = await db.from("inventory_settings").select("company_id, alert_frequency").in("company_id", companies);
  const freq = new Map((settings ?? []).map((s) => [s.company_id as string, (s.alert_frequency as string) || "once"]));
  const now = Date.now();
  let sent = 0;
  for (const cid of companies) {
    const gap = GAP[freq.get(cid) ?? "once"] ?? Infinity;
    const due = rows.filter((r) => r.company_id === cid && (!r.last_notified_at || now - new Date(r.last_notified_at).getTime() >= gap));
    if (!due.length) continue;
    const first = due[0];
    const title = due.length === 1 ? `📦 Low stock: ${first.items?.name ?? "item"}` : `📦 ${due.length} items are running low`;
    const body = due.length === 1
      ? `${first.inventory_locations?.name ?? "Location"} has ${Number(first.qty)} left (alert at ${Number(first.min_qty)}). Time to restock.`
      : due.slice(0, 4).map((r) => `${r.items?.name ?? "Item"} · ${r.inventory_locations?.name ?? ""}: ${Number(r.qty)}`).join("\n");
    sent += await pushToCompany(cid, { title, body, url: "/dashboard/inventory", tag: `low-stock-${cid}` });
    await db.from("inventory_alerts").update({ last_notified_at: new Date().toISOString() }).in("id", due.map((r) => r.id));
  }
  return sent;
}
