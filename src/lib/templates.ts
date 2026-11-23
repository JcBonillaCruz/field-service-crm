import type { DiscType, SalesLine } from "@/lib/sales";
import { lineAmount, round2 } from "@/lib/sales";
import type { Priority } from "@/lib/jobs";

// =====================================================================
// Paso 6.10 · Plantillas de cotización y de trabajo
// Una sola plantilla sirve para las dos cosas: "Tune-up" trae sus líneas con precio (cotización)
// y su tipo de trabajo, duración y checklist (trabajo). use_in decide dónde aparece.
// =====================================================================
export type TplUse = "both" | "quote" | "job";
export type TplLine = { item_id: string | null; name: string; description: string | null; quantity: number; unit: string | null; rate: number; discount: number; discount_type: DiscType };
export type TplCheck = { label: string; required: boolean };
export type WorkTemplate = {
  id: string; company_id: string; name: string; description: string | null; use_in: TplUse;
  job_type_id: string | null; title: string | null; job_details: string | null; duration_min: number | null; priority: Priority; checklist: TplCheck[];
  lines: TplLine[]; subject: string | null; notes: string | null; terms: string | null; deposit_type: "percent" | "flat" | null; deposit_value: number;
  is_active: boolean; position: number; created_by_name: string | null; created_at: string; updated_at: string;
};

export const TPL_COLS = "id, company_id, name, description, use_in, job_type_id, title, job_details, duration_min, priority, checklist, lines, subject, notes, terms, deposit_type, deposit_value, is_active, position, created_by_name, created_at, updated_at";

export const tplOf = (r: Record<string, unknown>): WorkTemplate => ({
  ...(r as WorkTemplate),
  lines: Array.isArray(r.lines) ? (r.lines as TplLine[]) : [],
  checklist: Array.isArray(r.checklist) ? (r.checklist as TplCheck[]) : [],
  deposit_value: Number(r.deposit_value) || 0,
});

export const forQuote = (t: Pick<WorkTemplate, "use_in">) => t.use_in !== "job";
export const forJob = (t: Pick<WorkTemplate, "use_in">) => t.use_in !== "quote";

// Total de la plantilla (sin impuesto): sirve de "Estimate" en el trabajo
export const tplTotal = (t: Pick<WorkTemplate, "lines">) => round2(t.lines.reduce((s, l) => s + lineAmount(l), 0));

// Líneas de la plantilla → líneas del formulario de cotización
export const tplToLines = (t: Pick<WorkTemplate, "lines">, start = 0): SalesLine[] => t.lines.map((l, i) => ({
  position: start + i, item_id: l.item_id ?? null, name: l.name ?? "", description: l.description ?? "", quantity: Number(l.quantity) || 1,
  unit: l.unit ?? null, rate: Number(l.rate) || 0, discount: Number(l.discount) || 0, discount_type: l.discount_type === "flat" ? "flat" : "percent",
  amount: lineAmount(l), image_url: null,
}));
// Líneas del formulario → para guardar en la plantilla
export const linesToTpl = (lines: SalesLine[]): TplLine[] => lines.filter((l) => l.name.trim() || Number(l.rate) || l.item_id).map((l) => ({
  item_id: l.item_id, name: l.name.trim(), description: l.description?.trim() || null, quantity: Number(l.quantity) || 0, unit: l.unit,
  rate: round2(Number(l.rate)), discount: round2(Number(l.discount)), discount_type: l.discount_type,
}));

// ---------- Depósito ----------
// "percent" = % del total de la cotización; "flat" = cantidad fija (nunca más que el total)
export function depositAmount(total: number, type: "percent" | "flat" | null | undefined, value: number | null | undefined): number {
  const v = Number(value) || 0;
  if (!type || v <= 0 || total <= 0) return 0;
  return round2(Math.min(total, type === "percent" ? total * Math.min(100, v) / 100 : v));
}

export function tplError(e: { message?: string; code?: string } | null | undefined): "dup" | "sql" | "perm" | "save" {
  const m = e?.message ?? "";
  if (e?.code === "23505") return "dup";
  if (/does not exist|schema cache|Could not find/i.test(m)) return "sql";
  if (/row-level|permission/i.test(m)) return "perm";
  return "save";
}
