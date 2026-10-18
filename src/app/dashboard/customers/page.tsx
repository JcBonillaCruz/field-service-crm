import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageCustomers, cityLine } from "@/lib/customers";
import Avatar from "@/components/Avatar";
import SearchBox from "@/components/customers/SearchBox";
import NoAccess from "@/components/customers/NoAccess";
import { primaryButton } from "@/components/customers/ui";

type Row = {
  id: string;
  display_name: string;
  customer_type: "residential" | "commercial";
  phone: string | null;
  email: string | null;
  customer_addresses: { city: string; state: string | null; zip: string | null; country: string; is_primary: boolean }[];
};

export default async function CustomersPage({ searchParams }: { searchParams: { q?: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageCustomers(current.role)) return <NoAccess />;

  const q = (searchParams.q ?? "").trim();
  let query = supabase
    .from("customers")
    .select("id, display_name, customer_type, phone, email, customer_addresses ( city, state, zip, country, is_primary )")
    .eq("company_id", current.id)
    .eq("is_archived", false)
    .order("display_name")
    .limit(200);

  if (q) {
    const safe = q.replace(/[,()%*\\]/g, " ").trim();
    const digits = q.replace(/\D/g, "");
    const parts = [`display_name.ilike.%${safe}%`, `contact_search.ilike.%${safe.toLowerCase()}%`];
    if (digits.length >= 3) parts.push(`contact_search.like.%${digits}%`);
    query = query.or(parts.join(","));
  }

  const { data } = await query;
  const customers = (data ?? []) as Row[];

  return (
    <section className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#0b1f3a] sm:text-3xl">Customers</h1>
          <p className="mt-1 text-slate-500">{current.name}</p>
        </div>
        <Link href="/dashboard/customers/new" className={primaryButton}>+ New customer</Link>
      </div>

      <div className="mt-6">
        <SearchBox initial={q} />
      </div>

      {customers.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          {q ? (
            <>
              <p className="font-semibold text-[#0b1f3a]">No customers match &ldquo;{q}&rdquo;</p>
              <p className="mt-1 text-sm text-slate-500">Try a different name, phone or email.</p>
            </>
          ) : (
            <>
              <p className="font-semibold text-[#0b1f3a]">No customers yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                Add your first customer with their phone, email and service addresses.
              </p>
              <Link href="/dashboard/customers/new" className={`${primaryButton} mt-6 inline-block`}>+ New customer</Link>
            </>
          )}
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="hidden grid-cols-[2fr_1.2fr_1.6fr_1.4fr] gap-4 border-b border-slate-100 px-5 py-3 text-xs font-medium text-slate-500 md:grid">
            <span>Name</span><span>Phone</span><span>Email</span><span>Primary address</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {customers.map((c) => {
              const primary = c.customer_addresses.find((a) => a.is_primary) ?? c.customer_addresses[0];
              const more = c.customer_addresses.length - 1;
              return (
                <li key={c.id}>
                  <Link href={`/dashboard/customers/${c.id}`}
                    className="grid gap-1 px-5 py-4 hover:bg-slate-50 md:grid-cols-[2fr_1.2fr_1.6fr_1.4fr] md:items-center md:gap-4">
                    <span className="flex min-w-0 items-center gap-3">
                      <Avatar name={c.display_name} url={null} seed={c.id} size={36} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-800">{c.display_name}</span>
                        <span className="block text-xs text-slate-500">{c.customer_type === "commercial" ? "Commercial" : "Residential"}</span>
                      </span>
                    </span>
                    <span className="pl-12 text-sm text-slate-600 md:pl-0">{c.phone || <span className="text-slate-300">—</span>}</span>
                    <span className="truncate pl-12 text-sm text-slate-600 md:pl-0">{c.email || <span className="text-slate-300">—</span>}</span>
                    <span className="pl-12 text-sm text-slate-600 md:pl-0">
                      {primary ? cityLine(primary) : <span className="text-slate-300">—</span>}
                      {more > 0 && <span className="ml-1 text-xs text-slate-400">+{more} more</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
