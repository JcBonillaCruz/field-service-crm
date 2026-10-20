import { Role } from "@/lib/types";

// Product Catalog: Items, Products (para cupones) y Coupons
export type ItemType = "goods" | "service";
export type Item = {
  id: string; name: string; item_type: ItemType; unit: string | null; sku: string | null; image_url: string | null;
  selling_price: number; account: string; description: string | null; is_active: boolean; created_at: string;
};
export type CatalogProduct = {
  id: string; name: string; description: string | null; notify_emails: string | null; redirect_url: string | null; auto_numbers: boolean;
};
export type DiscountType = "flat" | "percent";
export type RedemptionType = "one_time" | "unlimited" | "limited_cycles";
export type Coupon = {
  id: string; product_id: string; name: string; code: string; discount_type: DiscountType; discount_value: number;
  redemption_type: RedemptionType; cycles: number | null; expires_on: string | null; max_redemptions: number | null;
  redemptions: number; is_active: boolean; created_at: string;
};

export const UNITS = ["each", "hour", "visit", "job", "ft", "sq ft", "ton", "lb", "gal", "box", "set", "pair", "kit"];
export const ACCOUNTS = ["Sales", "Service Income", "Installation Income", "Maintenance Plans", "Parts & Materials", "Other Income"];
export const REDEMPTION_OPTIONS: { value: RedemptionType; label: string }[] = [
  { value: "one_time", label: "One-Time" },
  { value: "unlimited", label: "Unlimited" },
  { value: "limited_cycles", label: "Limited Cycles" },
];

export const canManageCatalog = (role: Role) => role === "owner" || role === "manager" || role === "office";

export const usd = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v || 0);

export const discountLabel = (c: Pick<Coupon, "discount_type" | "discount_value">) =>
  c.discount_type === "percent" ? `${+c.discount_value}%` : usd(c.discount_value);

export function couponStatus(c: Coupon): { label: string; tone: "active" | "expired" | "used" | "inactive" } {
  if (!c.is_active) return { label: "Inactive", tone: "inactive" };
  if (c.expires_on && new Date(`${c.expires_on}T23:59:59`) < new Date()) return { label: "Expired", tone: "expired" };
  if (c.max_redemptions && c.redemptions >= c.max_redemptions) return { label: "Maxed out", tone: "used" };
  return { label: "Active", tone: "active" };
}

export const cleanCode = (v: string) => v.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 30);
