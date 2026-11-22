import type { PDFFont, PDFPage } from "pdf-lib";

// =====================================================================
// PDF real de los reportes (Paso 5.10d) — reemplaza la hoja HTML que se abría en otra ventana.
// Cada reporte describe su contenido (tarjetas, viñetas, tablas) y aquí se dibuja en hojas tamaño carta
// con pdf-lib (la misma librería de las facturas). Se arma en el navegador con los datos que ya están en pantalla.
// =====================================================================
export type PdfTone = "neg" | "pos" | "muted";
export type PdfCell = string | { text: string; tone?: PdfTone; sub?: string };
export type PdfRow = { cells: PdfCell[]; style?: "section" | "sub" | "total" | "result" };
export type PdfColumn = { label: string; width: number; align?: "left" | "right" }; // width = parte del ancho (se reparten en proporción)
export type PdfBlock =
  | { type: "kpis"; items: { label: string; value: string; tone?: PdfTone }[] }
  | { type: "heading"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "table"; columns: PdfColumn[]; rows: PdfRow[]; hideHeader?: boolean }
  | { type: "note"; text: string }
  // Paso 5.13: fotos (JPG) en dos columnas, con su pie. Las usa el reporte de servicio.
  | { type: "photos"; items: { jpg: Uint8Array; caption?: string }[] };
export type PdfDoc = { title: string; subtitle: string; company: string; blocks: PdfBlock[]; footer?: string; fileName: string;
  lang?: "en" | "es"; // Paso 6.2d: idioma del pie de página (el reporte de servicio sale en el idioma del cliente)
};

