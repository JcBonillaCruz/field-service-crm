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
    <section className="min-h-[calc(100vh-4rem)] bg-white">
      <div className="border-b border-slate-200 px-5 py-5 sm:px-8">
        <Link prefetch={false} href="/dashboard/customers" className="text-sm font-medium text-slate-500 hover:text-slate-800">&larr; Customers</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#0b1f3a]">New Customer</h1>
      </div>
      <div className="px-5 pt-6 sm:px-8">
        <CustomerForm companyId={current.id} />
      </div>
    </section>
  );
}
