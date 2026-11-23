import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { pushToCompany } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Paso 6.12d: cuando alguien revierte un conteo, avisa al dueño y a la oficina (no a los técnicos)
export async function POST(request: NextRequest) {
  const { supabase, current } = await getSession();
  if (!current) return NextResponse.json({ ok: false }, { status: 401 });
  let batch = "";
  try { batch = String((await request.json()).batch ?? ""); } catch { /* */ }
  const { data } = await supabase.from("inventory_count_reversals").select("reason, reversed_by_name").eq("company_id", current.id).eq("batch_id", batch).maybeSingle();
  if (!data) return NextResponse.json({ ok: false });
  const sent = await pushToCompany(current.id, {
    title: "↩️ Inventory count reversed", body: `${data.reversed_by_name ?? "Someone"}: ${data.reason}`, url: `/dashboard/inventory/counts/${batch}`, tag: `count-rev-${batch}`,
  }).catch(() => 0);
  return NextResponse.json({ ok: true, sent });
}
