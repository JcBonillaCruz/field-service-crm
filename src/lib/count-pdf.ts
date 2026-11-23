// =====================================================================
// Paso 6.12d · PDF de conteos (pdf-lib, en el navegador)
//   · "sheet": hoja para contar a mano (cajitas vacías), en el mismo orden que la pantalla de New Count
//   · "report": el conteo ya hecho (esperado, contado, diferencia, valor)
// Carta, vertical u horizontal. Se abre como PDF real (se puede imprimir desde el visor).
// =====================================================================
export type CountPdfCol = { label: string; w: number; align?: "left" | "right" | "center"; box?: boolean };
export type CountPdfRow = { cells: string[]; tone?: ("neg" | "pos" | null)[] };
export type CountPdfInput = {
  company: string; title: string; subtitle: string; meta: [string, string][]; orientation: "portrait" | "landscape";
  columns: CountPdfCol[]; rows: CountPdfRow[]; summary?: [string, string, "neg" | "pos" | null][];
  sign?: string[]; note?: string; footer: string; page: (n: number, total: number) => string;
};

const safe = (t: unknown) => String(t ?? "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/−/g, "-").replace(/→/g, ">")
  .replace(/…/g, "...").replace(/×/g, "x").replace(/[^\x20-\x7e\xa0-\xff–—]/g, "");

export async function buildCountPdf(d: CountPdfInput): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${d.title} · ${d.company}`); pdf.setAuthor(d.company); pdf.setCreator("BrightPro");
  const font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const [W, H] = d.orientation === "landscape" ? [792, 612] : [612, 792];
  const M = 36, CW = W - M * 2;
  const C = { ink: rgb(0.043, 0.122, 0.227), teal: rgb(0.059, 0.463, 0.431), mint: rgb(0.914, 0.969, 0.957), gray: rgb(0.392, 0.455, 0.545),
    line: rgb(0.85, 0.88, 0.91), soft: rgb(0.973, 0.98, 0.984), neg: rgb(0.745, 0.071, 0.235), pos: rgb(0.059, 0.463, 0.431), orange: rgb(0.91, 0.443, 0.227) };
  const fit = (t: string, f = font, size = 9.5, max = 100) => {
    let s = safe(t);
    if (f.widthOfTextAtSize(s, size) <= max) return s;
    while (s.length > 1 && f.widthOfTextAtSize(`${s}...`, size) > max) s = s.slice(0, -1);
    return `${s}...`;
  };
  const totalW = d.columns.reduce((a, c) => a + c.w, 0);
  const cols = d.columns.map((c) => ({ ...c, px: (c.w / totalW) * CW }));
  const ROW = 22;
  const pages: ReturnType<typeof pdf.addPage>[] = [];
  let page = pdf.addPage([W, H]); pages.push(page);
  let y = H - M;

  // Encabezado (solo en la primera hoja): franja turquesa, título, empresa y datos
  page.drawRectangle({ x: 0, y: H - 8, width: W, height: 8, color: C.teal });
  page.drawText(fit(d.title, bold, 18, CW * 0.6), { x: M, y: y - 14, size: 18, font: bold, color: C.ink });
  const cw = bold.widthOfTextAtSize(safe(d.company), 11);
  page.drawText(safe(d.company), { x: W - M - cw, y: y - 12, size: 11, font: bold, color: C.teal });
  page.drawText(fit(d.subtitle, font, 10, CW), { x: M, y: y - 31, size: 10, font, color: C.gray });
  y -= 46;
  const metaW = CW / Math.max(1, d.meta.length);
  page.drawRectangle({ x: M, y: y - 34, width: CW, height: 34, color: C.mint });
  d.meta.forEach(([k, v], i) => {
    page.drawText(fit(k.toUpperCase(), bold, 7, metaW - 14), { x: M + 10 + i * metaW, y: y - 13, size: 7, font: bold, color: C.gray });
    page.drawText(fit(v, bold, 10.5, metaW - 14), { x: M + 10 + i * metaW, y: y - 27, size: 10.5, font: bold, color: C.ink });
  });
  y -= 48;
  if (d.summary?.length) {
    const sw = CW / d.summary.length;
    d.summary.forEach(([k, v, tone], i) => {
      const x = M + i * sw;
      page.drawRectangle({ x: x + (i ? 4 : 0), y: y - 38, width: sw - (i ? 4 : 0) - (i < d.summary!.length - 1 ? 4 : 0), height: 38, borderColor: C.line, borderWidth: 0.8 });
      page.drawText(fit(k, font, 8, sw - 20), { x: x + 12, y: y - 14, size: 8, font, color: C.gray });
      page.drawText(fit(v, bold, 13, sw - 20), { x: x + 12, y: y - 31, size: 13, font: bold, color: tone === "neg" ? C.neg : tone === "pos" ? C.pos : C.ink });
    });
    y -= 52;
  }

  const header = () => {
    page.drawRectangle({ x: M, y: y - ROW, width: CW, height: ROW, color: C.ink });
    let x = M;
    cols.forEach((c) => {
      const t = fit(c.label.toUpperCase(), bold, 7.5, c.px - 10);
      const tw = bold.widthOfTextAtSize(t, 7.5);
      const tx = c.align === "right" ? x + c.px - 6 - tw : c.align === "center" || c.box ? x + (c.px - tw) / 2 : x + 6;
      page.drawText(t, { x: tx, y: y - 14.5, size: 7.5, font: bold, color: rgb(1, 1, 1) });
      x += c.px;
    });
    y -= ROW;
  };
  header();
  d.rows.forEach((r, i) => {
    if (y - ROW < M + 30) { page = pdf.addPage([W, H]); pages.push(page); y = H - M; header(); }
    if (i % 2) page.drawRectangle({ x: M, y: y - ROW, width: CW, height: ROW, color: C.soft });
    let x = M;
    cols.forEach((c, j) => {
      if (c.box) {
        page.drawRectangle({ x: x + 6, y: y - ROW + 4, width: c.px - 12, height: ROW - 8, borderColor: C.gray, borderWidth: 0.8, color: rgb(1, 1, 1) });
        if (r.cells[j]) { const t = fit(r.cells[j], bold, 10, c.px - 16); page.drawText(t, { x: x + (c.px - bold.widthOfTextAtSize(t, 10)) / 2, y: y - 15, size: 10, font: bold, color: C.ink }); }
      } else {
        const f = j === 0 || (c.align === "right" && r.tone?.[j]) ? bold : font;
        const t = fit(r.cells[j] ?? "", f, 9.5, c.px - 12);
        const tw = f.widthOfTextAtSize(t, 9.5);
        const tx = c.align === "right" ? x + c.px - 6 - tw : c.align === "center" ? x + (c.px - tw) / 2 : x + 6;
        const tone = r.tone?.[j];
        page.drawText(t, { x: tx, y: y - 14.5, size: 9.5, font: f, color: tone === "neg" ? C.neg : tone === "pos" ? C.pos : C.ink });
      }
      x += c.px;
    });
    page.drawLine({ start: { x: M, y: y - ROW }, end: { x: M + CW, y: y - ROW }, thickness: 0.5, color: C.line });
    y -= ROW;
  });

  // Nota y firmas
  if (d.note) {
    if (y < M + 60) { page = pdf.addPage([W, H]); pages.push(page); y = H - M; }
    y -= 16;
    page.drawText(fit(d.note, font, 9, CW), { x: M, y, size: 9, font, color: C.gray });
  }
  if (d.sign?.length) {
    if (y < M + 70) { page = pdf.addPage([W, H]); pages.push(page); y = H - M; }
    y -= 46;
    const sw = CW / d.sign.length;
    d.sign.forEach((s, i) => {
      const x = M + i * sw;
      page.drawLine({ start: { x: x + (i ? 10 : 0), y }, end: { x: x + sw - 10, y }, thickness: 0.8, color: C.gray });
      page.drawText(safe(s), { x: x + (i ? 10 : 0), y: y - 12, size: 8.5, font, color: C.gray });
    });
  }
  pages.forEach((p, i) => {
    p.drawText(safe(d.footer), { x: M, y: 18, size: 7.5, font, color: C.gray });
    const t = safe(d.page(i + 1, pages.length));
    p.drawText(t, { x: W - M - font.widthOfTextAtSize(t, 7.5), y: 18, size: 7.5, font, color: C.gray });
  });
  return pdf.save();
}

// Abre el PDF en otra pestaña (visor del navegador: ahí se imprime o se descarga)
export function openPdf(bytes: Uint8Array, fileName: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (!w) { const a = document.createElement("a"); a.href = url; a.download = fileName; a.click(); }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
