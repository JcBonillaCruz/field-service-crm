import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import SettingsHub from "@/components/settings/SettingsHub";

// Inicio de Settings: todas las opciones que ya funcionan, con su explicación
export default async function SettingsPage() {
  const { current } = await getSession();
  if (!current) redirect("/dashboard");
  return <SettingsHub role={current.role} />;
}
