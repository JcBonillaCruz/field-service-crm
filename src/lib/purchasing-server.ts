import type { SupabaseClient } from "@supabase/supabase-js";
import { ItemSupplier, PoLine, PurchaseOrder, Supplier } from "@/lib/purchasing";

// Paso 6.14 · Lecturas de Compras. Si el SQL 6.13-6.14 aún no corre, todo llega vacío con needsSql = true.
const SUP = "id, name, contact_name, phone, email, website, account_no, address, payment_terms, lead_days, notes, is_active";
const PO = "id, number, supplier_id, location_id, status, order_date, expected_date, notes, total, created_by_name, ordered_at, received_at, created_at";
const LINE = "id, po_id, item_id, position, buy_unit, per_unit, qty, unit_cost, received";

const numLine = (l: PoLine): PoLine => ({ ...l, per_unit: Number(l.per_unit), qty: Number(l.qty), unit_cost: Number(l.unit_cost), received: Number(l.received) });

export async function loadPurchasing(supabase: SupabaseClient, companyId: string) {
  const [sups, pos, lines, links, buy] = await Promise.all([
    supabase.from("inventory_suppliers").select(SUP).eq("company_id", companyId).order("name").limit(2000),
    supabase.from("purchase_orders").select(PO).eq("company_id", companyId).order("created_at", { ascending: false }).limit(2000),
    supabase.from("purchase_order_lines").select(LINE).eq("company_id", companyId).limit(30000),
    supabase.from("item_suppliers").select("id, item_id, supplier_id, supplier_sku, cost, is_preferred").eq("company_id", companyId).limit(30000),
    supabase.from("items").select("id, purchase_unit, units_per_purchase, is_consumable, discontinued_at").eq("company_id", companyId).eq("track_inventory", true).limit(10000),
  ]);
  return {
    needsSql: Boolean(sups.error || pos.error),
    suppliers: (sups.data ?? []) as Supplier[],
    orders: ((pos.data ?? []) as PurchaseOrder[]).map((p) => ({ ...p, total: Number(p.total) })),
    lines: ((lines.data ?? []) as PoLine[]).map(numLine),
    links: ((links.data ?? []) as ItemSupplier[]).map((l) => ({ ...l, cost: l.cost == null ? null : Number(l.cost) })),
    buying: Object.fromEntries(((buy.error ? [] : buy.data) ?? []).map((b) => [b.id as string, {
      purchase_unit: (b.purchase_unit as string | null) ?? null, per: Number(b.units_per_purchase ?? 1) || 1,
      consumable: Boolean(b.is_consumable), discontinued: Boolean(b.discontinued_at),
    }])) as Record<string, BuyInfo>,
  };
}
export type BuyInfo = { purchase_unit: string | null; per: number; consumable: boolean; discontinued: boolean };

export async function loadPurchaseOrder(supabase: SupabaseClient, companyId: string, id: string) {
  const [po, lines] = await Promise.all([
    supabase.from("purchase_orders").select(PO).eq("company_id", companyId).eq("id", id).maybeSingle(),
    supabase.from("purchase_order_lines").select(LINE).eq("po_id", id).order("position"),
  ]);
  if (!po.data) return null;
  return { po: { ...(po.data as PurchaseOrder), total: Number((po.data as PurchaseOrder).total) }, lines: ((lines.data ?? []) as PoLine[]).map(numLine) };
}

export async function loadSupplier(supabase: SupabaseClient, companyId: string, id: string) {
  const { data } = await supabase.from("inventory_suppliers").select(SUP).eq("company_id", companyId).eq("id", id).maybeSingle();
  return (data ?? null) as Supplier | null;
}
