import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { CatalogProduct, Coupon, canManageCatalog } from "@/lib/catalog";
import NoAccess from "@/components/customers/NoAccess";
import CouponForm from "@/components/catalog/CouponForm";

export default async function EditCouponPage({ params }: { params: { id: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageCatalog(current.role)) return <NoAccess />;
  const [{ data: coupon }, { data: products }] = await Promise.all([
    supabase.from("coupons").select("*").eq("id", params.id).eq("company_id", current.id).maybeSingle(),
    supabase.from("catalog_products").select("id, name, description, notify_emails, redirect_url, auto_numbers").eq("company_id", current.id).order("name"),
  ]);
  if (!coupon) notFound();
  return <CouponForm companyId={current.id} coupon={coupon as Coupon} products={(products ?? []) as CatalogProduct[]} />;
}
