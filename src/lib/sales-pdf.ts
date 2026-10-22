import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { TPL_ICONS, tplOf } from "@/lib/pdf-templates";
import { AddressSnap, PdfSettings, SalesDoc, SalesLine, addressLines, balanceOf, discountSummary, fmtD, num2, pdfOf } from "@/lib/sales";

export type PdfInput = {
  doc: SalesDoc; lines: SalesLine[]; companyName: string; logoUrl: string | null;
  org: { address?: string; phone?: string; email?: string; website?: string }; pdf: PdfSettings; whiteLabel: boolean;
  hideZero?: boolean; variant?: "full" | "delivery" | "packing";
  photos?: { name: string; bytes: Uint8Array }[]; // fotos del trabajo (4 por hoja)
};
export const MAX_PDF_PHOTOS = 12;

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
  const tp = tplOf(s.template);
  const fam = tp.font === "serif" ? [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold] : tp.font === "mono" ? [StandardFonts.Courier, StandardFonts.CourierBold] : [StandardFonts.Helvetica, StandardFonts.HelveticaBold];
  const font = await pdf.embedFont(fam[0]);
  const bold = await pdf.embedFont(fam[1]);
  const logo = await loadImage(pdf, input.logoUrl);
  const sign = doc.signature_data ? await loadImage(pdf, doc.signature_data) : null;

  const W = 612, H = 792;
  const M0 = s.margin === "narrow" ? 36 : s.margin === "wide" ? 68 : 50;
  // Plantillas de recibo: columna angosta al centro
  const M = tp.receipt ? 160 : M0;
  const MV = M0; // margen de arriba y abajo
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
  let y = H - MV;
  const text = (t: string, x: number, yy: number, o: { f?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; align?: "left" | "right" | "center" } = {}) => {
    const f = o.f ?? font, size = o.size ?? base, str = safe(t);
    const w = f.widthOfTextAtSize(str, size);
    const xx = o.align === "right" ? x - w : o.align === "center" ? x - w / 2 : x;
    page.drawText(str, { x: xx, y: yy, size, font: f, color: o.color ?? TEXT });
  };
  // Ícono en cuadrito suave (plantillas ✦). Devuelve cuánto hay que mover el texto
  const icon = (d: string, x: number, yy: number) => {
    if (!tp.icons) return 0;
    page.drawRectangle({ x, y: yy - 3, width: 13, height: 13, color: accent, opacity: 0.12 });
    page.drawSvgPath(d, { x: x + 1.5, y: yy + 8.5, scale: 10 / 24, borderColor: accent, borderWidth: 2.2 });
    return 18;
  };
  const newPage = () => { page = pdf.addPage([W, H]); pages.push(page); y = H - MV; };
  const ensure = (h: number) => { if (y - h < MV + 28) { newPage(); return true; } return false; };

  // ---------- Encabezado (izquierda y derecha se miden por separado para que nada se monte) ----------
  const title = variant === "delivery" ? "DELIVERY NOTE" : variant === "packing" ? "PACKING SLIP" : isQuote ? "QUOTE" : "INVOICE";
  const logoMax = s.logo_px > 0 ? s.logo_px * 0.75 : s.logo_size === "small" ? 80 : s.logo_size === "large" ? 190 : 135; // px de pantalla → puntos del PDF
  const titleSize = tp.receipt ? 18 : tp.titleWeight === "bold" ? 22 : 26;
  const titleFont = tp.titleWeight === "bold" ? bold : font;
  const orgLines: [string, string | null][] = s.show_org_address ? [
    ...(org.address ?? "").split("\n").filter((l) => l.trim()).map((l, i) => [l, i === 0 ? TPL_ICONS.pin : null] as [string, string | null]),
    [org.phone ?? "", TPL_ICONS.phone], [org.email ?? "", TPL_ICONS.mail], [org.website ?? "", TPL_ICONS.globe],
  ].filter(([l]) => (l as string).trim()) as [string, string | null][] : [];
  const drawLogo = (x: number, yTop: number, align: "left" | "right" | "center") => {
    if (!logo) return yTop;
    const sc = Math.min(logoMax / logo.height, (tp.receipt ? 220 : 400) / logo.width);
    const w = logo.width * sc, h = logo.height * sc;
    const lx = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
    page.drawImage(logo, { x: lx, y: yTop - h, width: w, height: h });
    return yTop - h - 10;
  };
  const drawOrg = (x: number, yTop: number, align: "left" | "right" | "center", withName = true) => {
    let yy = yTop;
    if (withName) { text(companyName, x, yy - base - 1, { f: bold, size: base + 1.5, color: INK, align }); yy -= base + 7; }
    orgLines.forEach(([l, d]) => {
      const off = tp.icons && align === "left" ? 18 : 0;
      if (off && d) icon(d, x, yy - base);
      text(l, x + off, yy - base, { align }); yy -= base + (tp.icons ? 6 : 3);
    });
    return yy;
  };
  const drawTitle = (x: number, yTop: number, align: "left" | "right" | "center", color = INK) => {
    let yy = yTop - titleSize;
    text(title, x, yy, { f: titleFont, size: titleSize, color: tp.header === "split" ? accent : color, align });
    yy -= 16; text(`# ${doc.number}`, x, yy, { f: bold, size: base + 0.5, color: INK, align });
    if (!isQuote && priced) {
      yy -= 22; text("Balance Due", x, yy, { f: bold, size: base - 0.5, color: MUTED, align });
      if (tp.icons && align === "right") icon(TPL_ICONS.wallet, x - bold.widthOfTextAtSize("Balance Due", base - 0.5) - 18, yy);
      yy -= 17; text(`$${num2(balanceOf(doc))}`, x, yy, { f: bold, size: base + 5, color: INK, align });
    }
    return yy - 8;
  };
  if (tp.header === "band") {
    page.drawRectangle({ x: 0, y: H - 100, width: W, height: 100, color: accent });
    text(companyName, M, H - 58, { f: bold, size: 15, color: rgb(1, 1, 1) });
    text(title, right, H - 54, { f: titleFont, size: titleSize, color: rgb(1, 1, 1), align: "right" });
    text(`# ${doc.number}`, right, H - 74, { size: base + 1, color: rgb(1, 1, 1), align: "right" });
    let l = drawLogo(M, H - 118, "left");
    l = drawOrg(M, l, "left", false);
    let r = H - 118;
    if (!isQuote && priced) {
      text("Balance Due", right, r - base, { f: bold, size: base - 0.5, color: MUTED, align: "right" });
      text(`$${num2(balanceOf(doc))}`, right, r - base - 18, { f: bold, size: base + 5, color: INK, align: "right" });
      r -= base + 26;
    }
    y = Math.min(l, r) - 10;
  } else if (tp.header === "centered") {
    let c = drawLogo(W / 2, y, "center");
    c = drawOrg(W / 2, c, "center");
    y = drawTitle(W / 2, c - 10, "center");
  } else if (tp.header === "reversed") {
    const l = drawTitle(M, y, "left");
    let r = drawLogo(right, y, "right");
    r = drawOrg(right, r, "right");
    y = Math.min(l, r) - 6;
  } else {
    let l = drawLogo(M, y, "left");
    l = drawOrg(M, l, "left");
    const r = drawTitle(right, y, "right");
    y = Math.min(l, r) - 6;
    if (tp.header === "split") { page.drawRectangle({ x: M, y: y - 4, width: right - M, height: 3, color: accent }); y -= 12; }
  }
  y -= 14;
  if (tp.border) page.drawRectangle({ x: M - 16, y: MV - 4, width: right - M + 32, height: H - 2 * MV + 24, borderColor: rgb(0.8, 0.82, 0.86), borderWidth: 1.2 });

  // ---------- Bill To / Job Site / datos ----------
  const blockTop = y;
  const addr = (label: string, name: string | null, a: AddressSnap, x: number) => {
    let yy = blockTop;
    const off = icon(label.startsWith("Bill") ? TPL_ICONS.user : TPL_ICONS.pin, x, yy);
    text(label, x + off, yy, { color: MUTED }); yy -= base + (tp.icons ? 7 : 4);
    if (name) { text(name, x, yy, { f: bold, color: accent }); yy -= base + 4; }
    addressLines(a).forEach((l) => { wrap(l, font, base, 150).forEach((w) => { text(w, x, yy); yy -= base + 3; }); });
    return yy;
  };
  let low = addr("Bill To", doc.customer_name, doc.billing_address, M);
  if (doc.site_address && !tp.receipt) low = Math.min(low, addr(doc.site_address.label ? `Job Site - ${doc.site_address.label}` : "Job Site / Ship To", null, doc.site_address, M + 165));
  const meta: [string, string][] = (isQuote
    ? [["Quote Date", fmtD(doc.doc_date)], ["Expiry Date", fmtD(doc.expiry_date)], ["Reference#", doc.reference ?? ""], ["Salesperson", doc.salesperson ?? ""]]
    : [["Invoice Date", fmtD(doc.doc_date)], ["Terms", doc.payment_terms ?? ""], ["Due Date", fmtD(doc.due_date)], ["P.O.#", doc.order_number ?? ""], ["Salesperson", doc.salesperson ?? ""]]
  ).filter(([, v]) => v) as [string, string][];
  let my = blockTop - (base + 4);
  if (tp.meta === "right" && !tp.receipt) {
    meta.forEach(([k, v]) => { text(`${k} :`, right - 90, my, { color: MUTED, align: "right" }); text(v, right, my, { color: INK, align: "right" }); my -= base + 6; });
  }
  y = Math.min(low, my) - 14;
  if (tp.meta === "row" || tp.receipt) {
    const cells = meta.slice(0, tp.receipt ? 3 : 4);
    const cw = (right - M) / Math.max(1, cells.length);
    page.drawRectangle({ x: M, y: y - 30, width: right - M, height: 32, borderColor: LINE, borderWidth: 0.8 });
    cells.forEach(([k, v], i) => {
      text(k, M + i * cw + 6, y - 11, { size: base - 1.5, color: MUTED });
      text(v, M + i * cw + 6, y - 24, { size: base - 0.5, color: INK });
      if (i) page.drawLine({ start: { x: M + i * cw, y: y - 30 }, end: { x: M + i * cw, y: y + 2 }, thickness: 0.6, color: LINE });
    });
    y -= 46;
  }
  if (doc.subject) {
    text("Subject :", M, y, { color: MUTED }); y -= base + 3;
    wrap(doc.subject, font, base, right - M).forEach((l) => { text(l, M, y, { color: INK }); y -= base + 3; });
    y -= 8;
  }

  // ---------- Tabla ----------
  const cQty = tp.receipt ? (priced ? right - 120 : right - 8) : priced ? right - 200 : right - 20;
  const cRate = tp.receipt ? right - 58 : right - 100, cAmt = right - (tp.receipt ? 2 : 8);
  const cName = tp.receipt ? M + 4 : M + 34;
  const descMax = (priced ? cQty - (tp.receipt ? 34 : 40) : cQty - 60) - cName;
  const head = () => {
    const h = base + 12;
    const filled = tp.table === "dark" || tp.table === "accent";
    if (tp.table === "lines") page.drawLine({ start: { x: M, y: y - h }, end: { x: right, y: y - h }, thickness: 1.5, color: accent });
    else if (tp.table === "light") page.drawRectangle({ x: M, y: y - h, width: right - M, height: h, color: accent, opacity: 0.12 });
    else if (tp.table === "grid") page.drawRectangle({ x: M, y: y - h, width: right - M, height: h, color: rgb(0.945, 0.96, 0.976), borderColor: rgb(0.8, 0.82, 0.86), borderWidth: 0.8 });
    else page.drawRectangle({ x: M, y: y - h, width: right - M, height: h, color: accent });
    const c = filled ? rgb(1, 1, 1) : INK;
    const ty = y - h + 7;
    if (!tp.receipt) text("#", M + 12, ty, { f: bold, color: c, align: "center" });
    text(tp.receipt ? "Item" : "Item & Description", cName, ty, { f: bold, color: c });
    text("Qty", cQty, ty, { f: bold, color: c, align: "right" });
    if (priced) { text("Rate", cRate, ty, { f: bold, color: c, align: "right" }); text("Amount", cAmt, ty, { f: bold, color: c, align: "right" }); }
    if (variant === "packing") text("Packed", cAmt, ty, { f: bold, color: c, align: "right" });
    y -= h + 4;
  };
  head();
  lines.forEach((l, i) => {
    const nameL = wrap(l.name, font, base + 0.5, descMax);
    const descL = l.description && !tp.receipt ? wrap(l.description, font, base - 0.5, descMax) : [];
    const h = nameL.length * (base + 4) + descL.length * (base + 2) + 10;
    if (ensure(h)) head();
    let yy = y - base - 2;
    if (!tp.receipt) text(String(i + 1), M + 12, yy, { align: "center" });
    nameL.forEach((t) => { text(t, cName, yy, { size: base + 0.5, color: INK }); yy -= base + 4; });
    descL.forEach((t) => { text(t, cName, yy, { size: base - 0.5, color: MUTED }); yy -= base + 2; });
    text(num2(l.quantity), cQty, y - base - 2, { align: "right" });
    if (l.unit && !tp.receipt) text(l.unit, cQty, y - base * 2 - 4, { size: base - 1.5, color: MUTED, align: "right" });
    if (priced) {
      text(num2(l.rate), cRate, y - base - 2, { align: "right" });
      text(num2((Number(l.quantity) || 0) * (Number(l.rate) || 0)), cAmt, y - base - 2, { align: "right" });
    }
    if (variant === "packing") page.drawRectangle({ x: cAmt - 12, y: y - base - 4, width: 10, height: 10, borderColor: MUTED, borderWidth: 0.8 });
    if (tp.table === "accent" && i % 2) page.drawRectangle({ x: M, y: y - h, width: right - M, height: h, color: rgb(0.973, 0.98, 0.988), opacity: 0.6 });
    y -= h;
    if (tp.table === "grid") page.drawRectangle({ x: M, y, width: right - M, height: h, borderColor: rgb(0.8, 0.82, 0.86), borderWidth: 0.6 });
    else page.drawLine({ start: { x: M, y }, end: { x: right, y }, thickness: 0.6, color: LINE });
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
      const acc = r.shade && tp.totals === "accent";
      const tw = tp.receipt ? right - M : 230;
      if (r.shade && tp.totals !== "plain") page.drawRectangle({ x: right - tw, y: y - 18, width: tw, height: 24, color: acc ? accent : SHADE });
      if (r.shade && tp.totals === "plain") page.drawLine({ start: { x: right - tw, y: y + 6 }, end: { x: right, y: y + 6 }, thickness: 1.2, color: INK });
      if (tp.totals === "box") page.drawRectangle({ x: right - tw, y: y - 18, width: tw, height: 24, borderColor: LINE, borderWidth: 0.6 });
      const white = rgb(1, 1, 1);
      text(r.k, right - 110, y - 10, { f: r.strong ? bold : font, color: acc ? white : r.strong ? INK : TEXT, align: "right" });
      text(r.v, cAmt, y - 10, { f: r.strong ? bold : font, color: acc ? white : r.red ? RED : r.strong ? INK : TEXT, align: "right" });
      y -= 24;
    });
  }

  // ---------- Notas, términos y firma ----------
  const para = (label: string, body: string | null) => {
    if (!body) return;
    const ls = wrap(body, font, base, right - M);
    ensure(ls.length * (base + 3) + 30);
    y -= 14; const off = icon(label === "Notes" ? TPL_ICONS.note : TPL_ICONS.shield, M, y); text(label, M + off, y, { color: MUTED }); y -= base + (tp.icons ? 8 : 5);
    ls.forEach((l) => { if (ensure(base + 3)) y -= 4; text(l, M, y, { color: INK }); y -= base + 3; });
  };
  para("Notes", doc.notes);
  para("Terms & Conditions", doc.terms);
  // Firma del cliente: abajo, justo arriba del pie de página de la última hoja (se ve más profesional)
  if (doc.signed_name && doc.signed_at) {
    const sc = sign ? Math.min(60 / sign.height, 220 / sign.width) : 0;
    const sh = sign ? sign.height * sc : 0;
    const bh = 18 + sh + 8 + base * 2 + 10;
    if (y - bh < MV + 48) newPage();
    let sy = MV + 40 + bh;
    text("Accepted & signed by the customer", M, sy - base, { f: bold, color: INK }); sy -= base + 10;
    if (sign) { page.drawImage(sign, { x: M, y: sy - sh, width: sign.width * sc, height: sh }); sy -= sh + 4; }
    page.drawLine({ start: { x: M, y: sy }, end: { x: M + 230, y: sy }, thickness: 0.6, color: MUTED }); sy -= base + 3;
    text(`${doc.signed_name} - ${fmtD(doc.signed_at)}`, M, sy, { color: TEXT });
    y = MV + 40;
  }
  if (variant !== "full") {
    ensure(60); y -= 40;
    page.drawLine({ start: { x: M, y }, end: { x: M + 220, y }, thickness: 0.6, color: MUTED });
    page.drawLine({ start: { x: right - 160, y }, end: { x: right, y }, thickness: 0.6, color: MUTED });
    text("Received by (name & signature)", M, y - 12, { color: MUTED }); text("Date", right - 160, y - 12, { color: MUTED });
  }

  // ---------- Fotos del trabajo: 4 por hoja (2 × 2), con su margen ----------
  const photos = (input.photos ?? []).slice(0, MAX_PDF_PHOTOS);
  const embedded: { img: PDFImage; name: string }[] = [];
  for (const ph of photos) {
    try {
      const b = ph.bytes;
      const img = b[0] === 0x89 && b[1] === 0x50 ? await pdf.embedPng(b) : b[0] === 0xff && b[1] === 0xd8 ? await pdf.embedJpg(b) : null;
      if (img) embedded.push({ img, name: ph.name });
    } catch { /* foto dañada: se salta */ }
  }
  for (let i = 0; i < embedded.length; i += 4) {
    newPage();
    text(i === 0 ? "Job Photos" : "Job Photos (continued)", M, y - 14, { f: bold, size: base + 4, color: INK });
    text(`${doc.kind === "quote" ? "Quote" : "Invoice"} # ${doc.number}`, right, y - 14, { color: MUTED, align: "right" });
    const top = y - 34, gap = 14;
    const cw = (right - M - gap) / 2, ch = (top - (MV + 40) - gap) / 2;
    embedded.slice(i, i + 4).forEach((p, k) => {
      const cx = M + (k % 2) * (cw + gap), cy = top - Math.floor(k / 2) * (ch + gap);
      page.drawRectangle({ x: cx, y: cy - ch, width: cw, height: ch, color: rgb(0.97, 0.975, 0.98), borderColor: LINE, borderWidth: 0.6 });
      const sc = Math.min((cw - 12) / p.img.width, (ch - 28) / p.img.height);
      const w = p.img.width * sc, h = p.img.height * sc;
      page.drawImage(p.img, { x: cx + (cw - w) / 2, y: cy - 6 - h - ((ch - 28) - h) / 2, width: w, height: h });
      const label = p.name.length > 48 ? p.name.slice(0, 45) + "..." : p.name;
      text(label, cx + 6, cy - ch + 8, { size: base - 1.5, color: MUTED });
    });
  }

  // ---------- Pie de página en cada hoja ----------
  pages.forEach((p, i) => {
    page = p;
    p.drawLine({ start: { x: M, y: MV + 18 }, end: { x: right, y: MV + 18 }, thickness: 0.5, color: LINE });
    let fx = M;
    if (s.footer_text) { text(s.footer_text.slice(0, 140), fx, MV + 5, { size: base - 1.5, color: MUTED }); fx += widthOf(s.footer_text.slice(0, 140), font, base - 1.5) + 14; }
    // Sin plan pagado siempre sale "Powered by BrightPro"; con marca blanca la compañía decide
    if (!input.whiteLabel || s.show_powered) {
      text("POWERED BY", fx, MV + 5, { size: base - 2, color: MUTED });
      text("Bright", fx + widthOf("POWERED BY", font, base - 2) + 5, MV + 5, { f: bold, size: base, color: INK });
      text("Pro", fx + widthOf("POWERED BY", font, base - 2) + 5 + widthOf("Bright", bold, base), MV + 5, { f: bold, size: base, color: rgb(0.91, 0.44, 0.23) });
    }
    text(`${i + 1}`, right, MV + 5, { size: base - 1.5, color: MUTED, align: "right" });
  });
  return pdf.save();
}

export const pdfFileName = (doc: SalesDoc, variant?: string) =>
  `${variant === "delivery" ? "Delivery-Note-" : variant === "packing" ? "Packing-Slip-" : ""}${doc.number}.pdf`.replace(/[^\w.\-]+/g, "_");
