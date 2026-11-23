import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import { MOVE_SELECT, MoveRow, loadInventory } from "@/lib/inventory-server";
import { countList } from "@/lib/inventory-insights";
import { exportResponse, fileBase } from "@/lib/export-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Paso 6.12d · Excel de conteos:
//   { location, expected } → hoja para contar (columna "Counted" vacía)
//   { batch }              → el conteo ya hecho (esperado, contado, diferencia, valor)
export async function POST(request: NextRequest) {
  const { supabase, current } = await getSession();
  if (!current || !canManageInventory(current.role)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  let body: { location?: string; expected?: boolean; batch?: string; es?: boolean } = {};
  try { body = await request.json(); } catch { /* */ }
  const es = Boolean(body.es);
  const L = es
    ? { n: "#", item: "Producto", sku: "SKU", unit: "Unidad", exp: "Esperado", cnt: "Contado", diff: "Diferencia", cost: "Costo unitario", val: "Valor", notes: "Notas", sheet: "Hoja de conteo", count: "Conteo" }
    : { n: "#", item: "Item", sku: "SKU", unit: "Unit", exp: "Expected", cnt: "Counted", diff: "Difference", cost: "Unit cost", val: "Value", notes: "Notes", sheet: "Count sheet", count: "Count" };
  if (body.batch) {
    const { data } = await supabase.from("inventory_movements").select(MOVE_SELECT).eq("company_id", current.id).eq("batch_id", body.batch).eq("kind", "count").order("created_at");
    const rows = ((data ?? []) as unknown as MoveRow[]).sort((a, b) => (a.items?.name ?? "").localeCompare(b.items?.name ?? ""));
    const matrix: unknown[][] = [[L.n, L.item, L.sku, L.unit, L.exp, L.cnt, L.diff, L.cost, L.val]];
    rows.forEach((m, i) => {
      const d = Number(m.counted_qty ?? 0) - Number(m.expected_qty ?? 0);
      matrix.push([i + 1, m.items?.name ?? "", m.items?.sku ?? "", m.items?.unit ?? "", Number(m.expected_qty ?? 0), Number(m.counted_qty ?? 0), d, Number(m.unit_cost ?? 0), Math.round(d * Number(m.unit_cost ?? 0) * 100) / 100]);
    });
    return exportResponse(matrix, fileBase(es ? "conteo" : "count", current.name), "xlsx", "", L.count);
  }
  const inv = await loadInventory(supabase, current.id);
  const loc = inv.locations.find((l) => l.id === body.location) ?? inv.locations[0];
  if (!loc) return NextResponse.json({ error: "No location" }, { status: 400 });
  const list = countList(inv.items, inv.stock, loc.id);
  const at = (id: string) => Number(inv.stock.find((s) => s.item_id === id && s.location_id === loc.id)?.qty ?? 0);
  const matrix: unknown[][] = [[L.n, L.item, L.sku, L.unit, ...(body.expected ? [L.exp] : []), L.cnt, L.notes]];
  list.forEach((it, i) => matrix.push([i + 1, it.name, it.sku ?? "", it.unit ?? "", ...(body.expected ? [at(it.id)] : []), "", ""]));
  return exportResponse(matrix, fileBase(`${es ? "hoja-conteo" : "count-sheet"}-${loc.name}`, current.name), "xlsx", "", L.sheet);
}
