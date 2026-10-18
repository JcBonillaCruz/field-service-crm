import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Address, Customer, canDeleteCustomers, canManageCustomers } from "@/lib/customers";
import Avatar from "@/components/Avatar";
import AddressManager from "@/components/customers/AddressManager";
import DeleteCustomerButton from "@/components/customers/DeleteCustomerButton";
import NoAccess from "@/components/customers/NoAccess";
import { secondaryButton } from "@/components/customers/ui";

export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { warn?: string };
}) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageCustomers(current.role)) return <NoAccess />;

  const { data: customer } = await supabase
    .from("customers")
    .select("id, customer_type, first_name, last_name, company_name, display_name, email, phone, notes, created_at")
    .eq("id", params.id)
    .eq("company_id", current.id)
    .maybeSingle();

  if (!customer) notFound();
  const c = customer as Customer;

  const { data: addrRows } = await supabase
    .from("customer_addresses")
    .select("id, label, street, unit, city, state, zip, is_primary")
    .eq("customer_id", c.id)
    .order("is_primary", { ascending: false })
    .order("created_at");

  const addresses = (addrRows ?? []).map((a) => ({
    ...a,
    label: a.label ?? "",
    unit: a.unit ?? "",
    zip: a.zip ?? "",
  })) as (Address & { id: string })[];

  const contact = [c.first_name, c.last_name].filter(Boolean).join(" ");

  return (
    <section className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-10">
      <Link href="/dashboard/customers" className="text-sm font-medium text-slate-500 hover:text-slate-800">&larr; Customers</Link>

      {searchParams.warn === "addresses" && (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The customer was saved, but the addresses weren&apos;t. Add them again below.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={c.display_name} url={null} seed={c.id} size={56} />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-[#0b1f3a] sm:text-3xl">{c.display_name}</h1>
            <p className="text-sm text-slate-500">
              {c.customer_type === "commercial" ? "Commercial" : "Residential"}
              {c.customer_type === "commercial" && contact ? ` · Contact: ${contact}` : ""}
            </p>
          </div>
        </div>
        <Link href={`/dashboard/customers/${c.id}/edit`} className={secondaryButton}>Edit</Link>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="text-base font-semibold text-[#0b1f3a]">Contact</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-slate-500">Phone</dt>
                <dd className="mt-0.5">
                  {c.phone ? <a href={`tel:${c.phone.replace(/\D/g, "")}`} className="font-medium text-[#0f766e] hover:underline">{c.phone}</a> : <span className="text-slate-400">Not added</span>}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Email</dt>
                <dd className="mt-0.5 break-all">
                  {c.email ? <a href={`mailto:${c.email}`} className="font-medium text-[#0f766e] hover:underline">{c.email}</a> : <span className="text-slate-400">Not added</span>}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Customer since</dt>
                <dd className="mt-0.5 text-slate-700">
                  {new Date(c.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="text-base font-semibold text-[#0b1f3a]">Notes</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{c.notes || <span className="text-slate-400">No notes.</span>}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="mb-4 text-base font-semibold text-[#0b1f3a]">
            Service addresses <span className="font-normal text-slate-400">({addresses.length})</span>
          </h2>
          <AddressManager customerId={c.id} companyId={current.id} addresses={addresses} />
        </div>
      </div>

      {canDeleteCustomers(current.role) && (
        <div className="mt-10 border-t border-slate-200 pt-6">
          <DeleteCustomerButton id={c.id} name={c.display_name} />
        </div>
      )}
    </section>
  );
}
