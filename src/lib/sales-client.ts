"use client";

import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_PREFS, DocKind, QuoteSettings, SalesDoc, SalesLine, Subscription, addInterval, computeTotals, dueFromTerms, lineAmount, round2, today,
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
    // Paso 6.9: impuesto de la línea (solo si viene; las líneas de suscripción no lo traen y lo calcula la base)
    ...(l.tax_rate != null ? { tax_rate_id: l.tax_rate_id ?? null, tax_name: Number(l.tax_rate) > 0 ? l.tax_name ?? null : null, tax_rate: Number(l.tax_rate) || 0, tax_amount: round2(Number(l.tax_amount) || 0) } : {}),
  }));
  if (!rows.length) return null;
  let { error } = await supabase.from("sales_lines").insert(rows);
  // Sin el SQL 6.9 (impuesto por línea) se guarda igual, sin esas columnas
  if (error && /tax_/i.test(error.message)) ({ error } = await supabase.from("sales_lines").insert(rows.map(({ tax_rate_id: _a, tax_name: _b, tax_rate: _c, tax_amount: _d, ...r }: Record<string, unknown>) => r)));
  // Sin el SQL 3.38 (columna "account") se guarda igual, sin la cuenta
  if (error && /account/i.test(error.message)) ({ error } = await supabase.from("sales_lines").insert(rows.map(({ account: _a, tax_rate_id: _b, tax_name: _c, tax_rate: _d, tax_amount: _e, ...r }: Record<string, unknown>) => r)));
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
    // Paso 6.9: el impuesto pasa igual (tasa, exención, desglose)
    ...(quote.tax_mode ? {
      tax_mode: quote.tax_mode, tax_rate_id: quote.tax_rate_id ?? null, tax_source: quote.tax_source ?? null, tax_exempt_reason: quote.tax_exempt_reason ?? null,
      tax_cert_number: quote.tax_cert_number ?? null, tax_breakdown: quote.tax_breakdown ?? [],
      surcharges: quote.surcharges ?? [], surcharge_total: quote.surcharge_total ?? 0,
      ...(quote.shipping_type === "percent" ? { shipping_type: "percent", shipping_value: quote.shipping_value ?? 0 } : {}),
    } : {}),
  }).select("id").single();
  if (error || !data) return null;
  await saveLines(quote.company_id, { doc_id: data.id }, lines);
  await supabase.from("sales_docs").update({ status: "invoiced", updated_at: new Date().toISOString() }).eq("id", quote.id);
  await logActivity(quote.company_id, "quote", quote.id, `Quote converted to invoice ${number}`, actor);
  await logActivity(quote.company_id, "invoice", data.id, `Invoice created from quote ${quote.number}`, actor);
  // Paso 6.10: lo cobrado del depósito ya queda descontado en la factura final
  if (quote.deposit_type) await applyQuoteDeposits(data.id, quote, actor);
  return data.id;
}

// Paso 6.7: convertir a factura desde el Home (sin abrir la cotización). Carga la cotización, sus líneas y
// las preferencias de cotización de la compañía y usa el mismo convertQuote de siempre.
export async function convertQuoteById(quoteId: string, actor: string): Promise<string | null> {
  const supabase = db();
  const { data: doc } = await supabase.from("sales_docs").select("*").eq("id", quoteId).maybeSingle();
  if (!doc || doc.kind !== "quote" || doc.status !== "accepted") return null;
  const [{ data: lines }, { data: prefs }] = await Promise.all([
    supabase.from("sales_lines").select("*").eq("doc_id", quoteId).order("position"),
    supabase.from("sales_prefs").select("quote_settings").eq("company_id", doc.company_id).maybeSingle(),
  ]);
  const settings = { ...DEFAULT_PREFS.quote_settings, ...((prefs?.quote_settings as QuoteSettings | null) ?? {}) };
  return convertQuote(doc as SalesDoc, (lines ?? []) as SalesLine[], settings, actor);
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
  // Paso 6.10: el depósito aplicado cuenta como pagado (crédito), pero se guarda aparte para mostrarlo en el PDF
  const dep = round2((data ?? []).filter((p) => p.kind === "deposit").reduce((s, p) => s + Number(p.amount), 0));
  const paid = round2((data ?? []).filter((p) => p.kind === "payment" || p.kind === "deposit").reduce((s, p) => s + Number(p.amount), 0));
  const off = round2((data ?? []).filter((p) => p.kind === "write_off").reduce((s, p) => s + Number(p.amount), 0));
  const bal = round2(Number(invoice.total) - paid - off);
  let status = invoice.status;
  if (status !== "void") {
    if (off > 0 && bal <= 0) status = "written_off";
    else if (bal <= 0 && Number(invoice.total) > 0) status = "paid";
    else if (status === "draft" || status === "paid" || status === "written_off" || status === "partially_paid") status = paid > 0 ? "partially_paid" : "sent";
  }
  const patch = { amount_paid: paid, written_off: off, status, updated_at: new Date().toISOString() };
  const { error } = await supabase.from("sales_docs").update({ ...patch, deposit_applied: dep }).eq("id", invoice.id);
  // Sin el SQL 6.10 (columna deposit_applied) se guarda igual, sin esa columna
  if (error && /deposit_applied/i.test(error.message)) await supabase.from("sales_docs").update(patch).eq("id", invoice.id);
}

