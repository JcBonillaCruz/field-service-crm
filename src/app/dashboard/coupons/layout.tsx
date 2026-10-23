import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { TAG, cached, must } from "@/lib/data-cache";
import { CouponRow, canManageCatalog } from "@/lib/catalog";
import { loadViews } from "@/lib/catalog-server";
import NoAccess from "@/components/customers/NoAccess";
import CatalogWorkspace from "@/components/catalog/CatalogWorkspace";

export default async function CouponsLayout({ children }: { children: React.ReactNode }) {
  const { supabase, current, user } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageCatalog(current.role)) return <NoAccess />;
  // Catálogo: caché corta (se borra al instante cuando alguien guarda un cambio)
  const [data, views] = await Promise.all([
    cached(["coupons-list", current.id, user.id], [TAG.catalog(current.id)], 120, async () => must(await supabase.from("coupons").select("*, catalog_products ( name )").eq("company_id", current.id).order("created_at", { ascending: false }).limit(5000)))
      .catch(async () => (await supabase.from("coupons").select("*, catalog_products ( name )").eq("company_id", current.id).order("created_at", { ascending: false }).limit(5000)).data),
    loadViews(supabase, current.id, "coupons"),
  ]);
  return (
    <CatalogWorkspace module="coupons" rows={(data ?? []) as CouponRow[]} customViews={views} companyId={current.id}>
      {children}
    </CatalogWorkspace>
  );
}
