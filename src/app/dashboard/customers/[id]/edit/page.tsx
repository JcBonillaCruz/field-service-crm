import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Customer, Email, Phone, canManageCustomers } from "@/lib/customers";
import CustomerForm from "@/components/customers/CustomerForm";
import NoAccess from "@/components/customers/NoAccess";

export default async function EditCustomerPage({ params }: { params: { id: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageCustomers(current.role)) return <NoAccess />;

  const { data } = await supabase
    .from("customers")
    .select("id, customer_type, first_name, last_name, company_name, display_name, email, phone, notes, created_at")
    .eq("id", params.id)
    .eq("company_id", current.id)
    .maybeSingle();
  if (!data) notFound();
  const c = data as Customer;

  const [{ data: phoneRows }, { data: emailRows }] = await Promise.all([
    supabase.from("customer_phones").select("label, country, number, is_primary").eq("customer_id", c.id).order("position"),
    supabase.from("customer_emails").select("label, email, is_primary").eq("customer_id", c.id).order("position"),
  ]);

  return (
    <section className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
      <Link href={`/dashboard/customers/${c.id}`} className="text-sm font-medium text-slate-500 hover:text-slate-800">&larr; {c.display_name}</Link>
      <h1 className="mb-6 mt-3 text-2xl font-semibold tracking-tight text-[#0b1f3a] sm:text-3xl">Edit customer</h1>
      <CustomerForm companyId={current.id} customer={c}
        initialPhones={(phoneRows ?? []) as Phone[]} initialEmails={(emailRows ?? []) as Email[]} />
    </section>
  );
}
