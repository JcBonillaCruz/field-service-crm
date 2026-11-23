import { InvItem, InvLocation, InvStock, KitRow } from "@/lib/inventory";

// =====================================================================
// Paso 6.12c · Cálculos de inventario que comparten el Dashboard, Stock & Vans y Reports
//   · por ubicación: valor, unidades, productos, bajos, agotados, kit completo (vans)
//   · lista de compras: lo que falta para llegar a la meta de cada lugar (kit "Carry" o 2× el mínimo)
//   · por agotarse: días que quedan según lo usado en los últimos 30 días
// =====================================================================
export type LocStat = {
  id: string; value: number; units: number; items: number; low: number; out: number;
  lowNames: string[]; kitTotal: number; kitOk: number; lastRestock: string | null;
};
export type UseMove = { item_id: string; kind: string; qty: number; to_location: string | null; created_at: string };

export function locationStats(items: InvItem[], stock: InvStock[], locations: InvLocation[], kit: KitRow[] = [], moves: UseMove[] = []): Record<string, LocStat> {
  const item = new Map(items.map((i) => [i.id, i]));
  const out: Record<string, LocStat> = {};
  for (const l of locations) out[l.id] = { id: l.id, value: 0, units: 0, items: 0, low: 0, out: 0, lowNames: [], kitTotal: 0, kitOk: 0, lastRestock: null };
  for (const s of stock) {
    const st = out[s.location_id], it = item.get(s.item_id);
    if (!st || !it) continue;
    if (s.qty > 0) { st.units += s.qty; st.items += 1; st.value += s.qty * it.cost_price; }
    if (it.is_active && s.min_qty > 0 && s.qty <= s.min_qty) { st.low += 1; if (s.qty <= 0) st.out += 1; if (st.lowNames.length < 3) st.lowNames.push(it.name); }
  }
  // Kit completo: cuántos productos del kit tiene la van al menos en su cantidad "Carry"
  const kitItems = kit.filter((k) => k.par > 0 && item.get(k.item_id)?.is_active);
  for (const l of locations) {
    if (l.kind !== "van" || !kitItems.length) continue;
    const st = out[l.id];
    st.kitTotal = kitItems.length;
    st.kitOk = kitItems.filter((k) => (stock.find((s) => s.item_id === k.item_id && s.location_id === l.id)?.qty ?? 0) >= k.par).length;
  }
  for (const m of moves) {
    if (m.kind !== "transfer" || !m.to_location || !out[m.to_location]) continue;
    const st = out[m.to_location];
    if (!st.lastRestock || m.created_at > st.lastRestock) st.lastRestock = m.created_at;
  }
  return out;
}

export type BuyRow = { item: InvItem; onHand: number; target: number; need: number; cost: number; places: string[] };
// Lista de compras: meta de cada lugar = Carry del kit (vans) o 2× el mínimo (donde hay mínimo). Se compra lo que falta en total.
export function shoppingList(items: InvItem[], stock: InvStock[], locations: InvLocation[], kit: KitRow[] = []): BuyRow[] {
  const loc = new Map(locations.map((l) => [l.id, l]));
  const par = new Map(kit.map((k) => [k.item_id, k.par]));
  const rows: BuyRow[] = [];
  for (const it of items) {
    if (!it.is_active) continue;
    const mine = stock.filter((s) => s.item_id === it.id && loc.has(s.location_id));
    let target = 0; const places: string[] = [];
    for (const s of mine) {
      const l = loc.get(s.location_id)!;
      const t = l.kind === "van" && (par.get(it.id) ?? 0) > 0 ? par.get(it.id)! : s.min_qty > 0 ? s.min_qty * 2 : 0;
      target += t;
      if (t > 0 && s.qty < t) places.push(l.name);
    }
    // Vans del kit que todavía no tienen fila de stock de este producto
    if ((par.get(it.id) ?? 0) > 0) for (const l of locations) if (l.kind === "van" && !mine.some((s) => s.location_id === l.id)) { target += par.get(it.id)!; places.push(l.name); }
    const onHand = mine.reduce((a, s) => a + Math.max(0, s.qty), 0);
    const lowSomewhere = mine.some((s) => s.min_qty > 0 && s.qty <= s.min_qty);
    const need = Math.max(0, Math.ceil(target - onHand));
    if (need > 0 && (lowSomewhere || onHand <= 0 || places.length)) rows.push({ item: it, onHand, target, need, cost: need * it.cost_price, places });
  }
  return rows.sort((a, b) => b.cost - a.cost || a.item.name.localeCompare(b.item.name));
}

export type RunOut = { item: InvItem; onHand: number; perDay: number; daysLeft: number };
// Por agotarse: lo usado en los últimos 30 días ÷ 30 = consumo diario; días que quedan = stock ÷ consumo
export function runningOut(items: InvItem[], stock: InvStock[], moves: UseMove[], within = 21): RunOut[] {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const used = new Map<string, number>();
  for (const m of moves) if (m.kind === "use" && m.created_at >= since) used.set(m.item_id, (used.get(m.item_id) ?? 0) + Math.abs(m.qty));
  const rows: RunOut[] = [];
  for (const it of items) {
    const u = used.get(it.id) ?? 0;
    if (!it.is_active || u <= 0) continue;
    const onHand = stock.filter((s) => s.item_id === it.id).reduce((a, s) => a + Math.max(0, s.qty), 0);
    const perDay = u / 30;
    const daysLeft = Math.floor(onHand / perDay);
    if (daysLeft <= within) rows.push({ item: it, onHand, perDay, daysLeft });
  }
  return rows.sort((a, b) => a.daysLeft - b.daysLeft);
}
