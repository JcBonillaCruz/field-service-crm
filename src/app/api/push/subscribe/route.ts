import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { admin } from "@/lib/push";

export const dynamic = "force-dynamic";

// Guardar / quitar este teléfono o computadora para las alertas
export async function POST(request: NextRequest) {
  const { supabase, current, user } = await getSession();
  if (!current) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const b = await request.json().catch(() => null) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | null;
  if (!b?.endpoint || !b.keys?.p256dh || !b.keys?.auth) return NextResponse.json({ error: "Bad subscription" }, { status: 400 });
  // Este teléfono/navegador pasa a la cuenta que lo usa AHORA. Se borra con la llave de servicio porque el registro
  // anterior puede ser de OTRA cuenta (misma persona entrando como dueño y luego como técnico): con la sesión normal
  // la base no deja borrar lo de otro usuario y el teléfono se quedaba ligado a la cuenta vieja.
  const db = admin();
  await (db ?? supabase).from("push_subscriptions").delete().eq("endpoint", b.endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({
    user_id: user.id, company_id: current.id, endpoint: b.endpoint, p256dh: b.keys.p256dh, auth: b.keys.auth, user_agent: request.headers.get("user-agent")?.slice(0, 200) ?? null,
  });
  if (error) return NextResponse.json({ error: "It couldn't be saved. Did you run the SQL for Paso 3.33?" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { supabase } = await getSession();
  const b = await request.json().catch(() => null) as { endpoint?: string } | null;
  if (b?.endpoint) await supabase.from("push_subscriptions").delete().eq("endpoint", b.endpoint);
  return NextResponse.json({ ok: true });
}
