import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { SalesDoc, SalesLine, SalesModule, Subscription, balanceOf, canManageSales, invoiceStatus, quoteStatus, subStatus } from "@/lib/sales";
import { FIELDS, displayValue, rawValue } from "@/lib/catalog-views";
import { checkExportBody, exportResponse, fileBase } from "@/lib/export-file";

type Body = { scope?: "all" | "view" | "period"; ids?: string[]; columns?: string[]; period?: { from?: string; to?: string }; format?: "csv" | "xlsx"; password?: string };

// Exportar Quotes / Invoices / Subscriptions con el mismo pop-up de todo el sistema.
// "All" sale como Zoho: una fila por cada artículo (así se puede volver a importar).
export async function salesExport(request: NextRequest, module: SalesModule) {
  const { supabase, current } = await getSession();
  if (!current || !canManageSales(current.role)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  let body: Body = {};
  try { body = await request.json(); } catch { /* valores por defecto */ }
  const format = body.format === "xlsx" ? "xlsx" : "csv";
  const password = (body.password ?? "").trim();
  const bad = checkExportBody(format, password);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });

  const isSub = module === "subscriptions";
  const rows: (SalesDoc | Subscription)[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    let q = isSub
      ? supabase.from("subscriptions").select("*").eq("company_id", current.id).order("created_at", { ascending: false })
      : supabase.from("sales_docs").select("*").eq("company_id", current.id).eq("kind", module === "quotes" ? "quote" : "invoice").order("doc_date", { ascending: false });
    if (body.scope === "view" && body.ids?.length) q = q.in("id", body.ids.slice(0, 5000));
    const dateCol = isSub ? "created_at" : "doc_date";
    if (body.scope === "period" && body.period?.from) q = q.gte(dateCol, body.period.from);
    if (body.scope === "period" && body.period?.to) q = q.lte(dateCol, isSub ? body.period.to + "T23:59:59" : body.period.to);
    const { data, error } = await q.range(from, from + 999);
    if (error) return NextResponse.json({ error: "Export failed. Did you run the SQL for Paso 3.30?" }, { status: 500 });
    rows.push(...((data ?? []) as (SalesDoc | Subscription)[]));
    if (!data || data.length < 1000) break;
  }
  if (body.scope === "view" && body.ids?.length) {
    const pos = new Map(body.ids.map((id, i) => [id, i]));
    rows.sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0));
  }
  const sheet = isSub ? "Subscriptions" : module === "quotes" ? "Quotes" : "Invoices";

  if (body.scope === "view" && body.columns?.length) {
    const cols = body.columns.map((k) => FIELDS[module].find((f) => f.key === k)).filter(Boolean) as typeof FIELDS["quotes"];
    const matrix = [cols.map((c) => c.label), ...rows.map((r) => cols.map((c) => (c.type === "number" ? rawValue(module, r, c.key) ?? "" : displayValue(module, r, c.key))))];
    return exportResponse(matrix, fileBase(module, current.name), format, password, sheet);
  }

  // Líneas de todos los documentos
  const ids = rows.map((r) => r.id);
  const lines: SalesLine[] = [];
  for (let i = 0; i < ids.length; i += 300) {
    const chunk = ids.slice(i, i + 300);
    const { data } = await supabase.from("sales_lines").select("*").in(isSub ? "subscription_id" : "doc_id", chunk).order("position");
    lines.push(...((data ?? []) as SalesLine[]));
  }
  const byParent = new Map<string, SalesLine[]>();
  lines.forEach((l) => {
    const key = (isSub ? (l as SalesLine & { subscription_id: string }).subscription_id : (l as SalesLine & { doc_id: string }).doc_id);
    byParent.set(key, [...(byParent.get(key) ?? []), l]);
  });
  const lineCols = (l?: SalesLine) => [l?.name ?? "", l?.description ?? "", l ? Number(l.quantity) : "", l?.unit ?? "", l ? Number(l.rate) : "", l ? Number(l.discount) : "", l ? (l.discount_type === "percent" ? "%" : "$") : "", l ? Number(l.amount) : ""];
  const lineHead = ["Item Name", "Item Desc", "Quantity", "Usage Unit", "Item Price", "Discount", "Discount Type", "Item Total"];

  let matrix: unknown[][];
  if (isSub) {
    matrix = [["Subscription Number", "Customer Name", "Profile Name", "Status", "Bill Every", "Bill Unit", "Start Date", "Next Billing Date", "Expires After", "Invoices Created", "Payment Terms", "Salesperson", "Total", ...lineHead]];
    (rows as Subscription[]).forEach((s) => {
      const head = [s.number, s.customer_name, s.profile_name, subStatus(s).label, s.bill_every, s.bill_unit, s.start_date, s.next_billing_date ?? "", s.expires_after ?? "Never", s.invoices_generated, s.payment_terms, s.salesperson ?? "", Number(s.total)];
      const ls = byParent.get(s.id) ?? [];
      (ls.length ? ls : [undefined]).forEach((l) => matrix.push([...head, ...lineCols(l)]));
    });
  } else if (module === "quotes") {
    matrix = [["Quote Date", "Quote Number", "Quote Status", "Customer Name", "Reference Number", "Expiry Date", "Salesperson", "Subject", "Job Site", "SubTotal", "Discount", "Tax %", "Shipping Charge", "Adjustment", "Total", "Notes", "Terms & Conditions", ...lineHead]];
    (rows as SalesDoc[]).forEach((d) => {
      const head = [d.doc_date, d.number, quoteStatus(d).label, d.customer_name, d.reference ?? "", d.expiry_date ?? "", d.salesperson ?? "", d.subject ?? "",
        d.site_address ? [d.site_address.street, d.site_address.city].filter(Boolean).join(", ") : "", Number(d.subtotal), d.discount_type === "percent" ? `${+d.discount_value}%` : Number(d.discount_value),
        Number(d.tax_rate), Number(d.shipping), Number(d.adjustment), Number(d.total), d.notes ?? "", d.terms ?? ""];
      const ls = byParent.get(d.id) ?? [];
      (ls.length ? ls : [undefined]).forEach((l) => matrix.push([...head, ...lineCols(l)]));
    });
  } else {
    matrix = [["Invoice Date", "Invoice Number", "Invoice Status", "Customer Name", "Order Number", "Payment Terms", "Due Date", "Salesperson", "Subject", "Job Site", "SubTotal", "Discount", "Tax %", "Shipping Charge", "Adjustment", "Total", "Payment Made", "Written Off", "Balance", "Notes", "Terms & Conditions", ...lineHead]];
    (rows as SalesDoc[]).forEach((d) => {
      const head = [d.doc_date, d.number, invoiceStatus(d).label, d.customer_name, d.order_number ?? "", d.payment_terms ?? "", d.due_date ?? "", d.salesperson ?? "", d.subject ?? "",
        d.site_address ? [d.site_address.street, d.site_address.city].filter(Boolean).join(", ") : "", Number(d.subtotal), d.discount_type === "percent" ? `${+d.discount_value}%` : Number(d.discount_value),
        Number(d.tax_rate), Number(d.shipping), Number(d.adjustment), Number(d.total), Number(d.amount_paid), Number(d.written_off), balanceOf(d), d.notes ?? "", d.terms ?? ""];
      const ls = byParent.get(d.id) ?? [];
      (ls.length ? ls : [undefined]).forEach((l) => matrix.push([...head, ...lineCols(l)]));
    });
  }
  return exportResponse(matrix, fileBase(module, current.name), format, password, sheet);
}
