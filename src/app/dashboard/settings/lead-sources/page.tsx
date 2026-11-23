import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import NoAccess from "@/components/customers/NoAccess";
import { canManageCustomers } from "@/lib/customers";
import { loadLeadSources } from "@/lib/lead-sources";
import LeadSourcesForm from "@/components/settings/LeadSourcesForm";

export const dynamic = "force-dynamic";

// Paso 6.8: Settings → Lead sources (dueño, manager y oficina)
export default async function LeadSourcesPage() {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageCustomers(current.role)) return <NoAccess />;
  const { list, needsSql } = await loadLeadSources(supabase, current.id);
  // Cuántos clientes tiene cada fuente
  const counts: Record<string, number> = {};
  if (!needsSql) {
    const { data } = await supabase.from("customers").select("lead_source_id").eq("company_id", current.id).not("lead_source_id", "is", null).limit(20000);
    for (const r of (data ?? []) as { lead_source_id: string }[]) counts[r.lead_source_id] = (counts[r.lead_source_id] ?? 0) + 1;
  }
  return <LeadSourcesForm companyId={current.id} initial={list} counts={counts} needsSql={needsSql} />;
}
