import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { admin } from "@/lib/push";
import { processInventoryAlerts } from "@/lib/inventory-alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// La llama la app después de cada movimiento de stock (de cualquier miembro de la compañía)
export async function POST() {
  const { current } = await getSession();
  if (!current) return NextResponse.json({ ok: false }, { status: 401 });
  const db = admin();
  if (!db) return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is missing" });
  const sent = await processInventoryAlerts(db, current.id).catch(() => 0);
  return NextResponse.json({ ok: true, sent });
}
