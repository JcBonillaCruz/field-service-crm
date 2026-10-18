import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageCustomers } from "@/lib/customers";
import CustomerForm from "@/components/customers/CustomerForm";
import NoAccess from "@/components/customers/NoAccess";

export default async function NewCustomerPage() {
  const { current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageCustomers(current.role)) return <NoAccess />;

  return (
    <section className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
      <Link href="/dashboard/customers" className="text-sm font-medium text-slate-500 hover:text-slate-800">&larr; Customers</Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#0b1f3a] sm:text-3xl">New customer</h1>
      <p className="mb-6 mt-1 text-slate-500">For {current.name}</p>
      <CustomerForm companyId={current.id} />
    </section>
  );
}
