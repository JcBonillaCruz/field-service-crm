import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import NoAccess from "@/components/customers/NoAccess";
import StatusColorsForm from "@/components/settings/StatusColorsForm";
import type { StoredPalette } from "@/lib/status-colors";

export const dynamic = "force-dynamic";

// Paso 6.4: colores por estado (dueño y manager, igual que Job settings)
export default async function StatusColorsPage() {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (current.role !== "owner" && current.role !== "manager") return <NoAccess />;
  let row = await supabase.from("job_settings").select("status_colors").eq("company_id", current.id).maybeSingle();
  // Compañía sin ajustes de trabajos todavía: se crean (igual que al abrir Jobs)
  if (!row.error && !row.data) {
    await supabase.rpc("job_ensure_setup", { p_company: current.id });
    row = await supabase.from("job_settings").select("status_colors").eq("company_id", current.id).maybeSingle();
  }
  const stored = row.error ? null : ((row.data as { status_colors?: StoredPalette } | null)?.status_colors ?? null);
  return <StatusColorsForm companyId={current.id} stored={stored} />;
}
