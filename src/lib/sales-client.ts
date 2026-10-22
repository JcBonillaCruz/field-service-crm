"use client";

import { createClient } from "@/lib/supabase/client";
import {
  DocKind, QuoteSettings, SalesDoc, SalesLine, Subscription, addInterval, computeTotals, dueFromTerms, lineAmount, round2, today,
} from "@/lib/sales";

export const db = () => createClient();

export async function logActivity(companyId: string, entity: string, entityId: string, message: string, actor: string, detail?: string) {
  await db().from("sales_activity").insert({ company_id: companyId, entity, entity_id: entityId, message, detail: detail ?? null, actor_name: actor || null });
}

export async function nextNumber(companyId: string, kind: DocKind | "subscription"): Promise<string | null> {
  const { data, error } = await db().rpc("next_sales_number", { cid: companyId, k: kind });
  if (error) return null;
  return data as string;
}

// Guarda las líneas: borra las anteriores y escribe las nuevas en orden
export async function saveLines(companyId: string, parent: { doc_id?: string; subscription_id?: string }, lines: SalesLine[]) {
  const supabase = db();
  if (parent.doc_id) await supabase.from("sales_lines").delete().eq("doc_id", parent.doc_id);
  else if (parent.subscription_id) await supabase.from("sales_lines").delete().eq("subscription_id", parent.subscription_id);
  const rows = lines.filter((l) => l.name.trim() || Number(l.rate) || l.item_id).map((l, i) => ({
    company_id: companyId, doc_id: parent.doc_id ?? null, subscription_id: parent.subscription_id ?? null, position: i,
    item_id: l.item_id, name: l.name.trim(), description: l.description?.trim() || null, quantity: Number(l.quantity) || 0,
    unit: l.unit, rate: round2(Number(l.rate)), discount: round2(Number(l.discount)), discount_type: l.discount_type,
    amount: lineAmount(l), image_url: l.image_url ?? null, account: l.account ?? null,
  }));
  if (!rows.length) return null;
  let { error } = await supabase.from("sales_lines").insert(rows);
  // Sin el SQL 3.38 (columna "account") se guarda igual, sin la cuenta
  if (error && /account/i.test(error.message)) ({ error } = await supabase.from("sales_lines").insert(rows.map(({ account: _a, ...r }) => r)));
  return error;
}

