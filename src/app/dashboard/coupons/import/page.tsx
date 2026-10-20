import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageCatalog } from "@/lib/catalog";
import NoAccess from "@/components/customers/NoAccess";
import CatalogImport from "@/components/catalog/CatalogImport";

export default async function ImportCouponsPage() {
  const { current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageCatalog(current.role)) return <NoAccess />;
  return <CatalogImport module="coupons" companyId={current.id} />;
}
