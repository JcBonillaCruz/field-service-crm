import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Item, canManageCatalog } from "@/lib/catalog";
import { loadViews } from "@/lib/catalog-server";
import NoAccess from "@/components/customers/NoAccess";
import CatalogWorkspace from "@/components/catalog/CatalogWorkspace";

export default async function ItemsLayout({ children }: { children: React.ReactNode }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageCatalog(current.role)) return <NoAccess />;
  const [{ data }, views] = await Promise.all([
    supabase.from("items").select("*").eq("company_id", current.id).order("created_at", { ascending: false }).limit(5000),
    loadViews(supabase, current.id, "items"),
  ]);
  return (
    <CatalogWorkspace module="items" rows={(data ?? []) as Item[]} customViews={views} companyId={current.id}>
      {children}
    </CatalogWorkspace>
  );
}
