import AppShell from "@/components/AppShell";
import { getSession } from "@/lib/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, companies, current } = await getSession();
  return (
    <AppShell user={user} companies={companies} currentId={current?.id ?? null}>
      {children}
    </AppShell>
  );
}
