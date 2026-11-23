import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import { loadLocationsAll } from "@/lib/inventory-server";
import { loadVanHistory } from "@/lib/van-history";
import { checkExportBody, exportResponse, fileBase } from "@/lib/export-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { scope?: "all" | "view" | "period"; columns?: string[]; period?: { from?: string; to?: string }; range?: { from?: string; to?: string }; format?: "csv" | "xlsx"; password?: string };

// Paso 6.13 · Exportar la ficha de una van / almacén (mismo pop-up de siempre). Sin costos para el técnico.
export async function POST(request: NextRequest) {
  const { supabase, current, user } = await getSession();
  if (!current) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  let body: Body = {};
  try { body = await request.json(); } catch { /* valores por defecto */ }
  const format = body.format === "xlsx" ? "xlsx" : "csv";
  const password = (body.password ?? "").trim();
  const bad = checkExportBody(format, password);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });

  const locId = request.nextUrl.searchParams.get("loc") ?? "";
  const locations = await loadLocationsAll(supabase, current.id);
  const loc = locations.find((l) => l.id === locId);
  if (!loc) return NextResponse.json({ error: "Open a van or warehouse in Stock & Vans to export its history." }, { status: 400 });
  const manager = canManageInventory(current.role);
  if (!manager && !(loc.kind === "van" && loc.assigned_user_id === user.id)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const day = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`) : null);
  const src = body.scope === "view" ? body.range : body.scope === "period" ? body.period : undefined;
  const from = day(src?.from) ?? new Date(Date.now() - 365 * 86400000);
  const toDay = day(src?.to);
  const to = toDay ? new Date(toDay.getTime() + 86400000) : new Date(Date.now() + 86400000);
  const only = body.scope === "view" ? (body.columns?.[0] ?? "all") : "all";
  const name = (id: string | null) => locations.find((l) => l.id === id)?.name ?? "";
  const h = await loadVanHistory(supabase, current.id, loc, { from, to }, manager, name);

  const head = ["Type", "Date", "Item Name", "SKU", "Qty", "Unit", "Job #", "Customer", "Where / From", "By", "Note", ...(manager ? ["Cost"] : [])];
  const matrix: unknown[][] = [head];
  const push = (r: unknown[], cost: number | null) => matrix.push(manager ? [...r, cost ?? 0] : r);
  if (only === "all" || only === "used") for (const u of h.used) push([u.kind === "use" ? "Used" : "Removed", u.when, u.name, u.sku ?? "", -u.qty, u.unit ?? "", u.job_number ?? "", u.customer ?? "", u.address ?? u.reason ?? "", u.by ?? "", ""], u.cost);
  if (only === "all" || only === "received") for (const r of h.received) push([r.inbound ? "Received" : "Sent out", r.when, r.name, r.sku ?? "", r.inbound ? r.qty : -r.qty, r.unit ?? "", "", "", r.kind === "receive" ? "Purchase" : r.other ?? "", r.by ?? "", r.note ?? ""], r.cost);
  if (only === "all" || only === "counts") for (const c of h.counts) push(["Count", c.when, `${c.items} items counted${c.reversed ? " (reversed)" : ""}`, "", -c.short, "", "", "", c.short > 0 ? "Missing" : "All good", c.by ?? "", ""], c.shortValue);
  if ((only === "all" || only === "unscanned") && h.unscanned) for (const u of h.unscanned) push(["Not scanned", u.when ?? "", u.name, u.sku ?? "", -u.missing, u.unit ?? "", u.number, u.customer, `Billed ${u.billed} · scanned ${u.scanned}`, "", ""], u.value);
  return exportResponse(matrix, fileBase(`${loc.name}-history`, current.name), format, password, "History");
}
