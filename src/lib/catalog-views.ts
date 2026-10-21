import { CouponRow, Item, REDEMPTION_OPTIONS, couponStatus, discountLabel, fmtDate, usd } from "@/lib/catalog";
import { SalesDoc, SalesModule, Subscription, fmtD, invoiceStatus, money, quoteStatus, salesRaw, subStatus } from "@/lib/sales";

// Vistas personalizadas (como "New View" de Zoho) para Items y Coupons
export type CatalogModule = "items" | "coupons" | SalesModule;
export const isSales = (m: CatalogModule): m is SalesModule => m === "quotes" || m === "invoices" || m === "subscriptions";
export type FieldType = "text" | "number" | "choice" | "date";
export type FieldDef = {
  key: string; label: string; type: FieldType; choices?: { value: string; label: string }[];
  align?: "right"; width: number; locked?: boolean; filter?: boolean; column?: boolean;
};
export type Criterion = { field: string; op: string; value: string };
export type Visibility = "me" | "roles" | "everyone";
export type ViewDef = {
  id: string; name: string; builtin?: boolean; is_favorite?: boolean; criteria: Criterion[]; match: "all" | "any";
  columns: string[]; visibility?: Visibility; roles?: string[]; user_id?: string;
};
export type Row = Item | CouponRow | SalesDoc | Subscription;

const STATUS = [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }];
const Q_STATUS = [
  { value: "draft", label: "Draft" }, { value: "sent", label: "Sent" }, { value: "viewed", label: "Customer Viewed" }, { value: "accepted", label: "Accepted" },
  { value: "invoiced", label: "Invoiced" }, { value: "declined", label: "Declined" }, { value: "expired", label: "Expired" },
];
const I_STATUS = [
  { value: "draft", label: "Draft" }, { value: "sent", label: "Sent" }, { value: "viewed", label: "Viewed" }, { value: "partially_paid", label: "Partially Paid" },
  { value: "overdue", label: "Overdue" }, { value: "paid", label: "Paid" }, { value: "void", label: "Void" }, { value: "written_off", label: "Written Off" },
];
const S_STATUS = [
  { value: "live", label: "Live" }, { value: "future", label: "Future" }, { value: "paused", label: "Paused" }, { value: "cancelled", label: "Cancelled" }, { value: "expired", label: "Expired" },
];

