import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageInventory } from "@/lib/inventory";
import NoAccess from "@/components/customers/NoAccess";
import SupplierForm from "@/components/inventory/purchasing/SupplierForm";

export const dynamic = "force-dynamic";

export default async function NewSupplierPage() {
  const { current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageInventory(current.role)) return <NoAccess />;
  return <SupplierForm companyId={current.id} />;
}
