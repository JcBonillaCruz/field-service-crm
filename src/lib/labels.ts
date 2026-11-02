// =====================================================================
// Etiquetas de inventario: hojas de stickers (impresora normal) y rollos (impresora térmica)
// =====================================================================
export type Paper = {
  id: string; name: string; hint: string; kind: "sheet" | "roll";
  w: number; h: number;                       // tamaño de UNA etiqueta (pulgadas)
  cols?: number; rows?: number;               // hojas
  top?: number; left?: number; gapX?: number; gapY?: number;
};
export const PAPERS: Paper[] = [
  { id: "avery5160", name: "Sheet · 30 labels (2⅝ × 1 in)", hint: "Avery 5160 / 8160, Uline S-11893, Amazon 30-up · Letter paper", kind: "sheet", w: 2.625, h: 1, cols: 3, rows: 10, top: 0.5, left: 0.1875, gapX: 0.125, gapY: 0 },
  { id: "avery5163", name: "Sheet · 10 labels (4 × 2 in)", hint: "Avery 5163 / 8163 · bins and shelves", kind: "sheet", w: 4, h: 2, cols: 2, rows: 5, top: 0.5, left: 0.15625, gapX: 0.1875, gapY: 0 },
  { id: "avery5167", name: "Sheet · 80 labels (1¾ × ½ in)", hint: "Avery 5167 / 8167 · small parts", kind: "sheet", w: 1.75, h: 0.5, cols: 4, rows: 20, top: 0.5, left: 0.28125, gapX: 0.3125, gapY: 0 },
  { id: "roll2x1", name: "Label printer · 2 × 1 in", hint: "Thermal printers (Zebra, Rollo, MUNBYN, inFlow…)", kind: "roll", w: 2, h: 1 },
  { id: "roll225x125", name: "Label printer · 2¼ × 1¼ in", hint: "Thermal printers · Dymo / Rollo size", kind: "roll", w: 2.25, h: 1.25 },
  { id: "roll3x2", name: "Label printer · 3 × 2 in", hint: "Thermal printers · bigger text", kind: "roll", w: 3, h: 2 },
  { id: "roll4x6", name: "Label printer · 4 × 6 in", hint: "Thermal shipping labels · bins and boxes", kind: "roll", w: 4, h: 6 },
];

export type Template = { id: "basic" | "qr" | "price" | "big"; name: string; text: string };
export const TEMPLATES: Template[] = [
  { id: "basic", name: "Basic", text: "Name, barcode and SKU" },
  { id: "qr", name: "QR Code", text: "QR + name, SKU and price" },
  { id: "price", name: "Price tag", text: "Name, big price and barcode" },
  { id: "big", name: "Bin / Shelf", text: "Big name and barcode for bins" },
];

export type LabelItem = { id: string; name: string; sku: string; price: number; unit: string | null };
export const perPage = (p: Paper) => (p.kind === "sheet" ? (p.cols ?? 1) * (p.rows ?? 1) : 1);
