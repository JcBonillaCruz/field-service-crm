import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canExportCustomers, canManageCustomers, cityLine } from "@/lib/customers";
import { customerListQuery, readListParams } from "@/lib/customer-list";
import Avatar from "@/components/Avatar";
import SearchBox from "@/components/customers/SearchBox";
import NoAccess from "@/components/customers/NoAccess";
import CustomersToolbar from "@/components/customers/CustomersToolbar";
import { primaryButton } from "@/components/customers/ui";

type Row = {
  id: string;
  display_name: string;
  customer_type: "residential" | "commercial";
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  customer_addresses: { city: string; state: string | null; zip: string | null; country: string; is_primary: boolean }[];
};

const dash = <span className="text-slate-300">—</span>;
const COLS = "md:grid-cols-[2fr_1.6fr_2fr_1.3fr_1.4fr]";

export default async function CustomersPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageCustomers(current.role)) return <NoAccess />;

  const params = readListParams(searchParams);
  const { data } = await customerListQuery(
    supabase, current.id, params,
    "id, display_name, customer_type, company_name, first_name, last_name, phone, email, customer_addresses ( city, state, zip, country, is_primary )"
  ).limit(500);
  const customers = (data ?? []) as unknown as Row[];
  const filtered = Boolean(params.q) || params.view !== "all";

  return (
    <section className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
      <CustomersToolbar params={params} total={customers.length}
        canImport={canManageCustomers(current.role)} canExport={canExportCustomers(current.role)} />

      <div className="mt-6">
        <SearchBox initial={params.q} />
      </div>

      {customers.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          {filtered ? (
            <>
              <p className="font-semibold text-[#0b1f3a]">No customers found</p>
              <p className="mt-1 text-sm text-slate-500">Try a different search or view.</p>
            </>
          ) : (
            <>
              <p className="font-semibold text-[#0b1f3a]">No customers yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                Add your first customer, or bring all of them at once from a CSV file.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link href="/dashboard/customers/new" className={primaryButton}>+ New customer</Link>
                <Link href="/dashboard/customers/import"
                  className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-[15px] font-medium text-slate-700 hover:bg-slate-50">
                  Import from CSV
                </Link>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className={`hidden gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid ${COLS}`}>
            <span>Name</span><span>Company name</span><span>Email</span><span>Phone</span><span>Location</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {customers.map((c) => {
              const primary = c.customer_addresses.find((a) => a.is_primary) ?? c.customer_addresses[0];
              const more = c.customer_addresses.length - 1;
              const person = [c.first_name, c.last_name].filter(Boolean).join(" ");
              return (
                <li key={c.id}>
                  <Link href={`/dashboard/customers/${c.id}`}
                    className={`grid gap-1 px-5 py-4 transition-colors hover:bg-[#f6fbfa] md:items-center md:gap-4 ${COLS}`}>
                    <span className="flex min-w-0 items-center gap-3">
                      <Avatar name={c.display_name} url={null} seed={c.id} size={36} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-[#0f766e]">{c.customer_type === "commercial" && person ? person : c.display_name}</span>
                        <span className="block text-xs text-slate-500">{c.customer_type === "commercial" ? "Commercial" : "Residential"}</span>
                      </span>
                    </span>
                    <span className="truncate pl-12 text-sm text-slate-700 md:pl-0">{c.company_name || <span className="hidden md:inline">{dash}</span>}</span>
                    <span className="truncate pl-12 text-sm text-slate-600 md:pl-0">{c.email || <span className="hidden md:inline">{dash}</span>}</span>
                    <span className="pl-12 text-sm text-slate-600 md:pl-0">{c.phone || <span className="hidden md:inline">{dash}</span>}</span>
                    <span className="pl-12 text-sm text-slate-600 md:pl-0">
                      {primary ? cityLine({ ...primary, zip: null }) : <span className="hidden md:inline">{dash}</span>}
                      {more > 0 && <span className="ml-1 text-xs text-slate-400">+{more}</span>}
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
