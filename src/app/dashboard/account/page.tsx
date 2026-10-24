import { getSession } from "@/lib/session";
import AccountSettings from "@/components/account/AccountSettings";

// Mi cuenta: datos personales, foto, correo, contraseña, organizaciones y borrar cuenta
export default async function AccountPage() {
  const { user, companies, current } = await getSession();
  return <AccountSettings user={user} companies={companies} currentId={current?.id ?? null} />;
}
