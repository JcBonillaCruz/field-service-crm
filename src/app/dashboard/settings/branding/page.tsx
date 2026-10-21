import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageSales } from "@/lib/sales";
import { loadPrefs } from "@/lib/sales-server";
import NoAccess from "@/components/customers/NoAccess";
import BrandingForm from "@/components/settings/BrandingForm";

export default async function BrandingPage() {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageSales(current.role)) return <NoAccess />;
  return <BrandingForm companyId={current.id} prefs={await loadPrefs(supabase, current.id)} company={current.name} />;
}
