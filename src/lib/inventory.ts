import { Role } from "@/lib/types";

// =====================================================================
// Inventory (Paso 4.1)
// El producto es el MISMO registro de "items" con track_inventory = true.
// La cantidad vive en inventory_stock (por ubicación) y SOLO cambia con movimientos (inv_move).
// =====================================================================
export type InvItem = {
  id: string; name: string; sku: string | null; unit: string | null; image_url: string | null;
  selling_price: number; cost_price: number; category_id: string | null; description: string | null;
  is_active: boolean; created_at: string;
};
export type InvLocation = { id: string; name: string; kind: "warehouse" | "van"; is_default: boolean; assigned_user_id: string | null };
export type InvStock = { item_id: string; location_id: string; qty: number; min_qty: number };
export type InvCategory = { id: string; name: string };
export type InvPhoto = { id: string; item_id: string; url: string; path: string; position: number };
export type InvMovement = {
  id: string; item_id: string; kind: MoveKind; qty: number; from_location: string | null; to_location: string | null;
  reason: string | null; note: string | null; actor_name: string | null; created_at: string;
};
export type MoveKind = "receive" | "transfer" | "use" | "return" | "adjust" | "count";
export type StockStatus = "in" | "low" | "out";

export const canManageInventory = (role: Role | null | undefined) => role === "owner" || role === "manager" || role === "office";
export const MAX_PHOTOS = 3;

export const MOVE_LABEL: Record<MoveKind, string> = {
  receive: "Received", transfer: "Transferred", use: "Used on a job", return: "Returned", adjust: "Adjusted", count: "Counted",
};

// Motivos para un ajuste manual (quedan firmados en el historial)
export const ADD_REASONS = ["Received purchase", "Found / recount", "Returned by customer", "Correction"];
export const REMOVE_REASONS = ["Used on a job", "Damaged", "Lost / missing", "Returned to supplier", "Correction"];

export const qtyFmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ""));
export const usd = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v || 0);

// Estado de un producto: Agotado si el total es 0; Bajo si alguna ubicación con mínimo está en o debajo de su mínimo
export function statusOf(rows: InvStock[]): StockStatus {
  const total = rows.reduce((s, r) => s + Number(r.qty), 0);
  if (total <= 0) return "out";
  return rows.some((r) => Number(r.min_qty) > 0 && Number(r.qty) <= Number(r.min_qty)) ? "low" : "in";
}

export const STATUS_META: Record<StockStatus, { label: string; badge: string; dot: string }> = {
  in: { label: "In Stock", badge: "bg-[#e7f6f1] text-[#0f766e] ring-[#bfe6da]", dot: "bg-[#14a39a]" },
  low: { label: "Low Stock", badge: "bg-[#fff7e6] text-[#b45309] ring-[#fcdca4]", dot: "bg-[#f59e0b]" },
  out: { label: "Out of Stock", badge: "bg-[#fff1f2] text-[#be123c] ring-[#fecdd3]", dot: "bg-[#e11d48]" },
};

// Mensajes claros para los errores de la base de datos
export function invError(e: { message?: string; code?: string; hint?: string } | null | undefined): string {
  const m = `${e?.message ?? ""} ${e?.hint ?? ""}`;
  if (!e) return "";
  if (m.includes("SKU_EXISTS") || e.code === "23505") return "Another inventory product already uses this SKU / barcode.";
  if (m.includes("SKU_REQUIRED")) return "Products that track inventory need a SKU / barcode.";
  if (m.includes("NOT_ENOUGH_STOCK")) return e.hint || "There isn't enough stock in that location.";
  if (m.includes("REASON_REQUIRED")) return "Choose a reason for this adjustment.";
  if (m.includes("PHOTO_LIMIT")) return `Up to ${MAX_PHOTOS} photos per product.`;
  if (m.includes("NO_ACCESS")) return e.hint || "You don't have permission to do this.";
  if (m.includes("NAME_REQUIRED")) return "Enter the product name.";
  if (m.includes("does not exist") || m.includes("Could not find the function")) return "Run the SQL for Paso 4.1 in Supabase first.";
  return "Something went wrong. Try again.";
}

// Foto: la achica en el teléfono antes de subirla (máx. 1280 px, WebP ~150 KB; JPG si el navegador no hace WebP)
export async function compressImage(file: File, max = 1280, quality = 0.8): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i); i.onerror = () => fail(new Error("bad image")); i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    const make = (type: string) => new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, quality));
    const webp = await make("image/webp");
    if (webp && webp.type === "image/webp") return webp;
    return (await make("image/jpeg")) ?? file;
  } finally {
    URL.revokeObjectURL(url);
  }
}
