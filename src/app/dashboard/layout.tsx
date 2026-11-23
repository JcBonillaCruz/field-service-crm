import AppShell from "@/components/AppShell";
import { getSession } from "@/lib/session";
import LocationPinger from "@/components/jobs/tech/LocationPinger";
import LanguageSync from "@/components/LanguageSync";
import { StatusColorsProvider } from "@/components/StatusColors";
import type { StoredPalette } from "@/lib/status-colors";
import NewJobHost from "@/components/jobs/NewJobHost";
import { canManageJobs } from "@/lib/jobs";
import { canManageSales } from "@/lib/sales";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, companies, current, language } = await getSession();
  // Paso 6.4: colores por estado de la compañía. Si la columna aún no existe (falta el SQL), se usan los de fábrica.
  let stored: StoredPalette = null;
  if (current) {
    const { data, error } = await supabase.from("job_settings").select("status_colors").eq("company_id", current.id).maybeSingle();
    if (!error) stored = ((data as { status_colors?: StoredPalette } | null)?.status_colors ?? null);
  }
  return (
    <AppShell user={user} companies={companies} currentId={current?.id ?? null}>
      <StatusColorsProvider stored={stored}>
        {children}
      </StatusColorsProvider>
      {/* Paso 5.9: comparte la ubicación solo con el día iniciado (no pinta nada) */}
      {current && <LocationPinger companyId={current.id} />}
      {/* Paso 6.5b: todos los "+ New job" abren el modal grande (Job / Quote / Time off) */}
      {current && canManageJobs(current.role) && <NewJobHost companyId={current.id} canQuote={canManageSales(current.role)} />}
      {/* Paso 6.1: en un aparato nuevo copia el idioma guardado en el perfil */}
      <LanguageSync saved={language} />
    </AppShell>
  );
}
