import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Address, Customer, Email, Phone, canManageCustomers } from "@/lib/customers";
import CustomerForm from "@/components/customers/CustomerForm";
import NoAccess from "@/components/customers/NoAccess";

export default async function EditCustomerPage({ params }: { params: { id: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageCustomers(current.role)) return <NoAccess />;

  const { data } = await supabase
    .from("customers")
    .select("*")
    .eq("id", params.id)
    .eq("company_id", current.id)
    .maybeSingle();
  if (!data) notFound();
  const c = data as Customer;

  const [{ data: phoneRows }, { data: emailRows }, { data: addrRows }] = await Promise.all([
    supabase.from("customer_phones").select("label, country, number, is_primary").eq("customer_id", c.id).order("position"),
    supabase.from("customer_emails").select("label, email, is_primary").eq("customer_id", c.id).order("position"),
    supabase.from("customer_addresses").select("id, label, street, unit, city, state, zip, country, is_primary").eq("customer_id", c.id).order("created_at"),
  ]);

  return (
    <section className="min-h-[calc(100vh-4rem)] bg-white">
      <div className="border-b border-slate-200 px-5 py-5 sm:px-8">
        <Link prefetch={false} href={`/dashboard/customers/${c.id}`} className="text-sm font-medium text-slate-500 hover:text-slate-800">&larr; {c.display_name}</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#0b1f3a]">Edit Customer</h1>
      </div>
      <div className="px-5 pt-6 sm:px-8">
      <CustomerForm companyId={current.id} customer={c}
        initialPhones={(phoneRows ?? []) as Phone[]} initialEmails={(emailRows ?? []) as Email[]} initialAddresses={(addrRows ?? []) as Address[]} />
      </div>
    </section>
  );
}
