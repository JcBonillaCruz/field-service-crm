import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { CatalogProduct, canManageCatalog } from "@/lib/catalog";
import NoAccess from "@/components/customers/NoAccess";
import CouponForm from "@/components/catalog/CouponForm";

export default async function NewCouponPage() {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageCatalog(current.role)) return <NoAccess />;
  const { data } = await supabase.from("catalog_products").select("id, name, description, notify_emails, redirect_url, auto_numbers").eq("company_id", current.id).order("name");
  return <CouponForm companyId={current.id} products={(data ?? []) as CatalogProduct[]} />;
}
