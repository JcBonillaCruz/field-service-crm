"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  JobStatus, SiteAddress, TechChip, VISIT_LABEL, VisitStatus, addDays, addressLine, dayStart, fmtTime, isoDay, jobError, sameDay, startOfWeek, usd,
} from "@/lib/jobs";

export type MyVisit = {
  visit_id: string; job_id: string; number: string; visit_no: number; visit_count: number; starts_at: string; ends_at: string; arrival_window_min: number;
  visit_status: VisitStatus; job_status: JobStatus; title: string | null; priority: string; customer_name: string; customer_phone: string | null;
  site_address: SiteAddress; type_name: string | null; type_color: string | null; form_kind: string | null; estimated_total: number | null; techs: TechChip[];
};

const PILL: Record<string, string> = {
  scheduled: "bg-[#eef4ff] text-[#2563eb]", on_my_way: "bg-[#f3efff] text-[#6d28d9]", in_progress: "bg-[#fff6e6] text-[#b45309]",
  paused: "bg-[#fff6e6] text-[#b45309]", on_hold: "bg-[#fff1f2] text-[#be123c]", completed: "bg-[#e7f6f1] text-[#0f766e]", cancelled: "bg-slate-100 text-slate-500",
};

// Técnico: sus trabajos (lista compacta, 5+ por pantalla) con la semana arriba y entrada/salida del día
export default function MyJobs({ companyId, userId }: { companyId: string; userId: string }) {
  const [day, setDay] = useState(() => dayStart(new Date()));
  const [week, setWeek] = useState(() => startOfWeek(new Date(), 0));
  const [visits, setVisits] = useState<MyVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shift, setShift] = useState<{ id: string; started_at: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Una sola consulta por semana: así se ven los puntitos de los días con trabajo
  const load = useCallback(async () => {
    const sb = createClient();
    const [v, s] = await Promise.all([
      sb.rpc("tech_my_visits", { p_company: companyId, p_from: week.toISOString(), p_to: addDays(week, 7).toISOString() }),
      sb.from("tech_time_entries").select("id, started_at").eq("company_id", companyId).eq("user_id", userId).eq("kind", "shift").is("ended_at", null).maybeSingle(),
    ]);
    if (v.error) setError(jobError(v.error)); else { setError(""); setVisits((v.data ?? []) as MyVisit[]); }
    setShift((s.data as { id: string; started_at: string } | null) ?? null);
    setLoading(false);
  }, [companyId, userId, week]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  // Se actualiza solo cuando la oficina asigna o mueve un trabajo
  useEffect(() => {
    const sb = createClient();
    let t: ReturnType<typeof setTimeout>;
    const again = () => { clearTimeout(t); t = setTimeout(load, 500); };
    const ch = sb.channel(`my-jobs-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "job_visit_techs", filter: `user_id=eq.${userId}` }, again)
      .on("postgres_changes", { event: "*", schema: "public", table: "job_visits", filter: `company_id=eq.${companyId}` }, again)
      .subscribe();
    const iv = setInterval(() => { if (document.visibilityState === "visible") load(); }, 60000);
    const onShow = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onShow);
    return () => { clearTimeout(t); clearInterval(iv); sb.removeChannel(ch); document.removeEventListener("visibilitychange", onShow); };
  }, [companyId, userId, load]);

  async function clock() {
    setBusy(true);
    const pos = await new Promise<GeolocationPosition | null>((ok) => navigator.geolocation ? navigator.geolocation.getCurrentPosition(ok, () => ok(null), { enableHighAccuracy: true, timeout: 8000 }) : ok(null));
    const { error: e } = await createClient().rpc("tech_clock", { p_company: companyId, p_action: shift ? "out" : "in", p_lat: pos?.coords.latitude ?? null, p_lng: pos?.coords.longitude ?? null });
    setBusy(false);
    if (e) return setError(e.hint || jobError(e));
    load();
  }
  function goDay(d: Date) { setDay(d); const w = startOfWeek(d, 0); if (w.getTime() !== week.getTime()) setWeek(w); }

  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const isOpen = (v: MyVisit) => ["on_my_way", "in_progress", "paused"].includes(v.visit_status);
  const count = (d: Date) => visits.filter((v) => sameDay(new Date(v.starts_at), d)).length;
  const open = visits.filter(isOpen);
  const ofDay = visits.filter((v) => sameDay(new Date(v.starts_at), day) && !isOpen(v)).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const today = new Date();
  const hours = shift ? Math.max(0, (Date.now() - new Date(shift.started_at).getTime()) / 3600000) : 0;

  return (
    <div className="mx-auto w-full max-w-2xl px-3 pb-24 pt-3 sm:px-4 lg:pt-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[20px] font-semibold tracking-tight text-[#0b1f3a]">My jobs</h1>
          <p className="text-[13px] text-slate-500">{sameDay(day, today) ? "Today, " : ""}{day.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</p>
        </div>
        <button type="button" onClick={clock} disabled={busy}
          className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-all active:scale-95 disabled:opacity-60 ${shift ? "bg-[#fff1f2] text-[#be123c] ring-1 ring-[#fecdd3]" : "bg-[#0f766e] text-white"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${shift ? "animate-pulse bg-[#e11d48]" : "bg-white"}`} />
          {shift ? <>Clock out <span className="font-normal opacity-80">{hours.toFixed(1)}h</span></> : "Clock in"}
        </button>
      </div>

      {/* Semana compacta: toda cabe en la pantalla; el puntito dice cuántos trabajos hay */}
      <div className="mt-3 flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1.5">
        <button type="button" aria-label="Previous week" onClick={() => goDay(addDays(day, -7))} className="flex h-10 w-6 shrink-0 items-center justify-center text-slate-400"><svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 5-5 5 5 5" /></svg></button>
        <div className="grid flex-1 grid-cols-7 gap-0.5">
          {days.map((d) => {
            const on = sameDay(d, day), n = count(d), t = sameDay(d, today);
            return (
              <button key={isoDay(d)} type="button" onClick={() => setDay(d)}
                className={`flex flex-col items-center rounded-xl py-1 transition-colors ${on ? "bg-[#0f766e] text-white" : t ? "text-[#0f766e]" : "text-slate-600"}`}>
                <span className="text-[10.5px] font-medium uppercase">{d.toLocaleDateString("en-US", { weekday: "narrow" })}</span>
                <span className="text-[15px] font-semibold leading-tight">{d.getDate()}</span>
                <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${n ? (on ? "bg-white" : "bg-[#14a39a]") : "bg-transparent"}`} />
              </button>
            );
          })}
        </div>
        <button type="button" aria-label="Next week" onClick={() => goDay(addDays(day, 7))} className="flex h-10 w-6 shrink-0 items-center justify-center text-slate-400"><svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m8 5 5 5-5 5" /></svg></button>
      </div>
      {!sameDay(day, today) && <button type="button" onClick={() => goDay(dayStart(today))} className="mt-2 text-[13px] font-semibold text-[#0f766e]">Back to today</button>}

      {error && <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-[14px] text-red-700">{error}</p>}

      {open.length > 0 && (
        <>
          <p className="mb-1.5 mt-4 flex items-center gap-1.5 text-[12.5px] font-semibold text-[#b45309]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#f59e0b]" />Working now</p>
          <div className="space-y-2">{open.map((v) => <JobRow key={v.visit_id} v={v} live />)}</div>
        </>
      )}

      <p className="mb-1.5 mt-4 text-[12.5px] font-semibold text-slate-500">
        {sameDay(day, today) ? "Today" : day.toLocaleDateString("en-US", { weekday: "long" })}{!loading ? ` · ${ofDay.length} job${ofDay.length === 1 ? "" : "s"}` : ""}
      </p>
      {loading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-[68px] animate-pulse rounded-xl bg-slate-100" />)}</div>
      ) : ofDay.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center">
          <p className="text-[15px] font-semibold text-[#0b1f3a]">No jobs this day</p>
          <p className="mt-1 text-[13px] text-slate-500">When the office assigns you a job it shows up here and you get an alert.</p>
        </div>
      ) : (
        <div className="space-y-2">{ofDay.map((v) => <JobRow key={v.visit_id} v={v} />)}</div>
      )}
    </div>
  );
}

// Fila compacta (2 líneas): hora a la izquierda, cliente y trabajo, estado y urgencia. Al tocar abre el trabajo completo.
function JobRow({ v, live = false }: { v: MyVisit; live?: boolean }) {
  const s = new Date(v.starts_at), e = new Date(v.ends_at);
  const urgent = v.priority === "urgent" || v.priority === "high";
  return (
    <Link prefetch={false} href={`/dashboard/jobs/mine/${v.job_id}`}
      className={`flex items-stretch gap-3 rounded-xl border bg-white px-3 py-2.5 transition-colors active:bg-slate-50 ${live ? "border-[#fcd38d] bg-[#fffbf3]" : "border-slate-200"}`}
      style={{ borderLeft: `3px solid ${v.type_color ?? "#14a39a"}` }}>
      <div className="w-[3.6rem] shrink-0 text-right">
        <p className="text-[13.5px] font-semibold leading-tight text-[#0b1f3a]">{fmtTime(s).replace(" ", "\u00a0")}</p>
        <p className="text-[11.5px] leading-tight text-slate-400">{fmtTime(e).replace(" ", "\u00a0")}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-[15px] font-semibold leading-tight text-[#0b1f3a]">
          {urgent && <span className={`h-2 w-2 shrink-0 rounded-full ${v.priority === "urgent" ? "bg-[#e11d48]" : "bg-[#f59e0b]"}`} title={v.priority} />}
          <span className="truncate">{v.customer_name || v.number}</span>
        </p>
        <p className="mt-0.5 truncate text-[12.5px] text-slate-500">{[v.type_name ?? v.title, addressLine(v.site_address).split(",")[0]].filter(Boolean).join(" · ")}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end justify-between">
        <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${PILL[v.visit_status] ?? PILL.scheduled}`}>{VISIT_LABEL[v.visit_status]}</span>
        {v.estimated_total != null && <span className="text-[12px] font-semibold text-slate-600">{usd(v.estimated_total)}</span>}
      </div>
    </Link>
  );
}
