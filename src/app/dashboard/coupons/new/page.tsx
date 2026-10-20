import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { CatalogProduct, Coupon, canManageCatalog } from "@/lib/catalog";
import NoAccess from "@/components/customers/NoAccess";
import CouponForm from "@/components/catalog/CouponForm";

export default async function NewCouponPage({ searchParams }: { searchParams: { clone?: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageCatalog(current.role)) return <NoAccess />;
  const [{ data: products }, { data: clone }] = await Promise.all([
    supabase.from("catalog_products").select("id, name, description, notify_emails, redirect_url, auto_numbers").eq("company_id", current.id).order("name"),
    searchParams.clone
      ? supabase.from("coupons").select("*").eq("id", searchParams.clone).eq("company_id", current.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return <CouponForm companyId={current.id} products={(products ?? []) as CatalogProduct[]} clone={(clone as Coupon) ?? undefined} />;
}
