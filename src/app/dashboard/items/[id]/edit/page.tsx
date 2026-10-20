import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Item, canManageCatalog } from "@/lib/catalog";
import NoAccess from "@/components/customers/NoAccess";
import ItemForm from "@/components/catalog/ItemForm";

export default async function EditItemPage({ params }: { params: { id: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageCatalog(current.role)) return <NoAccess />;
  const { data } = await supabase.from("items").select("*").eq("id", params.id).eq("company_id", current.id).maybeSingle();
  if (!data) notFound();
  return <ItemForm companyId={current.id} item={data as Item} />;
}
