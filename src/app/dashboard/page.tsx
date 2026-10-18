import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import CreateCompanyForm from "@/components/CreateCompanyForm";
import { COMPANY_COOKIE, CompanySummary, ROLE_LABEL, Role } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .single();

  const { data: rows } = await supabase
    .from("company_members")
    .select("role, companies ( id, name, industry, created_at )")
    .eq("user_id", user.id)
    .eq("is_active", true);

  type Row = { role: Role; companies: { id: string; name: string; industry: string | null; created_at: string } | null };
  const companies: CompanySummary[] = ((rows ?? []) as unknown as Row[])
    .filter((r) => r.companies)
    .sort((a, b) => a.companies!.created_at.localeCompare(b.companies!.created_at))
    .map((r) => ({ id: r.companies!.id, name: r.companies!.name, industry: r.companies!.industry, role: r.role }));

  const saved = cookies().get(COMPANY_COOKIE)?.value;
  const current = companies.find((c) => c.id === saved) ?? companies[0] ?? null;

  const fullName = profile?.full_name || "";
  const firstName = (fullName || user.email || "").split(" ")[0];

  return (
    <AppShell
      user={{ id: user.id, email: user.email ?? "", fullName, avatarUrl: profile?.avatar_url ?? null }}
      companies={companies}
      currentId={current?.id ?? null}
    >

      {!current ? (
        <section className="mx-auto max-w-lg px-6 py-16">
          <h1 className="text-3xl font-semibold tracking-tight text-[#0b1f3a]">Welcome, {firstName}</h1>
          <p className="mt-2 text-slate-500">Let&apos;s set up your first company.</p>
          <div className="mt-8 rounded-2xl bg-white p-8 shadow-[0_12px_40px_rgba(15,40,60,0.06)]">
            <h2 className="text-lg font-semibold text-[#0b1f3a]">Create your first company</h2>
            <p className="mt-1 mb-6 text-sm text-slate-500">
              Each company keeps its own customers, invoices and inventory. You can add more later.
            </p>
            <CreateCompanyForm />
          </div>
        </section>
      ) : (
        <section className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-12">
          <p className="text-sm font-medium text-[#0f766e]">{current.industry ?? "Business"}</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight text-[#0b1f3a]">{current.name}</h1>
          <p className="mt-2 text-slate-500">
            Hello, {firstName}. You&apos;re signed in as {ROLE_LABEL[current.role].toLowerCase()} of this company.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Customers", "Contacts, service addresses and history"],
              ["Quotes & contracts", "Signed on the customer's phone"],
              ["Invoices", "Send, track and get paid"],
              ["Van inventory", "Stock per van with low-stock alerts"],
              ["Dispatch", "Calendar, crew and job timer"],
              ["Team", "Invite office staff and technicians"],
            ].map(([title, text]) => (
              <div key={title} className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="font-semibold text-[#0b1f3a]">{title}</p>
                <p className="mt-1 text-sm text-slate-500">{text}</p>
                <p className="mt-4 text-xs text-slate-400">Coming soon</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