export function randomToken() {
  const a = new Uint8Array(18);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Cotización → Factura (se queda en borrador para revisarla, como Zoho)
export async function convertQuote(quote: SalesDoc, lines: SalesLine[], settings: QuoteSettings, actor: string, asSent = false): Promise<string | null> {
  const supabase = db();
  const number = await nextNumber(quote.company_id, "invoice");
  if (!number) return null;
  const terms = "Due on Receipt";
  const date = today();
  const { data, error } = await supabase.from("sales_docs").insert({
    company_id: quote.company_id, kind: "invoice", number, customer_id: quote.customer_id, customer_name: quote.customer_name, emails: quote.emails,
    billing_address: quote.billing_address, site_address: settings.retain_address === false ? null : quote.site_address,
    address_id: settings.retain_address === false ? null : quote.address_id,
    reference: quote.number, order_number: quote.reference, doc_date: date, payment_terms: terms, due_date: dueFromTerms(date, terms),
    salesperson: quote.salesperson, project_name: quote.project_name, subject: quote.subject, status: asSent ? "sent" : "draft",
    sent_at: asSent ? new Date().toISOString() : null,
    discount_value: quote.discount_value, discount_type: quote.discount_type, coupon_code: quote.coupon_code, tax_name: quote.tax_name,
    tax_rate: quote.tax_rate, tax_amount: quote.tax_amount, shipping: quote.shipping, adjustment: quote.adjustment, adjustment_label: quote.adjustment_label,
    subtotal: quote.subtotal, total: quote.total, notes: settings.retain_notes ? quote.notes : null, terms: settings.retain_terms ? quote.terms : null,
    quote_id: quote.id, created_by_name: actor,
  }).select("id").single();
  if (error || !data) return null;
  await saveLines(quote.company_id, { doc_id: data.id }, lines);
  await supabase.from("sales_docs").update({ status: "invoiced", updated_at: new Date().toISOString() }).eq("id", quote.id);
  await logActivity(quote.company_id, "quote", quote.id, `Quote converted to invoice ${number}`, actor);
  await logActivity(quote.company_id, "invoice", data.id, `Invoice created from quote ${quote.number}`, actor);
  return data.id;
}

// Suscripción → siguiente factura del ciclo
export async function invoiceFromSubscription(sub: Subscription, lines: SalesLine[], actor: string): Promise<string | null> {
  const supabase = db();
  const number = await nextNumber(sub.company_id, "invoice");
  if (!number) return null;
  const cycle = sub.invoices_generated + 1;
  const applyDiscount = sub.discount_mode !== "none" && (sub.discount_apply === "every" || (sub.discount_apply === "one_time" && cycle === 1)
    || (sub.discount_apply === "cycles" && cycle <= (sub.discount_cycles ?? 0)));
  const useLines = sub.discount_mode === "item" && !applyDiscount ? lines.map((l) => ({ ...l, discount: 0 })) : lines;
  const docDisc = sub.discount_mode === "transaction" && applyDiscount ? { discount_value: sub.discount_value, discount_type: sub.discount_type } : { discount_value: 0, discount_type: "percent" as const };
  const t = computeTotals(useLines, docDisc);
  const date = sub.next_billing_date && sub.next_billing_date <= today() ? sub.next_billing_date : today();
  const { data, error } = await supabase.from("sales_docs").insert({
    company_id: sub.company_id, kind: "invoice", number, customer_id: sub.customer_id, customer_name: sub.customer_name, emails: sub.emails,
    billing_address: sub.billing_address, site_address: sub.site_address, address_id: sub.address_id, reference: sub.number,
    doc_date: date, payment_terms: sub.payment_terms, due_date: dueFromTerms(date, sub.payment_terms), salesperson: sub.salesperson,
    subject: sub.profile_name, status: "draft", ...docDisc, subtotal: t.subtotal, total: t.total, notes: sub.notes, terms: sub.terms,
    subscription_id: sub.id, created_by_name: actor,
  }).select("id").single();
  if (error || !data) return null;
  await saveLines(sub.company_id, { doc_id: data.id }, useLines);
  const next = addInterval(sub.next_billing_date || sub.start_date, sub.bill_every, sub.bill_unit);
  const done = sub.expires_after ? cycle >= sub.expires_after : false;
  await supabase.from("subscriptions").update({
    invoices_generated: cycle, next_billing_date: done ? null : next, status: done ? "expired" : sub.status, updated_at: new Date().toISOString(),
  }).eq("id", sub.id);
  await logActivity(sub.company_id, "subscription", sub.id, `Invoice ${number} created (cycle ${cycle})`, actor);
  await logActivity(sub.company_id, "invoice", data.id, `Invoice created from subscription ${sub.number}`, actor);
  return data.id;
}

// Recalcula lo pagado de una factura después de un pago, borrado o cancelación
export async function refreshInvoicePaid(invoice: SalesDoc) {
  const supabase = db();
  const { data } = await supabase.from("sales_payments").select("kind, amount").eq("invoice_id", invoice.id);
  const paid = round2((data ?? []).filter((p) => p.kind === "payment").reduce((s, p) => s + Number(p.amount), 0));
  const off = round2((data ?? []).filter((p) => p.kind === "write_off").reduce((s, p) => s + Number(p.amount), 0));
  const bal = round2(Number(invoice.total) - paid - off);
  let status = invoice.status;
  if (status !== "void") {
    if (off > 0 && bal <= 0) status = "written_off";
    else if (bal <= 0 && Number(invoice.total) > 0) status = "paid";
    else if (status === "draft" || status === "paid" || status === "written_off" || status === "partially_paid") status = paid > 0 ? "partially_paid" : "sent";
  }
  await supabase.from("sales_docs").update({ amount_paid: paid, written_off: off, status, updated_at: new Date().toISOString() }).eq("id", invoice.id);
}
