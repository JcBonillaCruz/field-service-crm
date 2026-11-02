import { redirect } from "next/navigation";
import NoCompanyWelcome from "@/components/NoCompanyWelcome";
import { getSession } from "@/lib/session";
import Dashboard from "@/components/dashboard/Dashboard"; // celular (sin cambios)
import DesktopDashboard from "@/components/dashboard/DesktopDashboard"; // computadora
import { loadDashboard } from "@/lib/dashboard-server";

const TRIAL_DAYS = 14;

export default async function DashboardPage({ searchParams }: { searchParams?: { demo?: string } }) {
  const { supabase, current, firstName, companies } = await getSession();

  if (!current) {
    // ¿Lo invitaron a alguna compañía? (técnicos, oficina…) → se une en vez de crear una
    const { data: invites } = await supabase.rpc("my_pending_invites");
    return <NoCompanyWelcome firstName={firstName} invites={(invites ?? []) as { token: string; company_name: string; role: string; invited_by_name: string | null }[]} />;
  }

  // El técnico no ve finanzas: va directo a su van
  if (current.role === "technician") redirect("/dashboard/inventory/van");

  // Clientes y Ventas en paralelo (antes uno esperaba al otro)
  const [{ data: typeRows }, dash] = await Promise.all([
    supabase.from("customers").select("customer_type").eq("company_id", current.id).eq("is_archived", false),
    loadDashboard(supabase, current.id).catch(() => null),
  ]);
  const rows = typeRows ?? [];
  const counts = {
    total: rows.length,
    commercial: rows.filter((r) => r.customer_type === "commercial").length,
    residential: rows.filter((r) => r.customer_type === "residential").length,
  };
  const daysLeft = Math.max(0, TRIAL_DAYS - Math.floor((Date.now() - new Date(current.createdAt).getTime()) / 86400000));

  return (
    <>
      {/* Celular y tablet: diseño móvil (igual que antes) */}
      <div className="lg:hidden">
        <Dashboard
          firstName={firstName ?? "there"}
          companyName={current.name}
          industry={current.industry ?? "Business"}
          role={current.role}
          counts={counts}
          daysLeft={daysLeft}
          stats={dash?.mobile ?? null}
        />
      </div>
      {/* Computadora (1024 px o más): diseño tipo Zoho. Con ?demo=1 muestra datos de ejemplo */}
      <div className="hidden lg:block">
        <DesktopDashboard
          firstName={firstName || "there"}
          companyId={current.id}
          companyName={current.name}
          companyIndex={Math.max(0, companies.indexOf(current))}
          demo={searchParams?.demo === "1"}
          real={dash?.data ?? null}
          stats={dash?.mobile ?? null}
        />
      </div>
    </>
  );
}
