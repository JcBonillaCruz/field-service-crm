import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { canManageInventory, statusOf, STATUS_META } from "@/lib/inventory";
import { loadInventory } from "@/lib/inventory-server";
import { checkExportBody, exportResponse, fileBase } from "@/lib/export-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { scope?: "all" | "view" | "period"; ids?: string[]; period?: { from?: string; to?: string }; format?: "csv" | "xlsx"; password?: string };

// Exportar el inventario (mismo pop-up de siempre): una columna por ubicación + total, valor y estado
export async function POST(request: NextRequest) {
  const { supabase, current } = await getSession();
  if (!current || !canManageInventory(current.role)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  let body: Body = {};
  try { body = await request.json(); } catch { /* valores por defecto */ }
  const format = body.format === "xlsx" ? "xlsx" : "csv";
  const password = (body.password ?? "").trim();
  const bad = checkExportBody(format, password);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });

  const data = await loadInventory(supabase, current.id);
  if (data.needsSql) return NextResponse.json({ error: "Run the SQL for Paso 4.1 first." }, { status: 500 });
  let items = data.items;
  if (body.scope === "view" && body.ids?.length) {
    const pos = new Map(body.ids.map((id, i) => [id, i]));
    items = items.filter((i) => pos.has(i.id)).sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0));
  }
  if (body.scope === "period") {
    const from = body.period?.from, to = body.period?.to;
    items = items.filter((i) => (!from || i.created_at >= from) && (!to || i.created_at <= to + "T23:59:59"));
  }
  const cat = new Map(data.categories.map((c) => [c.id, c.name]));
  const locs = data.locations;
  const matrix: unknown[][] = [[
    "Item Name", "SKU", "Category", "Unit", ...locs.map((l) => `Qty - ${l.name}`), "Total Qty", "Low Stock Alert (min)",
    "Unit Cost", "Selling Price", "Inventory Value", "Status", "Description", "Created Time",
  ]];
  for (const it of items) {
    const rows = data.stock.filter((s) => s.item_id === it.id);
    const total = rows.reduce((s, r) => s + r.qty, 0);
    const mins = rows.filter((r) => r.min_qty > 0).map((r) => `${locs.find((l) => l.id === r.location_id)?.name ?? ""}: ${r.min_qty}`).join("; ");
    matrix.push([
      it.name, it.sku ?? "", cat.get(it.category_id ?? "") ?? "", it.unit ?? "",
      ...locs.map((l) => rows.find((r) => r.location_id === l.id)?.qty ?? 0), total, mins,
      it.cost_price, it.selling_price, Math.round(total * it.cost_price * 100) / 100, STATUS_META[statusOf(rows)].label,
      it.description ?? "", it.created_at,
    ]);
  }
  return exportResponse(matrix, fileBase("inventory", current.name), format, password, "Inventory");
}
