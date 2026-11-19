import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageJobs } from "@/lib/jobs";
import NoAccess from "@/components/customers/NoAccess";
import JobDetail, { JobDetailData, JobDetailDoc } from "@/components/jobs/ops/JobDetail";
import { loadJobBasics } from "@/lib/jobs-server";
import { admin } from "@/lib/push";

export const dynamic = "force-dynamic";

// Ficha completa del trabajo (oficina y dueño). El técnico usa su propia pantalla (My Jobs).
export default async function JobDetailPage({ params, searchParams }: { params: { id: string }; searchParams?: { chat?: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageJobs(current.role)) redirect(`/dashboard/jobs/mine/${params.id}${searchParams?.chat === "1" ? "?chat=1" : ""}`);
  const { data, error } = await supabase.rpc("tech_job", { p_job: params.id });
  if (error?.message?.includes("NOT_FOUND")) notFound();
  if (error || !data) return <NoAccess />;
  const d = data as JobDetailData;
  if (d.job.company_id !== current.id) notFound();

  // Cotización y factura del trabajo · fotos (bucket privado: enlaces firmados por 1 hora)
  const docIds = [d.job.quote_id, d.job.invoice_id].filter(Boolean) as string[];
  const [docs, signed, basics, planRow] = await Promise.all([
    docIds.length ? supabase.from("sales_docs").select("id, kind, number, status, total, amount_paid").in("id", docIds) : Promise.resolve({ data: [] }),
    // Paso 5.8d: los enlaces de las fotos los firma el servidor (la persona ya pasó el permiso de tech_job arriba)
    d.photos.length ? (admin() ?? supabase).storage.from("job-photos").createSignedUrls(d.photos.map((p) => p.path), 3600) : Promise.resolve({ data: [] }),
    loadJobBasics(supabase, current.id),
    // Paso 5.11: ¿salió de un plan de mantenimiento? (sin el SQL nuevo la consulta falla y no pasa nada)
    supabase.from("jobs").select("plan_id, maintenance_plans ( id, name )").eq("id", params.id).maybeSingle().then((r) => r, () => ({ data: null })),
  ]);
  const planOf = (planRow.data as { maintenance_plans?: { id: string; name: string } | { id: string; name: string }[] | null } | null)?.maintenance_plans;
  const plan = Array.isArray(planOf) ? planOf[0] ?? null : planOf ?? null;
  const urls: Record<string, string> = {};
  ((signed.data ?? []) as { path: string | null; signedUrl: string }[]).forEach((s) => { if (s.path) urls[s.path] = s.signedUrl; });
  return <JobDetail companyId={current.id} data={d} docs={(docs.data ?? []) as JobDetailDoc[]} photoUrls={urls} isOwner={current.role === "owner"} seeProfit={current.role === "owner" || current.role === "manager"} settings={basics.settings} plan={plan} />;
}
