import { Role } from "@/lib/types";
import { TEMPLATE_DEFS, tplOf } from "@/lib/pdf-templates";

// =====================================================================
// Sales (Paso 3.30): Quotes, Invoices y Subscriptions
// =====================================================================
export type DocKind = "quote" | "invoice";
export type SalesModule = "quotes" | "invoices" | "subscriptions";
export type DiscType = "percent" | "flat";

export type AddressSnap = {
  label?: string | null; street?: string | null; unit?: string | null; city?: string | null;
  state?: string | null; zip?: string | null; country?: string | null; attention?: string | null;
} | null;

export type SalesLine = {
  id?: string; position: number; item_id: string | null; name: string; description: string | null;
  quantity: number; unit: string | null; rate: number; discount: number; discount_type: DiscType; amount: number; image_url?: string | null;
  account?: string | null; // cuenta de ingreso (Sales, Labor Income…)
};
export const INCOME_ACCOUNTS = ["Sales", "Service Income", "Labor Income", "Materials Income", "General Income", "Other Charges", "Shipping Charge", "Late Fee Income", "Discount"];

export type SalesDoc = {
  id: string; company_id: string; kind: DocKind; number: string; customer_id: string | null; customer_name: string; emails: string[];
  billing_address: AddressSnap; site_address: AddressSnap; address_id: string | null;
  reference: string | null; order_number: string | null; doc_date: string; expiry_date: string | null; due_date: string | null;
  payment_terms: string | null; salesperson: string | null; project_name: string | null; subject: string | null; status: string;
  discount_value: number; discount_type: DiscType; coupon_code: string | null; tax_name: string | null; tax_rate: number; tax_amount: number;
  shipping: number; adjustment: number; adjustment_label: string; subtotal: number; total: number; amount_paid: number; written_off: number;
  notes: string | null; terms: string | null; quote_id: string | null; subscription_id: string | null;
  sent_at: string | null; viewed_at: string | null; accepted_at: string | null; declined_at: string | null; voided_at: string | null;
  reminders_stopped: boolean; expected_payment_date: string | null; share_token: string | null; share_expires_on: string | null;
  created_by_name: string | null; created_at: string; updated_at: string;
  signature_data?: string | null; signed_name?: string | null; signed_at?: string | null; last_email_at?: string | null; email_opened_at?: string | null;
};

export type Subscription = {
  id: string; company_id: string; number: string; customer_id: string | null; customer_name: string; emails: string[];
  billing_address: AddressSnap; site_address: AddressSnap; address_id: string | null; profile_name: string;
  bill_every: number; bill_unit: "week" | "month" | "year"; start_date: string; expires_after: number | null; next_billing_date: string | null;
  status: string; discount_mode: "none" | "item" | "transaction"; discount_value: number; discount_type: DiscType;
  discount_apply: "one_time" | "every" | "cycles"; discount_cycles: number | null; salesperson: string | null; payment_terms: string;
  collect_offline: boolean; notes: string | null; terms: string | null; subtotal: number; total: number; invoices_generated: number;
  cancelled_at: string | null; created_by_name: string | null; created_at: string; updated_at: string;
};

export type Payment = {
  id: string; invoice_id: string; kind: "payment" | "write_off"; amount: number; paid_on: string; mode: string | null;
  reference: string | null; notes: string | null; created_by_name: string | null; created_at: string;
};
export type Activity = { id: string; message: string; detail: string | null; actor_name: string | null; created_at: string };
export type Comment = { id: string; body: string; author_name: string | null; created_at: string };
export type SalesFile = { id: string; name: string; path: string; size: number | null; mime: string | null; created_at: string };

