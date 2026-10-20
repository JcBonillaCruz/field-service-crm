import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { HistoryRow, Item, canManageCatalog } from "@/lib/catalog";
import { loadHistory } from "@/lib/catalog-server";
import NoAccess from "@/components/customers/NoAccess";
import ItemDetailView from "@/components/catalog/ItemDetailView";

export default async function ItemPage({ params }: { params: { id: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageCatalog(current.role)) return <NoAccess />;
  const { data } = await supabase.from("items").select("*").eq("id", params.id).eq("company_id", current.id).maybeSingle();
  if (!data) notFound();
  const history = await loadHistory(supabase, "item", params.id);
  return <ItemDetailView item={data as Item} history={history as HistoryRow[]} companyId={current.id} />;
}
