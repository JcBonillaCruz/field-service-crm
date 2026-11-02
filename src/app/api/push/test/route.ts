import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { admin } from "@/lib/push";
import { pushToUsers } from "@/lib/jobs-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// "Send test": manda una alerta de prueba a los teléfonos/computadoras de esta persona en esta compañía
export async function POST() {
  const { current, user } = await getSession();
  if (!current) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return NextResponse.json({ error: "Alerts aren't set up: add the VAPID keys in Vercel." }, { status: 200 });
  const db = admin();
  if (!db) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is missing in Vercel." }, { status: 200 });
  const sent = await pushToUsers(db, current.id, [user.id], { title: "BrightPro test alert 🔔", body: "Alerts are working on this device.", url: "/dashboard", tag: "test" });
  return NextResponse.json({ ok: true, sent, error: sent ? undefined : "This device isn't registered. Turn alerts off and on again." });
}
