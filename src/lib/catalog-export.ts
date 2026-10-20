import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { CouponRow, Item, canManageCatalog } from "@/lib/catalog";
import { CatalogModule, FIELDS, displayValue, rawValue } from "@/lib/catalog-views";
import { checkExportBody, exportResponse, fileBase } from "@/lib/export-file";

type Body = { scope?: "all" | "view" | "period"; ids?: string[]; columns?: string[]; period?: { from?: string; to?: string }; format?: "csv" | "xlsx"; password?: string };

// Exportar Items o Coupons desde el mismo pop-up que Customers
export async function catalogExport(request: NextRequest, module: CatalogModule) {
  const { supabase, current } = await getSession();
  if (!current || !canManageCatalog(current.role)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  let body: Body = {};
  try { body = await request.json(); } catch { /* valores por defecto */ }
  const format = body.format === "xlsx" ? "xlsx" : "csv";
  const password = (body.password ?? "").trim();
  const bad = checkExportBody(format, password);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });

  const table = module === "items" ? "items" : "coupons";
  const select = module === "items" ? "*" : "*, catalog_products ( name )";
  const rows: (Item | CouponRow)[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    let q = supabase.from(table).select(select).eq("company_id", current.id).order("created_at", { ascending: false });
    if (body.scope === "view" && body.ids?.length) q = q.in("id", body.ids.slice(0, 5000));
    if (body.scope === "period" && body.period?.from) q = q.gte("created_at", body.period.from);
    if (body.scope === "period" && body.period?.to) q = q.lte("created_at", body.period.to + "T23:59:59");
    const { data, error } = await q.range(from, from + 999);
    if (error) return NextResponse.json({ error: "Export failed" }, { status: 500 });
    rows.push(...((data ?? []) as unknown as (Item | CouponRow)[]));
    if (!data || data.length < 1000) break;
  }
  // En "vista actual" se respeta el orden de la lista
  if (body.scope === "view" && body.ids?.length) {
    const pos = new Map(body.ids.map((id, i) => [id, i]));
    rows.sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0));
  }

  let matrix: unknown[][];
  if (body.scope === "view" && body.columns?.length) {
    const cols = body.columns.map((k) => FIELDS[module].find((f) => f.key === k)).filter(Boolean) as typeof FIELDS["items"];
    matrix = [cols.map((c) => c.label), ...rows.map((r) => cols.map((c) => (c.type === "number" ? rawValue(module, r, c.key) ?? "" : displayValue(module, r, c.key))))];
  } else if (module === "items") {
    matrix = [["Item Name", "SKU", "Description", "Rate", "Usage Unit", "Account", "Product Type", "Status", "Image URL", "Created Time"],
      ...(rows as Item[]).map((it) => [it.name, it.sku ?? "", it.description ?? "", Number(it.selling_price), it.unit ?? "", it.account, it.item_type, it.is_active ? "Active" : "Inactive", it.image_url ?? "", it.created_at])];
  } else {
    matrix = [["Coupon Name", "Coupon Code", "Product Name", "Discount By", "Discount Value", "Redemption Type", "Cycles", "Expiration Date", "Maximum Redemption", "Redemptions Used", "Status"],
      ...(rows as CouponRow[]).map((c) => [c.name, c.code, c.catalog_products?.name ?? "", c.discount_type === "percent" ? "Percentage" : "Flat", Number(c.discount_value), c.redemption_type, c.cycles ?? "", c.expires_on ?? "", c.max_redemptions ?? "", c.redemptions, c.is_active ? "Active" : "Inactive"])];
  }
  return exportResponse(matrix, fileBase(module, current.name), format, password, module === "items" ? "Items" : "Coupons");
}
