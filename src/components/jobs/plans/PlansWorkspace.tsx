"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { confirmDelete } from "@/lib/confirm";
import { addressLine } from "@/lib/jobs";
import { HORIZON_DAYS, Plan } from "@/lib/maintenance";
import { Kpi, card, tealBtn } from "@/components/finances/FinBits";
import SelectMenu from "@/components/ui/SelectMenu";
import PlanArt from "@/components/jobs/plans/PlanArt";

import { useTranslations } from "next-intl";
import { useJobsTx } from "@/i18n/useJobsTx";
import { usePlanTx } from "@/i18n/usePlanTx";
type Show = "all" | "active" | "paused" | "ended";
const COLS = "lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,1.1fr)_auto]";
const iconBtn = "flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors";

// Jobs → Maintenance plans (Paso 5.11): planes que crean sus visitas solos
export default function PlansWorkspace({ plans, needsSql }: { plans: Plan[]; needsSql: boolean }) {
  const t = useTranslations("plans");
  const tc = useTranslations("common");
  const { usd } = useJobsTx();
  const { billingLabel, dayText, freqLabel, planError, planState, whenText } = usePlanTx();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [show, setShow] = useState<Show>("all");
  const [q, setQ] = useState("");
  const [note, setNote] = useState("");
  const [fail, setFail] = useState("");
  const [busy, setBusy] = useState("");
  useEffect(() => { if (!note) return; const tm = setTimeout(() => setNote(""), 4500); return () => clearTimeout(tm); }, [note]);
  const done = (msg: string) => { setBusy(""); setNote(msg); setFail(""); start(() => router.refresh()); };

  const active = plans.filter((p) => p.status === "active");
  const upcoming = plans.reduce((a, p) => a + (p.visits_upcoming ?? 0), 0);
  const nextOne = plans.filter((p) => p.next_visit).sort((a, b) => String(a.next_visit).localeCompare(String(b.next_visit)))[0];
  const shown = useMemo(() => {
    const w = q.trim().toLowerCase();
    return plans.filter((p) => (show === "all" || (show === "active" ? p.status === "active" : show === "paused" ? p.status === "paused" : p.status === "cancelled" || p.status === "finished"))
      && (!w || `${p.name} ${p.customer_name} ${p.type_name ?? ""} ${addressLine(p.site ?? null)}`.toLowerCase().includes(w)));
  }, [plans, show, q]);

  async function setStatus(p: Plan, action: "pause" | "resume") {
    setBusy(p.id);
    const { data, error } = await createClient().rpc("maintenance_plan_status", { p_plan: p.id, p_action: action });
    if (error) { setBusy(""); return setFail(planError(error)); }
    const r = (data ?? {}) as { removed?: number; created?: number };
    done(action === "pause" ? t("pausedMsg") + (r.removed ? t("removedVisits", { n: r.removed }) : t("noMore"))
      : t("activeAgain") + (r.created ? t("created", { n: r.created }) : ""));
  }
  async function remove(p: Plan) {
    if (!(await confirmDelete({ title: t("deleteQ", { name: p.name }), message: t("deleteMsg"), download: { filename: `maintenance-plan-${p.customer_name || p.name}`, data: p } }))) return;
    setBusy(p.id);
    const { error } = await createClient().rpc("maintenance_plan_delete", { p_plan: p.id });
    if (error) { setBusy(""); return setFail(planError(error)); }
    done(t("deleted"));
  }
  const open = (e: React.MouseEvent | React.KeyboardEvent, p: Plan) => {
    if ((e.target as HTMLElement).closest("a,button")) return;
    if ("key" in e && e.key !== "Enter") return;
    router.push(`/dashboard/jobs/plans/${p.id}`);
  };
  const cell = (label: string, value: React.ReactNode, sub?: React.ReactNode) => (
    <span className="min-w-0"><span className="block text-[11px] font-medium text-slate-400 lg:hidden">{label}</span><span className="block truncate text-[13.5px] text-slate-700">{value}</span>{sub && <span className="block truncate text-[12px] text-slate-400">{sub}</span>}</span>
  );

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[#f4f6f8] px-3 pb-24 pt-4 lg:px-6 lg:pb-8 lg:pt-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight text-[#0b1f3a]">{t("title")}</h1>
          <p className="text-[13px] text-slate-500">{t("intro")}</p>
        </div>
        {!needsSql && <Link prefetch={false} href="/dashboard/jobs/plans/new" className={`${tealBtn} hidden lg:inline-flex`}>
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>{t("newPlan")}
        </Link>}
      </div>
      {note && <p role="status" className="mt-3 animate-[bp-fade_0.2s_ease-out] rounded-xl border border-[#b7e4c7] bg-[#f0fbf4] px-4 py-2.5 text-[13.5px] font-medium text-[#15803d]">{note}</p>}
      {fail && <p role="alert" className="mt-3 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-2.5 text-[13.5px] text-[#be123c]">{fail}</p>}

      {needsSql ? (
        <div className={`${card} mt-5 px-5 py-10 text-center`}>
          <p className="text-[15px] font-semibold text-[#0b1f3a]">{t("oneStep")}</p>
          <p className="mx-auto mt-1 max-w-md text-[13.5px] text-slate-500">{t.rich("runSql", { b: (c) => <b>{c}</b> })}</p>
        </div>
      ) : plans.length === 0 ? (
        <div className={`${card} mt-5 flex flex-col items-center px-5 py-12 text-center`}>
          <PlanArt size={64} />
          <p className="mt-3 text-[15px] font-semibold text-[#0b1f3a]">{t("none")}</p>
          <p className="mx-auto mt-1 max-w-md text-[13.5px] text-slate-500">{t("noneHint", { n: HORIZON_DAYS })}</p>
          <Link prefetch={false} href="/dashboard/jobs/plans/new" className={`${tealBtn} mt-4`}>{t("createFirst")}</Link>
        </div>
      ) : (
        <div className={`transition-opacity duration-200 ${pending ? "opacity-60" : ""}`}>
          <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-3">
            <Kpi art="done" title={t("kActive")} value={String(active.length)} hint={plans.length - active.length ? t("kPausedEnded", { n: plans.length - active.length }) : t("kBooking")} />
            <Kpi art="ontime" title={t("kBooked")} value={String(upcoming)} hint={t("kOnSchedule", { n: HORIZON_DAYS })} />
            <div className="col-span-2 xl:col-span-1"><Kpi art="site" title={t("kNext")} value={nextOne ? whenText(nextOne.next_visit) : "—"} hint={nextOne ? `${nextOne.customer_name} · ${nextOne.name}` : t("kNothing")} /></div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="w-44"><SelectMenu ariaLabel={t("show")} value={show} onChange={(v) => setShow(v as Show)} options={[{ value: "all", label: t("fAll") }, { value: "active", label: t("fActive") }, { value: "paused", label: t("fPaused") }, { value: "ended", label: t("fEnded") }]} /></div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPh")} aria-label={t("searchAria")}
              className="h-[42px] min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3.5 text-[14px] placeholder:text-slate-400 focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15 sm:max-w-xs" />
          </div>

          <section className={`${card} mt-3 overflow-hidden`}>
            <div className={`hidden items-center gap-x-3 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 lg:grid ${COLS}`}><span>{t("hPlan")}</span><span>{t("hRepeats")}</span><span>{t("hNext")}</span><span>{t("hCharged")}</span><span className="w-[6.5rem]" /></div>
            {shown.length === 0 ? <p className="px-5 py-8 text-center text-[13.5px] text-slate-500">{t("noMatch")}</p> : (
              <ul className="divide-y divide-slate-100">
                {shown.map((p) => { const st = planState(p); const off = p.status !== "active"; return (
                  <li key={p.id} tabIndex={0} onClick={(e) => open(e, p)} onKeyDown={(e) => open(e, p)} title={t("openX", { name: p.name })}
                    className={`grid cursor-pointer grid-cols-2 items-center gap-x-3 gap-y-2.5 px-3.5 py-3 transition-colors hover:bg-[#f6fbfa] focus:bg-[#f6fbfa] focus:outline-none lg:px-5 ${COLS} ${busy === p.id ? "opacity-50" : ""}`}>
                    <span className="col-span-2 flex min-w-0 items-center gap-2.5 lg:col-span-1">
                      <span className="shrink-0"><PlanArt size={36} muted={off} /></span>
                      <span className="min-w-0">
                        <span className="flex min-w-0 items-center gap-2"><span className="truncate text-[14px] font-semibold text-[#0b1f3a]">{p.customer_name || t("customer")}</span><span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span></span>
                        <span className="block truncate text-[12.5px] text-slate-500">{p.name}{p.site ? ` · ${addressLine(p.site)}` : ""}</span>
                        {p.last_error && p.status === "active" && <span className="block truncate text-[12px] font-medium text-[#be123c]">{t("couldntCreate")}</span>}
                      </span>
                    </span>
                    {cell(t("hRepeats"), freqLabel(p), p.type_name)}
                    {cell(t("hNext"), p.next_visit ? whenText(p.next_visit) : p.status === "active" && p.next_due ? t("willBook", { d: dayText(p.next_due) }) : "—", t("bookedDone", { b: p.visits_upcoming ?? 0, d: p.visits_done ?? 0 }))}
                    {cell(t("hCharged"), billingLabel(p), Number(p.price) > 0 ? t("perVisit", { v: usd(Number(p.price)) }) : undefined)}
                    <span className="flex items-center justify-end gap-0.5 self-end lg:w-[6.5rem] lg:self-auto">
                      {(p.status === "active" || p.status === "paused") && (
                        <button type="button" onClick={() => setStatus(p, p.status === "active" ? "pause" : "resume")} aria-label={p.status === "active" ? t("pauseX", { name: p.name }) : t("resumeX", { name: p.name })} title={p.status === "active" ? t("pause") : t("resume")} className={`${iconBtn} hover:bg-[#fff6e6] hover:text-[#b45309]`}>
                          <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="currentColor">{p.status === "active" ? <path d="M6 4.5h2.6v11H6zM11.4 4.5H14v11h-2.6z" /> : <path d="M6.5 4.2v11.6L16 10z" />}</svg>
                        </button>
                      )}
                      <Link prefetch={false} href={`/dashboard/jobs/plans/${p.id}/edit`} aria-label={t("editX", { name: p.name })} title={tc("edit")} className={`group/e ${iconBtn} hover:bg-[#e9f7f4] hover:text-[#0f766e]`}>
                        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] transition-transform duration-200 group-hover/e:-rotate-12 group-hover/e:scale-110" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" /></svg>
                      </Link>
                      <button type="button" onClick={() => remove(p)} aria-label={t("deleteX", { name: p.name })} title={tc("delete")} className={`${iconBtn} hover:bg-[#fff1f2] hover:text-[#be123c]`}>
                        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 7h14M10 7V4.5h4V7M7 7l.8 12.5h8.4L17 7M10 11v5M14 11v5" /></svg>
                      </button>
                    </span>
                  </li>
                ); })}
              </ul>
            )}
          </section>
          <p className="mt-4 max-w-3xl text-[12.5px] leading-relaxed text-slate-500">
            {t.rich("footer", { n: HORIZON_DAYS, link: (c) => <Link prefetch={false} href="/dashboard/jobs/schedule" className="font-semibold text-[#0f766e] hover:underline">{c}</Link> })}
          </p>
        </div>
      )}
      {!needsSql && (
        <Link prefetch={false} href="/dashboard/jobs/plans/new" aria-label={t("newAria")} className="fixed bottom-5 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#0f766e] text-white shadow-lg shadow-[#0f766e]/40 active:scale-95 lg:hidden">
          <svg viewBox="0 0 20 20" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4v12M4 10h12" /></svg>
        </Link>
      )}
    </div>
  );
}
