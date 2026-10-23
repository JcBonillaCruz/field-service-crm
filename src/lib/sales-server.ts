import type { SupabaseClient } from "@supabase/supabase-js";
import { TAG, cached, must } from "@/lib/data-cache";
import { Activity, Comment, DEFAULT_PREFS, DocKind, Payment, SalesDoc, SalesFile, SalesLine, SalesPrefs, Subscription } from "@/lib/sales";

export type CustomerOption = { id: string; display_name: string; email: string | null; company_name: string | null; payment_terms: string | null; currency: string | null };
export type ItemOption = { id: string; name: string; sku: string | null; selling_price: number; description: string | null; unit: string | null; image_url: string | null; item_type: string };
export type CouponOption = { id: string; name: string; code: string; discount_type: "flat" | "percent"; discount_value: number };

// Preferencias: la parte fija (logo, plantillas, datos de la empresa) sale de caché;
// los contadores de numeración (QT-/INV-/SUB-) SIEMPRE en vivo, para no repetir números.
const COUNTERS = "quote_prefix, quote_next, quote_auto, invoice_prefix, invoice_next, invoice_auto, sub_prefix, sub_next";
export async function loadPrefs(supabase: SupabaseClient, companyId: string): Promise<SalesPrefs> {
  const uid = await currentUserId();
  const fixed = () => Promise.all([
    supabase.from("sales_prefs").select("*").eq("company_id", companyId).maybeSingle().then(must),
    supabase.from("company_plans").select("white_label").eq("company_id", companyId).maybeSingle().then((r) => r.data),
  ]);
  const [[data, plan], live] = await Promise.all([
    (uid ? cached(["prefs", companyId, uid], [TAG.prefs(companyId)], 300, fixed) : fixed()).catch(() => [null, null] as const),
    supabase.from("sales_prefs").select(COUNTERS).eq("company_id", companyId).maybeSingle().then((r) => r.data),
  ]);
  const white = Boolean((plan as { white_label?: boolean } | null)?.white_label);
  if (!data) return { ...DEFAULT_PREFS, white_label: white };
  return {
    ...DEFAULT_PREFS, ...data, ...(live ?? {}),
    quote_settings: { ...DEFAULT_PREFS.quote_settings, ...(data.quote_settings ?? {}) },
    invoice_settings: { ...DEFAULT_PREFS.invoice_settings, ...(data.invoice_settings ?? {}) },
    org_info: data.org_info ?? {}, pdf_settings: data.pdf_settings ?? {}, white_label: white,
  } as SalesPrefs;
}

// Id del usuario de esta petición (para que la caché respete los permisos de cada quien)
async function currentUserId(): Promise<string | null> {
  try { const { getSession } = await import("@/lib/session"); return (await getSession()).user.id; } catch { return null; }
}

// Catálogo para formularios (items activos y cupones): caché corta + se borra al guardar un item o cupón
async function loadCatalogOptions(supabase: SupabaseClient, companyId: string) {
  const uid = await currentUserId();
  const load = async () => {
    const [items, coupons] = await Promise.all([
      supabase.from("items").select("id, name, sku, selling_price, description, unit, image_url, item_type").eq("company_id", companyId).eq("is_active", true).order("name").limit(5000).then(must),
      supabase.from("coupons").select("id, name, code, discount_type, discount_value, expires_on, is_active").eq("company_id", companyId).eq("is_active", true).limit(500).then(must),
    ]);
    return { items: items ?? [], coupons: coupons ?? [] };
  };
  return (uid ? cached(["catalog-options", companyId, uid], [TAG.catalog(companyId)], 120, load) : load()).catch(() => ({ items: [], coupons: [] }));
}

