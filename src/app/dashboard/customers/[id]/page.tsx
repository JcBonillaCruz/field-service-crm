import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Address, Customer, canDeleteCustomers, canManageCustomers, phoneDisplay, phoneHref } from "@/lib/customers";
import Avatar from "@/components/Avatar";
import AddressManager from "@/components/customers/AddressManager";
import DeleteCustomerButton from "@/components/customers/DeleteCustomerButton";
import NoAccess from "@/components/customers/NoAccess";
import CustomerDetailActions from "@/components/customers/CustomerDetailActions";

const TABS = ["Overview", "Comments", "Transactions", "Mails", "Statement"];

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

  const [{ data: addrRows }, { data: phoneRows }, { data: emailRows }] = await Promise.all([
    supabase.from("customer_addresses").select("id, label, street, unit, city, state, zip, country, is_primary")
      .eq("customer_id", c.id).order("is_primary", { ascending: false }).order("created_at"),
    supabase.from("customer_phones").select("id, label, country, dial_code, number, is_primary").eq("customer_id", c.id).order("position"),
    supabase.from("customer_emails").select("id, label, email, is_primary").eq("customer_id", c.id).order("position"),
  ]);
  const phones = phoneRows ?? [];
  const emails = emailRows ?? [];
  const addresses = (addrRows ?? []).map((a) => ({
    ...a, label: a.label ?? "", unit: a.unit ?? "", zip: a.zip ?? "", state: a.state ?? "", country: a.country ?? "US",
  })) as (Address & { id: string })[];

  const contact = [c.first_name, c.last_name].filter(Boolean).join(" ");

  return (
    <div className="flex min-h-full flex-col">
      {/* Barra de la ficha: nombre, acciones y cerrar */}
      <div className="lg:sticky lg:top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/dashboard/customers" aria-label="Back to customers"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 15 7 10l5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
          <Avatar name={c.display_name} url={null} seed={c.id} size={40} />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-[#0b1f3a] sm:text-xl">{c.display_name}</h1>
            <p className="truncate text-xs text-slate-500">
              {c.customer_type === "commercial" ? "Commercial" : "Residential"}{c.customer_type === "commercial" && contact ? ` · ${contact}` : ""}
            </p>
          </div>
        </div>
        <CustomerDetailActions customerId={c.id} />
      </div>

      {/* Pestañas (por ahora solo Overview; las demás llegan con facturas y correos) */}
      <div className="lg:sticky lg:top-[65px] z-10 flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 sm:px-6">
        {TABS.map((t, i) => (
          i === 0 ? (
            <span key={t} className="whitespace-nowrap border-b-2 border-[#0f766e] px-3 py-3 text-sm font-semibold text-[#0f766e]">{t}</span>
          ) : (
            <span key={t} title="Coming soon" className="flex items-center gap-1.5 whitespace-nowrap px-3 py-3 text-sm text-slate-400">
              {t}<span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium">Soon</span>
            </span>
          )
        ))}
      </div>

      <div className="flex-1 px-4 py-6 sm:px-6">
        {searchParams.warn === "addresses" && (
          <p className="mb-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">The customer was saved, but the addresses weren&apos;t. Add them again below.</p>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <h2 className="text-base font-semibold text-[#0b1f3a]">Contact</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-slate-500">{phones.length > 1 ? "Phones" : "Phone"}</dt>
                  {phones.length === 0 && <dd className="mt-0.5 text-slate-400">Not added</dd>}
                  {phones.map((p) => (
                    <dd key={p.id} className="mt-1 flex flex-wrap items-center gap-x-2">
                      <a href={phoneHref(p)} className="font-medium text-[#0f766e] hover:underline">{phoneDisplay(p)}</a>
                      <span className="text-xs text-slate-500">{p.label}</span>
                      {p.is_primary && phones.length > 1 && <span className="rounded-full bg-[#d6f3ec] px-2 py-0.5 text-[11px] font-medium text-[#0f766e]">Primary</span>}
                    </dd>
                  ))}
                </div>
                <div>
                  <dt className="text-slate-500">{emails.length > 1 ? "Emails" : "Email"}</dt>
                  {emails.length === 0 && <dd className="mt-0.5 text-slate-400">Not added</dd>}
                  {emails.map((e) => (
                    <dd key={e.id} className="mt-1 flex flex-wrap items-center gap-x-2">
                      <a href={`mailto:${e.email}`} className="break-all font-medium text-[#0f766e] hover:underline">{e.email}</a>
                      <span className="text-xs text-slate-500">{e.label}</span>
                      {e.is_primary && emails.length > 1 && <span className="rounded-full bg-[#d6f3ec] px-2 py-0.5 text-[11px] font-medium text-[#0f766e]">Primary</span>}
                    </dd>
                  ))}
                </div>
                <div>
                  <dt className="text-slate-500">Customer since</dt>
                  <dd className="mt-0.5 text-slate-700">{new Date(c.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <h2 className="text-base font-semibold text-[#0b1f3a]">Notes</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{c.notes || <span className="text-slate-400">No notes.</span>}</p>
            </div>

            {canDeleteCustomers(current.role) && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <DeleteCustomerButton id={c.id} name={c.display_name} />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="mb-4 text-base font-semibold text-[#0b1f3a]">
              Service addresses <span className="font-normal text-slate-400">({addresses.length})</span>
            </h2>
            <AddressManager customerId={c.id} companyId={current.id} addresses={addresses} />
          </div>
        </div>
      </div>
    </div>
  );
}
