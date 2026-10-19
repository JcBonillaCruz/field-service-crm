import CreateCompanyForm from "@/components/CreateCompanyForm";
import { getSession } from "@/lib/session";
import Dashboard from "@/components/dashboard/Dashboard";

const TRIAL_DAYS = 14;

export default async function DashboardPage() {
  const { supabase, current, firstName } = await getSession();

  if (!current) {
    return (
      <section className="mx-auto max-w-lg px-5 py-12 sm:py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-[#0b1f3a]">Welcome, {firstName}</h1>
        <p className="mt-2 text-slate-500">Let&apos;s set up your first company.</p>
        <div className="mt-8 rounded-2xl bg-white p-6 shadow-[0_12px_40px_rgba(15,40,60,0.06)] sm:p-8">
          <h2 className="text-lg font-semibold text-[#0b1f3a]">Create your first company</h2>
          <p className="mb-6 mt-1 text-sm text-slate-500">Each company keeps its own customers, invoices and inventory. You can add more later.</p>
          <CreateCompanyForm />
        </div>
      </section>
    );
  }

  // Datos reales que sí tenemos hoy: clientes
  const { data: typeRows } = await supabase
    .from("customers")
    .select("customer_type")
    .eq("company_id", current.id)
    .eq("is_archived", false);
  const rows = typeRows ?? [];
  const counts = {
    total: rows.length,
    commercial: rows.filter((r) => r.customer_type === "commercial").length,
    residential: rows.filter((r) => r.customer_type === "residential").length,
  };
  const daysLeft = Math.max(0, TRIAL_DAYS - Math.floor((Date.now() - new Date(current.createdAt).getTime()) / 86400000));

  return (
    <Dashboard
      firstName={firstName ?? "there"}
      companyName={current.name}
      industry={current.industry ?? "Business"}
      role={current.role}
      counts={counts}
      daysLeft={daysLeft}
    />
  );
}
