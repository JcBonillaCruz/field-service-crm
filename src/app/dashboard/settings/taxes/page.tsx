import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import NoAccess from "@/components/customers/NoAccess";
import { canManageSales } from "@/lib/sales";
import { loadSurcharges, loadTaxRates } from "@/lib/tax";
import TaxRatesForm from "@/components/settings/TaxRatesForm";

export const dynamic = "force-dynamic";

// Paso 6.9: Settings → Taxes (dueño y manager editan; oficina solo ve)
export default async function TaxesPage() {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageSales(current.role)) return <NoAccess />;
  const { rates, needsSql } = await loadTaxRates(supabase, current.id);
  const surcharges = needsSql ? [] : await loadSurcharges(supabase, current.id);
  return <TaxRatesForm companyId={current.id} initial={rates} surcharges={surcharges} needsSql={needsSql}
    canEdit={current.role === "owner" || current.role === "manager"} />;
}