// Lo que necesita el formulario de Quote / Invoice / Subscription
export async function loadFormData(supabase: SupabaseClient, companyId: string) {
  const [{ data: customers }, { items, coupons }, { data: people }, prefs] = await Promise.all([
    supabase.from("customers").select("id, display_name, email, company_name, payment_terms, currency").eq("company_id", companyId).order("display_name").limit(5000),
    loadCatalogOptions(supabase, companyId),
    supabase.from("sales_docs").select("salesperson").eq("company_id", companyId).not("salesperson", "is", null).limit(500),
    loadPrefs(supabase, companyId),
  ]);
  const salespeople = Array.from(new Set((people ?? []).map((p) => p.salesperson as string).filter(Boolean))).sort();
  const today = new Date().toISOString().slice(0, 10);
  return {
    customers: (customers ?? []) as CustomerOption[],
    items: (items ?? []) as ItemOption[],
    coupons: ((coupons ?? []) as (CouponOption & { expires_on: string | null })[]).filter((c) => !c.expires_on || c.expires_on >= today),
    salespeople, prefs,
  };
}

export async function loadDoc(supabase: SupabaseClient, companyId: string, kind: DocKind, id: string) {
  const { data: doc } = await supabase.from("sales_docs").select("*").eq("id", id).eq("company_id", companyId).eq("kind", kind).maybeSingle();
  if (!doc) return null;
  const [{ data: lines }, { data: activity }, { data: comments }, { data: files }, payments, related, prefs, { data: company }] = await Promise.all([
    supabase.from("sales_lines").select("*").eq("doc_id", id).order("position"),
    supabase.from("sales_activity").select("id, message, detail, actor_name, created_at").eq("entity_id", id).order("created_at", { ascending: false }).limit(300),
    supabase.from("sales_comments").select("id, body, author_name, created_at").eq("entity_id", id).order("created_at", { ascending: false }),
    supabase.from("sales_files").select("id, name, path, size, mime, created_at").eq("entity_id", id).order("created_at"),
    kind === "invoice"
      ? supabase.from("sales_payments").select("*").eq("invoice_id", id).order("paid_on", { ascending: false }).then((r) => (r.data ?? []) as Payment[])
      : Promise.resolve([] as Payment[]),
    kind === "quote"
      ? supabase.from("sales_docs").select("*").eq("quote_id", id).eq("kind", "invoice").order("created_at").then((r) => (r.data ?? []) as SalesDoc[])
      : doc.quote_id ? supabase.from("sales_docs").select("*").eq("id", doc.quote_id).then((r) => (r.data ?? []) as SalesDoc[]) : Promise.resolve([] as SalesDoc[]),
    loadPrefs(supabase, companyId),
    supabase.from("companies").select("name").eq("id", companyId).maybeSingle(),
  ]);
  return {
    doc: doc as SalesDoc, lines: (lines ?? []) as SalesLine[], activity: (activity ?? []) as Activity[], comments: (comments ?? []) as Comment[],
    files: (files ?? []) as SalesFile[], payments, related, prefs, companyName: (company?.name as string) ?? "",
  };
}

export async function loadSubscription(supabase: SupabaseClient, companyId: string, id: string) {
  const { data: sub } = await supabase.from("subscriptions").select("*").eq("id", id).eq("company_id", companyId).maybeSingle();
  if (!sub) return null;
  const [{ data: lines }, { data: activity }, { data: invoices }, { data: comments }] = await Promise.all([
    supabase.from("sales_lines").select("*").eq("subscription_id", id).order("position"),
    supabase.from("sales_activity").select("id, message, detail, actor_name, created_at").eq("entity_id", id).order("created_at", { ascending: false }).limit(300),
    supabase.from("sales_docs").select("*").eq("subscription_id", id).eq("kind", "invoice").order("created_at", { ascending: false }),
    supabase.from("sales_comments").select("id, body, author_name, created_at").eq("entity_id", id).order("created_at", { ascending: false }),
  ]);
  return {
    sub: sub as Subscription, lines: (lines ?? []) as SalesLine[], activity: (activity ?? []) as Activity[],
    invoices: (invoices ?? []) as SalesDoc[], comments: (comments ?? []) as Comment[],
  };
}