export const FIELDS: Record<CatalogModule, FieldDef[]> = {
  items: [
    { key: "name", label: "Name", type: "text", width: 300, locked: true },
    { key: "sku", label: "SKU", type: "text", width: 150 },
    { key: "description", label: "Description", type: "text", width: 380 },
    { key: "rate", label: "Rate", type: "number", align: "right", width: 130 },
    { key: "unit", label: "Usage Unit", type: "text", width: 130 },
    { key: "account", label: "Account Name", type: "text", width: 170 },
    { key: "type", label: "Type", type: "choice", width: 120, choices: [{ value: "goods", label: "Goods" }, { value: "service", label: "Service" }] },
    { key: "status", label: "Status", type: "choice", width: 120, choices: STATUS },
    { key: "image", label: "Image", type: "choice", width: 110, choices: [{ value: "yes", label: "Has image" }, { value: "no", label: "No image" }] },
    { key: "source", label: "Created Source", type: "choice", width: 140, choices: [{ value: "user", label: "User" }, { value: "import", label: "Import" }] },
    { key: "created", label: "Created Time", type: "date", width: 150 },
    { key: "updated", label: "Last Modified Time", type: "date", width: 170 },
  ],
  coupons: [
    { key: "name", label: "Name", type: "text", width: 240, locked: true },
    { key: "code", label: "Coupon Code", type: "text", width: 170 },
    { key: "status", label: "Status", type: "choice", width: 130, choices: [...STATUS, { value: "expired", label: "Expired" }, { value: "used", label: "Maxed out" }] },
    { key: "discount", label: "Discount Value", type: "number", width: 150 },
    { key: "discount_by", label: "Discount By", type: "choice", width: 140, choices: [{ value: "flat", label: "Flat" }, { value: "percent", label: "Percentage" }] },
    { key: "redemption", label: "Redemption Type", type: "choice", width: 160, choices: REDEMPTION_OPTIONS.map((r) => ({ value: r.value, label: r.label.replace("-", " ") })) },
    { key: "max", label: "Maximum Redemption", type: "number", width: 180 },
    { key: "used", label: "Redemptions Used", type: "number", width: 160 },
    { key: "expires", label: "Expiration Date", type: "date", width: 150 },
    { key: "product", label: "Product Name", type: "text", width: 180 },
    { key: "created", label: "Created Time", type: "date", width: 150 },
  ],
  quotes: [
    { key: "name", label: "Quote Number", type: "text", width: 150, locked: true },
    { key: "date", label: "Date", type: "date", width: 130 },
    { key: "reference", label: "Reference Number", type: "text", width: 170 },
    { key: "customer", label: "Customer Name", type: "text", width: 240 },
    { key: "status", label: "Status", type: "choice", width: 150, choices: Q_STATUS },
    { key: "amount", label: "Amount", type: "number", align: "right", width: 140 },
    { key: "expiry", label: "Expiry Date", type: "date", width: 140 },
    { key: "salesperson", label: "Salesperson", type: "text", width: 150 },
    { key: "subject", label: "Subject", type: "text", width: 220 },
    { key: "created", label: "Created Time", type: "date", width: 150 },
  ],
  invoices: [
    { key: "name", label: "Invoice#", type: "text", width: 150, locked: true },
    { key: "date", label: "Date", type: "date", width: 130 },
    { key: "order", label: "Order Number", type: "text", width: 150 },
    { key: "customer", label: "Customer Name", type: "text", width: 240 },
    { key: "status", label: "Status", type: "choice", width: 170, choices: I_STATUS },
    { key: "due", label: "Due Date", type: "date", width: 130 },
    { key: "amount", label: "Amount", type: "number", align: "right", width: 140 },
    { key: "balance", label: "Balance Due", type: "number", align: "right", width: 140 },
    { key: "salesperson", label: "Salesperson", type: "text", width: 150 },
    { key: "subject", label: "Subject", type: "text", width: 220 },
    { key: "created", label: "Created Time", type: "date", width: 150 },
  ],
  subscriptions: [
    { key: "name", label: "Subscription#", type: "text", width: 150, locked: true },
    { key: "customer", label: "Customer Name", type: "text", width: 240 },
    { key: "profile", label: "Profile Name", type: "text", width: 200 },
    { key: "status", label: "Status", type: "choice", width: 130, choices: S_STATUS },
    { key: "amount", label: "Amount", type: "number", align: "right", width: 140 },
    { key: "frequency", label: "Billing Frequency", type: "choice", width: 160, choices: [{ value: "week", label: "Weekly" }, { value: "month", label: "Monthly" }, { value: "year", label: "Yearly" }] },
    { key: "next", label: "Next Billing Date", type: "date", width: 160 },
    { key: "start", label: "Start Date", type: "date", width: 130 },
    { key: "salesperson", label: "Salesperson", type: "text", width: 150 },
    { key: "created", label: "Created Time", type: "date", width: 150 },
  ],
};

const ITEM_COLS = ["name", "sku", "description", "rate", "unit"];
const COUPON_COLS = ["name", "code", "status", "discount", "discount_by", "redemption", "max", "expires"];
const QUOTE_COLS = ["date", "name", "reference", "customer", "status", "amount"];
const INVOICE_COLS = ["date", "name", "order", "customer", "status", "due", "amount", "balance"];
const SUB_COLS = ["name", "customer", "profile", "status", "frequency", "next", "amount"];
const v = (id: string, name: string, criteria: Criterion[], columns: string[], match: "all" | "any" = "all"): ViewDef => ({ id, name, builtin: true, criteria, match, columns });
const st = (value: string): Criterion => ({ field: "status", op: "is", value });

