import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import QrStudio from "@/components/tools/QrStudio";

export default async function QrPage() {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  const { data: p } = await supabase.from("sales_prefs").select("logo_url, org_info").eq("company_id", current.id).maybeSingle();
  const org = (p?.org_info ?? {}) as Record<string, string>;
  return <QrStudio company={current.name} logoUrl={p?.logo_url ?? null} phone={org.phone ?? ""} website={org.website ?? ""} />;
}
