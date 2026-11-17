import { redirect } from "next/navigation";
import NoCompanyWelcome from "@/components/NoCompanyWelcome";
import { getSession } from "@/lib/session";
import Dashboard from "@/components/dashboard/Dashboard"; // finanzas en el celular (sin cambios)
import DesktopDashboard from "@/components/dashboard/DesktopDashboard"; // finanzas en la computadora (sin cambios)
import HomeTabs from "@/components/home/HomeTabs";
import JobsDashboard from "@/components/home/JobsDashboard";
import { loadDashboard } from "@/lib/dashboard-server";
import { loadJobBasics } from "@/lib/jobs-server";
import { buildRevenue, loadHomeAlerts } from "@/lib/home-dashboard";
import { canManageSales } from "@/lib/sales";

export const dynamic = "force-dynamic";
const TRIAL_DAYS = 14;

// Inicio (Paso 5.3f): primero los trabajos y las alertas de todas las apps.
//   · Dashboard → dueño, manager y oficina
//   · Finances  → solo dueño y manager (el dashboard de finanzas de antes, tal cual)
//   · Ingresos dentro del Dashboard → solo el dueño
export default async function DashboardPage({ searchParams }: { searchParams?: { demo?: string } }) {
  const { supabase, current, firstName, companies } = await getSession();

  if (!current) {
    // ¿Lo invitaron a alguna compañía? (técnicos, oficina…) → se une en vez de crear una
    const { data: invites } = await supabase.rpc("my_pending_invites");
    return <NoCompanyWelcome firstName={firstName} invites={(invites ?? []) as { token: string; company_name: string; role: string; invited_by_name: string | null }[]} />;
  }

  // El técnico no ve finanzas: va directo a su van (igual que antes)
  if (current.role === "technician") redirect("/dashboard/inventory/van");

  const owner = current.role === "owner";
  const canFinance = owner || current.role === "manager";

  const [basics, alerts, dash, typeRows] = await Promise.all([
    loadJobBasics(supabase, current.id),
    loadHomeAlerts(supabase, current.id, { finances: false, inventory: true }).catch(() => []),
    canFinance ? loadDashboard(supabase, current.id).catch(() => null) : Promise.resolve(null),
    canFinance ? supabase.from("customers").select("customer_type").eq("company_id", current.id).eq("is_archived", false) : Promise.resolve({ data: [] }),
  ]);
  const rows = (typeRows.data ?? []) as { customer_type: string | null }[];
  const counts = {
    total: rows.length,
    commercial: rows.filter((r) => r.customer_type === "commercial").length,
    residential: rows.filter((r) => r.customer_type === "residential").length,
  };
  const daysLeft = Math.max(0, TRIAL_DAYS - Math.floor((Date.now() - new Date(current.createdAt).getTime()) / 86400000));
  const companyIndex = Math.max(0, companies.indexOf(current));
  const weekStartsOn = basics.settings.week_starts_on;

  return (
    <HomeTabs
      firstName={firstName || "there"}
      companyId={current.id}
      companyName={current.name}
      companyIndex={companyIndex}
      canFinance={canFinance}
      canAddCustomer={canManageSales(current.role)}
      dashboard={
        <JobsDashboard
          companyId={current.id}
          team={basics.team}
          weekStartsOn={weekStartsOn}
          canSeePrice={canFinance}
          revenue={owner && dash ? buildRevenue(dash.data, weekStartsOn) : null}
          alerts={alerts}
        />
      }
      financesDesktop={canFinance ? (
        <DesktopDashboard firstName={firstName || "there"} companyId={current.id} companyName={current.name} companyIndex={companyIndex}
          demo={searchParams?.demo === "1"} real={dash?.data ?? null} stats={dash?.mobile ?? null} embedded />
      ) : null}
      financesMobile={canFinance ? (
        <Dashboard firstName={firstName ?? "there"} companyName={current.name} industry={current.industry ?? "Business"} role={current.role}
          counts={counts} daysLeft={daysLeft} stats={dash?.mobile ?? null} embedded />
      ) : null}
    />
  );
}