export const BUILTIN_VIEWS: Record<CatalogModule, ViewDef[]> = {
  items: [
    v("all", "All Items", [], ITEM_COLS),
    v("active", "Active Items", [{ field: "status", op: "is", value: "active" }], ITEM_COLS),
    v("inactive", "Inactive Items", [{ field: "status", op: "is", value: "inactive" }], ITEM_COLS),
    v("goods", "Goods", [{ field: "type", op: "is", value: "goods" }], ITEM_COLS),
    v("services", "Services", [{ field: "type", op: "is", value: "service" }], ITEM_COLS),
    v("no_image", "Items Without Image", [{ field: "image", op: "is", value: "no" }], ITEM_COLS),
  ],
  coupons: [
    v("all", "All Coupons", [], COUPON_COLS),
    v("active", "Active Coupons", [{ field: "status", op: "is", value: "active" }], COUPON_COLS),
    v("inactive", "Inactive Coupons", [{ field: "status", op: "is", value: "inactive" }], COUPON_COLS),
    v("expired", "Expired Coupons", [{ field: "status", op: "is", value: "expired" }], COUPON_COLS),
  ],
  quotes: [
    v("all", "All Quotes", [], QUOTE_COLS), v("draft", "Draft", [st("draft")], QUOTE_COLS), v("sent", "Sent", [st("sent")], QUOTE_COLS),
    v("viewed", "Customer Viewed", [st("viewed")], QUOTE_COLS), v("accepted", "Accepted", [st("accepted")], QUOTE_COLS),
    v("invoiced", "Invoiced", [st("invoiced")], QUOTE_COLS), v("declined", "Declined", [st("declined")], QUOTE_COLS), v("expired", "Expired", [st("expired")], QUOTE_COLS),
  ],
  invoices: [
    v("all", "All Invoices", [], INVOICE_COLS), v("draft", "Draft", [st("draft")], INVOICE_COLS),
    v("unpaid", "Unpaid", [st("sent"), st("viewed"), st("partially_paid"), st("overdue")], INVOICE_COLS, "any"),
    v("sent", "Sent", [st("sent")], INVOICE_COLS), v("overdue", "Overdue", [st("overdue")], INVOICE_COLS),
    v("partially_paid", "Partially Paid", [st("partially_paid")], INVOICE_COLS), v("paid", "Paid", [st("paid")], INVOICE_COLS), v("void", "Void", [st("void")], INVOICE_COLS),
  ],
  subscriptions: [
    v("all", "All Subscriptions", [], SUB_COLS), v("live", "Live", [st("live")], SUB_COLS), v("future", "Future", [st("future")], SUB_COLS),
    v("paused", "Paused", [st("paused")], SUB_COLS), v("cancelled", "Cancelled", [st("cancelled")], SUB_COLS), v("expired", "Expired", [st("expired")], SUB_COLS),
  ],
};
export const DEFAULT_VIEW: Record<CatalogModule, string> = { items: "active", coupons: "all", quotes: "all", invoices: "all", subscriptions: "all" };
// Etiqueta corta del menú (como Zoho: "All", "Active"...)
export const shortViewName = (m: CatalogModule, view: ViewDef) =>
  view.builtin ? view.name.replace(new RegExp(` ${MODULE_INFO[m].plural}$`), "") : view.name;

export const OPS: Record<FieldType, { value: string; label: string }[]> = {
  text: [
    { value: "is", label: "is" }, { value: "is_not", label: "isn't" }, { value: "contains", label: "contains" },
    { value: "not_contains", label: "doesn't contain" }, { value: "starts", label: "starts with" }, { value: "ends", label: "ends with" },
    { value: "empty", label: "is empty" }, { value: "not_empty", label: "is not empty" },
  ],
  number: [
    { value: "eq", label: "=" }, { value: "neq", label: "≠" }, { value: "lt", label: "<" }, { value: "lte", label: "≤" },
    { value: "gt", label: ">" }, { value: "gte", label: "≥" }, { value: "empty", label: "is empty" }, { value: "not_empty", label: "is not empty" },
  ],
  choice: [{ value: "is", label: "is" }, { value: "is_not", label: "isn't" }],
  date: [
    { value: "on", label: "is" }, { value: "before", label: "is before" }, { value: "after", label: "is after" },
    { value: "empty", label: "is empty" }, { value: "not_empty", label: "is not empty" },
  ],
};
export const NO_VALUE_OPS = new Set(["empty", "not_empty"]);

