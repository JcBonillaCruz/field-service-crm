import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { CouponRow, canManageCatalog } from "@/lib/catalog";
import { loadViews } from "@/lib/catalog-server";
import NoAccess from "@/components/customers/NoAccess";
import CatalogWorkspace from "@/components/catalog/CatalogWorkspace";

export default async function CouponsLayout({ children }: { children: React.ReactNode }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageCatalog(current.role)) return <NoAccess />;
  const [{ data }, views] = await Promise.all([
    supabase.from("coupons").select("*, catalog_products ( name )").eq("company_id", current.id).order("created_at", { ascending: false }).limit(5000),
    loadViews(supabase, current.id, "coupons"),
  ]);
  return (
    <CatalogWorkspace module="coupons" rows={(data ?? []) as CouponRow[]} customViews={views} companyId={current.id}>
      {children}
    </CatalogWorkspace>
  );
}