// Las fuentes estándar del PDF no traen flechas ni el signo menos tipográfico: se cambian por su equivalente
const safe = (t: unknown) => String(t ?? "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/−/g, "-").replace(/→/g, ">")
  .replace(/…/g, "...").replace(/×/g, "x").replace(/[^\x20-\x7e\xa0-\xff–—]/g, "");
export const pdfFileName = (...parts: string[]) => `${parts.join("-").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.pdf`;

export async function buildReportPdf(doc: PdfDoc): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${doc.title} · ${doc.company}`); pdf.setAuthor(doc.company); pdf.setCreator("BrightPro");
  const font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 612, H = 792, M = 42, CW = W - M * 2;
  const C = {
    ink: rgb(0.043, 0.122, 0.227), teal: rgb(0.059, 0.463, 0.431), gray: rgb(0.392, 0.455, 0.545), light: rgb(0.58, 0.64, 0.72),
    line: rgb(0.886, 0.91, 0.941), soft: rgb(0.945, 0.973, 0.965), neg: rgb(0.745, 0.071, 0.235), pos: rgb(0.082, 0.502, 0.239), softNeg: rgb(1, 0.945, 0.949),
  };
  const toneColor = (t?: PdfTone) => (t === "neg" ? C.neg : t === "pos" ? C.pos : t === "muted" ? C.gray : C.ink);
  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;
  const newPage = () => { page = pdf.addPage([W, H]); y = H - M; };
  const need = (h: number) => { if (y - h < M + 26) newPage(); };
  const text = (s: string, x: number, yy: number, size: number, f: PDFFont = font, color = C.ink) => page.drawText(safe(s), { x, y: yy, size, font: f, color });
  const widthOf = (s: string, size: number, f: PDFFont = font) => f.widthOfTextAtSize(safe(s), size);
  const wrap = (s: string, size: number, max: number, f: PDFFont = font): string[] => {
    const out: string[] = []; let line = "";
    for (const w of safe(s).split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(next, size) <= max || !line) line = next; else { out.push(line); line = w; }
    }
    if (line) out.push(line);
    return out.length ? out : [""];
  };
  // Recorta con "..." lo que no cabe en una celda de una sola línea
  const fit = (s: string, size: number, max: number, f: PDFFont = font) => {
    let t = safe(s);
    if (f.widthOfTextAtSize(t, size) <= max) return t;
    while (t.length > 1 && f.widthOfTextAtSize(`${t}...`, size) > max) t = t.slice(0, -1);
    return `${t}...`;
  };

  // Encabezado
  text(doc.title, M, y - 16, 20, bold);
  const cw = widthOf(doc.company, 10.5, bold);
  text(doc.company, W - M - cw, y - 12, 10.5, bold, C.teal);
  y -= 30;
  for (const l of wrap(doc.subtitle, 9.5, CW)) { text(l, M, y - 9, 9.5, font, C.gray); y -= 13; }
  y -= 4; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1.2, color: C.teal }); y -= 14;

  for (const b of doc.blocks) {
    if (b.type === "kpis") {
      const n = b.items.length, gap = 8, w = (CW - gap * (n - 1)) / n, h = 44;
      need(h + 10);
      b.items.forEach((k, i) => {
        const x = M + i * (w + gap);
        page.drawRectangle({ x, y: y - h, width: w, height: h, borderColor: C.line, borderWidth: 1, color: rgb(1, 1, 1) });
        text(fit(k.label, 8, w - 16), x + 8, y - 15, 8, font, C.gray);
        const size = widthOf(k.value, 13, bold) > w - 16 ? 10.5 : 13;
        text(fit(k.value, size, w - 16, bold), x + 8, y - 33, size, bold, toneColor(k.tone));
      });
      y -= h + 14;
    } else if (b.type === "heading") {
      need(48);
      y -= 6; text(b.text, M, y - 11, 11.5, bold, C.teal); y -= 20;
    } else if (b.type === "bullets") {
      for (const item of b.items) {
        const lines = wrap(item, 9.5, CW - 14);
        need(lines.length * 13 + 3);
        page.drawCircle({ x: M + 3.5, y: y - 6, size: 1.6, color: C.teal });
        lines.forEach((l, i) => text(l, M + 13, y - 9 - i * 13, 9.5));
        y -= lines.length * 13 + 3;
      }
      y -= 6;
    } else if (b.type === "photos") {
      const gap = 12, cw2 = (CW - gap) / 2, maxH = 190;
      for (let i = 0; i < b.items.length; i += 2) {
        const pair = b.items.slice(i, i + 2);
        const imgs: (import("pdf-lib").PDFImage | null)[] = [];
        for (const it of pair) { try { imgs.push(await pdf.embedJpg(it.jpg)); } catch { imgs.push(null); } }
        const dims = imgs.map((im) => { if (!im) return { w: 0, h: 0 }; const k = Math.min(cw2 / im.width, maxH / im.height); return { w: im.width * k, h: im.height * k }; });
        const rowH = Math.max(...dims.map((d) => d.h), 20) + 16;
        need(rowH + 6);
        pair.forEach((it, k) => {
          const im = imgs[k]; if (!im) return;
          const x = M + k * (cw2 + gap);
          page.drawImage(im, { x, y: y - dims[k].h, width: dims[k].w, height: dims[k].h });
          if (it.caption) text(fit(it.caption, 8, cw2), x, y - dims[k].h - 11, 8, font, C.gray);
        });
        y -= rowH + 6;
      }
      y -= 4;
    } else if (b.type === "note") {
      for (const l of wrap(b.text, 8, CW)) { need(11); text(l, M, y - 8, 8, font, C.light); y -= 11; }
      y -= 6;
    } else {
      const total = b.columns.reduce((a, c) => a + c.width, 0);
      const xs: number[] = []; let x = M;
      const ws = b.columns.map((c) => { xs.push(x); const w = (c.width / total) * CW; x += w; return w; });
      const header = () => {
        if (b.hideHeader) return;
        b.columns.forEach((c, i) => {
          const label = fit(c.label.toUpperCase(), 7.2, ws[i] - 8, bold);
          text(label, c.align === "right" ? xs[i] + ws[i] - 4 - widthOf(label, 7.2, bold) : xs[i] + 4, y - 9, 7.2, bold, C.gray);
        });
        y -= 14; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: C.light });
      };
      need(40); header();
      for (const r of b.rows) {
        const st = r.style, size = st === "result" ? 10.5 : st === "sub" ? 8.5 : 9.2;
        const f = st === "total" || st === "result" || st === "section" ? bold : font;
        const hasSub = r.cells.some((c) => typeof c !== "string" && c.sub);
        // La primera columna puede ocupar varias líneas; las demás van en una
        const first = r.cells[0], firstText = typeof first === "string" ? first : first?.text ?? "";
        const indent = st === "sub" ? 14 : 4;
        const span = st === "section" ? CW : ws[0];
        const lines = wrap(firstText, size, span - indent - 4, f).slice(0, 3);
        const subLines = hasSub && typeof first !== "string" && first?.sub ? wrap(first.sub, 7.8, ws[0] - indent - 4).slice(0, 3) : [];
        const h = (st === "result" ? 9 : st === "section" ? 10 : 6) + lines.length * (size + 2.6) + subLines.length * 10;
        if (y - h < M + 26) { newPage(); header(); }
        if (st === "result") {
          const v = r.cells.find((c) => typeof c !== "string" && c.tone === "neg");
          page.drawRectangle({ x: M, y: y - h, width: CW, height: h, color: v ? C.softNeg : C.soft });
        }
        const top = y - (st === "result" ? 5 : st === "section" ? 8 : 3) - size;
        lines.forEach((l, i) => text(l, xs[0] + indent, top - i * (size + 2.6), size, f, st === "section" ? C.teal : st === "sub" ? C.gray : toneColor(typeof first === "string" ? undefined : first?.tone)));
        subLines.forEach((l, i) => text(l, xs[0] + indent, top - lines.length * (size + 2.6) - i * 10 + 1, 7.8, font, C.gray));
        if (st !== "section") {
          r.cells.slice(1).forEach((c, k) => {
            const i = k + 1, col = b.columns[i]; if (!col) return;
            const t = fit(typeof c === "string" ? c : c.text, size, ws[i] - 8, f);
            const color = st === "sub" ? C.gray : toneColor(typeof c === "string" ? undefined : c.tone);
            text(t, col.align === "right" ? xs[i] + ws[i] - 4 - widthOf(t, size, f) : xs[i] + 4, top, size, f, color);
          });
        }
        y -= h;
        if (st !== "result") page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: st === "total" || st === "section" ? 0.9 : 0.5, color: st === "total" || st === "section" ? C.light : C.line });
      }
      y -= 12;
    }
  }

  // Pie de cada hoja: quién, cuándo y número de página
  const es = doc.lang === "es";
  const made = `${es ? "Hecho con BrightPro el" : "Generated by BrightPro on"} ${new Date().toLocaleDateString(es ? "es-US" : "en-US", { month: "long", day: "numeric", year: "numeric" })}`;
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: M + 14 }, end: { x: W - M, y: M + 14 }, thickness: 0.5, color: C.line });
    p.drawText(safe(`${doc.company} · ${doc.title}${doc.footer ? ` · ${doc.footer}` : ""}`).slice(0, 110), { x: M, y: M + 2, size: 7.5, font, color: C.light });
    const right = safe(`${made} · ${es ? "Página" : "Page"} ${i + 1} ${es ? "de" : "of"} ${pages.length}`);
    p.drawText(right, { x: W - M - font.widthOfTextAtSize(right, 7.5), y: M + 2, size: 7.5, font, color: C.light });
  });
  return pdf.save();
}