// Valor "crudo" de un campo (para filtrar, ordenar y exportar)
export function rawValue(m: CatalogModule, row: Row, key: string): string | number | null {
  if (isSales(m)) return salesRaw(m, row as SalesDoc | Subscription, key);
  if (m === "items") {
    const it = row as Item;
    switch (key) {
      case "name": return it.name; case "sku": return it.sku; case "description": return it.description;
      case "rate": return Number(it.selling_price); case "unit": return it.unit; case "account": return it.account;
      case "type": return it.item_type; case "status": return it.is_active ? "active" : "inactive";
      case "image": return it.image_url ? "yes" : "no"; case "source": return it.source || "user";
      case "created": return it.created_at; case "updated": return it.updated_at || it.created_at;
    }
    return null;
  }
  const c = row as CouponRow;
  switch (key) {
    case "name": return c.name; case "code": return c.code; case "status": return couponStatus(c).tone;
    case "discount": return Number(c.discount_value); case "discount_by": return c.discount_type;
    case "redemption": return c.redemption_type; case "max": return c.max_redemptions; case "used": return c.redemptions;
    case "expires": return c.expires_on; case "product": return c.catalog_products?.name ?? null; case "created": return c.created_at;
  }
  return null;
}

// Texto que se ve en la tabla
export function displayValue(m: CatalogModule, row: Row, key: string): string {
  const f = FIELDS[m].find((x) => x.key === key);
  const raw = rawValue(m, row, key);
  if (raw == null || raw === "") return "";
  if (isSales(m)) {
    if (key === "amount" || key === "balance") return money(raw as number);
    if (key === "status") {
      if (m === "subscriptions") return subStatus(row as Subscription).label;
      return m === "quotes" ? quoteStatus(row as SalesDoc).label : invoiceStatus(row as SalesDoc).label;
    }
    if (f?.type === "date") return fmtD(String(raw));
  }
  if (m === "items" && key === "rate") return usd(raw as number);
  if (m === "coupons" && key === "discount") return discountLabel(row as CouponRow);
  if (m === "coupons" && key === "status") return couponStatus(row as CouponRow).label;
  if (f?.type === "date") return fmtDate(String(raw));
  if (f?.choices) return f.choices.find((ch) => ch.value === raw)?.label ?? String(raw);
  return String(raw);
}

function test(m: CatalogModule, row: Row, c: Criterion): boolean {
  const f = FIELDS[m].find((x) => x.key === c.field);
  if (!f || !c.op) return true;
  const raw = rawValue(m, row, c.field);
  const empty = raw == null || raw === "";
  if (c.op === "empty") return empty;
  if (c.op === "not_empty") return !empty;
  if (f.type === "number") {
    if (c.value === "") return true;
    const a = Number(raw ?? 0), b = Number(c.value);
    return ({ eq: a === b, neq: a !== b, lt: a < b, lte: a <= b, gt: a > b, gte: a >= b } as Record<string, boolean>)[c.op] ?? true;
  }
  if (f.type === "date") {
    if (!c.value) return true;
    if (empty) return false;
    const a = String(raw).slice(0, 10);
    return c.op === "on" ? a === c.value : c.op === "before" ? a < c.value : a > c.value;
  }
  const a = String(raw ?? "").toLowerCase(), b = c.value.toLowerCase();
  if (f.type === "choice") return c.op === "is" ? a === b : a !== b;
  switch (c.op) {
    case "is": return a === b; case "is_not": return a !== b; case "contains": return a.includes(b);
    case "not_contains": return !a.includes(b); case "starts": return a.startsWith(b); case "ends": return a.endsWith(b);
  }
  return true;
}

