import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { AddressSnap, PdfSettings, SalesDoc, SalesLine, addressLines, balanceOf, discountSummary, fmtD, num2, pdfOf } from "@/lib/sales";

export type PdfInput = {
  doc: SalesDoc; lines: SalesLine[]; companyName: string; logoUrl: string | null;
  org: { address?: string; phone?: string; email?: string; website?: string }; pdf: PdfSettings; whiteLabel: boolean;
  hideZero?: boolean; variant?: "full" | "delivery" | "packing";
};

const hex = (h: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
  const n = parseInt(m ? m[1] : "2f3437", 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
const INK = rgb(0.043, 0.122, 0.227);
const TEXT = rgb(0.25, 0.29, 0.34);
const MUTED = rgb(0.45, 0.5, 0.56);
const LINE = rgb(0.86, 0.88, 0.91);
const RED = rgb(0.86, 0.15, 0.27);
const SHADE = rgb(0.96, 0.957, 0.953);

async function loadImage(pdf: PDFDocument, url: string | null): Promise<PDFImage | null> {
  if (!url) return null;
  try {
    let bytes: Uint8Array;
    if (url.startsWith("data:")) bytes = Uint8Array.from(Buffer.from(url.split(",")[1] ?? "", "base64"));
    else { const r = await fetch(url); if (!r.ok) return null; bytes = new Uint8Array(await r.arrayBuffer()); }
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return await pdf.embedPng(bytes);
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return await pdf.embedJpg(bytes);
    return null; // WEBP/SVG no se pueden poner en el PDF
  } catch { return null; }
}

export async function buildSalesPdf(input: PdfInput): Promise<Uint8Array> {
  const { doc, companyName, org } = input;
  const s = pdfOf(input.pdf);
  const variant = input.variant ?? "full";
  const priced = variant === "full";
  const isQuote = doc.kind === "quote";
  const lines = input.lines.filter((l) => !(priced && input.hideZero && Number(l.amount) === 0));
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${isQuote ? "Quote" : "Invoice"} ${doc.number}`);
  pdf.setAuthor(companyName);
  pdf.setCreator(input.whiteLabel ? companyName : "BrightPro");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await loadImage(pdf, input.logoUrl);
  const sign = doc.signature_data ? await loadImage(pdf, doc.signature_data) : null;

  const W = 612, H = 792;
  const M = s.margin === "narrow" ? 36 : s.margin === "wide" ? 68 : 50;
  const base = s.font_size === "small" ? 8.5 : s.font_size === "large" ? 10.5 : 9.5;
  const accent = hex(s.accent);
  const right = W - M;

  // Helvetica solo entiende Latin-1: cambiamos lo raro para que no truene
  const safe = (t: string) => (t ?? "").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/\u2026/g, "...")
    .replace(/[^\x0a\x20-\x7e\xa0-\xff]/g, "");
  const widthOf = (t: string, f: PDFFont, size: number) => f.widthOfTextAtSize(safe(t), size);
  function wrap(t: string, f: PDFFont, size: number, max: number): string[] {
    const out: string[] = [];
    safe(t).split("\n").forEach((para) => {
      const words = para.split(/\s+/);
      let cur = "";
      words.forEach((w) => {
        const next = cur ? `${cur} ${w}` : w;
        if (widthOf(next, f, size) <= max) cur = next;
        else {
          if (cur) out.push(cur);
          if (widthOf(w, f, size) > max) { let chunk = ""; for (const ch of w) { if (widthOf(chunk + ch, f, size) > max) { out.push(chunk); chunk = ch; } else chunk += ch; } cur = chunk; }
          else cur = w;
        }
      });
      out.push(cur);
    });
    return out;
  }

  let page: PDFPage = pdf.addPage([W, H]);
  const pages: PDFPage[] = [page];
  let y = H - M;
  const text = (t: string, x: number, yy: number, o: { f?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; align?: "left" | "right" | "center" } = {}) => {
    const f = o.f ?? font, size = o.size ?? base, str = safe(t);
    const w = f.widthOfTextAtSize(str, size);
    const xx = o.align === "right" ? x - w : o.align === "center" ? x - w / 2 : x;
    page.drawText(str, { x: xx, y: yy, size, font: f, color: o.color ?? TEXT });
  };
  const newPage = () => { page = pdf.addPage([W, H]); pages.push(page); y = H - M; };
  const ensure = (h: number) => { if (y - h < M + 28) { newPage(); return true; } return false; };

  // ---------- Encabezado ----------
  const title = variant === "delivery" ? "DELIVERY NOTE" : variant === "packing" ? "PACKING SLIP" : isQuote ? "QUOTE" : "INVOICE";
  const logoMax = s.logo_size === "small" ? 60 : s.logo_size === "large" ? 130 : 90;
  if (s.template === "modern") {
    page.drawRectangle({ x: 0, y: H - 110, width: W, height: 110, color: accent });
    text(title, right, H - 60, { f: bold, size: 26, color: rgb(1, 1, 1), align: "right" });
    text(`# ${doc.number}`, right, H - 80, { f: font, size: base + 1, color: rgb(1, 1, 1), align: "right" });
    text(companyName, M, H - 60, { f: bold, size: 15, color: rgb(1, 1, 1) });
    y = H - 130;
    if (logo) {
      const sc = Math.min(logoMax / logo.height, 170 / logo.width);
      page.drawImage(logo, { x: M, y: y - logo.height * sc, width: logo.width * sc, height: logo.height * sc });
      y -= logo.height * sc + 10;
    }
  } else {
    let top = y;
    if (logo) {
      const sc = Math.min(logoMax / logo.height, 200 / logo.width);
      page.drawImage(logo, { x: M, y: top - logo.height * sc, width: logo.width * sc, height: logo.height * sc });
      top -= logo.height * sc + 12;
    }
    text(title, right, y - (s.template === "minimal" ? 18 : 26), { f: s.template === "minimal" ? bold : font, size: s.template === "minimal" ? 18 : 28, color: INK, align: "right" });
    text(`# ${doc.number}`, right, y - (s.template === "minimal" ? 34 : 44), { f: bold, size: base + 0.5, color: INK, align: "right" });
    y = top;
    text(companyName, M, y - base, { f: bold, size: base + 1.5, color: INK });
    y -= base + 6;
  }
  if (s.show_org_address) {
    [...(org.address ?? "").split("\n"), org.phone ?? "", org.email ?? "", org.website ?? ""].filter((l) => l.trim()).forEach((l) => { text(l, M, y - base, { size: base }); y -= base + 3; });
  }
  if (!isQuote && priced) {
    const by = s.template === "modern" ? H - 140 : H - M - 70;
    text("Balance Due", right, by, { f: bold, size: base - 0.5, color: MUTED, align: "right" });
    text(`$${num2(balanceOf(doc))}`, right, by - 16, { f: bold, size: base + 5, color: INK, align: "right" });
  }
  y -= 22;

  // ---------- Bill To / Job Site / datos ----------
  const blockTop = y;
  const addr = (label: string, name: string | null, a: AddressSnap, x: number) => {
    let yy = blockTop;
    text(label, x, yy, { color: MUTED }); yy -= base + 4;
    if (name) { text(name, x, yy, { f: bold, color: accent }); yy -= base + 4; }
    addressLines(a).forEach((l) => { wrap(l, font, base, 150).forEach((w) => { text(w, x, yy); yy -= base + 3; }); });
    return yy;
  };
  let low = addr("Bill To", doc.customer_name, doc.billing_address, M);
  if (doc.site_address) low = Math.min(low, addr(doc.site_address.label ? `Job Site - ${doc.site_address.label}` : "Job Site / Ship To", null, doc.site_address, M + 165));
  const meta: [string, string][] = (isQuote
    ? [["Quote Date", fmtD(doc.doc_date)], ["Expiry Date", fmtD(doc.expiry_date)], ["Reference#", doc.reference ?? ""], ["Salesperson", doc.salesperson ?? ""]]
    : [["Invoice Date", fmtD(doc.doc_date)], ["Terms", doc.payment_terms ?? ""], ["Due Date", fmtD(doc.due_date)], ["P.O.#", doc.order_number ?? ""], ["Salesperson", doc.salesperson ?? ""]]
  ).filter(([, v]) => v) as [string, string][];
  let my = blockTop - (base + 4);
  meta.forEach(([k, v]) => { text(`${k} :`, right - 90, my, { color: MUTED, align: "right" }); text(v, right, my, { color: INK, align: "right" }); my -= base + 6; });
  y = Math.min(low, my) - 14;
  if (doc.subject) {
    text("Subject :", M, y, { color: MUTED }); y -= base + 3;
    wrap(doc.subject, font, base, right - M).forEach((l) => { text(l, M, y, { color: INK }); y -= base + 3; });
    y -= 8;
  }

  // ---------- Tabla ----------
  const cQty = priced ? right - 200 : right - 20, cRate = right - 100, cAmt = right - 8;
  const descMax = (priced ? cQty - 40 : cQty - 60) - (M + 34);
  const head = () => {
    const h = base + 12;
    if (s.template === "minimal") page.drawLine({ start: { x: M, y: y - h }, end: { x: right, y: y - h }, thickness: 1, color: accent });
    else page.drawRectangle({ x: M, y: y - h, width: right - M, height: h, color: accent });
    const c = s.template === "minimal" ? INK : rgb(1, 1, 1);
    const ty = y - h + 7;
    text("#", M + 12, ty, { f: bold, color: c, align: "center" });
    text("Item & Description", M + 34, ty, { f: bold, color: c });
    text("Qty", cQty, ty, { f: bold, color: c, align: "right" });
    if (priced) { text("Rate", cRate, ty, { f: bold, color: c, align: "right" }); text("Amount", cAmt, ty, { f: bold, color: c, align: "right" }); }
    if (variant === "packing") text("Packed", cAmt, ty, { f: bold, color: c, align: "right" });
    y -= h + 4;
  };
  head();
  lines.forEach((l, i) => {
    const nameL = wrap(l.name, font, base + 0.5, descMax);
    const descL = l.description ? wrap(l.description, font, base - 0.5, descMax) : [];
    const h = nameL.length * (base + 4) + descL.length * (base + 2) + 10;
    if (ensure(h)) head();
    let yy = y - base - 2;
    text(String(i + 1), M + 12, yy, { align: "center" });
    nameL.forEach((t) => { text(t, M + 34, yy, { size: base + 0.5, color: INK }); yy -= base + 4; });
    descL.forEach((t) => { text(t, M + 34, yy, { size: base - 0.5, color: MUTED }); yy -= base + 2; });
    text(num2(l.quantity), cQty, y - base - 2, { align: "right" });
    if (l.unit) text(l.unit, cQty, y - base * 2 - 4, { size: base - 1.5, color: MUTED, align: "right" });
    if (priced) {
      text(num2(l.rate), cRate, y - base - 2, { align: "right" });
      text(num2((Number(l.quantity) || 0) * (Number(l.rate) || 0)), cAmt, y - base - 2, { align: "right" });
    }
    if (variant === "packing") page.drawRectangle({ x: cAmt - 12, y: y - base - 4, width: 10, height: 10, borderColor: MUTED, borderWidth: 0.8 });
    y -= h;
    page.drawLine({ start: { x: M, y }, end: { x: right, y }, thickness: 0.6, color: LINE });
  });
  if (!lines.length) { text("No items", (M + right) / 2, y - 16, { color: MUTED, align: "center" }); y -= 28; }

  // ---------- Totales (descuento abajo en rojo, como Zoho) ----------
  if (priced) {
    const d = discountSummary(doc, input.lines);
    const rows: { k: string; v: string; red?: boolean; strong?: boolean; shade?: boolean }[] = [{ k: "Sub Total", v: num2(d.gross) }];
    if (d.total > 0) rows.push({ k: doc.coupon_code ? `Discount (${doc.coupon_code})` : doc.discount_type === "percent" && Number(doc.discount_value) && !d.itemDisc ? `Discount (${+doc.discount_value}%)` : "Discount", v: `(-) ${num2(d.total)}`, red: true });
    if (Number(doc.tax_amount) > 0) rows.push({ k: `${doc.tax_name || "Tax"} (${+doc.tax_rate}%)`, v: num2(doc.tax_amount) });
    if (Number(doc.shipping) !== 0) rows.push({ k: "Shipping Charges", v: num2(doc.shipping) });
    if (Number(doc.adjustment) !== 0) rows.push({ k: doc.adjustment_label || "Adjustment", v: num2(doc.adjustment) });
    rows.push({ k: "Total", v: `$${num2(doc.total)}`, strong: true, shade: isQuote });
    if (!isQuote) {
      if (Number(doc.amount_paid) > 0) rows.push({ k: "Payment Made", v: `(-) ${num2(doc.amount_paid)}`, red: true });
      if (Number(doc.written_off) > 0) rows.push({ k: "Written Off", v: `(-) ${num2(doc.written_off)}` });
      rows.push({ k: "Balance Due", v: `$${num2(balanceOf(doc))}`, strong: true, shade: true });
    }
    ensure(rows.length * 22 + 10);
    y -= 8;
    rows.forEach((r) => {
      if (r.shade) page.drawRectangle({ x: right - 230, y: y - 18, width: 230, height: 24, color: SHADE });
      text(r.k, right - 110, y - 10, { f: r.strong ? bold : font, color: r.strong ? INK : TEXT, align: "right" });
      text(r.v, cAmt, y - 10, { f: r.strong ? bold : font, color: r.red ? RED : r.strong ? INK : TEXT, align: "right" });
      y -= 24;
    });
  }

  // ---------- Notas, términos y firma ----------
  const para = (label: string, body: string | null) => {
    if (!body) return;
    const ls = wrap(body, font, base, right - M);
    ensure(ls.length * (base + 3) + 30);
    y -= 14; text(label, M, y, { color: MUTED }); y -= base + 5;
    ls.forEach((l) => { if (ensure(base + 3)) y -= 4; text(l, M, y, { color: INK }); y -= base + 3; });
  };
  para("Notes", doc.notes);
  para("Terms & Conditions", doc.terms);
  if (doc.signed_name && doc.signed_at) {
    ensure(sign ? 100 : 50); y -= 20;
    text("Accepted & signed by the customer", M, y, { f: bold, color: INK }); y -= 8;
    if (sign) { const sc = Math.min(60 / sign.height, 200 / sign.width); page.drawImage(sign, { x: M, y: y - sign.height * sc, width: sign.width * sc, height: sign.height * sc }); y -= sign.height * sc + 4; }
    page.drawLine({ start: { x: M, y }, end: { x: M + 210, y }, thickness: 0.6, color: MUTED }); y -= base + 3;
    text(`${doc.signed_name} - ${fmtD(doc.signed_at)}`, M, y, { color: TEXT }); y -= base + 3;
  }
  if (variant !== "full") {
    ensure(60); y -= 40;
    page.drawLine({ start: { x: M, y }, end: { x: M + 220, y }, thickness: 0.6, color: MUTED });
    page.drawLine({ start: { x: right - 160, y }, end: { x: right, y }, thickness: 0.6, color: MUTED });
    text("Received by (name & signature)", M, y - 12, { color: MUTED }); text("Date", right - 160, y - 12, { color: MUTED });
  }

  // ---------- Pie de página en cada hoja ----------
  pages.forEach((p, i) => {
    page = p;
    p.drawLine({ start: { x: M, y: M + 18 }, end: { x: right, y: M + 18 }, thickness: 0.5, color: LINE });
    let fx = M;
    if (s.footer_text) { text(s.footer_text.slice(0, 140), fx, M + 5, { size: base - 1.5, color: MUTED }); fx += widthOf(s.footer_text.slice(0, 140), font, base - 1.5) + 14; }
    // Sin plan pagado siempre sale "Powered by BrightPro"; con marca blanca la compañía decide
    if (!input.whiteLabel || s.show_powered) {
      text("POWERED BY", fx, M + 5, { size: base - 2, color: MUTED });
      text("Bright", fx + widthOf("POWERED BY", font, base - 2) + 5, M + 5, { f: bold, size: base, color: INK });
      text("Pro", fx + widthOf("POWERED BY", font, base - 2) + 5 + widthOf("Bright", bold, base), M + 5, { f: bold, size: base, color: rgb(0.91, 0.44, 0.23) });
    }
    text(`${i + 1}`, right, M + 5, { size: base - 1.5, color: MUTED, align: "right" });
  });
  return pdf.save();
}

export const pdfFileName = (doc: SalesDoc, variant?: string) =>
  `${variant === "delivery" ? "Delivery-Note-" : variant === "packing" ? "Packing-Slip-" : ""}${doc.number}.pdf`.replace(/[^\w.\-]+/g, "_");
