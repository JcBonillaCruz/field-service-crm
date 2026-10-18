import Link from "next/link";
import CreateCompanyForm from "@/components/CreateCompanyForm";
import { getSession } from "@/lib/session";
import { ROLE_LABEL } from "@/lib/types";

const MODULES: { title: string; text: string; href?: string }[] = [
  { title: "Customers", text: "Contacts, service addresses and history", href: "/dashboard/customers" },
  { title: "Quotes & contracts", text: "Signed on the customer's phone" },
  { title: "Invoices", text: "Send, track and get paid" },
  { title: "Van inventory", text: "Stock per van with low-stock alerts" },
  { title: "Dispatch", text: "Calendar, crew and job timer" },
  { title: "Team", text: "Invite office staff and technicians" },
];

export default async function DashboardPage() {
  const { current, firstName } = await getSession();

  if (!current) {
    return (
      <section className="mx-auto max-w-lg px-5 py-12 sm:py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-[#0b1f3a]">Welcome, {firstName}</h1>
        <p className="mt-2 text-slate-500">Let&apos;s set up your first company.</p>
        <div className="mt-8 rounded-2xl bg-white p-6 shadow-[0_12px_40px_rgba(15,40,60,0.06)] sm:p-8">
          <h2 className="text-lg font-semibold text-[#0b1f3a]">Create your first company</h2>
          <p className="mb-6 mt-1 text-sm text-slate-500">
            Each company keeps its own customers, invoices and inventory. You can add more later.
          </p>
          <CreateCompanyForm />
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-12">
      <p className="text-sm font-medium text-[#0f766e]">{current.industry ?? "Business"}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#0b1f3a] sm:text-3xl">{current.name}</h1>
      <p className="mt-2 text-slate-500">
        Hello, {firstName}. You&apos;re signed in as {ROLE_LABEL[current.role].toLowerCase()} of this company.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) =>
          m.href ? (
            <Link key={m.title} href={m.href}
              className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-[#14a39a]">
              <p className="font-semibold text-[#0b1f3a]">{m.title}</p>
              <p className="mt-1 text-sm text-slate-500">{m.text}</p>
              <p className="mt-4 text-xs font-semibold text-[#0f766e]">Open</p>
            </Link>
          ) : (
            <div key={m.title} className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="font-semibold text-[#0b1f3a]">{m.title}</p>
              <p className="mt-1 text-sm text-slate-500">{m.text}</p>
              <p className="mt-4 text-xs text-slate-400">Coming soon</p>
            </div>
          )
        )}
      </div>
    </section>
  );
}
