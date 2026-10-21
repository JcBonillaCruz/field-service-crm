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
  border?: boolean; receipt?: boolean; titleWeight?: "light" | "bold";
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
