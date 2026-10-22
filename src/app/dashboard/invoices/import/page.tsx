import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageSales } from "@/lib/sales";
import NoAccess from "@/components/customers/NoAccess";
import SalesImport from "@/components/sales/SalesImport";

export default async function ImportPage() {
  const { supabase, current, user } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageSales(current.role)) return <NoAccess />;
  const { data } = await supabase.from("customers").select("id, display_name, company_name").eq("company_id", current.id).limit(20000);
  return <SalesImport kind="invoice" companyId={current.id} actor={user.fullName || user.email} customers={data ?? []} />;
}
