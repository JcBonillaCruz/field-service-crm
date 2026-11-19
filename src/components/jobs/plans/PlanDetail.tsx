"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { askConfirm, confirmDelete } from "@/lib/confirm";
import { STATUS_META, JobStatus, addressLine, arrivalLabel, durationLabel, fmtHour, usd } from "@/lib/jobs";
import { HORIZON_DAYS, Plan, PlanJob, billingLabel, dayText, endLabel, freqLabel, planError, planState, whenText } from "@/lib/maintenance";
import { card, ghostBtn, tealBtn } from "@/components/finances/FinBits";
import PlanArt from "@/components/jobs/plans/PlanArt";

const timeLabel = (m: number) => `${fmtHour(m).replace(" ", ":" + String(m % 60).padStart(2, "0") + " ")}`;

// Ficha de un plan de mantenimiento: resumen a la izquierda, visitas a la derecha
export default function PlanDetail({ plan: p, jobs, techNames, justSaved }: { plan: Plan; jobs: PlanJob[]; techNames: string[]; justSaved: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(justSaved ? "Plan saved. Its visits are on the Schedule." : "");
  const [fail, setFail] = useState("");
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(""), 5000); return () => clearTimeout(t); }, [note]);
  const st = planState(p);
  const now = Date.now();
  const isUp = (j: PlanJob) => !j.cancelled && ["scheduled", "unscheduled"].includes(j.status) && (!j.starts_at || new Date(j.starts_at).getTime() > now);
  const upcoming = jobs.filter(isUp).sort((a, b) => String(a.starts_at ?? "9").localeCompare(String(b.starts_at ?? "9")));
  const past = jobs.filter((j) => !isUp(j));

  async function act(action: "pause" | "resume" | "cancel") {
    if (action === "cancel" && !(await askConfirm({ title: `Cancel the plan "${p.name}"?`, message: "No more visits are created and the ones that haven't started are removed from the calendar. Visits already done stay in the history. You can turn the plan on again later.", confirmLabel: "Cancel plan", cancelLabel: "Keep it", tone: "danger" }))) return;
    setBusy(true);
    const { data, error } = await createClient().rpc("maintenance_plan_status", { p_plan: p.id, p_action: action });
    setBusy(false);
    if (error) return setFail(planError(error));
    const r = (data ?? {}) as { removed?: number; created?: number };
    setFail("");
    setNote(action === "resume" ? `Active again.${r.created ? ` ${r.created} visit${r.created === 1 ? "" : "s"} created.` : ""}` : `${action === "pause" ? "Paused" : "Cancelled"}.${r.removed ? ` ${r.removed} visit${r.removed === 1 ? "" : "s"} removed from the calendar.` : ""}`);
    start(() => router.refresh());
  }
  async function remove() {
    if (!(await confirmDelete({ title: `Delete the plan "${p.name}"?`, message: "Visits that haven't started are removed from the calendar. Visits already started or finished stay as normal jobs.", download: { filename: `maintenance-plan-${p.customer_name || p.name}`, data: { plan: p, visits: jobs } } }))) return;
    setBusy(true);
    const { error } = await createClient().rpc("maintenance_plan_delete", { p_plan: p.id });
    if (error) { setBusy(false); return setFail(planError(error)); }
    router.push("/dashboard/jobs/plans"); router.refresh();
  }

  const row = (label: string, value: React.ReactNode) => (<><dt className="text-slate-500">{label}</dt><dd className="min-w-0 text-slate-800">{value}</dd></>);
  const visit = (j: PlanJob) => {
    const s = j.cancelled ? STATUS_META.cancelled : STATUS_META[j.status as JobStatus] ?? STATUS_META.scheduled;
    return (
      <li key={j.job_id}>
        <Link prefetch={false} href={`/dashboard/jobs/${j.job_id}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[#f6fbfa]">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-medium text-[#0b1f3a]">{j.starts_at ? whenText(j.starts_at) : "Not scheduled"}</span>
            <span className="block truncate text-[12px] text-slate-400">#{j.number} · {j.techs.length ? j.techs.join(", ") : "Unassigned"}</span>
          </span>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${s.badge}`}>{s.label}</span>
          <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.5 4.5 13 10l-5.5 5.5" /></svg>
        </Link>
      </li>
    );
  };

  return (
    <div className={`min-h-[calc(100dvh-4rem)] bg-[#f4f6f8] px-3 pb-24 pt-4 transition-opacity lg:px-6 lg:pb-8 lg:pt-5 ${pending ? "opacity-60" : ""}`}>
      <Link prefetch={false} href="/dashboard/jobs/plans" className="inline-flex items-center gap-1 text-[13px] font-medium text-slate-500 hover:text-[#0f766e]">
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.5 4.5 7 10l5.5 5.5" /></svg>Maintenance plans
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <PlanArt size={46} muted={p.status !== "active"} />
        <div className="mr-auto min-w-0">
          <div className="flex min-w-0 items-center gap-2"><h1 className="truncate text-[21px] font-semibold tracking-tight text-[#0b1f3a]">{p.name}</h1><span className={`shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${st.cls}`}>{st.label}</span></div>
          <p className="truncate text-[13.5px] text-slate-500"><Link prefetch={false} href={`/dashboard/customers/${p.customer_id}`} className="font-medium text-[#0f766e] hover:underline">{p.customer_name}</Link>{p.site ? ` · ${addressLine(p.site)}` : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {p.status === "active" && <button type="button" disabled={busy} onClick={() => act("pause")} className={ghostBtn}>Pause</button>}
          {p.status !== "active" && <button type="button" disabled={busy} onClick={() => act("resume")} className={tealBtn}>{p.status === "paused" ? "Resume" : "Turn on again"}</button>}
          <Link prefetch={false} href={`/dashboard/jobs/plans/${p.id}/edit`} className={ghostBtn}>Edit</Link>
          {(p.status === "active" || p.status === "paused") && <button type="button" disabled={busy} onClick={() => act("cancel")} className={`${ghostBtn} !text-[#be123c]`}>Cancel plan</button>}
          <button type="button" disabled={busy} onClick={remove} aria-label="Delete plan" title="Delete plan" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition-colors hover:bg-[#fff1f2] hover:text-[#be123c] disabled:opacity-50">
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 7h14M10 7V4.5h4V7M7 7l.8 12.5h8.4L17 7M10 11v5M14 11v5" /></svg>
          </button>
        </div>
      </div>
      {note && <p role="status" className="mt-3 animate-[bp-fade_0.2s_ease-out] rounded-xl border border-[#b7e4c7] bg-[#f0fbf4] px-4 py-2.5 text-[13.5px] font-medium text-[#15803d]">{note}</p>}
      {fail && <p role="alert" className="mt-3 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-2.5 text-[13.5px] text-[#be123c]">{fail}</p>}
      {p.last_error && p.status === "active" && (
        <p role="alert" className="mt-3 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-2.5 text-[13.5px] text-[#be123c]"><b>A visit couldn&apos;t be created.</b> BrightPro tries again every morning and each time this page opens. Detail: {p.last_error}</p>
      )}

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <section className={`${card} px-4 py-4 lg:px-5`}>
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">Plan</h2>
          <dl className="mt-3 grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-[14px]">
            {row("Repeats", freqLabel(p))}
            {row("First visit", dayText(p.start_date))}
            {row("Time", `${timeLabel(p.start_min)} · ${durationLabel(p.duration_min)}${p.arrival_window_min ? ` · ${arrivalLabel(p.arrival_window_min)} arrival window` : ""}`)}
            {row("Job type", p.type_name ?? "No type")}
            {row("Collaborators", techNames.length ? techNames.join(", ") : "Not set: visits arrive unassigned")}
            {row("Ends", endLabel(p))}
            {row("Charged", billingLabel(p))}
            {row("Price per visit", Number(p.price) > 0 ? usd(Number(p.price)) : "—")}
            {p.services.length > 0 && row("Services", <ul className="space-y-0.5">{p.services.map((s) => <li key={s.item_id} className="truncate">{s.qty} × {s.name}</li>)}</ul>)}
            {p.description && row("Included", <span className="whitespace-pre-line">{p.description}</span>)}
            {p.tech_notes && row("Tech notes", <span className="whitespace-pre-line">{p.tech_notes}</span>)}
            {row("Created", `${dayText(p.created_at)}${p.created_by_name ? ` by ${p.created_by_name}` : ""}`)}
          </dl>
          {p.billing === "subscription" && p.subscription_id && (
            <Link prefetch={false} href={`/dashboard/subscriptions/${p.subscription_id}`} className="mt-3 inline-block text-[13px] font-semibold text-[#0f766e] hover:underline">Open the subscription {p.subscription_number ?? ""}</Link>
          )}
        </section>

        <div className="grid gap-4">
          <section className={`${card} overflow-hidden`}>
            <div className="flex items-baseline gap-2 px-4 pb-1 pt-4"><h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">Coming up</h2><span className="text-[12px] text-slate-400">{upcoming.length} booked</span></div>
            {upcoming.length ? <ul className="divide-y divide-slate-100">{upcoming.map(visit)}</ul> : (
              <p className="px-4 pb-4 pt-1 text-[13.5px] text-slate-500">{p.status === "active" ? (p.next_due ? `Nothing in the next ${HORIZON_DAYS} days. The next visit is for ${dayText(p.next_due)} and will be booked when it gets closer.` : "Nothing booked.") : "Nothing booked while the plan is off."}</p>
            )}
            {p.status === "active" && upcoming.length > 0 && p.next_due && <p className="border-t border-slate-100 px-4 py-2.5 text-[12px] text-slate-400">After these, the next one is for {dayText(p.next_due)}.</p>}
          </section>
          <section className={`${card} overflow-hidden`}>
            <div className="flex items-baseline gap-2 px-4 pb-1 pt-4"><h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">History</h2><span className="text-[12px] text-slate-400">{p.visits_done ?? 0} done</span></div>
            {past.length ? <ul className="divide-y divide-slate-100">{past.slice(0, 60).map(visit)}</ul> : <p className="px-4 pb-4 pt-1 text-[13.5px] text-slate-500">No visits done yet.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
