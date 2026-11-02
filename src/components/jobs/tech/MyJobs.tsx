"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  JobStatus, SiteAddress, TechChip, VISIT_LABEL, VisitStatus, addDays, addMinutes, addressLine, dayStart, fmtTime, isoDay, jobError, mapsLink, sameDay, usd,
} from "@/lib/jobs";
import { TechDots } from "@/components/jobs/EventBar";

export type MyVisit = {
  visit_id: string; job_id: string; number: string; visit_no: number; visit_count: number; starts_at: string; ends_at: string; arrival_window_min: number;
  visit_status: VisitStatus; job_status: JobStatus; title: string | null; priority: string; customer_name: string; customer_phone: string | null;
  site_address: SiteAddress; type_name: string | null; type_color: string | null; form_kind: string | null; estimated_total: number | null; techs: TechChip[];
};

const PILL: Record<string, string> = {
  scheduled: "bg-[#eef4ff] text-[#2563eb]", on_my_way: "bg-[#f3efff] text-[#6d28d9]", in_progress: "bg-[#fff6e6] text-[#b45309]",
  paused: "bg-[#fff6e6] text-[#b45309]", on_hold: "bg-[#fff1f2] text-[#be123c]", completed: "bg-[#e7f6f1] text-[#0f766e]", cancelled: "bg-slate-100 text-slate-500",
};

