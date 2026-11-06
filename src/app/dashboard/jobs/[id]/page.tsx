import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageJobs } from "@/lib/jobs";
import NoAccess from "@/components/customers/NoAccess";
import JobDetail, { JobDetailData, JobDetailDoc } from "@/components/jobs/ops/JobDetail";

export const dynamic = "force-dynamic";

// Ficha completa del trabajo (oficina y dueño). El técnico usa su propia pantalla (My Jobs).
export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageJobs(current.role)) redirect(`/dashboard/jobs/mine/${params.id}`);
  const { data, error } = await supabase.rpc("tech_job", { p_job: params.id });
  if (error?.message?.includes("NOT_FOUND")) notFound();
  if (error || !data) return <NoAccess />;
  const d = data as JobDetailData;
  if (d.job.company_id !== current.id) notFound();

  // Cotización y factura del trabajo · fotos (bucket privado: enlaces firmados por 1 hora)
  const docIds = [d.job.quote_id, d.job.invoice_id].filter(Boolean) as string[];
  const [docs, signed] = await Promise.all([
    docIds.length ? supabase.from("sales_docs").select("id, kind, number, status, total, amount_paid").in("id", docIds) : Promise.resolve({ data: [] }),
    d.photos.length ? supabase.storage.from("job-photos").createSignedUrls(d.photos.map((p) => p.path), 3600) : Promise.resolve({ data: [] }),
  ]);
  const urls: Record<string, string> = {};
  ((signed.data ?? []) as { path: string | null; signedUrl: string }[]).forEach((s) => { if (s.path) urls[s.path] = s.signedUrl; });
  return <JobDetail companyId={current.id} data={d} docs={(docs.data ?? []) as JobDetailDoc[]} photoUrls={urls} isOwner={current.role === "owner"} />;
}
