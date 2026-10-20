import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageCatalog } from "@/lib/catalog";
import { findView } from "@/lib/catalog-server";
import NoAccess from "@/components/customers/NoAccess";
import ViewForm from "@/components/catalog/ViewForm";

export default async function EditItemViewPage({ params }: { params: { viewId: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageCatalog(current.role)) return <NoAccess />;
  const view = await findView(supabase, current.id, "items", params.viewId);
  if (!view || view.builtin) notFound();
  return <ViewForm module="items" companyId={current.id} view={view} />;
}
