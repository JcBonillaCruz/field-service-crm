// =====================================================================
// PDF de inventario (pdf-lib, en el navegador) · Paso 6.12d → rediseño 6.12g
//   · Reportes: SIEMPRE vertical. Hojas de conteo a mano: SIEMPRE horizontal.
//   · Letra pequeña (≈ 40–50 renglones por hoja), columnas que se ajustan al contenido
//     y el texto largo se parte en 2–3 líneas (nunca "Main Wareh...").
//   · Colores y logo de la marca (Inventario → Ajustes → Diseño del PDF).
//   · Renglones con alerta resaltados (rojo = agotado/faltante, ámbar = por agotarse).
// =====================================================================
export type CountPdfCol = { label: string; w: number; align?: "left" | "right" | "center"; box?: boolean };
export type CountPdfRow = { cells: string[]; tone?: ("neg" | "pos" | null)[]; alert?: "red" | "amber"; total?: boolean };
export type PdfStyle = "grid" | "modern" | "minimal";
export type PdfDesign = {
  style?: PdfStyle; primary?: string; accent?: string; signatures?: boolean; logo?: boolean; zebra?: boolean;
  logoData?: string; // logo propio para los PDF (PNG en data URL); si no hay, se usa el logo de la empresa
  orientation?: "portrait" | "landscape"; // (ya no se usa, se guarda por compatibilidad)
};
export const DEFAULT_DESIGN: Required<Omit<PdfDesign, "logoData" | "orientation">> & { logoData: string } = {
  style: "modern", primary: "#0b1f3a", accent: "#0f766e", signatures: true, logo: true, zebra: true, logoData: "",
};
export type FullDesign = typeof DEFAULT_DESIGN;
export const designOf = (d?: PdfDesign | null): FullDesign => {
  const x = { ...DEFAULT_DESIGN, ...Object.fromEntries(Object.entries(d ?? {}).filter(([, v]) => v !== undefined && v !== null)) } as FullDesign;
  const ok = (c: string, f: string) => (/^#[0-9a-f]{6}$/i.test(c) ? c : f);
  return { ...x, primary: ok(x.primary, DEFAULT_DESIGN.primary), accent: ok(x.accent, DEFAULT_DESIGN.accent), style: (["grid", "modern", "minimal"] as const).includes(x.style) ? x.style : "modern" };
};
export type CountPdfInput = {
  design?: PdfDesign; logoBytes?: Uint8Array | null; logoPng?: boolean;
  company: string; title: string; subtitle: string; meta: [string, string][]; orientation: "portrait" | "landscape";
  columns: CountPdfCol[]; rows: CountPdfRow[];
  sections?: { heading: string; columns: CountPdfCol[]; rows: CountPdfRow[]; empty?: string }[];
  summary?: [string, string, "neg" | "pos" | null][];
  sign?: string[]; note?: string; footer: string; page: (n: number, total: number) => string;
};

const safe = (t: unknown) => String(t ?? "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/−/g, "-").replace(/→/g, ">")
  .replace(/…/g, "...").replace(/×/g, "x").replace(/[^\x20-\x7e\xa0-\xff–—]/g, "");

export async function buildCountPdf(d: CountPdfInput): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  type Font = Awaited<ReturnType<typeof pdf.embedFont>>;
  type Color = ReturnType<typeof rgb>;
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${d.title} · ${d.company}`); pdf.setAuthor(d.company); pdf.setCreator("BrightPro");
  const font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const [W, H] = d.orientation === "landscape" ? [792, 612] : [612, 792];
  const M = 30, CW = W - M * 2, BOTTOM = M + 22;
  const ds = designOf(d.design);
  const col = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
  const tint = (h: string, k: number) => { const v = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); return rgb(...(v.map((c) => c + (1 - c) * k) as [number, number, number])); };
  const C = {
    pri: col(ds.primary), acc: col(ds.accent), accSoft: tint(ds.accent, 0.9), priSoft: tint(ds.primary, 0.93),
    ink: rgb(0.09, 0.12, 0.18), gray: rgb(0.42, 0.47, 0.55), line: rgb(0.86, 0.88, 0.91), lineDark: rgb(0.7, 0.74, 0.79), soft: rgb(0.982, 0.984, 0.988),
    red: rgb(0.78, 0.09, 0.2), headBg: rgb(0.953, 0.957, 0.965), head: rgb(0.27, 0.31, 0.37), redBg: rgb(1, 0.94, 0.945), amber: rgb(0.8, 0.45, 0.02), amberBg: rgb(1, 0.973, 0.91), pos: rgb(0.02, 0.5, 0.36), white: rgb(1, 1, 1),
  };
  const FS = 7.4, HS = 6.3, LH = 8.6, PADY = 3.4, PADX = 4.5; // tamaños: letra, encabezado, alto de línea
  const tw = (t: string, f: Font, s: number) => f.widthOfTextAtSize(t, s);
  const fit = (t: string, f: Font, size: number, max: number) => {
    let s = safe(t); if (tw(s, f, size) <= max) return s;
    while (s.length > 1 && tw(`${s}...`, f, size) > max) s = s.slice(0, -1);
    return `${s}...`;
  };
  // Parte el texto en líneas que quepan (máx. `lines`); solo la última puede llevar "..."
  const wrap = (t: string, f: Font, size: number, max: number, lines = 3): string[] => {
    const words = safe(t).split(/\s+/).filter(Boolean); const out: string[] = []; let cur = "";
    for (let i = 0; i < words.length; i++) {
      let w = words[i];
      while (tw(w, f, size) > max && w.length > 1) { // palabra muy larga (SKU): se corta a la fuerza
        let k = w.length; while (k > 1 && tw(w.slice(0, k), f, size) > max) k--;
        if (cur) { out.push(cur); cur = ""; } out.push(w.slice(0, k)); w = w.slice(k);
      }
      const next = cur ? `${cur} ${w}` : w;
      if (tw(next, f, size) <= max) cur = next; else { if (cur) out.push(cur); cur = w; }
    }
    if (cur) out.push(cur);
    if (out.length <= lines) return out.length ? out : [""];
    return [...out.slice(0, lines - 1), fit(out.slice(lines - 1).join(" "), f, size, max)];
  };

  // Anchos automáticos: cada columna toma lo que necesita su contenido; el texto largo se parte en líneas
  type Col = CountPdfCol & { px: number };
  const colsOf = (list: CountPdfCol[], rows: CountPdfRow[]): Col[] => {
    const longestWord = (s: string, f: Font, z: number) => Math.max(0, ...safe(s).split(/\s+/).map((w) => tw(w, f, z)));
    const nat = list.map((c, j) => {
      const head = longestWord(c.label.toUpperCase(), bold, HS) + PADX * 2 + 1.5;
      const body = Math.max(0, ...rows.slice(0, 400).map((r) => tw(safe(r.cells[j] ?? ""), r.total ? bold : font, FS))) + PADX * 2;
      const min = c.box ? Math.max(head, c.w * 4.2) : Math.max(head, c.align === "left" || !c.align ? Math.min(body, 70) : body);
      return { min, want: c.box ? Math.max(min, c.w * 5) : Math.max(min, body) };
    });
    const sumMin = nat.reduce((a, n) => a + n.min, 0), sumWant = nat.reduce((a, n) => a + n.want, 0);
    let px: number[];
    if (sumWant <= CW) { // sobra espacio: se reparte entre columnas de texto y cajas (según su peso)
      const flex = list.map((c) => (c.align === "right" || c.align === "center" ? 0 : c.w));
      const fw = flex.reduce((a, b) => a + b, 0) || 1;
      px = nat.map((n, j) => n.want + ((CW - sumWant) * flex[j]) / fw);
    } else if (sumMin <= CW) { // no cabe todo: los números quedan fijos y el texto se ajusta (en varias líneas)
      const extra = CW - sumMin; const room = nat.map((n) => n.want - n.min); const tr = room.reduce((a, b) => a + b, 0) || 1;
      px = nat.map((n, j) => n.min + (extra * room[j]) / tr);
    } else px = nat.map((n) => (n.min / sumMin) * CW);
    return list.map((c, j) => ({ ...c, px: px[j] }));
  };

  const pages: ReturnType<typeof pdf.addPage>[] = [];
  let page = pdf.addPage([W, H]); pages.push(page);
  let y = H - M;
  const newPage = () => { page = pdf.addPage([W, H]); pages.push(page); y = H - M - 10; };

  // Hoja para contar a mano = cuadrícula (se escribe en las celdas). Reportes = diseño limpio: blanco y grises.
  const sheet = d.columns.some((c) => c.box);
  const grid = sheet;
  const round = (x: number, top: number, w: number, h: number, r: number, o: { fill?: Color; border?: Color; bw?: number }) =>
    page.drawSvgPath(`M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`,
      { x, y: top, color: o.fill, borderColor: o.border, borderWidth: o.border ? o.bw ?? 0.7 : 0 });

  // ---------- Encabezado: logo de la empresa a la izquierda, título del reporte a la derecha ----------
  y = H - M;
  let lx = M, logoH = 0;
  if (ds.logo && d.logoBytes) {
    try {
      const img = d.logoPng ? await pdf.embedPng(d.logoBytes) : await pdf.embedJpg(d.logoBytes);
      const r = img.width / img.height; logoH = Math.min(42, 130 / r); const w = logoH * r;
      page.drawImage(img, { x: M, y: y - logoH, width: w, height: logoH });
      lx = M + w + 12;
    } catch { logoH = 0; }
  }
  const hy = y - Math.max(logoH, 34) / 2; // centro vertical del encabezado
  page.drawText(fit(d.company, bold, 11.5, CW * 0.45 - (lx - M)), { x: lx, y: hy + 1.5, size: 11.5, font: bold, color: C.ink });
  page.drawText(fit(d.subtitle, font, 7.4, CW * 0.5 - (lx - M)), { x: lx, y: hy - 9.5, size: 7.4, font, color: C.gray });
  const title = fit(d.title, bold, 16, CW * 0.48);
  page.drawText(title, { x: W - M - tw(title, bold, 16), y: hy + 0.5, size: 16, font: bold, color: C.pri });
  const metaLine = fit(d.meta.map(([k, v]) => `${k}: ${v}`).join("   ·   "), font, 7.2, CW * 0.5);
  page.drawText(metaLine, { x: W - M - tw(metaLine, font, 7.2), y: hy - 10.5, size: 7.2, font, color: C.gray });
  y -= Math.max(logoH, 34) + 9;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1.2, color: C.pri });
  y -= 14;

  // Tarjetas de resumen: redondeadas, blancas con borde gris; el número en rojo solo si es alerta
  if (d.summary?.length) {
    const n = d.summary.length, gap = 8, sw = (CW - gap * (n - 1)) / n, h = 40;
    d.summary.forEach(([k, v, tone], i) => {
      const x = M + i * (sw + gap), bad = tone === "neg";
      round(x, y, sw, h, 9, { fill: C.white, border: C.line, bw: 0.8 });
      page.drawText(fit(k, font, 7, sw - 22), { x: x + 11, y: y - 14, size: 7, font, color: C.gray });
      page.drawText(fit(v, bold, 13, sw - 22), { x: x + 11, y: y - 31, size: 13, font: bold, color: bad ? C.red : C.ink });
      if (bad) page.drawCircle({ x: x + sw - 12, y: y - 12, size: 2.6, color: C.red });
    });
    y -= h + 14;
  }

  // ---------- Tablas ----------
  let cols: Col[] = [];
  const headLines = () => cols.map((c) => wrap(c.label.toUpperCase(), bold, HS, c.px - PADX * 2, 2));
  const header = () => {
    const hl = headLines(); const n = Math.max(1, ...hl.map((l) => l.length)); const hh = n * 7.4 + 8;
    page.drawRectangle({ x: M, y: y - hh, width: CW, height: hh, color: C.headBg, ...(grid ? { borderColor: C.lineDark, borderWidth: 0.7 } : {}) });
    if (!grid) page.drawLine({ start: { x: M, y: y - hh }, end: { x: M + CW, y: y - hh }, thickness: 0.8, color: C.lineDark });
    let x = M;
    cols.forEach((c, j) => {
      hl[j].forEach((t, li) => {
        const w = tw(t, bold, HS);
        const tx = c.align === "right" ? x + c.px - PADX - w : c.align === "center" || c.box ? x + (c.px - w) / 2 : x + PADX;
        page.drawText(t, { x: tx, y: y - 4.6 - HS - (li + n - hl[j].length) * 7.4, size: HS, font: bold, color: C.head });
      });
      if (grid && x > M) page.drawLine({ start: { x, y }, end: { x, y: y - hh }, thickness: 0.6, color: C.lineDark });
      x += c.px;
    });
    y -= hh;
  };
  const table = (rows: CountPdfRow[]) => {
    header();
    rows.forEach((r, i) => {
      const fonts = cols.map((_, j) => (r.total || (r.tone?.[j] === "neg" && cols[j].align === "right") ? bold : font));
      const cells = cols.map((c, j) => (c.box ? [safe(r.cells[j] ?? "")] : wrap(r.cells[j] ?? "", fonts[j], FS, c.px - PADX * 2, 3)));
      const lines = Math.max(1, ...cells.map((l) => l.length));
      const rh = Math.max(sheet ? 17 : 0, lines * LH + PADY * 2);
      if (y - rh < BOTTOM) { newPage(); header(); }
      if (i % 2 && ds.zebra && !r.total) page.drawRectangle({ x: M, y: y - rh, width: CW, height: rh, color: C.soft });
      if (grid) { let gx = M; cols.forEach((c) => { page.drawRectangle({ x: gx, y: y - rh, width: c.px, height: rh, borderColor: C.line, borderWidth: 0.55 }); gx += c.px; }); }
      let x = M;
      cols.forEach((c, j) => {
        if (c.box) {
          if (cells[j][0]) { const t = fit(cells[j][0], bold, 8, c.px - 12); page.drawText(t, { x: x + (c.px - tw(t, bold, 8)) / 2, y: y - rh / 2 - 2.8, size: 8, font: bold, color: C.ink }); }
        } else {
          const tone = r.tone?.[j];
          const color = tone === "neg" ? C.red : tone === "pos" ? C.pos : C.ink;
          cells[j].forEach((t, li) => {
            const w = tw(t, fonts[j], FS);
            const tx = c.align === "right" ? x + c.px - PADX - w : c.align === "center" ? x + (c.px - w) / 2 : x + PADX + (j === 0 && r.alert === "red" ? 3.5 : 0);
            const ty = y - PADY - FS + 0.6 - li * LH - (rh - cells[j].length * LH - PADY * 2) / 2;
            page.drawText(t, { x: tx, y: ty, size: FS, font: fonts[j], color });
            if (tone === "neg" && r.alert) page.drawLine({ start: { x: tx, y: ty - 1.5 }, end: { x: tx + w, y: ty - 1.5 }, thickness: 0.6, color: C.red }); // alerta: rojo y subrayado
          });
          // Puntito rojo junto al nombre del producto con alerta (sin pintar todo el renglón)
          if (j === 0 && r.alert === "red" && c.align !== "right" && c.align !== "center") page.drawCircle({ x: x + 3.6, y: y - PADY - FS / 2 + 0.8, size: 1.6, color: C.red });
        }
        x += c.px;
      });
      if (!grid) page.drawLine({ start: { x: M, y: y - rh }, end: { x: M + CW, y: y - rh }, thickness: r.total ? 0.9 : 0.4, color: r.total ? C.ink : C.line });
      if (r.total) page.drawLine({ start: { x: M, y }, end: { x: M + CW, y }, thickness: 0.9, color: C.ink });
      y -= rh;
    });
  };
  if (d.columns.length) { cols = colsOf(d.columns, d.rows); table(d.rows); }
  for (const sec of d.sections ?? []) {
    if (y - 56 < BOTTOM) newPage();
    y -= 12;
    const head = fit(sec.heading, bold, 10, CW - 60);
    page.drawText(head, { x: M, y: y - 9, size: 10, font: bold, color: C.ink });
    const cnt = `(${sec.rows.filter((r) => !r.total).length})`;
    page.drawText(cnt, { x: M + tw(head, bold, 10) + 5, y: y - 9, size: 8.5, font, color: C.gray });
    y -= 16;
    if (!sec.rows.length) { page.drawText(fit(sec.empty ?? "-", font, FS, CW), { x: M, y: y - 9, size: FS, font, color: C.gray }); y -= 16; continue; }
    cols = colsOf(sec.columns, sec.rows);
    table(sec.rows);
  }

  // ---------- Nota y firmas ----------
  if (d.note) {
    const lines = wrap(d.note, font, 7, CW, 4);
    if (y - lines.length * 9 - 12 < BOTTOM) newPage();
    y -= 12;
    lines.forEach((l) => { page.drawText(l, { x: M, y: y - 7, size: 7, font, color: C.gray }); y -= 9; });
  }
  if (d.sign?.length && ds.signatures) {
    if (y - 46 < BOTTOM) newPage();
    y -= 38;
    const sw = CW / d.sign.length;
    d.sign.forEach((s, i) => {
      const x = M + i * sw;
      page.drawLine({ start: { x: x + (i ? 10 : 0), y }, end: { x: x + sw - 10, y }, thickness: 0.7, color: C.lineDark });
      page.drawText(safe(s), { x: x + (i ? 10 : 0), y: y - 9, size: 6.8, font, color: C.gray });
    });
  }
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: M - 2 }, end: { x: W - M, y: M - 2 }, thickness: 0.5, color: C.line });
    p.drawText(fit(d.footer, font, 6.5, CW * 0.6), { x: M, y: M - 12, size: 6.5, font, color: C.gray });
    const t = safe(d.page(i + 1, pages.length));
    p.drawText(t, { x: W - M - tw(t, bold, 6.5), y: M - 12, size: 6.5, font: bold, color: C.pri });
  });
  return pdf.save();
}

// Abre el visor de BrightPro: Imprimir · Descargar · Abrir (en el celular también)
export function openPdf(bytes: Uint8Array, fileName: string) {
  import("@/components/inventory/PdfViewer").then((m) => m.showPdf(bytes, fileName)).catch(() => {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
    const a = document.createElement("a"); a.href = url; a.download = fileName; a.click();
  });
}

// Diseño + logo para todos los PDF de inventario (se carga una vez en el navegador)
export type PdfBrand = { design: FullDesign; logoBytes: Uint8Array | null; logoPng: boolean };
let brandCache: Promise<PdfBrand> | null = null;
const fromDataUrl = (u: string) => { const b = atob(u.split(",")[1] ?? ""); const a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };
// Cualquier imagen (png, jpg, webp, svg) → PNG para el PDF
export async function imageToPng(src: Blob, max = 480): Promise<string> {
  const url = URL.createObjectURL(src);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const r = Math.min(1, max / Math.max(img.naturalWidth || max, img.naturalHeight || max));
    const c = document.createElement("canvas"); c.width = Math.max(1, Math.round((img.naturalWidth || max) * r)); c.height = Math.max(1, Math.round((img.naturalHeight || max / 3) * r));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/png");
  } finally { URL.revokeObjectURL(url); }
}
export async function companyLogoPng(companyId: string): Promise<string> {
  const { createClient } = await import("@/lib/supabase/client");
  const { data } = await createClient().from("sales_prefs").select("logo_url").eq("company_id", companyId).maybeSingle();
  const url = data?.logo_url as string | null | undefined;
  if (!url) return "";
  const r = await fetch(url); if (!r.ok) return "";
  return imageToPng(await r.blob());
}
export function loadPdfBrand(companyId: string, fresh = false): Promise<PdfBrand> {
  if (brandCache && !fresh) return brandCache;
  brandCache = (async () => {
    const { createClient } = await import("@/lib/supabase/client");
    const set = await createClient().from("inventory_settings").select("pdf_design").eq("company_id", companyId).maybeSingle();
    const design = designOf((set.error ? null : set.data?.pdf_design) as PdfDesign | null);
    let logoBytes: Uint8Array | null = null;
    if (design.logo) {
      try { const png = design.logoData || (await companyLogoPng(companyId)); if (png) logoBytes = fromDataUrl(png); } catch { /* sin logo */ }
    }
    return { design, logoBytes, logoPng: true };
  })();
  return brandCache;
}
// Para la vista previa del diseño (sin guardar)
export const logoBytesOf = (png: string) => (png ? fromDataUrl(png) : null);
