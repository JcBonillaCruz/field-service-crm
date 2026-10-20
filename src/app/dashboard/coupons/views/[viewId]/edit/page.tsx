import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageCatalog } from "@/lib/catalog";
import { findView } from "@/lib/catalog-server";
import NoAccess from "@/components/customers/NoAccess";
import ViewForm from "@/components/catalog/ViewForm";

export default async function EditCouponViewPage({ params }: { params: { viewId: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageCatalog(current.role)) return <NoAccess />;
  const view = await findView(supabase, current.id, "coupons", params.viewId);
  if (!view || view.builtin) notFound();
  return <ViewForm module="coupons" companyId={current.id} view={view} />;
}