export const SORTS: Record<CatalogModule, { value: string; label: string }[]> = {
  items: [
    { value: "name", label: "Name" }, { value: "sku", label: "SKU" }, { value: "rate", label: "Rate" },
    { value: "updated", label: "Last Modified Time" }, { value: "created", label: "Created Time" },
  ],
  coupons: [
    { value: "code", label: "Coupon Code" }, { value: "name", label: "Name" }, { value: "expires", label: "Expiration Date" }, { value: "created", label: "Created Time" },
  ],
  quotes: [
    { value: "date", label: "Date" }, { value: "name", label: "Quote Number" }, { value: "customer", label: "Customer Name" },
    { value: "amount", label: "Amount" }, { value: "expiry", label: "Expiry Date" }, { value: "created", label: "Created Time" },
  ],
  invoices: [
    { value: "date", label: "Date" }, { value: "name", label: "Invoice#" }, { value: "customer", label: "Customer Name" }, { value: "due", label: "Due Date" },
    { value: "amount", label: "Amount" }, { value: "balance", label: "Balance Due" }, { value: "created", label: "Created Time" },
  ],
  subscriptions: [
    { value: "name", label: "Subscription#" }, { value: "customer", label: "Customer Name" }, { value: "next", label: "Next Billing Date" },
    { value: "amount", label: "Amount" }, { value: "created", label: "Created Time" },
  ],
};

export function applyView(m: CatalogModule, rows: Row[], view: ViewDef, q: string, sort: string, dir: "asc" | "desc") {
  const crit = view.criteria.filter((c) => c.field && c.op);
  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const out = rows.filter((r) => {
    if (crit.length) {
      const ok = view.match === "any" ? crit.some((c) => test(m, r, c)) : crit.every((c) => test(m, r, c));
      if (!ok) return false;
    }
    if (!terms.length) return true;
    const blob = (m === "items"
      ? [(r as Item).name, (r as Item).sku, (r as Item).description]
      : m === "coupons" ? [(r as CouponRow).name, (r as CouponRow).code, (r as CouponRow).catalog_products?.name]
        : m === "subscriptions" ? [(r as Subscription).number, (r as Subscription).customer_name, (r as Subscription).profile_name]
          : [(r as SalesDoc).number, (r as SalesDoc).customer_name, (r as SalesDoc).reference, (r as SalesDoc).order_number, (r as SalesDoc).subject]
    ).filter(Boolean).join(" ").toLowerCase();
    return terms.every((t) => blob.includes(t));
  });
  const sign = dir === "desc" ? -1 : 1;
  return out.sort((a, b) => {
    const x = rawValue(m, a, sort), y = rawValue(m, b, sort);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    if (typeof x === "number" && typeof y === "number") return (x - y) * sign;
    return String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: "base" }) * sign;
  });
}

export const defaultSort = (m: CatalogModule) => (m === "quotes" || m === "invoices" ? "date" : "created");

// Favoritos de las vistas que trae el sistema (se guardan en este navegador)
export const favKey = (m: CatalogModule, companyId: string) => `bp-view-fav:${m}:${companyId}`;
export const lastViewKey = (m: CatalogModule, companyId: string) => `bp-view-last:${m}:${companyId}`;
export const colWidthKey = (m: CatalogModule, companyId: string) => `bp-colw:${m}:${companyId}`;

export const MODULE_INFO: Record<CatalogModule, { singular: string; plural: string; base: string }> = {
  items: { singular: "Item", plural: "Items", base: "/dashboard/items" },
  coupons: { singular: "Coupon", plural: "Coupons", base: "/dashboard/coupons" },
  quotes: { singular: "Quote", plural: "Quotes", base: "/dashboard/quotes" },
  invoices: { singular: "Invoice", plural: "Invoices", base: "/dashboard/invoices" },
  subscriptions: { singular: "Subscription", plural: "Subscriptions", base: "/dashboard/subscriptions" },
};