export type QuoteSettings = {
  allow_edit_accepted?: boolean; allow_customer_respond?: boolean; auto_convert?: "none" | "draft" | "send";
  hide_zero_lines?: boolean; retain_notes?: boolean; retain_terms?: boolean; retain_address?: boolean;
  default_notes?: string; default_terms?: string;
};
export type InvoiceSettings = { hide_zero_lines?: boolean; default_notes?: string; default_terms?: string; overdue_reminder_days?: number };
export type OrgInfo = { address?: string; phone?: string; email?: string; website?: string };
// Plantilla del PDF (Customize → Change / Edit Template)
export type PdfTemplate = string;
export type PdfSettings = {
  template?: PdfTemplate; accent?: string; margin?: "narrow" | "normal" | "wide"; font_size?: "small" | "normal" | "large";
  logo_size?: "small" | "medium" | "large"; logo_px?: number; show_org_address?: boolean; footer_text?: string; show_powered?: boolean;
};
export const TEMPLATES = TEMPLATE_DEFS;
export const DEFAULT_PDF: Required<PdfSettings> = {
  template: "standard", accent: "", margin: "normal", font_size: "normal", logo_size: "medium", logo_px: 0, show_org_address: true, footer_text: "", show_powered: false,
};
export const pdfOf = (p?: PdfSettings | null): Required<PdfSettings> => {
  const merged = { ...DEFAULT_PDF, ...Object.fromEntries(Object.entries(p ?? {}).filter(([, v]) => v !== undefined && v !== null)) } as Required<PdfSettings>;
  // Sin color propio, cada plantilla trae el suyo
  return { ...merged, accent: /^#[0-9a-f]{6}$/i.test(merged.accent) ? merged.accent : tplOf(merged.template).accent };
};
export type SalesPrefs = {
  quote_prefix: string; quote_next: number; quote_auto: boolean; invoice_prefix: string; invoice_next: number; invoice_auto: boolean;
  sub_prefix: string; sub_next: number; quote_settings: QuoteSettings; invoice_settings: InvoiceSettings; org_info: OrgInfo; logo_url: string | null;
  pdf_settings: PdfSettings; white_label: boolean;
};
export const DEFAULT_PREFS: SalesPrefs = {
  quote_prefix: "QT-", quote_next: 1, quote_auto: true, invoice_prefix: "INV-", invoice_next: 1, invoice_auto: true, sub_prefix: "SUB-", sub_next: 1,
  quote_settings: { default_notes: "Looking forward to your business.", allow_customer_respond: true }, invoice_settings: { default_notes: "Thank you for the payment. You just made our day." },
  org_info: {}, logo_url: null, pdf_settings: {}, white_label: false,
};
export const previewNumber = (p: SalesPrefs, k: DocKind | "subscription") =>
  k === "quote" ? `${p.quote_prefix}${String(p.quote_next).padStart(6, "0")}`
    : k === "invoice" ? `${p.invoice_prefix}${String(p.invoice_next).padStart(6, "0")}`
      : `${p.sub_prefix}${String(p.sub_next).padStart(5, "0")}`;

export const canManageSales = (role: Role) => role === "owner" || role === "manager" || role === "office";

// ---------- Dinero y fechas ----------
export const money = (v: number | null | undefined, currency = "USD") => {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(v) || 0); } catch { return `$${(Number(v) || 0).toFixed(2)}`; }
};
export const num2 = (v: number) => (Number(v) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const round2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;
const pad = (n: number) => String(n).padStart(2, "0");
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISO = (s: string) => { const [y, m, d] = s.slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
// "20 Oct 2026" (como Zoho)
export const fmtD = (v: string | null | undefined) =>
  v ? new Date(v.length === 10 ? `${v}T12:00:00` : v).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";
export const fmtDT = (v: string) =>
  new Date(v).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
export const daysBetween = (a: string, b: string) => Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86400000);

export const TERMS = ["Due on Receipt", "Net 15", "Net 30", "Net 45", "Net 60", "Due end of the month", "Due end of next month", "Custom"];
export function dueFromTerms(date: string, terms: string): string {
  const d = fromISO(date || today());
  const net = /^Net (\d+)$/.exec(terms);
  if (net) { d.setDate(d.getDate() + Number(net[1])); return toISO(d); }
  if (terms === "Due end of the month") return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  if (terms === "Due end of next month") return toISO(new Date(d.getFullYear(), d.getMonth() + 2, 0));
  return toISO(d);
}
export function addInterval(date: string, every: number, unit: "week" | "month" | "year"): string {
  const d = fromISO(date);
  if (unit === "week") d.setDate(d.getDate() + 7 * every);
  else if (unit === "month") d.setMonth(d.getMonth() + every);
  else d.setFullYear(d.getFullYear() + every);
  return toISO(d);
}

// ---------- Totales ----------
export function lineAmount(l: Pick<SalesLine, "quantity" | "rate" | "discount" | "discount_type">) {
  const gross = (Number(l.quantity) || 0) * (Number(l.rate) || 0);
  const off = l.discount_type === "percent" ? gross * ((Number(l.discount) || 0) / 100) : Number(l.discount) || 0;
  return round2(Math.max(0, gross - off));
}
export type Totals = { subtotal: number; discount: number; tax: number; shipping: number; adjustment: number; total: number };
export function computeTotals(lines: Pick<SalesLine, "quantity" | "rate" | "discount" | "discount_type">[], o: {
  discount_value?: number; discount_type?: DiscType; tax_rate?: number; shipping?: number; adjustment?: number;
}): Totals {
  const subtotal = round2(lines.reduce((s, l) => s + lineAmount(l), 0));
  const dv = Number(o.discount_value) || 0;
  const discount = round2(Math.min(subtotal, o.discount_type === "flat" ? dv : subtotal * (dv / 100)));
  const tax = round2((subtotal - discount) * ((Number(o.tax_rate) || 0) / 100));
  const shipping = round2(Number(o.shipping) || 0);
  const adjustment = round2(Number(o.adjustment) || 0);
  return { subtotal, discount, tax, shipping, adjustment, total: round2(subtotal - discount + tax + shipping + adjustment) };
}
// Lo que vale sin descuentos y el descuento total (líneas + documento), para mostrarlo abajo en rojo como Zoho
export const grossOf = (lines: Pick<SalesLine, "quantity" | "rate">[]) => round2(lines.reduce((t, l) => t + (Number(l.quantity) || 0) * (Number(l.rate) || 0), 0));
export function discountSummary(doc: Pick<SalesDoc, "subtotal" | "total" | "tax_amount" | "shipping" | "adjustment">, lines: Pick<SalesLine, "quantity" | "rate">[]) {
  const gross = grossOf(lines);
  const docDisc = round2(Number(doc.subtotal) - Number(doc.total) + Number(doc.tax_amount) + Number(doc.shipping) + Number(doc.adjustment));
  const itemDisc = round2(gross - Number(doc.subtotal));
  return { gross, itemDisc: Math.max(0, itemDisc), docDisc: Math.max(0, docDisc), total: round2(Math.max(0, itemDisc) + Math.max(0, docDisc)) };
}
export const balanceOf = (d: Pick<SalesDoc, "total" | "amount_paid" | "written_off">) => round2(Number(d.total) - Number(d.amount_paid) - Number(d.written_off));

// ---------- Estados ----------
export type Tone = "draft" | "sent" | "viewed" | "accepted" | "declined" | "expired" | "invoiced" | "overdue" | "partial" | "paid" | "void" | "live" | "paused" | "cancelled" | "future";
export type Status = { key: string; label: string; tone: Tone };

export function quoteStatus(d: Pick<SalesDoc, "status" | "expiry_date">): Status {
  const s = d.status;
  if (["draft", "sent", "viewed"].includes(s) && d.expiry_date && d.expiry_date < today()) return { key: "expired", label: "Expired", tone: "expired" };
  const map: Record<string, Status> = {
    draft: { key: "draft", label: "Draft", tone: "draft" }, sent: { key: "sent", label: "Sent", tone: "sent" },
    viewed: { key: "viewed", label: "Customer Viewed", tone: "viewed" }, accepted: { key: "accepted", label: "Accepted", tone: "accepted" },
    declined: { key: "declined", label: "Declined", tone: "declined" }, invoiced: { key: "invoiced", label: "Invoiced", tone: "invoiced" },
  };
  return map[s] ?? map.draft;
}

export function invoiceStatus(d: Pick<SalesDoc, "status" | "due_date" | "total" | "amount_paid" | "written_off">): Status & { days?: number } {
  const bal = balanceOf(d);
  if (d.status === "void") return { key: "void", label: "Void", tone: "void" };
  if (d.status === "draft") return { key: "draft", label: "Draft", tone: "draft" };
  if (d.status === "written_off") return { key: "written_off", label: "Written Off", tone: "paid" };
  if (bal <= 0 && Number(d.total) > 0) return { key: "paid", label: "Paid", tone: "paid" };
  if (d.due_date && d.due_date < today() && bal > 0) {
    const days = daysBetween(d.due_date, today());
    return { key: "overdue", label: `Overdue by ${days} ${days === 1 ? "day" : "days"}`, tone: "overdue", days };
  }
  if (Number(d.amount_paid) > 0) return { key: "partially_paid", label: "Partially Paid", tone: "partial" };
  if (d.status === "viewed") return { key: "viewed", label: "Viewed", tone: "viewed" };
  return { key: "sent", label: "Sent", tone: "sent" };
}

export function subStatus(s: Pick<Subscription, "status" | "start_date" | "expires_after" | "invoices_generated">): Status {
  if (s.status === "cancelled") return { key: "cancelled", label: "Cancelled", tone: "cancelled" };
  if (s.status === "paused") return { key: "paused", label: "Paused", tone: "paused" };
  if (s.status === "expired" || (s.expires_after && s.invoices_generated >= s.expires_after)) return { key: "expired", label: "Expired", tone: "expired" };
  if (s.start_date > today()) return { key: "future", label: "Future", tone: "future" };
  return { key: "live", label: "Live", tone: "live" };
}

export const docStatus = (d: SalesDoc) => (d.kind === "quote" ? quoteStatus(d) : invoiceStatus(d));

// Colores del texto en la lista (como Zoho: azul enviado, verde pagado, naranja vencido…)
export const TONE_TEXT: Record<Tone, string> = {
  draft: "text-slate-500", sent: "text-[#2563eb]", viewed: "text-[#7c3aed]", accepted: "text-[#16a34a]", declined: "text-[#e11d48]",
  expired: "text-slate-500", invoiced: "text-[#16a34a]", overdue: "text-[#ea580c]", partial: "text-[#d97706]", paid: "text-[#16a34a]",
  void: "text-slate-400", live: "text-[#16a34a]", paused: "text-[#d97706]", cancelled: "text-[#e11d48]", future: "text-[#2563eb]",
};
// Cintita diagonal del PDF
export const TONE_RIBBON: Record<Tone, string> = {
  draft: "bg-slate-500", sent: "bg-[#2563eb]", viewed: "bg-[#7c3aed]", accepted: "bg-[#16a34a]", declined: "bg-[#e11d48]",
  expired: "bg-slate-500", invoiced: "bg-[#16a34a]", overdue: "bg-[#ea580c]", partial: "bg-[#d97706]", paid: "bg-[#16a34a]",
  void: "bg-slate-400", live: "bg-[#16a34a]", paused: "bg-[#d97706]", cancelled: "bg-[#e11d48]", future: "bg-[#2563eb]",
};
export const TONE_FOLD: Record<Tone, string> = {
  draft: "bg-slate-700", sent: "bg-[#1e40af]", viewed: "bg-[#5b21b6]", accepted: "bg-[#14532d]", declined: "bg-[#9f1239]",
  expired: "bg-slate-700", invoiced: "bg-[#14532d]", overdue: "bg-[#9a3412]", partial: "bg-[#92400e]", paid: "bg-[#14532d]",
  void: "bg-slate-600", live: "bg-[#14532d]", paused: "bg-[#92400e]", cancelled: "bg-[#9f1239]", future: "bg-[#1e40af]",
};
export const TONE_PILL: Record<Tone, string> = {
  draft: "bg-slate-100 text-slate-600", sent: "bg-[#e8f0ff] text-[#2563eb]", viewed: "bg-[#f1ebff] text-[#7c3aed]", accepted: "bg-[#e7f7ec] text-[#15803d]",
  declined: "bg-[#ffe8ee] text-[#be123c]", expired: "bg-slate-100 text-slate-600", invoiced: "bg-[#e7f7ec] text-[#15803d]", overdue: "bg-[#fff0e6] text-[#c2410c]",
  partial: "bg-[#fff6e0] text-[#b45309]", paid: "bg-[#e7f7ec] text-[#15803d]", void: "bg-slate-100 text-slate-400", live: "bg-[#e7f7ec] text-[#15803d]",
  paused: "bg-[#fff6e0] text-[#b45309]", cancelled: "bg-[#ffe8ee] text-[#be123c]", future: "bg-[#e8f0ff] text-[#2563eb]",
};

// ---------- Direcciones ----------
export function addressLines(a: AddressSnap): string[] {
  if (!a) return [];
  const street = [a.street, a.unit].filter(Boolean).join(", ");
  const cityLine = [[a.city, a.state].filter(Boolean).join(", "), a.zip].filter(Boolean).join(" ");
  return [a.attention ? `Attn: ${a.attention}` : "", street, cityLine, a.country && a.country !== "US" ? a.country : "U.S.A"].filter(Boolean);
}
export const addressShort = (a: AddressSnap) => (a ? [a.street, a.city].filter(Boolean).join(", ") : "");

export const PAYMENT_MODES = ["Cash", "Check", "Credit Card", "Debit Card", "Bank Transfer", "Zelle", "Venmo", "Cash App", "PayPal", "Other"];
export const FREQ_LABEL = (every: number, unit: string) => `Every ${every === 1 ? "" : every + " "}${unit}${every === 1 ? "" : "s"}`;

export const MODULE_META: Record<SalesModule, { singular: string; plural: string; base: string; entity: string }> = {
  quotes: { singular: "Quote", plural: "Quotes", base: "/dashboard/quotes", entity: "quote" },
  invoices: { singular: "Invoice", plural: "Invoices", base: "/dashboard/invoices", entity: "invoice" },
  subscriptions: { singular: "Subscription", plural: "Subscriptions", base: "/dashboard/subscriptions", entity: "subscription" },
};

// ---------- Campos para vistas, filtros y exportar ----------
export function salesRaw(m: SalesModule, row: SalesDoc | Subscription, key: string): string | number | null {
  if (m === "subscriptions") {
    const s = row as Subscription;
    switch (key) {
      case "name": return s.number; case "customer": return s.customer_name; case "profile": return s.profile_name;
      case "status": return subStatus(s).key; case "amount": return Number(s.total); case "frequency": return s.bill_unit;
      case "next": return s.next_billing_date; case "start": return s.start_date; case "salesperson": return s.salesperson;
      case "created": return s.created_at; case "updated": return s.updated_at;
    }
    return null;
  }
  const d = row as SalesDoc;
  switch (key) {
    case "name": return d.number; case "date": return d.doc_date; case "reference": return d.reference; case "customer": return d.customer_name;
    case "status": return d.kind === "quote" ? quoteStatus(d).key : invoiceStatus(d).key;
    case "amount": return Number(d.total); case "balance": return balanceOf(d); case "expiry": return d.expiry_date; case "due": return d.due_date;
    case "order": return d.order_number; case "salesperson": return d.salesperson; case "subject": return d.subject;
    case "created": return d.created_at; case "updated": return d.updated_at;
  }
  return null;
}
