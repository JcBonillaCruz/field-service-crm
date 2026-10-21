import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import SettingsHub from "@/components/settings/SettingsHub";

export default async function SettingsPage() {
  const { current } = await getSession();
  if (!current) redirect("/dashboard");
  return <SettingsHub companyName={current.name} />;
}
