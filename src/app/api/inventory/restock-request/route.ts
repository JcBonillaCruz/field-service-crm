import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { pushToCompany, pushToUsers } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Paso 6.12f: el técnico pide resurtido → aviso a la oficina. Cuando la oficina lo marca listo → aviso al técnico.
export async function POST(request: NextRequest) {
  const { supabase, current } = await getSession();
  if (!current) return NextResponse.json({ ok: false }, { status: 401 });
  let id = ""; let done = false;
  try { const b = await request.json(); id = String(b.id ?? ""); done = Boolean(b.done); } catch { /* */ }
  const { data } = await supabase.from("inventory_restock_requests")
    .select("*, inventory_locations ( name )").eq("company_id", current.id).eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ ok: false });
  const loc = (Array.isArray(data.inventory_locations) ? data.inventory_locations[0] : data.inventory_locations) as { name?: string } | null;
  const n = Array.isArray(data.items) ? data.items.length : 0;
  // Paso 6.13: si se mandó en un clic, el aviso dice cuántos van y qué faltó
  const f = (data as { fulfilled?: { sent?: unknown[]; short?: { name?: string; qty?: number }[] } | null }).fulfilled;
  const doneBody = f?.sent
    ? `${loc?.name ?? "Your van"}: ${f.sent.length} item(s) sent${f.short?.length ? ` · missing ${f.short.map((s) => `${s.name ?? "item"} ×${s.qty}`).join(", ")}` : ""}`
    : `${loc?.name ?? "Your van"}: ${n} item(s) ready to pick up`;
  const sent = done
    ? await pushToUsers(current.id, [data.requested_by as string], {
        title: "✅ Restock ready", body: doneBody, url: "/dashboard/inventory/van", tag: `restock-${id}`,
      }).catch(() => 0)
    : await pushToCompany(current.id, {
        title: "🚚 Restock request", body: `${data.requested_by_name ?? "Technician"} · ${loc?.name ?? "Van"}: ${n} item(s)`, url: "/dashboard/inventory/dashboard#requests", tag: `restock-${id}`,
      }).catch(() => 0);
  return NextResponse.json({ ok: true, sent });
}
