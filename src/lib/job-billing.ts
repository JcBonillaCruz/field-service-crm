import type { SupabaseClient } from "@supabase/supabase-js";
import type { Billing } from "@/lib/operations";

// =====================================================================
// Paso 5.6b · Cobro de los trabajos terminados (solo oficina / dueño)
//   to_invoice = terminado sin factura o con la factura en borrador → columna "To invoice"
//   awaiting   = factura enviada, falta el pago · paid = pagada · none = "No invoice needed"
// Si el SQL del paso 5.6b no se ha corrido, no pasa nada: todo se queda como antes (Completed).
// =====================================================================
export type BillingRow = { job_id: string; billing: Billing; invoice_id: string | null; invoice_number: string | null; invoice_status: string | null; no_invoice_by_name: string | null };

export async function loadBilling(sb: SupabaseClient, companyId: string, since?: Date): Promise<Map<string, BillingRow>> {
  const map = new Map<string, BillingRow>();
  const { data, error } = await sb.rpc("ops_billing", { p_company: companyId, p_since: since ? since.toISOString() : null });
  if (error || !data) return map;
  (data as BillingRow[]).forEach((r) => map.set(r.job_id, r));
  return map;
}
export function withBilling<T extends { id: string }>(jobs: T[], map: Map<string, BillingRow>): T[] {
  if (!map.size) return jobs;
  return jobs.map((j) => {
    const b = map.get(j.id);
    return b ? { ...j, billing: b.billing, invoice_id: b.invoice_id, invoice_number: b.invoice_number, invoice_status: b.invoice_status } : j;
  });
}
