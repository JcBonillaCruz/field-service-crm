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
import RecentLogger from "@/components/RecentLogger";

const TABS = ["Overview", "Comments", "Transactions", "Mails", "Statement"];
const MOBILE_TABS = ["Details", "Transactions", "Comments"];

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
      <RecentLogger id={c.id} name={c.display_name} />
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

      {/* Pestañas — escritorio (5) */}
      <div className="hidden lg:sticky lg:top-[65px] z-10 lg:flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 sm:px-6">
        {TABS.map((t, i) => i === 0 ? (
          <span key={t} className="whitespace-nowrap border-b-2 border-[#0f766e] px-3 py-3 text-sm font-semibold text-[#0f766e]">{t}</span>
        ) : (
          <span key={t} title="Coming soon" className="flex items-center gap-1.5 whitespace-nowrap px-3 py-3 text-sm text-slate-400">
            {t}<span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium">Soon</span>
          </span>
        ))}
      </div>
      {/* Pestañas — móvil (3, como Zoho) */}
      <div className="flex gap-2 border-b border-slate-200 bg-white px-4 lg:hidden">
        {MOBILE_TABS.map((t, i) => i === 0 ? (
          <span key={t} className="whitespace-nowrap border-b-2 border-[#0f766e] px-2 py-3 text-sm font-semibold uppercase tracking-wide text-[#0f766e]">{t}</span>
        ) : (
          <span key={t} title="Coming soon" className="flex items-center gap-1.5 whitespace-nowrap px-2 py-3 text-sm uppercase tracking-wide text-slate-400">
            {t}<span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium normal-case">Soon</span>
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
            <Accordion title="Contact" action={<PencilLink href={editHref} />}>
              {/* ===== Contacto en móvil (estilo Zoho) ===== */}
              <div className="lg:hidden">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0 1 16 0" strokeLinecap="round" /></svg>
                  </span>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate text-[17px] font-semibold text-[#0b1f3a]">{contact || c.display_name}</span>
                    <span className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-500">USD</span>
                  </div>
                </div>
                <div className="mt-3 space-y-2 pl-1 text-[15px]">
                  {primaryEmail && <a href={`mailto:${primaryEmail.email}`} className="block break-all text-slate-700">{primaryEmail.email}</a>}
                  {phones[0] && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a1 1 0 0 1-1 1A14 14 0 0 1 4 5a1 1 0 0 1 1-1z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      {phoneDisplay(phones[0])}
                    </div>
                  )}
                </div>
                <div className="mt-5 flex items-start justify-around gap-2 border-t border-slate-100 pt-5">
                  <CallButton label="Mobile" href={callMobile ? phoneHref(callMobile) : undefined} kind="mobile" />
                  <CallButton label="Work Phone" href={callWork ? phoneHref(callWork) : undefined} kind="phone" />
                  <CallButton label="Email" href={primaryEmail ? `mailto:${primaryEmail.email}` : undefined} kind="mail" />
                </div>
              </div>

              {/* ===== Contacto en escritorio (como ya estaba) ===== */}
              <dl className="hidden space-y-3 text-sm lg:block">
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

const ICONS: Record<string, React.ReactNode> = {
  mobile: <><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M10.5 18.5h3" strokeLinecap="round" /></>,
  phone: <path d="M5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a1 1 0 0 1-1 1A14 14 0 0 1 4 5a1 1 0 0 1 1-1z" strokeLinecap="round" strokeLinejoin="round" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" strokeLinecap="round" strokeLinejoin="round" /></>,
};

function CallButton({ label, href, kind }: { label: string; href?: string; kind: "mobile" | "phone" | "mail" }) {
  const inner = (
    <>
      <span className={`flex h-14 w-14 items-center justify-center rounded-full transition-transform ${href ? "bg-[#0f766e] text-white shadow-sm shadow-[#0f766e]/30 active:scale-95" : "bg-[#e9f7f4] text-[#a9ddd4]"}`}>
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">{ICONS[kind]}</svg>
      </span>
      <span className={`text-[13px] font-medium ${href ? "text-[#0f766e]" : "text-[#a9ddd4]"}`}>{label}</span>
    </>
  );
  const box = "flex flex-1 flex-col items-center gap-2";
  return href ? <a href={href} className={box}>{inner}</a> : <div className={box}>{inner}</div>;
}
