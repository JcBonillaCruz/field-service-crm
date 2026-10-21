import type { SupabaseClient } from "@supabase/supabase-js";
import { SalesDoc, SalesLine, SalesPrefs, money, balanceOf, fmtD } from "@/lib/sales";
import { PdfInput } from "@/lib/sales-pdf";

export const pdfInputFrom = (d: { doc: SalesDoc; lines: SalesLine[]; prefs: SalesPrefs; companyName: string }, variant?: PdfInput["variant"]): PdfInput => ({
  doc: d.doc, lines: d.lines, companyName: d.companyName, logoUrl: d.prefs.logo_url, org: d.prefs.org_info ?? {}, pdf: d.prefs.pdf_settings ?? {},
  whiteLabel: d.prefs.white_label, hideZero: d.doc.kind === "quote" ? d.prefs.quote_settings.hide_zero_lines : d.prefs.invoice_settings.hide_zero_lines, variant,
});

export function newToken() {
  const a = new Uint8Array(18);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function ensureToken(supabase: SupabaseClient, doc: SalesDoc) {
  if (doc.share_token) return doc.share_token;
  const t = newToken();
  const { error } = await supabase.from("sales_docs").update({ share_token: t }).eq("id", doc.id);
  return error ? null : t;
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// **negrita**, *cursiva*, __subrayado__ del cuadro de texto
const rich = (t: string) => esc(t).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/__([^_]+)__/g, "<u>$1</u>").replace(/\*([^*]+)\*/g, "<i>$1</i>");

// Correo bonito con botón, en los colores de la compañía
export function emailHtml(o: { body: string; link: string; pixel: string; doc: SalesDoc; companyName: string; logoUrl: string | null; accent: string; whiteLabel: boolean }) {
  const isQuote = o.doc.kind === "quote";
  const btn = `<a href="${o.link}" style="display:inline-block;background:${o.accent};color:#ffffff;text-decoration:none;font-weight:600;padding:12px 26px;border-radius:8px;font-size:15px">${isQuote ? "VIEW QUOTE" : "VIEW INVOICE"}</a>`;
  const paras = o.body.split(/\n{2,}/).map((p) => p.includes("{link}")
    ? `<p style="margin:0 0 16px">${rich(p.replace("{link}", "").trim()).replace(/\n/g, "<br>")}</p><p style="margin:0 0 20px">${btn}</p>`
    : `<p style="margin:0 0 16px">${rich(p).replace(/\n/g, "<br>")}</p>`).join("");
  const amount = isQuote ? money(o.doc.total) : money(balanceOf(o.doc));
  return `<!doctype html><html><body style="margin:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb">
<tr><td style="background:${o.accent};height:6px;font-size:0">&nbsp;</td></tr>
<tr><td style="padding:26px 32px 8px">${o.logoUrl ? `<img src="${o.logoUrl}" alt="${esc(o.companyName)}" style="max-height:70px;max-width:220px;display:block">` : `<p style="margin:0;font-size:20px;font-weight:700;color:#0b1f3a">${esc(o.companyName)}</p>`}</td></tr>
<tr><td style="padding:8px 32px 4px"><table role="presentation" width="100%" style="background:#f8fafc;border-radius:10px"><tr>
<td style="padding:16px 18px"><p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.5px">${isQuote ? "Quote" : "Invoice"} ${esc(o.doc.number)}</p>
<p style="margin:4px 0 0;font-size:24px;font-weight:700;color:#0b1f3a">${amount}</p>
${!isQuote && o.doc.due_date ? `<p style="margin:4px 0 0;color:#64748b;font-size:13px">Due ${fmtD(o.doc.due_date)}</p>` : ""}
${isQuote && o.doc.expiry_date ? `<p style="margin:4px 0 0;color:#64748b;font-size:13px">Valid until ${fmtD(o.doc.expiry_date)}</p>` : ""}</td></tr></table></td></tr>
<tr><td style="padding:20px 32px 10px;font-size:15px;line-height:1.6">${paras}</td></tr>
<tr><td style="padding:14px 32px 24px;border-top:1px solid #f1f5f9;color:#94a3b8;font-size:12px">${esc(o.companyName)}${o.whiteLabel ? "" : ` · Sent with <b style="color:#0b1f3a">Bright</b><b style="color:#e8713a">Pro</b>`}</td></tr>
</table></td></tr></table><img src="${o.pixel}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px"></body></html>`;
}
