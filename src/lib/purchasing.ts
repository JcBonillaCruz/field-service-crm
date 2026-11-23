// =====================================================================
// Paso 6.14 · Compras: proveedores, órdenes de compra, unidad de compra vs. unidad de uso
//   Se pide en unidad de compra (Box of 50) y entra al stock en unidad de uso (50 piezas).
//   Precio de la orden = por unidad de compra; al recibir, el costo por pieza = precio ÷ piezas por caja.
// =====================================================================
export type Supplier = {
  id: string; name: string; contact_name: string | null; phone: string | null; email: string | null; website: string | null;
  account_no: string | null; address: string | null; payment_terms: string | null; lead_days: number | null; notes: string | null; is_active: boolean;
};
export type ItemSupplier = { id: string; item_id: string; supplier_id: string; supplier_sku: string | null; cost: number | null; is_preferred: boolean };
export type PoStatus = "draft" | "ordered" | "partial" | "received" | "cancelled";
export type PurchaseOrder = {
  id: string; number: string; supplier_id: string | null; location_id: string | null; status: PoStatus; order_date: string; expected_date: string | null;
  notes: string | null; total: number; created_by_name: string | null; ordered_at: string | null; received_at: string | null; created_at: string;
};
export type PoLine = { id: string; po_id: string; item_id: string; position: number; buy_unit: string | null; per_unit: number; qty: number; unit_cost: number; received: number };

export const PO_STATUSES: PoStatus[] = ["draft", "ordered", "partial", "received", "cancelled"];
export const PO_META: Record<PoStatus, { badge: string; dot: string }> = {
  draft: { badge: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400" },
  ordered: { badge: "bg-[#eef6ff] text-[#1d4ed8] ring-[#cfe0fb]", dot: "bg-[#3b82f6]" },
  partial: { badge: "bg-[#fff7e6] text-[#b45309] ring-[#fcdca4]", dot: "bg-[#f59e0b]" },
  received: { badge: "bg-[#e7f6f1] text-[#0f766e] ring-[#bfe6da]", dot: "bg-[#14a39a]" },
  cancelled: { badge: "bg-[#fff1f2] text-[#be123c] ring-[#fecdd3]", dot: "bg-[#e11d48]" },
};
export const poOpen = (s: PoStatus) => s === "ordered" || s === "partial";
export const lineTotal = (l: Pick<PoLine, "qty" | "unit_cost">) => Math.round(l.qty * l.unit_cost * 100) / 100;

// De piezas que faltan → unidades de compra (siempre hacia arriba: faltan 30 y la caja trae 50 → 1 caja)
export const toBuyUnits = (units: number, per: number) => Math.max(1, Math.ceil(units / Math.max(per, 0.001) - 1e-9));

// Mensajes claros para los errores de las funciones po_* (claves de "purch")
export function poErrKey(e: { message?: string; hint?: string } | null | undefined): string {
  const m = `${e?.message ?? ""} ${e?.hint ?? ""}`;
  if (!e) return "";
  if (/does not exist|Could not find the function|schema cache/i.test(m)) return "eSql";
  if (m.includes("NO_LINES")) return "eLines";
  if (m.includes("BAD_QTY")) return "eQty";
  if (m.includes("PO_LOCKED")) return "eLocked";
  if (m.includes("NO_ACCESS")) return "eAccess";
  if (m.includes("BAD_LOCATION")) return "eLoc";
  if (m.includes("23505") || /duplicate key/i.test(m)) return "eDup";
  return "eGeneric";
}