// Técnico: sus trabajos del día (lista grande y fácil de tocar), con entrada/salida del día
export default function MyJobs({ companyId, userId }: { companyId: string; userId: string }) {
  const [day, setDay] = useState(() => dayStart(new Date()));
  const [visits, setVisits] = useState<MyVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shift, setShift] = useState<{ id: string; started_at: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const sb = createClient();
    const [v, s] = await Promise.all([
      sb.rpc("tech_my_visits", { p_company: companyId, p_from: day.toISOString(), p_to: addDays(day, 1).toISOString() }),
      sb.from("tech_time_entries").select("id, started_at").eq("company_id", companyId).eq("user_id", userId).eq("kind", "shift").is("ended_at", null).maybeSingle(),
    ]);
    if (v.error) setError(jobError(v.error)); else { setError(""); setVisits((v.data ?? []) as MyVisit[]); }
    setShift((s.data as { id: string; started_at: string } | null) ?? null);
    setLoading(false);
  }, [companyId, userId, day]);

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

  const today = sameDay(day, new Date());
  const strip = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(dayStart(new Date()), i - 1)), []);
  const open = visits.filter((v) => ["on_my_way", "in_progress", "paused"].includes(v.visit_status));
  const rest = visits.filter((v) => !open.includes(v));
  const hours = shift ? Math.max(0, (Date.now() - new Date(shift.started_at).getTime()) / 3600000) : 0;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-4 lg:pt-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight text-[#0b1f3a]">My jobs</h1>
          <p className="text-[13.5px] text-slate-500">{day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
        </div>
        <button type="button" onClick={clock} disabled={busy}
          className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-[13.5px] font-semibold transition-all active:scale-95 disabled:opacity-60 ${shift ? "bg-[#fff1f2] text-[#be123c] ring-1 ring-[#fecdd3]" : "bg-[#0f766e] text-white shadow-sm shadow-[#0f766e]/30"}`}>
          <span className={`h-2 w-2 rounded-full ${shift ? "animate-pulse bg-[#e11d48]" : "bg-white"}`} />
          {shift ? <>Clock out <span className="font-normal opacity-80">· {hours.toFixed(1)}h</span></> : "Clock in"}
        </button>
      </div>

      {/* Días: ayer, hoy y la próxima semana */}
      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {strip.map((d) => {
          const on = sameDay(d, day);
          return (
            <button key={isoDay(d)} type="button" onClick={() => setDay(d)}
              className={`flex w-14 shrink-0 flex-col items-center rounded-xl border py-2 transition-colors ${on ? "border-[#0f766e] bg-[#0f766e] text-white" : "border-slate-200 bg-white text-slate-600"}`}>
              <span className="text-[11px] font-medium uppercase">{sameDay(d, new Date()) ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" })}</span>
              <span className="text-[17px] font-semibold">{d.getDate()}</span>
            </button>
          );
        })}
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-[14px] text-red-700">{error}</p>}
      {loading ? (
        <div className="mt-6 space-y-3">{[0, 1].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />)}</div>
      ) : visits.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-[16px] font-semibold text-[#0b1f3a]">{today ? "No jobs for today" : "No jobs this day"}</p>
          <p className="mt-1 text-[14px] text-slate-500">When the office assigns you a job it shows up here and you get an alert.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {open.length > 0 && <p className="text-[12.5px] font-semibold text-[#b45309]">Working now</p>}
          {[...open, ...rest].map((v, i) => <JobCard key={v.visit_id} v={v} highlight={i === 0 && open.length > 0} />)}
        </div>
      )}
    </div>
  );
}

function JobCard({ v, highlight }: { v: MyVisit; highlight: boolean }) {
  const s = new Date(v.starts_at), e = new Date(v.ends_at);
  const maps = mapsLink(v.site_address);
  const addr = addressLine(v.site_address);
  return (
    <div className={`overflow-hidden rounded-2xl border bg-white transition-shadow ${highlight ? "border-[#f59e0b] shadow-[0_8px_24px_rgba(245,158,11,0.15)]" : "border-slate-200"}`}
      style={{ borderLeft: `4px solid ${v.type_color ?? "#14a39a"}` }}>
      <Link prefetch={false} href={`/dashboard/jobs/mine/${v.job_id}`} className="block px-4 pb-3 pt-3.5 active:bg-slate-50">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-slate-500">{fmtTime(s)} – {fmtTime(e)}{v.arrival_window_min > 0 ? <span className="font-normal"> · arrive by {fmtTime(addMinutes(s, v.arrival_window_min))}</span> : null}</p>
            <p className="mt-0.5 truncate text-[17px] font-semibold text-[#0b1f3a]">{v.customer_name || v.number}</p>
            <p className="truncate text-[13.5px] text-slate-600">{[v.type_name, v.title].filter(Boolean).join(" · ") || "Job"}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${PILL[v.visit_status] ?? PILL.scheduled}`}>{VISIT_LABEL[v.visit_status]}</span>
        </div>
        {addr && <p className="mt-1.5 truncate text-[13px] text-slate-500">{addr}</p>}
        <div className="mt-2 flex items-center gap-2 text-[12px] text-slate-400">
          <span>#{v.number}{v.visit_count > 1 ? ` · Visit ${v.visit_no}` : ""}</span>
          {v.techs.length > 1 && <span className="flex items-center gap-1"><TechDots techs={v.techs} size={18} max={3} /></span>}
          {v.estimated_total != null && <span className="ml-auto font-semibold text-[#0b1f3a]">{usd(v.estimated_total)}</span>}
        </div>
      </Link>
      <div className="flex border-t border-slate-100">
        {v.customer_phone && <a href={`tel:${v.customer_phone.replace(/[^\d+]/g, "")}`} className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[13.5px] font-semibold text-[#0f766e] active:bg-[#f3fbf8]">Call</a>}
        {maps && <a href={maps} target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center gap-1.5 border-l border-slate-100 py-2.5 text-[13.5px] font-semibold text-[#0f766e] active:bg-[#f3fbf8]">Directions</a>}
        <Link prefetch={false} href={`/dashboard/jobs/mine/${v.job_id}`} className="flex flex-1 items-center justify-center gap-1.5 border-l border-slate-100 py-2.5 text-[13.5px] font-semibold text-[#0b1f3a] active:bg-slate-50">Open</Link>
      </div>
    </div>
  );
}
