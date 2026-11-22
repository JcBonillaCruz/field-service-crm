import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageJobs } from "@/lib/jobs";
import Confirmations from "@/components/jobs/Confirmations";
import { ConfState, loadConfirmations } from "@/lib/confirmations";

import { getTranslations } from "next-intl/server";
export const dynamic = "force-dynamic";

// Paso 5.8b · Confirmaciones: las próximas visitas y qué respondió cada cliente, sin entrar trabajo por trabajo
export default async function ConfirmationsPage({ searchParams }: { searchParams?: { show?: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageJobs(current.role)) redirect("/dashboard/jobs/mine");
  const [rows, { data: s }] = await Promise.all([
    loadConfirmations(supabase, current.id, 14),
    supabase.from("job_settings").select("*").eq("company_id", current.id).maybeSingle(),
  ]);
  const t = await getTranslations("conf");
  if (!rows) return (
    <section className="mx-auto max-w-lg px-5 py-16 text-center">
      <h1 className="text-xl font-semibold text-[#0b1f3a]">{t("notSetTitle")}</h1>
      <p className="mt-2 text-slate-500">{t("notSetText")}</p>
    </section>
  );
  const set = (s ?? {}) as { cn_reminder?: boolean; cn_reminder_days?: number };
  const show = ["asked", "waiting", "not_reminded", "confirmed"].includes(searchParams?.show ?? "") ? (searchParams!.show as ConfState) : "all";
  return <Confirmations companyId={current.id} rows={rows} autoOn={Boolean(set.cn_reminder)} days={set.cn_reminder_days === 2 ? 2 : 1} initialShow={show} />;
}
