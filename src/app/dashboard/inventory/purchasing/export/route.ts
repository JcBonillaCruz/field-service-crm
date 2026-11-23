import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import { loadInventory } from "@/lib/inventory-server";
import { loadPurchasing } from "@/lib/purchasing-server";
import { checkExportBody, exportResponse, fileBase } from "@/lib/export-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { scope?: "all" | "view" | "period"; period?: { from?: string; to?: string }; format?: "csv" | "xlsx"; password?: string };

// Paso 6.14 · Exportar órdenes de compra (una fila por línea) o proveedores. Mismo pop-up de siempre.
export async function POST(request: NextRequest) {
  const { supabase, current } = await getSession();
  if (!current || !canManageInventory(current.role)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  let body: Body = {};
  try { body = await request.json(); } catch { /* valores por defecto */ }
  const format = body.format === "xlsx" ? "xlsx" : "csv";
  const password = (body.password ?? "").trim();
  const bad = checkExportBody(format, password);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  const kind = request.nextUrl.searchParams.get("kind") === "suppliers" ? "suppliers" : "orders";
  const [p, inv] = await Promise.all([loadPurchasing(supabase, current.id), loadInventory(supabase, current.id)]);
  if (p.needsSql) return NextResponse.json({ error: "Run the SQL for steps 6.13-6.14 first." }, { status: 500 });
  const sup = new Map(p.suppliers.map((s) => [s.id, s]));
  const from = body.scope === "period" ? body.period?.from : undefined, to = body.scope === "period" ? body.period?.to : undefined;

  if (kind === "suppliers") {
    const matrix: unknown[][] = [["Supplier", "Contact", "Phone", "Email", "Website", "Account #", "Payment terms", "Lead time (days)", "Address", "Items", "Orders", "Active", "Notes"]];
    for (const s of p.suppliers) matrix.push([s.name, s.contact_name ?? "", s.phone ?? "", s.email ?? "", s.website ?? "", s.account_no ?? "", s.payment_terms ?? "", s.lead_days ?? "", s.address ?? "",
      p.links.filter((l) => l.supplier_id === s.id).length, p.orders.filter((o) => o.supplier_id === s.id).length, s.is_active ? "Yes" : "No", s.notes ?? ""]);
    return exportResponse(matrix, fileBase("suppliers", current.name), format, password, "Suppliers");
  }
  const item = new Map(inv.items.map((i) => [i.id, i]));
  const loc = new Map(inv.locations.map((l) => [l.id, l.name]));
  const matrix: unknown[][] = [["PO #", "Status", "Supplier", "Order date", "Expected", "Receive into", "Item", "SKU", "Buy unit", "Units per buy unit", "Qty ordered", "Qty received", "Unit price", "Line total", "PO total", "Created by", "Notes"]];
  for (const o of p.orders) {
    if ((from && o.order_date < from) || (to && o.order_date > to)) continue;
    for (const l of p.lines.filter((x) => x.po_id === o.id).sort((a, b) => a.position - b.position)) {
      const it = item.get(l.item_id);
      matrix.push([o.number, o.status, sup.get(o.supplier_id ?? "")?.name ?? "", o.order_date, o.expected_date ?? "", loc.get(o.location_id ?? "") ?? "", it?.name ?? "", it?.sku ?? "",
        l.buy_unit ?? it?.unit ?? "each", l.per_unit, l.qty, l.received, l.unit_cost, Math.round(l.qty * l.unit_cost * 100) / 100, o.total, o.created_by_name ?? "", o.notes ?? ""]);
    }
  }
  return exportResponse(matrix, fileBase("purchase-orders", current.name), format, password, "Purchase orders");
}
