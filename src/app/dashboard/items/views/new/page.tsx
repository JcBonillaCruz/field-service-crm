import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageCatalog } from "@/lib/catalog";
import { findView } from "@/lib/catalog-server";
import NoAccess from "@/components/customers/NoAccess";
import ViewForm from "@/components/catalog/ViewForm";

export default async function NewItemViewPage({ searchParams }: { searchParams: { from?: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageCatalog(current.role)) return <NoAccess />;
  const from = searchParams.from ? await findView(supabase, current.id, "items", searchParams.from) : null;
  return <ViewForm module="items" companyId={current.id} from={from ?? undefined} />;
}
