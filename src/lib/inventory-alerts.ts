import type { SupabaseClient } from "@supabase/supabase-js";
import { pushToCompany, pushToUsers } from "@/lib/push";

const GAP: Record<string, number> = { once: Infinity, daily: 86400000, weekly: 7 * 86400000 };
type Row = {
  id: string; company_id: string; qty: number; min_qty: number; last_notified_at: string | null;
  items: { name: string } | null; inventory_locations: { name: string; kind?: string; assigned_user_id?: string | null } | null;
};

// Avisa al celular por las alertas de stock bajo abiertas, según Inventory → Settings:
//   frecuencia: once (una vez) · daily (cada día mientras siga bajo) · weekly (cada semana)
//   Paso 6.12f: a quién → dueño/oficina (notify_office) y/o el técnico de esa van (notify_tech)
export async function processInventoryAlerts(db: SupabaseClient, companyId?: string) {
  let q = db.from("inventory_alerts").select("id, company_id, qty, min_qty, last_notified_at, items ( name ), inventory_locations ( name, kind, assigned_user_id )")
    .is("resolved_at", null).limit(2000);
  if (companyId) q = q.eq("company_id", companyId);
  const r1 = await q;
  let data: unknown[] | null = r1.data, error = r1.error;
  // Si la consulta con los datos de la van falla, se usa la de siempre
  if (error) {
    let q2 = db.from("inventory_alerts").select("id, company_id, qty, min_qty, last_notified_at, items ( name ), inventory_locations ( name )").is("resolved_at", null).limit(2000);
    if (companyId) q2 = q2.eq("company_id", companyId);
    const r2 = await q2; data = r2.data; error = r2.error;
  }
  const rows = (data ?? []) as unknown as Row[];
  if (!rows.length) return 0;
  const companies = Array.from(new Set(rows.map((r) => r.company_id)));
  let set = await db.from("inventory_settings").select("company_id, alert_frequency, notify_office, notify_tech").in("company_id", companies);
  if (set.error) set = await db.from("inventory_settings").select("company_id, alert_frequency").in("company_id", companies) as typeof set;
  const cfg = new Map((set.data ?? []).map((s) => [s.company_id as string, s as { alert_frequency?: string; notify_office?: boolean; notify_tech?: boolean }]));
  const now = Date.now();
  let sent = 0;
  for (const cid of companies) {
    const c = cfg.get(cid) ?? {};
    const gap = GAP[c.alert_frequency ?? "once"] ?? Infinity;
    const due = rows.filter((r) => r.company_id === cid && (!r.last_notified_at || now - new Date(r.last_notified_at).getTime() >= gap));
    if (!due.length) continue;
    // Dueño / manager / oficina
    if (c.notify_office !== false) {
      const first = due[0];
      const title = due.length === 1 ? `📦 Low stock: ${first.items?.name ?? "item"}` : `📦 ${due.length} items are running low`;
      const body = due.length === 1
        ? `${first.inventory_locations?.name ?? "Location"} has ${Number(first.qty)} left (alert at ${Number(first.min_qty)}). Time to restock.`
        : due.slice(0, 4).map((r) => `${r.items?.name ?? "Item"} · ${r.inventory_locations?.name ?? ""}: ${Number(r.qty)}`).join("\n");
      sent += await pushToCompany(cid, { title, body, url: "/dashboard/inventory/dashboard", tag: `low-stock-${cid}` });
    }
    // Cada técnico, solo lo de su van
    if (c.notify_tech !== false) {
      const byTech = new Map<string, Row[]>();
      due.forEach((r) => { const u = r.inventory_locations?.kind === "van" ? r.inventory_locations?.assigned_user_id : null; if (u) byTech.set(u, [...(byTech.get(u) ?? []), r]); });
      for (const [uid, list] of Array.from(byTech.entries())) {
        sent += await pushToUsers(cid, [uid], {
          title: list.length === 1 ? `🚐 Your van is low: ${list[0].items?.name ?? "item"}` : `🚐 ${list.length} parts are low in your van`,
          body: `${list.slice(0, 4).map((r) => `${r.items?.name ?? "Item"}: ${Number(r.qty)} left`).join("\n")}\nTap to ask for a restock.`,
          url: "/dashboard/inventory/van?request=1", tag: `van-low-${uid}`,
        });
      }
    }
    await db.from("inventory_alerts").update({ last_notified_at: new Date().toISOString() }).in("id", due.map((r) => r.id));
  }
  return sent;
}
