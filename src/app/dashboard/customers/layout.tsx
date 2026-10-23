import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canExportCustomers, canManageCustomers } from "@/lib/customers";
import { ListRow } from "@/lib/customer-list";
import NoAccess from "@/components/customers/NoAccess";
import CustomersWorkspace from "@/components/customers/CustomersWorkspace";

export default async function CustomersLayout({ children }: { children: React.ReactNode }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageCustomers(current.role)) return <NoAccess />;

  const { data } = await supabase
    .from("customers")
    .select("id, display_name, customer_type, company_name, first_name, last_name, phone, email, contact_search, created_at, customer_addresses ( city, state, country, is_primary )")
    .eq("company_id", current.id)
    .eq("is_archived", false)
    .order("display_name")
    .limit(1000);

  return (
    <CustomersWorkspace
      customers={(data ?? []) as unknown as ListRow[]}
      canImport={canManageCustomers(current.role)}
      canExport={canExportCustomers(current.role)}
    >
      {children}
    </CustomersWorkspace>
  );
}
