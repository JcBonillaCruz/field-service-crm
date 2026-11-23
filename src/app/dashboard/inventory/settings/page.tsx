import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory, InvCategory, kitOf, AlertFrequency } from "@/lib/inventory";
import NoAccess from "@/components/customers/NoAccess";
import InvSettingsModal, { InvSettingsRow } from "@/components/inventory/InvSettingsModal";
import { loadInventory, loadMembers } from "@/lib/inventory-server";
import { presetsOf } from "@/lib/inventory-report";
import type { PdfDesign } from "@/lib/count-pdf";

export const dynamic = "force-dynamic";

// Paso 6.12f: Ajustes de inventario en una ventana grande
export default async function InventorySettingsPage() {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) return <NoAccess />;
  const full = "alert_frequency, van_kit, notify_office, notify_tech, tech_can_request, default_wh_min, default_van_min, pdf_design, report_presets";
  const [cats, used, s1, inv, members] = await Promise.all([
    supabase.from("item_categories").select("id, name").eq("company_id", current.id).order("name"),
    supabase.from("items").select("category_id").eq("company_id", current.id).eq("track_inventory", true).not("category_id", "is", null).limit(10000),
    supabase.from("inventory_settings").select(full).eq("company_id", current.id).maybeSingle(),
    loadInventory(supabase, current.id),
    loadMembers(supabase, current.id),
  ]);
  let raw = (s1.data ?? {}) as Record<string, unknown>;
  const newSql = !s1.error;
  if (s1.error) {
    const s2 = await supabase.from("inventory_settings").select("alert_frequency, van_kit").eq("company_id", current.id).maybeSingle();
    raw = (s2.data ?? {}) as Record<string, unknown>;
  }
  const counts: Record<string, number> = {};
  (used.data ?? []).forEach((r) => { const k = r.category_id as string; counts[k] = (counts[k] ?? 0) + 1; });
  const settings: InvSettingsRow = {
    alert_frequency: ((raw.alert_frequency as AlertFrequency) ?? "once"),
    notify_office: raw.notify_office !== false, notify_tech: raw.notify_tech !== false, tech_can_request: raw.tech_can_request !== false,
    default_wh_min: Number(raw.default_wh_min ?? 0) || 0, default_van_min: Number(raw.default_van_min ?? 0) || 0,
    pdf_design: (raw.pdf_design ?? {}) as PdfDesign, report_presets: presetsOf(raw.report_presets), van_kit: kitOf(raw.van_kit),
  };
  return <InvSettingsModal companyId={current.id} company={current.name} canEdit={current.role === "owner" || current.role === "manager"}
    needsSql={Boolean(cats.error) || inv.needsSql} newSql={newSql} categories={(cats.data ?? []) as InvCategory[]} counts={counts} settings={settings}
    items={inv.items} stock={inv.stock} locations={inv.locations} members={members} barcodes={inv.barcodes} />;
}
