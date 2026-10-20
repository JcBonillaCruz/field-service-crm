import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageCatalog } from "@/lib/catalog";
import NoAccess from "@/components/customers/NoAccess";
import ItemForm from "@/components/catalog/ItemForm";

export default async function NewItemPage() {
  const { current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageCatalog(current.role)) return <NoAccess />;
  return <ItemForm companyId={current.id} />;
}
