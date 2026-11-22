"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { askConfirm } from "@/lib/confirm";
import SelectMenu from "@/components/ui/SelectMenu";
import { SiteAddress, addressLine } from "@/lib/jobs";

import { useTranslations } from "next-intl";
import { useJobsTx } from "@/i18n/useJobsTx";
import { useJobError } from "@/i18n/useFmt";
export type CancelledJob = {
  id: string; number: string; customer_name: string; customer_phone: string | null; title: string | null; site_address: SiteAddress;
  type_name: string | null; type_color: string | null; estimated_total: number | null; cancelled_at: string; cancelled_by_name: string | null;
  cancel_reason: string | null; created_at: string; source: string | null;
};


// Ícono ilustrado (mismo estilo que los de la app)
function CancelledArt({ size = 44 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="#f1f5f9" />
      <rect x="12" y="14" width="24" height="22" rx="3.5" fill="#fff" stroke="#94a3b8" strokeWidth="1.6" />
      <path d="M12 20h24M18 11v5M30 11v5" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="33" cy="33" r="7" fill="#e11d48" />
      <path d="m30.3 30.3 5.4 5.4M35.7 30.3l-5.4 5.4" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// Trabajos cancelados: quién, cuándo y por qué. Se pueden abrir o restaurar (vuelven a "Unscheduled").
export default function CancelledJobs({ jobs }: { jobs: CancelledJob[] }) {
  const t = useTranslations("cancelledJobs");
  const jt = useJobsTx();
  const jobError = useJobError();
  const { usd } = jt;
  const PERIODS = [{ value: "30", label: t("p30") }, { value: "90", label: t("p90") }, { value: "365", label: t("p365") }, { value: "all", label: t("pall") }];
  const when = (iso: string) => new Date(iso).toLocaleString(jt.tag, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  const day = (iso: string) => jt.date(new Date(iso), { month: "short", day: "numeric", year: "numeric" });
  const router = useRouter();
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState("90");
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState<{ m: string; err?: boolean } | null>(null);
  const flash = (m: string, err = false) => { setToast({ m, err }); setTimeout(() => setToast((t) => (t?.m === m ? null : t)), err ? 5000 : 2600); };

  const list = useMemo(() => {
    const since = period === "all" ? 0 : Date.now() - Number(period) * 86400000;
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return jobs.filter((j) => {
      if (new Date(j.cancelled_at).getTime() < since) return false;
      if (!terms.length) return true;
      const blob = `${j.number} ${j.customer_name} ${j.customer_phone ?? ""} ${j.title ?? ""} ${j.type_name ?? ""} ${j.cancel_reason ?? ""} ${j.cancelled_by_name ?? ""} ${addressLine(j.site_address)}`.toLowerCase();
      return terms.every((w) => blob.includes(w));
    });
  }, [jobs, q, period]);
  const lost = list.reduce((a, j) => a + Number(j.estimated_total ?? 0), 0);

  async function restore(j: CancelledJob) {
    if (!(await askConfirm({ title: t("restoreQ", { n: j.number }), message: t("restoreMsg", { name: j.customer_name || t("thisJob") }), confirmLabel: t("restoreJob"), tone: "green" }))) return;
    setBusy(j.id);
    const { error } = await createClient().rpc("job_restore", { p_job: j.id });
    setBusy("");
    if (error) return flash(jobError(error), true);
    flash(t("restored", { n: j.number }));
    router.refresh();
  }

  const restoreBtn = (j: CancelledJob, compact = false) => (
    <button type="button" onClick={(e) => { e.stopPropagation(); e.preventDefault(); restore(j); }} disabled={busy === j.id} title={t("restoreJob")}
      className={`group inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-[#0f766e] transition-colors hover:border-[#14a39a] hover:bg-[#f3fbf8] disabled:opacity-60 ${compact ? "h-8 px-2.5 text-[12.5px]" : "h-9 px-3 text-[13.5px]"}`}>
      {busy === j.id ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        : <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform duration-300 group-hover:-rotate-180" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5" /></svg>}
      {t("restore")}
    </button>
  );

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[#f4f6f8] px-3 pb-24 pt-4 lg:px-6 lg:pb-8 lg:pt-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight text-[#0b1f3a]">{t("title")}</h1>
          <p className="text-[13px] text-slate-500">{t("intro")}</p>
        </div>
        <div className="relative w-full sm:w-72">
          <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.9"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPh")} aria-label={t("searchAria")}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-[14px] focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15" />
          {q && <button type="button" onClick={() => setQ("")} aria-label={t("clear")} className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition-all hover:rotate-90 hover:bg-red-50 hover:text-red-600">
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 5l10 10M15 5 5 15" /></svg></button>}
        </div>
        <div className="w-full sm:w-44"><SelectMenu value={period} options={PERIODS} onChange={setPeriod} ariaLabel={t("period")} /></div>
      </div>

      {list.length > 0 && (
        <p className="mt-3 text-[13px] text-slate-500"><b className="text-[#0b1f3a]">{list.length}</b> {t("count", { n: list.length })}{lost > 0 && <> · <b className="text-[#0b1f3a]">{usd(lost)}</b>{t("inEstimated")}</>}</p>
      )}

      {list.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center">
          <CancelledArt size={56} />
          <p className="mt-3 text-[16px] font-semibold text-[#0b1f3a]">{jobs.length === 0 ? t("none") : t("noneSearch")}</p>
          <p className="mt-1 max-w-sm text-[13.5px] text-slate-500">{jobs.length === 0 ? t("noneHint") : t("noneSearchHint")}</p>
          <Link prefetch={false} href="/dashboard/jobs/operations" className="mt-4 text-[14px] font-semibold text-[#0f766e] hover:underline">{t("goOps")}</Link>
        </div>
      ) : (
        <>
          {/* Computadora: tabla */}
          <div className="mt-3 hidden overflow-hidden rounded-2xl border border-slate-200 bg-white lg:block">
            <table className="w-full text-left text-[14px]">
              <thead><tr className="border-b border-slate-200 text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="py-3 pl-5 pr-3">{t("thJob")}</th><th className="py-3 pr-3">{t("thCustomer")}</th><th className="py-3 pr-3">{t("thCancelled")}</th><th className="py-3 pr-3">{t("thReason")}</th><th className="py-3 pr-3 text-right">{t("thEstimated")}</th><th className="w-28 py-3 pr-5" />
              </tr></thead>
              <tbody>
                {list.map((j) => (
                  <tr key={j.id} onClick={() => router.push(`/dashboard/jobs/${j.id}`)} className="cursor-pointer border-b border-slate-100 align-top transition-colors last:border-0 hover:bg-[#f6fcfa]">
                    <td className="py-3 pl-5 pr-3">
                      <p className="text-[12.5px] font-semibold text-slate-500">{j.number}</p>
                      <p className="max-w-[16rem] truncate font-medium text-[#0b1f3a]">{j.title || j.type_name || t("job")}</p>
                      {j.type_name && <span className="mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${j.type_color ?? "#64748b"}18`, color: j.type_color ?? "#64748b" }}>{j.type_name}</span>}
                    </td>
                    <td className="py-3 pr-3"><p className="font-medium text-[#0b1f3a]">{j.customer_name || t("noCustomer")}</p>
                      <p className="max-w-[15rem] truncate text-[12.5px] text-slate-500">{addressLine(j.site_address) || j.customer_phone || ""}</p></td>
                    <td className="whitespace-nowrap py-3 pr-3"><p className="text-slate-700">{when(j.cancelled_at)}</p>
                      <p className="text-[12.5px] text-slate-500">{t("by", { name: j.cancelled_by_name || "—" })}</p></td>
                    <td className="py-3 pr-3"><p className="max-w-[22rem] whitespace-pre-line text-slate-700">{j.cancel_reason || "—"}</p></td>
                    <td className="py-3 pr-3 text-right tabular-nums text-slate-700">{Number(j.estimated_total ?? 0) > 0 ? usd(Number(j.estimated_total)) : "—"}</td>
                    <td className="py-3 pr-5 text-right">{restoreBtn(j)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Celular: tarjetas compactas */}
          <ul className="mt-3 space-y-2 lg:hidden">
            {list.map((j) => (
              <li key={j.id}>
                <Link prefetch={false} href={`/dashboard/jobs/${j.id}`} className="block rounded-2xl border border-slate-200 bg-white px-3.5 py-3 active:bg-slate-50">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-slate-500">{j.number}{j.type_name ? ` · ${j.type_name}` : ""}</p>
                      <p className="truncate text-[15px] font-semibold text-[#0b1f3a]">{j.customer_name || t("noCustomer")}</p>
                      {j.title && <p className="truncate text-[13px] text-slate-600">{j.title}</p>}
                    </div>
                    {restoreBtn(j, true)}
                  </div>
                  <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-[13px] text-slate-700">{j.cancel_reason || t("noReason")}</p>
                  <p className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-[12px] text-slate-500">
                    <span>{day(j.cancelled_at)} · {t("by", { name: j.cancelled_by_name || "—" })}</span>
                    {Number(j.estimated_total ?? 0) > 0 && <span className="font-semibold text-slate-600">{usd(Number(j.estimated_total))}</span>}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {jobs.length >= 500 && <p className="mt-3 text-center text-[12.5px] text-slate-400">{t("showing500")}</p>}
      {toast && <div role="status" className={`fixed bottom-5 left-1/2 z-[95] max-w-[92vw] -translate-x-1/2 rounded-xl px-4 py-2.5 text-[13.5px] font-medium text-white shadow-lg animate-[bp-pop-in_0.2s_ease-out] ${toast.err ? "bg-[#be123c]" : "bg-[#0b1f3a]"}`}>{toast.m}</div>}
    </div>
  );
}
