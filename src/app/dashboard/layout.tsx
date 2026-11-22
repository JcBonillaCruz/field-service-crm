import AppShell from "@/components/AppShell";
import { getSession } from "@/lib/session";
import LocationPinger from "@/components/jobs/tech/LocationPinger";
import LanguageSync from "@/components/LanguageSync";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, companies, current, language } = await getSession();
  return (
    <AppShell user={user} companies={companies} currentId={current?.id ?? null}>
      {children}
      {/* Paso 5.9: comparte la ubicación solo con el día iniciado (no pinta nada) */}
      {current && <LocationPinger companyId={current.id} />}
      {/* Paso 6.1: en un aparato nuevo copia el idioma guardado en el perfil */}
      <LanguageSync saved={language} />
    </AppShell>
  );
}
