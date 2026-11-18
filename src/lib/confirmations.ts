import type { SupabaseClient } from "@supabase/supabase-js";

// =====================================================================
// Paso 5.8b · Confirmaciones de clientes: las próximas visitas y qué respondió cada cliente.
// Se lee con la sesión del usuario (la seguridad de la base decide qué puede ver).
// =====================================================================
export type ConfState = "asked" | "waiting" | "not_reminded" | "confirmed";
export type ConfRow = {
  visit_id: string; job_id: string; number: string; title: string | null; customer_name: string; customer_phone: string | null;
  starts_at: string; arrival_window_min: number; reminder_sent_at: string | null; reply_at: string | null; reply_note: string | null; state: ConfState;
};
export const CONF_META: Record<ConfState, { label: string; short: string; pill: string; dot: string }> = {
  asked: { label: "Asked for another time", short: "Asked to move", pill: "bg-[#fff1f2] text-[#be123c] ring-[#fecdd3]", dot: "#e11d48" },
  waiting: { label: "Reminded · no answer yet", short: "No answer yet", pill: "bg-[#fff6e6] text-[#b45309] ring-[#fde3b4]", dot: "#f59e0b" },
  not_reminded: { label: "Not reminded yet", short: "Not reminded", pill: "bg-slate-100 text-slate-600 ring-slate-200", dot: "#94a3b8" },
  confirmed: { label: "Confirmed", short: "Confirmed", pill: "bg-[#e7f6f1] text-[#0f766e] ring-[#bfe6da]", dot: "#14a39a" },
};
export const CONF_ORDER: ConfState[] = ["asked", "waiting", "not_reminded", "confirmed"];

type Raw = {
  id: string; starts_at: string; arrival_window_min: number; reminder_sent_at: string | null; customer_reply: string | null; customer_reply_at: string | null; customer_reply_note: string | null;
  jobs: { id: string; number: string; title: string | null; customer_id: string | null; customer_name: string; customer_phone: string | null; cancelled_at: string | null };
};
// Visitas agendadas de los próximos días (solo trabajos con cliente). null = falta el SQL del Paso 5.8
export async function loadConfirmations(supabase: SupabaseClient, companyId: string, days = 14): Promise<ConfRow[] | null> {
  const { data, error } = await supabase.from("job_visits")
    .select("id, starts_at, arrival_window_min, reminder_sent_at, customer_reply, customer_reply_at, customer_reply_note, jobs!inner ( id, number, title, customer_id, customer_name, customer_phone, cancelled_at )")
    .eq("company_id", companyId).eq("status", "scheduled").gte("starts_at", new Date(Date.now() - 3600000).toISOString())
    .lt("starts_at", new Date(Date.now() + days * 86400000).toISOString()).order("starts_at").limit(600);
  if (error) return null;
  return ((data ?? []) as unknown as Raw[]).filter((v) => v.jobs.customer_id && !v.jobs.cancelled_at).map((v) => ({
    visit_id: v.id, job_id: v.jobs.id, number: v.jobs.number, title: v.jobs.title, customer_name: v.jobs.customer_name, customer_phone: v.jobs.customer_phone,
    starts_at: v.starts_at, arrival_window_min: v.arrival_window_min, reminder_sent_at: v.reminder_sent_at, reply_at: v.customer_reply_at, reply_note: v.customer_reply_note,
    state: v.customer_reply === "reschedule" ? "asked" : v.customer_reply === "confirmed" ? "confirmed" : v.reminder_sent_at ? "waiting" : "not_reminded",
  }));
}
export const countStates = (rows: ConfRow[]) => rows.reduce((a, r) => ({ ...a, [r.state]: a[r.state] + 1 }), { asked: 0, waiting: 0, not_reminded: 0, confirmed: 0 } as Record<ConfState, number>);
