import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

// Cliente con llave de servicio: SOLO en el servidor (para leer a quién avisar)
export function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

let ready: boolean | null = null;
function setup() {
  if (ready !== null) return ready;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  ready = Boolean(pub && priv);
  if (ready) webpush.setVapidDetails(`mailto:${process.env.SALES_FROM_EMAIL || "alerts@brightpro.app"}`, pub!, priv!);
  return ready;
}

export type PushPayload = { title: string; body: string; url: string; tag?: string };

// Manda la alerta (con sonido) a todos los teléfonos y computadoras de la compañía que la activaron
export async function pushToCompany(companyId: string, payload: PushPayload) {
  if (!setup()) return 0;
  const db = admin(); if (!db) return 0;
  const { data } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("company_id", companyId);
  let sent = 0;
  await Promise.all((data ?? []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 24 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("id", s.id); // ese teléfono ya no existe
    }
  }));
  return sent;
}

// Busca el documento del enlace público (para avisarle al dueño)
export async function docByToken(token: string) {
  const db = admin(); if (!db) return null;
  const { data } = await db.from("sales_docs").select("id, company_id, kind, number, customer_name, viewed_at, email_opened_at, status").eq("share_token", token).maybeSingle();
  return data as { id: string; company_id: string; kind: "quote" | "invoice"; number: string; customer_name: string; viewed_at: string | null; email_opened_at: string | null; status: string } | null;
}
export const docUrl = (d: { kind: string; id: string }) => `/dashboard/${d.kind === "quote" ? "quotes" : "invoices"}/${d.id}`;
