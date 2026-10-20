import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { CouponRow, HistoryRow, canManageCatalog } from "@/lib/catalog";
import { loadHistory } from "@/lib/catalog-server";
import NoAccess from "@/components/customers/NoAccess";
import CouponDetailView from "@/components/catalog/CouponDetailView";

export default async function CouponPage({ params }: { params: { id: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageCatalog(current.role)) return <NoAccess />;
  const { data } = await supabase.from("coupons").select("*, catalog_products ( name )").eq("id", params.id).eq("company_id", current.id).maybeSingle();
  if (!data) notFound();
  const history = await loadHistory(supabase, "coupon", params.id);
  return <CouponDetailView coupon={data as CouponRow} history={history as HistoryRow[]} />;
}
