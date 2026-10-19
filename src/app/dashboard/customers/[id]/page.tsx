import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Address, Customer, canDeleteCustomers, canManageCustomers, phoneDisplay, phoneHref } from "@/lib/customers";
import Avatar from "@/components/Avatar";
import AddressManager from "@/components/customers/AddressManager";
import DeleteCustomerButton from "@/components/customers/DeleteCustomerButton";
import NoAccess from "@/components/customers/NoAccess";
import CustomerDetailActions from "@/components/customers/CustomerDetailActions";
import Accordion, { PencilLink } from "@/components/customers/Accordion";

const TABS = ["Overview", "Comments", "Transactions", "Mails", "Statement"];

export default async function CustomerPage({
  params, searchParams,
}: {
  params: { id: string };
  searchParams: { warn?: string };
}) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageCustomers(current.role)) return <NoAccess />;

  const { data: customer } = await supabase
    .from("customers")
    .select("id, customer_type, salutation, first_name, last_name, company_name, display_name, email, phone, notes, created_at")
    .eq("id", params.id).eq("company_id", current.id).maybeSingle();

  if (!customer) notFound();
  const c = customer as Customer;
  const editHref = `/dashboard/customers/${c.id}/edit`;

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

  const contact = [c.salutation, c.first_name, c.last_name].filter(Boolean).join(" ");
  const callMobile = phones.find((p) => /mobile|cell|celular|m[oó]vil/i.test(p.label));
  const callWork = phones.find((p) => p !== callMobile && /office|work|main|trabajo|oficina/i.test(p.label)) ?? phones.find((p) => p !== callMobile) ?? null;
  const primaryEmail = emails.find((e) => e.is_primary) ?? emails[0] ?? null;
  const since = new Date(c.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const sinceShort = new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="flex min-h-full flex-col">
      {/* Barra de la ficha */}
      <div className="lg:sticky lg:top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/dashboard/customers" aria-label="Back to customers" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden">
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

      {/* Pestañas */}
      <div className="lg:sticky lg:top-[65px] z-10 flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 sm:px-6">
        {TABS.map((t, i) => i === 0 ? (
          <span key={t} className="whitespace-nowrap border-b-2 border-[#0f766e] px-3 py-3 text-sm font-semibold text-[#0f766e]">{t}</span>
        ) : (
          <span key={t} title="Coming soon" className="flex items-center gap-1.5 whitespace-nowrap px-3 py-3 text-sm text-slate-400">
            {t}<span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium">Soon</span>
          </span>
        ))}
      </div>

      <div className="flex-1 px-4 py-6 sm:px-6">
        {searchParams.warn === "addresses" && (
          <p className="mb-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">The customer was saved, but the addresses weren&apos;t. Add them again below.</p>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(340px,400px)_1fr]">
          {/* IZQUIERDA: info del cliente en acordeones */}
          <div className="space-y-5">
            {/* Acciones rápidas (solo móvil) */}
            <div className="grid grid-cols-3 gap-3 lg:hidden">
              <CallButton label="Mobile" href={callMobile ? phoneHref(callMobile) : undefined}
                icon="M7 2h6a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm3 13.5h0" />
              <CallButton label="Work phone" href={callWork ? phoneHref(callWork) : undefined}
                icon="M5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a1 1 0 0 1-1 1A14 14 0 0 1 4 5a1 1 0 0 1 1-1z" />
              <CallButton label="Email" href={primaryEmail ? `mailto:${primaryEmail.email}` : undefined}
                icon="M3 5h18v14H3zM3 6l9 7 9-7" />
            </div>

            <Accordion title="Contact" action={<PencilLink href={editHref} />}>
              <dl className="space-y-3 text-sm">
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
              </dl>
            </Accordion>

            <Accordion title="Service addresses" count={addresses.length}>
              <AddressManager customerId={c.id} companyId={current.id} addresses={addresses} />
            </Accordion>

            <Accordion title="Notes" action={<PencilLink href={editHref} />}>
              <p className="whitespace-pre-wrap text-sm text-slate-600">{c.notes || <span className="text-slate-400">No notes.</span>}</p>
            </Accordion>

            <Accordion title="Details" defaultOpen={false} action={<PencilLink href={editHref} />}>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-slate-500">Customer type</dt><dd className="text-slate-700">{c.customer_type === "commercial" ? "Commercial" : "Residential"}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-slate-500">Customer since</dt><dd className="text-slate-700">{since}</dd></div>
              </dl>
            </Accordion>

            {canDeleteCustomers(current.role) && (
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 sm:px-6">
                <DeleteCustomerButton id={c.id} name={c.display_name} />
              </div>
            )}
          </div>

          {/* DERECHA: historial de actividad */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="text-base font-semibold text-[#0b1f3a]">Activity</h2>
            <ol className="mt-5 space-y-5">
              <li className="relative flex gap-4 pl-1">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#14a39a] ring-4 ring-[#e9f7f4]" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#0b1f3a]">Customer created</p>
                  <p className="text-xs text-slate-500">{sinceShort}</p>
                </div>
              </li>
            </ol>
            <div className="mt-6 rounded-xl bg-[#f6fbfa] px-4 py-5 text-center">
              <p className="text-sm text-slate-500">Quotes, invoices and payments for this customer will show up here once you start creating them.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CallButton({ label, href, icon }: { label: string; href?: string; icon: string }) {
  const inner = (
    <>
      <span className={`flex h-12 w-12 items-center justify-center rounded-full ${href ? "bg-[#0f766e] text-white shadow-sm" : "bg-slate-100 text-slate-300"}`}>
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d={icon} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className={`text-xs font-medium ${href ? "text-[#0f766e]" : "text-slate-400"}`}>{label}</span>
    </>
  );
  const box = "flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white py-4";
  return href ? <a href={href} className={`${box} active:bg-slate-50`}>{inner}</a> : <div className={box}>{inner}</div>;
}