// =====================================================================
// Paso 6.10 · Depósitos
//   1) La cotización pide depósito (ej. 50%).
//   2) "Create deposit invoice" → factura de depósito (sin impuesto, una línea) ligada a la cotización.
//   3) Al hacer la factura final (de la cotización o del trabajo), lo cobrado del depósito se aplica como crédito
//      (pago tipo "deposit"): la factura final queda con el total completo y el saldo ya descontado.
//      Ese crédito NO cuenta como dinero nuevo en los reportes (el dinero entró con la factura de depósito).
// =====================================================================
export async function createDepositInvoice(quote: SalesDoc, actor: string, label: { line: (n: string) => string; desc: (p: string) => string }): Promise<string | null> {
  const supabase = db();
  const { depositAmount } = await import("@/lib/templates");
  const amount = depositAmount(Number(quote.total), quote.deposit_type, quote.deposit_value);
  if (amount <= 0) return null;
  const number = await nextNumber(quote.company_id, "invoice");
  if (!number) return null;
  const date = today();
  const pct = quote.deposit_type === "percent" ? `${+Number(quote.deposit_value)}%` : "";
  const { data, error } = await supabase.from("sales_docs").insert({
    company_id: quote.company_id, kind: "invoice", number, customer_id: quote.customer_id, customer_name: quote.customer_name, emails: quote.emails,
    billing_address: quote.billing_address, site_address: quote.site_address, address_id: quote.address_id,
    reference: quote.number, doc_date: date, payment_terms: "Due on Receipt", due_date: date, salesperson: quote.salesperson, subject: quote.subject,
    status: "draft", discount_value: 0, discount_type: "flat", tax_name: null, tax_rate: 0, tax_amount: 0, shipping: 0, adjustment: 0, adjustment_label: "Adjustment",
    subtotal: amount, total: amount, notes: quote.notes, quote_id: quote.id, created_by_name: actor, is_deposit: true, tax_mode: "none", tax_breakdown: [],
  }).select("id").single();
  if (error || !data) return null;
  await saveLines(quote.company_id, { doc_id: data.id }, [{
    position: 0, item_id: null, name: label.line(quote.number), description: pct ? label.desc(pct) : null, quantity: 1, unit: null,
    rate: amount, discount: 0, discount_type: "flat", amount, image_url: null, tax_rate: 0, tax_rate_id: null, tax_name: null, tax_amount: 0,
  }]);
  await logActivity(quote.company_id, "quote", quote.id, `Deposit invoice ${number} created for ${money2(amount)}`, actor);
  await logActivity(quote.company_id, "invoice", data.id, `Deposit invoice created from quote ${quote.number}`, actor);
  return data.id as string;
}

export type OpenDeposit = { id: string; number: string; quote_id: string | null; reference: string | null; paid: number; applied: number; available: number };
// Depósitos ya cobrados de un cliente que todavía no se aplican a ninguna factura (o solo en parte)
export async function openDeposits(companyId: string, customerId: string | null, exceptInvoice?: string): Promise<OpenDeposit[]> {
  if (!customerId) return [];
  const supabase = db();
  const { data: deps, error } = await supabase.from("sales_docs").select("id, number, quote_id, reference, amount_paid, status")
    .eq("company_id", companyId).eq("customer_id", customerId).eq("kind", "invoice").eq("is_deposit", true).neq("status", "void");
  if (error || !deps?.length) return [];
  const ids = deps.map((d) => d.id as string);
  const { data: used } = await supabase.from("sales_payments").select("source_invoice_id, amount, invoice_id").eq("kind", "deposit").in("source_invoice_id", ids);
  return deps.filter((d) => d.id !== exceptInvoice).map((d) => {
    const applied = round2((used ?? []).filter((u) => u.source_invoice_id === d.id).reduce((t, u) => t + Number(u.amount), 0));
    const paid = round2(Number(d.amount_paid));
    return { id: d.id as string, number: d.number as string, quote_id: (d.quote_id as string | null) ?? null, reference: (d.reference as string | null) ?? null, paid, applied, available: round2(paid - applied) };
  }).filter((d) => d.available > 0.004);
}

// Aplica un depósito cobrado a una factura (sin pasarse del saldo)
export async function applyDeposit(invoice: SalesDoc, dep: OpenDeposit, actor: string): Promise<number> {
  const supabase = db();
  const { data: fresh } = await supabase.from("sales_docs").select("*").eq("id", invoice.id).maybeSingle();
  const inv = (fresh ?? invoice) as SalesDoc;
  const bal = round2(Number(inv.total) - Number(inv.amount_paid) - Number(inv.written_off));
  const amount = round2(Math.min(dep.available, bal));
  if (amount <= 0) return 0;
  const { error } = await supabase.from("sales_payments").insert({
    company_id: inv.company_id, invoice_id: inv.id, kind: "deposit", amount, paid_on: today(), mode: "Deposit",
    reference: dep.number, notes: null, created_by_name: actor, source_invoice_id: dep.id,
  });
  if (error) return 0;
  await refreshInvoicePaid(inv);
  await logActivity(inv.company_id, "invoice", inv.id, `Deposit ${dep.number} of ${money2(amount)} applied`, actor);
  await logActivity(inv.company_id, "invoice", dep.id, `Deposit applied to invoice ${inv.number} (${money2(amount)})`, actor);
  return amount;
}

// Al crear la factura final de una cotización: aplica solo los depósitos de ESA cotización
async function applyQuoteDeposits(invoiceId: string, quote: SalesDoc, actor: string) {
  const deps = (await openDeposits(quote.company_id, quote.customer_id, invoiceId)).filter((d) => d.quote_id === quote.id);
  if (!deps.length) return;
  const { data } = await db().from("sales_docs").select("*").eq("id", invoiceId).maybeSingle();
  if (!data) return;
  for (const d of deps) await applyDeposit(data as SalesDoc, d, actor);
}
const money2 = (v: number) => `$${(Number(v) || 0).toFixed(2)}`;
