import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { canManageSales } from "@/lib/sales";
import { Digest, buildNotices } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export type { Notice } from "@/lib/notifications";

// La app ya NO usa esta ruta para vigilar (lo hace el navegador con 1 llamada directa a la función de la base de datos).
// Se deja por compatibilidad: usa la misma función ligera, sin select * ni 10 consultas.
export async function GET() {
  const { supabase, current } = await getSession();
  if (!current || !canManageSales(current.role)) return NextResponse.json({ items: [] });
  const { data, error } = await supabase.rpc("get_company_notifications_digest", { p_company_id: current.id });
  if (error || !data) return NextResponse.json({ items: [], error: error?.message });
  const d = data as Digest;
  return NextResponse.json({ items: buildNotices(d), version: d.version });
}

// Marcar como leídas: { keys: string[] }
export async function POST(req: Request) {
  const { supabase, user } = await getSession();
  const body = await req.json().catch(() => ({}));
  const keys: string[] = Array.isArray(body.keys) ? body.keys.filter((k: unknown) => typeof k === "string").slice(0, 200) : [];
  if (!keys.length) return NextResponse.json({ ok: true });
  const { error } = await supabase.from("notification_reads").upsert(keys.map((key) => ({ user_id: user.id, key })), { onConflict: "user_id,key", ignoreDuplicates: true });
  return NextResponse.json({ ok: !error, error: error?.message });
}
