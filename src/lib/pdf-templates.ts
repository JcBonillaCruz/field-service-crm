// 30 diseños de PDF (Quotes / Invoices). Cada uno es una mezcla de piezas que entienden
// tanto la vista en pantalla (DocPaper) como el PDF real (sales-pdf).
export type TplCategory = "standard" | "spreadsheet" | "premium" | "universal" | "retail";
export type TplDef = {
  id: string; name: string; category: TplCategory; accent: string;
  header: "classic" | "reversed" | "centered" | "band" | "split";
  table: "dark" | "light" | "lines" | "grid" | "accent";
  font: "sans" | "serif" | "mono";
  totals: "shade" | "accent" | "plain" | "box";
  meta: "right" | "row";
  border?: boolean; receipt?: boolean; titleWeight?: "light" | "bold"; icons?: boolean;
};

export const CATEGORIES: { id: TplCategory; name: string }[] = [
  { id: "standard", name: "Standard" }, { id: "spreadsheet", name: "Spreadsheet" }, { id: "premium", name: "Premium" },
  { id: "universal", name: "Universal" }, { id: "retail", name: "Retail" },
];

const t = (id: string, name: string, category: TplCategory, accent: string, o: Partial<TplDef>): TplDef => ({
  id, name, category, accent, header: "classic", table: "dark", font: "sans", totals: "shade", meta: "right", titleWeight: "light", ...o,
});

export const TEMPLATE_DEFS: TplDef[] = [
  // Standard (7)
  t("standard", "Standard", "standard", "#2f3437", {}),
  t("standard-reversed", "Standard - Reversed", "standard", "#2f3437", { header: "reversed" }),
  t("standard-european", "Standard - European", "standard", "#334155", { header: "reversed", meta: "row" }),
  t("standard-serif", "Standard - Classic Serif", "standard", "#3f3a36", { font: "serif" }),
  t("standard-light", "Standard - Light", "standard", "#64748b", { table: "light" }),
  t("standard-centered", "Standard - Centered", "standard", "#2f3437", { header: "centered" }),
  t("standard-pos", "POS Standard", "standard", "#1f2937", { table: "lines", totals: "plain" }),
  // Spreadsheet (5)
  t("spreadsheet", "Spreadsheet", "spreadsheet", "#374151", { table: "grid", border: true, totals: "box", titleWeight: "bold" }),
  t("spreadsheet-plus", "Spreadsheet - Plus", "spreadsheet", "#1e3a5f", { table: "grid", border: true, totals: "box", meta: "row", titleWeight: "bold" }),
  t("spreadsheet-lite", "Spreadsheet - Lite", "spreadsheet", "#6b7280", { table: "grid", totals: "box", titleWeight: "bold" }),
  t("spreadsheet-compact", "Spreadsheet - Compact", "spreadsheet", "#0f172a", { table: "grid", border: true, totals: "box", font: "mono" }),
  t("spreadsheet-ledger", "Spreadsheet - Ledger", "spreadsheet", "#14532d", { table: "grid", totals: "box", font: "serif" }),
  // Premium (8)
  t("modern", "Grand", "premium", "#1a2744", { header: "band", table: "accent", totals: "accent", titleWeight: "bold" }),
  t("minimal", "Minimalist", "premium", "#be123c", { table: "lines", totals: "accent", titleWeight: "bold" }),
  t("premium-continental", "Continental", "premium", "#2f3437", { header: "reversed", table: "dark", totals: "accent" }),
  t("premium-brand", "Brand Orange", "premium", "#e8713a", { header: "band", table: "accent", totals: "accent", titleWeight: "bold" }),
  t("premium-emerald", "Emerald", "premium", "#0f766e", { header: "split", table: "accent", totals: "accent" }),
  t("premium-royal", "Royal", "premium", "#4c1d95", { header: "band", table: "accent", font: "serif", totals: "accent" }),
  t("premium-elegant", "Elegant Serif", "premium", "#7c2d12", { font: "serif", table: "lines", totals: "plain", header: "centered" }),
  t("premium-ocean", "Ocean", "premium", "#0369a1", { header: "split", table: "accent", totals: "shade" }),
  // Premium con íconos (5)
  t("icons-navy", "Signature Navy ✦", "premium", "#1a2744", { header: "band", table: "accent", totals: "accent", titleWeight: "bold", icons: true }),
  t("icons-aurora", "Aurora ✦", "premium", "#0f766e", { header: "split", table: "accent", totals: "accent", icons: true }),
  t("icons-executive", "Executive Gold ✦", "premium", "#a16207", { header: "classic", table: "dark", font: "serif", totals: "accent", icons: true }),
  t("icons-sunset", "Sunset ✦", "premium", "#e8713a", { header: "band", table: "light", totals: "accent", titleWeight: "bold", icons: true }),
  t("icons-sapphire", "Sapphire ✦", "premium", "#1e40af", { header: "split", table: "light", totals: "accent", meta: "row", icons: true }),
  // Universal (6)
  t("universal-lite", "Lite", "universal", "#475569", { table: "light", meta: "row" }),
  t("universal-simple", "Simple", "universal", "#334155", { table: "lines", totals: "plain" }),
  t("universal-compact", "Compact", "universal", "#1f2937", { table: "light", meta: "row", font: "sans" }),
  t("universal-basic", "Basic", "universal", "#dc2626", { header: "centered", table: "lines", totals: "plain", titleWeight: "bold" }),
  t("universal-clean", "Clean", "universal", "#0f766e", { table: "light", totals: "shade" }),
  t("universal-bold", "Bold", "universal", "#111827", { table: "dark", totals: "accent", titleWeight: "bold" }),
  // Retail (4)
  t("retail-standard", "Retail - Standard", "retail", "#111827", { receipt: true, header: "centered", table: "lines", totals: "plain", border: true, titleWeight: "bold" }),
  t("retail-premium", "Retail - Premium", "retail", "#111827", { receipt: true, header: "centered", table: "lines", totals: "plain", font: "serif" }),
  t("retail-pos-premium", "POS Retail - Premium", "retail", "#111827", { receipt: true, header: "centered", table: "lines", totals: "plain", font: "mono" }),
  t("retail-pos-standard", "POS Retail - Standard", "retail", "#111827", { receipt: true, header: "centered", table: "lines", totals: "plain", font: "mono", border: true }),
];

export const tplOf = (id?: string | null) => TEMPLATE_DEFS.find((x) => x.id === id) ?? TEMPLATE_DEFS[0];

// Íconos de línea (24×24) que usan las plantillas ✦ en pantalla y en el PDF
export const TPL_ICONS = {
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c0-3.3 3.6-6 8-6s8 2.7 8 6",
  pin: "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  note: "M6 3h9l4 4v14H6zM15 3v4h4M9 12h6M9 16h6",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4",
  wallet: "M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H3zM3 7l12-4v4M16 13h2",
  hash: "M9 4 7 20M17 4l-2 16M4 9h16M3 15h16",
};
