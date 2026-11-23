import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import { exportResponse, fileBase } from "@/lib/export-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Paso 6.12e: Excel de los reportes de inventario (lista de compra, por agotarse, agotados).
// La pantalla manda la tabla tal cual la ve el dueño (con sus cantidades ajustadas).
export async function POST(request: NextRequest) {
  const { current } = await getSession();
  if (!current || !canManageInventory(current.role)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  let body: { name?: string; sheet?: string; matrix?: unknown[][] } = {};
  try { body = await request.json(); } catch { /* */ }
  const matrix = Array.isArray(body.matrix) ? body.matrix.slice(0, 20000).map((r) => (Array.isArray(r) ? r.slice(0, 30) : [])) : [];
  if (!matrix.length) return NextResponse.json({ error: "Empty" }, { status: 400 });
  return exportResponse(matrix, fileBase(String(body.name || "inventory-report").slice(0, 40), current.name), "xlsx", "", String(body.sheet || "Report").slice(0, 30));
}
