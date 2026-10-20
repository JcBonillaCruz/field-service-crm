import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Item, canManageCatalog } from "@/lib/catalog";
import NoAccess from "@/components/customers/NoAccess";
import ItemForm from "@/components/catalog/ItemForm";

export default async function NewItemPage({ searchParams }: { searchParams: { clone?: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageCatalog(current.role)) return <NoAccess />;
  let clone: Item | undefined;
  if (searchParams.clone) {
    const { data } = await supabase.from("items").select("*").eq("id", searchParams.clone).eq("company_id", current.id).maybeSingle();
    clone = (data as Item) ?? undefined;
  }
  return <ItemForm companyId={current.id} clone={clone} />;
}
