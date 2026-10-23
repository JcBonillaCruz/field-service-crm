import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canExportCustomers, canManageCustomers } from "@/lib/customers";
import { canManageSales } from "@/lib/sales";
import { ListRow } from "@/lib/customer-list";
import NoAccess from "@/components/customers/NoAccess";
import CustomersWorkspace from "@/components/customers/CustomersWorkspace";

export default async function CustomersLayout({ children }: { children: React.ReactNode }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageCustomers(current.role)) return <NoAccess />;

  // Clientes + lo que cada uno te debe (en vivo, sin caché: es dinero) — las dos consultas en paralelo
  const [{ data }, { data: open }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, display_name, customer_type, company_name, first_name, last_name, phone, email, contact_search, created_at, customer_addresses ( city, state, country, is_primary )")
      .eq("company_id", current.id)
      .eq("is_archived", false)
      .order("display_name")
      .limit(1000),
    canManageSales(current.role)
      ? supabase.from("sales_docs").select("customer_id, total, amount_paid, written_off")
          .eq("company_id", current.id).eq("kind", "invoice").not("status", "in", "(draft,void,written_off)").not("customer_id", "is", null).limit(10000)
      : Promise.resolve({ data: [] as { customer_id: string; total: number; amount_paid: number; written_off: number }[] }),
  ]);
  // Por cliente: lo pendiente de cobro y el crédito a favor (si pagó de más)
  const money: Record<string, { receivable: number; credit: number }> = {};
  for (const d of open ?? []) {
    const bal = Math.round((Number(d.total) - Number(d.amount_paid) - Number(d.written_off)) * 100) / 100;
    const m = (money[d.customer_id as string] ??= { receivable: 0, credit: 0 });
    if (bal > 0) m.receivable += bal; else if (bal < 0) m.credit += -bal;
  }

  return (
    <CustomersWorkspace
      customers={(data ?? []) as unknown as ListRow[]}
      money={money}
      canImport={canManageCustomers(current.role)}
      canExport={canExportCustomers(current.role)}
    >
      {children}
    </CustomersWorkspace>
  );
}
