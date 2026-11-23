import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import SettingsWindow from "@/components/settings/SettingsWindow";

// Paso 6.17: todo /dashboard/settings/* se abre dentro de la ventana flotante (menú a la izquierda, pantalla a la derecha)
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { current } = await getSession();
  if (!current) redirect("/dashboard");
  return <SettingsWindow role={current.role} company={current.name}>{children}</SettingsWindow>;
}
