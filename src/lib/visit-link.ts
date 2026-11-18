import type { SupabaseClient } from "@supabase/supabase-js";
import type { JobInfo, VisitInfo } from "@/lib/jobs-notify";

// Paso 5.8 · La visita detrás del enlace que recibe el cliente (solo servidor, con llave de servicio)
export type LinkedVisit = VisitInfo & {
  status: string; company_id: string; customer_reply: "confirmed" | "reschedule" | null; customer_reply_at: string | null; customer_reply_note: string | null;
  jobs: JobInfo & { cancelled_at: string | null };
};
export async function visitByToken(db: SupabaseClient, token: string): Promise<LinkedVisit | null> {
  if (!/^[a-f0-9]{32,64}$/i.test(token)) return null;
  const { data } = await db.from("job_visits")
    .select("id, visit_no, status, starts_at, ends_at, arrival_window_min, company_id, customer_reply, customer_reply_at, customer_reply_note, jobs!inner ( id, company_id, number, title, customer_id, customer_name, customer_phone, site_address, cancelled_at )")
    .eq("customer_token", token).maybeSingle();
  return (data as unknown as LinkedVisit | null) ?? null;
}
// ¿El cliente todavía puede confirmar o pedir otro horario?
export function linkState(v: LinkedVisit): "open" | "cancelled" | "closed" {
  if (v.status === "cancelled" || v.jobs.cancelled_at) return "cancelled";
  if (v.status !== "scheduled" || !v.starts_at || new Date(v.starts_at).getTime() < Date.now()) return "closed";
  return "open";
}
