import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageJobs } from "@/lib/jobs";
import { loadCustomerOptions, loadJobBasics } from "@/lib/jobs-server";
import { canManageSales } from "@/lib/sales";
import NoAccess from "@/components/customers/NoAccess";
import ScheduleBoard from "@/components/jobs/ScheduleBoard";
import JobsNeedSql from "@/components/jobs/JobsNeedSql";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageJobs(current.role)) return <NoAccess />;
  // Paso 6.5: el modal de "New" abre al instante (clientes, etiquetas y plantillas ya vienen cargados)
  const [data, customers] = await Promise.all([loadJobBasics(supabase, current.id), loadCustomerOptions(supabase, current.id)]);
  if (data.needsSql) return <JobsNeedSql />;
  return <ScheduleBoard companyId={current.id} settings={data.settings} types={data.types} team={data.team} canSeeMoney
    tags={data.tags} templates={data.templates} customers={customers} canQuote={canManageSales(current.role)} />;
}
