"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { locCheck } from "@/lib/live-map";
import { SharingBadge } from "@/components/jobs/tech/LocationPinger";
import {
  JobStatus, SiteAddress, TechChip, VISIT_LABEL, VisitStatus, addDays, addressLine, dayStart, fmtTime, isoDay, jobError, navLink, sameDay, startOfWeek, usd,
} from "@/lib/jobs";
import { StatusArt } from "@/components/jobs/EventBar";
import { ProgressRing } from "@/components/jobs/ops/OpsBits";
import { TimesheetArt } from "@/components/jobs/time/TimeBits";
import { CallArt, ChatArt, ClockArt, DoneArt, EmptyArt, HoursArt, JobArt, NavArt, OpenArt, ScanArt, TabArt, ToolboxArt, VanArt } from "@/components/jobs/tech/TechArt";

export type MyVisit = {
  visit_id: string; job_id: string; number: string; visit_no: number; visit_count: number; starts_at: string; ends_at: string; arrival_window_min: number;
  visit_status: VisitStatus; job_status: JobStatus; title: string | null; priority: string; customer_name: string; customer_phone: string | null;
  site_address: SiteAddress; type_name: string | null; type_color: string | null; form_kind: string | null; estimated_total: number | null; techs: TechChip[];
};
type TimeRow = { id: string; kind: string; started_at: string; ended_at: string | null };
type Tab = "today" | "new" | "paused" | "done";

const PILL: Record<string, string> = {
  scheduled: "bg-[#eef4ff] text-[#2563eb]", on_my_way: "bg-[#f3efff] text-[#6d28d9]", in_progress: "bg-[#fff6e6] text-[#b45309]",
  paused: "bg-[#fff6e6] text-[#b45309]", on_hold: "bg-[#fff1f2] text-[#be123c]", completed: "bg-[#e7f6f1] text-[#0f766e]", cancelled: "bg-slate-100 text-slate-500",
};
const box = "rounded-2xl border border-slate-200 bg-white";
// "48 min" · "1 h 12 min"
const span = (min: number) => { const m = Math.max(0, Math.round(min)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`; };

// Inicio del técnico o colaborador: saludo, reloj del día, resumen, el próximo trabajo, la semana y su lista.
// La lógica es la de siempre (misma consulta tech_my_visits, mismo Clock in / out); aquí solo cambia cómo se ve.
export default function MyJobs({ companyId, userId, firstName = "" }: { companyId: string; userId: string; firstName?: string }) {
  const [day, setDay] = useState(() => dayStart(new Date()));
  const [week, setWeek] = useState(() => startOfWeek(new Date(), 0));
  const [visits, setVisits] = useState<MyVisit[]>([]);
  const [times, setTimes] = useState<TimeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("today");
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const sb = createClient();
    const t0 = dayStart(new Date());
    const [v, s] = await Promise.all([
      sb.rpc("tech_my_visits", { p_company: companyId, p_from: addDays(t0, -60).toISOString(), p_to: addDays(t0, 45).toISOString() }),
      // Registros de tiempo de hoy y los que siguen abiertos: de aquí salen las horas del día y el "working 48 min"
      sb.from("tech_time_entries").select("id, kind, started_at, ended_at").eq("company_id", companyId).eq("user_id", userId)
        .or(`ended_at.is.null,started_at.gte.${t0.toISOString()}`).order("started_at", { ascending: true }),
    ]);
    if (v.error) setError(jobError(v.error)); else { setError(""); setVisits((v.data ?? []) as MyVisit[]); }
    setTimes((s.data ?? []) as TimeRow[]);
    setNow(Date.now());
    setLoading(false);
  }, [companyId, userId]);

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
    const tick = setInterval(() => setNow(Date.now()), 30000); // el reloj y "starts in…" avanzan solos
    const onShow = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onShow);
    return () => { clearTimeout(t); clearInterval(iv); clearInterval(tick); sb.removeChannel(ch); document.removeEventListener("visibilitychange", onShow); };
  }, [companyId, userId, load]);

  const shift = times.find((r) => r.kind === "shift" && !r.ended_at) ?? null;

  async function clock() {
    setBusy(true);
    const pos = await new Promise<GeolocationPosition | null>((ok) => navigator.geolocation ? navigator.geolocation.getCurrentPosition(ok, () => ok(null), { enableHighAccuracy: true, timeout: 8000 }) : ok(null));
    const { error: e } = await createClient().rpc("tech_clock", { p_company: companyId, p_action: shift ? "out" : "in", p_lat: pos?.coords.latitude ?? null, p_lng: pos?.coords.longitude ?? null });
    setBusy(false);
    if (e) return setError(e.hint || jobError(e));
    locCheck(); // Paso 5.9: empieza o deja de compartir la ubicación al momento
    load();
  }
  function goDay(d: Date) { setDay(d); const w = startOfWeek(d, 0); if (w.getTime() !== week.getTime()) setWeek(w); }

  const today = new Date(now);
  const t0 = dayStart(today).getTime();
  const tomorrow = addDays(dayStart(today), 1);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const count = (d: Date) => visits.filter((v) => sameDay(new Date(v.starts_at), d) && v.visit_status !== "completed" && v.visit_status !== "cancelled").length;
  const byStart = (a: MyVisit, b: MyVisit) => a.starts_at.localeCompare(b.starts_at);

  const open = visits.filter((v) => v.visit_status === "on_my_way" || v.visit_status === "in_progress");
  const ofDay = visits.filter((v) => sameDay(new Date(v.starts_at), day) && v.visit_status === "scheduled").sort(byStart);
  const newOnes = visits.filter((v) => v.visit_status === "scheduled" && new Date(v.starts_at) >= tomorrow).sort(byStart);
  const pausedOnes = visits.filter((v) => v.visit_status === "paused" || v.visit_status === "on_hold").sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const doneOnes = visits.filter((v) => v.visit_status === "completed").sort((a, b) => b.starts_at.localeCompare(a.starts_at));

  // Resumen de hoy
  const isLive = (v: MyVisit) => v.visit_status === "on_my_way" || v.visit_status === "in_progress";
  const todays = visits.filter((v) => (sameDay(new Date(v.starts_at), today) && v.visit_status !== "cancelled") || isLive(v));
  const todayLeft = todays.filter((v) => ["scheduled", "on_my_way", "in_progress"].includes(v.visit_status)).length;
  const todayDone = todays.filter((v) => v.visit_status === "completed").length;
  const pct = todays.length ? Math.round((todayDone / todays.length) * 100) : 0;
  const hours = times.filter((r) => r.kind === "shift").reduce((sum, r) => {
    const a = Math.max(new Date(r.started_at).getTime(), t0), b = r.ended_at ? new Date(r.ended_at).getTime() : now;
    return sum + Math.max(0, b - a);
  }, 0) / 3600000;

  // Tarjeta grande: lo que está haciendo ahora o, si no, el siguiente trabajo programado
  const live = open[0] ?? null;
  const next = live ?? visits.filter((v) => v.visit_status === "scheduled" && new Date(v.starts_at).getTime() >= t0).sort(byStart)[0] ?? null;
  const liveSince = live ? times.filter((r) => !r.ended_at && r.kind === (live.visit_status === "on_my_way" ? "travel" : "on_site")).pop() : null;

  const h = today.getHours();
  const hello = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const TABS: [Tab, string, number][] = [["today", "Today", todayLeft], ["new", "New", newOnes.length], ["paused", "Paused", pausedOnes.length], ["done", "Done", doneOnes.length]];

  return (
    <div className="min-h-[calc(100dvh-4rem)] w-full max-w-[100vw] overflow-x-hidden bg-[#f4f6f8] px-3 pb-24 pt-3 sm:px-4 lg:px-6 lg:pb-8 lg:pt-5">
      {/* Saludo */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-[20px] font-semibold tracking-tight text-[#0b1f3a] lg:text-[22px]" suppressHydrationWarning>{hello}{firstName ? `, ${firstName}` : ""}</h1>
          <p className="text-[13px] text-slate-500" suppressHydrationWarning>{today.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })} · My jobs</p>
        </div>
        <SharingBadge className="mt-1 shrink-0" />
      </div>

      {error && <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-[14px] text-red-700">{error}</p>}

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,1fr)_23rem] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-5">
        {/* ===== Resumen: reloj, avance del día y el próximo trabajo (arriba en el celular, a la derecha en la computadora) ===== */}
        <div className="min-w-0 space-y-3 lg:col-start-2 lg:row-start-1">
          {/* Reloj del día */}
          <div className={`group flex items-center gap-3 px-3 py-2.5 ${box} ${shift ? "border-[#9ad9cd]" : ""}`}>
            <ClockArt size={46} running={Boolean(shift)} />
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-semibold leading-tight text-[#0b1f3a]">{shift ? "On the clock" : "Start your day"}</p>
              <p className="mt-0.5 truncate text-[12.5px] text-slate-500" suppressHydrationWarning>
                {shift ? <>Since {fmtTime(new Date(shift.started_at))} · <span className="font-semibold text-[#0f766e]">{hours.toFixed(1)} h</span></>
                  : hours > 0 ? `${hours.toFixed(1)} h worked today` : "Tap Clock in to begin"}
              </p>
            </div>
            <button type="button" onClick={clock} disabled={busy}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-all duration-150 hover:-translate-y-px active:scale-95 disabled:opacity-60 ${shift ? "bg-[#fff1f2] text-[#be123c] ring-1 ring-[#fecdd3] hover:bg-[#ffe4e6]" : "bg-[#0f766e] text-white hover:bg-[#0c5f59]"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${shift ? "animate-pulse bg-[#e11d48]" : "bg-white"}`} />
              {shift ? "Clock out" : "Clock in"}
            </button>
          </div>

          {/* Avance de hoy */}
          <div className={`flex items-center gap-2 px-3 py-3 ${box}`}>
            <div className="flex shrink-0 flex-col items-center">
              <ProgressRing pct={pct} size={58} color="#e8713a" stroke={6} />
              <span className="mt-1 text-[10.5px] font-medium text-slate-500">{todays.length ? `${todayDone} of ${todays.length} done` : "No jobs today"}</span>
            </div>
            <div className="grid min-w-0 flex-1 grid-cols-3">
              <Stat art={<ToolboxArt size={38} />} n={String(todayLeft)} label="To do" onClick={() => { setTab("today"); goDay(dayStart(new Date())); }} />
              <Stat art={<DoneArt size={38} />} n={String(todayDone)} label="Done" onClick={() => setTab("done")} />
              <Stat art={<HoursArt size={38} />} n={hours ? hours.toFixed(1) : "0"} label="Hours" href="/dashboard/jobs/my-timesheet" />
            </div>
          </div>

          {/* Up next / Working now */}
          {loading ? <div className="h-[168px] animate-pulse rounded-2xl bg-slate-200/70" /> : next && (
            <NextCard v={next} now={now} since={liveSince ? new Date(liveSince.started_at).getTime() : null} />
          )}
        </div>

        {/* ===== Lista: pestañas, semana y trabajos ===== */}
        <div className="min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          {/* Pestañas: Hoy · Nuevos · Pausados / a medias · Terminados */}
          <div className="grid grid-cols-4 gap-1 rounded-2xl border border-slate-200 bg-white p-1">
            {TABS.map(([k, l, n]) => (
              <button key={k} type="button" onClick={() => setTab(k)} aria-pressed={tab === k}
                className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 transition-all duration-150 active:scale-95 lg:flex-row lg:justify-center lg:gap-2 lg:py-2 ${tab === k ? "bg-[#e9f7f4] text-[#0f766e]" : "text-slate-500 hover:bg-slate-50"}`}>
                <TabArt kind={k} on={tab === k} />
                <span className="flex items-center gap-1 text-[12.5px] font-semibold">
                  {l}
                  {n > 0 && <span className={`rounded-full px-1.5 text-[10.5px] leading-[1.5] ${k === "paused" ? "bg-[#ffe4e6] text-[#be123c]" : k === "done" ? "bg-[#dcfce7] text-[#15803d]" : tab === k ? "bg-[#0f766e] text-white" : "bg-slate-100 text-slate-500"}`}>{n}</span>}
                </span>
              </button>
            ))}
          </div>

          {tab === "new" && <TabList list={newOnes} empty="No new jobs" hint="Jobs the office assigns you for the coming days show up here." showDay />}
          {tab === "paused" && <TabList list={pausedOnes} empty="Nothing paused" hint="Jobs you paused or left for follow-up (waiting for a part) show up here so you can continue them." showDay />}
          {tab === "done" && <TabList list={doneOnes} empty="No finished jobs yet" hint="Jobs you finish show up here. You can open them to see everything, but they can't be changed." showDay />}

          {tab === "today" && <>
            {/* Semana compacta: toda cabe en la pantalla; el puntito dice que ese día hay trabajo */}
            <div className={`mt-3 flex items-center gap-1 p-1.5 ${box}`}>
              <button type="button" aria-label="Previous week" onClick={() => goDay(addDays(day, -7))} className="flex h-10 w-6 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-[#0f766e]"><svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 5-5 5 5 5" /></svg></button>
              <div className="grid flex-1 grid-cols-7 gap-0.5">
                {days.map((d) => {
                  const on = sameDay(d, day), n = count(d), t = sameDay(d, today);
                  return (
                    <button key={isoDay(d)} type="button" onClick={() => setDay(d)}
                      className={`flex flex-col items-center rounded-xl py-1 transition-all duration-150 active:scale-95 ${on ? "bg-[#0f766e] text-white shadow-sm" : t ? "text-[#0f766e] hover:bg-[#e9f7f4]" : "text-slate-600 hover:bg-slate-50"}`}>
                      <span className="text-[10.5px] font-medium uppercase">{d.toLocaleDateString("en-US", { weekday: "narrow" })}</span>
                      <span className="text-[15px] font-semibold leading-tight">{d.getDate()}</span>
                      <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${n ? (on ? "bg-white" : "bg-[#e8713a]") : "bg-transparent"}`} />
                    </button>
                  );
                })}
              </div>
              <button type="button" aria-label="Next week" onClick={() => goDay(addDays(day, 7))} className="flex h-10 w-6 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-[#0f766e]"><svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m8 5 5 5-5 5" /></svg></button>
            </div>
            {!sameDay(day, today) && <button type="button" onClick={() => goDay(dayStart(new Date()))} className="mt-2 text-[13px] font-semibold text-[#0f766e]">Back to today</button>}

            {/* El trabajo en curso ya está en la tarjeta grande de arriba: aquí solo se repite si hay más de uno */}
            {open.length > 1 && (
              <>
                <p className="mb-1.5 mt-4 flex items-center gap-1.5 text-[12.5px] font-semibold text-[#b45309]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#f59e0b]" />{open.some((v) => v.visit_status === "in_progress") ? "Working now" : "On my way"}</p>
                <div className="space-y-2">{open.slice(1).map((v) => <JobRow key={v.visit_id} v={v} live />)}</div>
              </>
            )}

            <p className="mb-1.5 mt-4 text-[12.5px] font-semibold text-slate-500">
              {sameDay(day, today) ? "Today" : day.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}{!loading && ofDay.length > 0 ? ` · ${ofDay.length} job${ofDay.length === 1 ? "" : "s"}${sameDay(day, today) ? " left" : ""}` : ""}
            </p>
            {loading ? (
              <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-[62px] animate-pulse rounded-2xl bg-slate-200/70" />)}</div>
            ) : ofDay.length === 0 && sameDay(day, today) && open.length > 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-center text-[13px] text-slate-500">Nothing else scheduled for today.</p>
            ) : ofDay.length === 0 ? (
              <Empty title={sameDay(day, today) && todayDone > 0 && open.length === 0 ? "All done for today" : "No jobs this day"}
                hint={sameDay(day, today) && todayDone > 0 && open.length === 0 ? "Nice work. New jobs show up here as soon as the office assigns them." : "When the office assigns you a job it shows up here and you get an alert."} />
            ) : (
              <div className="space-y-2">{ofDay.map((v, i) => <JobRow key={v.visit_id} v={v} delay={i} />)}</div>
            )}
          </>}
        </div>

        {/* ===== Accesos rápidos ===== */}
        <div className="min-w-0 lg:col-start-2 lg:row-start-2">
          <p className="mb-1.5 mt-2 text-[12.5px] font-semibold text-slate-500 lg:mt-0">Shortcuts</p>
          <div className="grid grid-cols-3 gap-2">
            <Shortcut href="/dashboard/jobs/my-timesheet" label="My Timesheet" art={<TimesheetArt size={40} />} />
            <Shortcut href="/dashboard/inventory/van" label="My Van" art={<VanArt size={40} />} />
            <Shortcut href="/dashboard/inventory/scan" label="Scan part" art={<ScanArt size={40} />} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Número del resumen (To do · Done · Hours): toca y lleva a su lista
function Stat({ art, n, label, onClick, href }: { art: React.ReactNode; n: string; label: string; onClick?: () => void; href?: string }) {
  const cls = "group flex flex-col items-center rounded-xl py-1 transition-all duration-150 hover:bg-slate-50 active:scale-95";
  const inner = <>
    {art}
    <span className="mt-0.5 text-[17px] font-semibold leading-tight text-[#0b1f3a]" suppressHydrationWarning>{n}</span>
    <span className="text-[11px] text-slate-500">{label}</span>
  </>;
  return href ? <Link prefetch={false} href={href} className={cls}>{inner}</Link> : <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}

function Shortcut({ href, label, art }: { href: string; label: string; art: React.ReactNode }) {
  return (
    <Link prefetch={false} href={href} className={`group flex flex-col items-center px-1 py-2.5 text-center transition-all duration-150 hover:-translate-y-0.5 hover:border-[#9ad9cd] hover:shadow-sm active:scale-95 ${box}`}>
      {art}
      <span className="mt-1 text-[11.5px] font-semibold leading-tight text-[#0b1f3a]">{label}</span>
    </Link>
  );
}

// Tarjeta grande del próximo trabajo (o del que está en curso) con sus cuatro accesos: Navigate · Call · Chat · Open
function NextCard({ v, now, since }: { v: MyVisit; now: number; since: number | null }) {
  const s = new Date(v.starts_at), e = new Date(v.ends_at);
  const live = v.visit_status === "on_my_way" || v.visit_status === "in_progress";
  const mins = (s.getTime() - now) / 60000;
  const isToday = sameDay(s, new Date(now));
  const isTomorrow = sameDay(s, addDays(dayStart(new Date(now)), 1));
  const head = v.visit_status === "in_progress" ? "Working now" : v.visit_status === "on_my_way" ? "On my way" : "Up next";
  const chip = live ? (since ? `${v.visit_status === "on_my_way" ? "Driving" : "Working"} ${span((now - since) / 60000)}` : "")
    : !isToday ? (isTomorrow ? "Tomorrow" : s.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }))
    : mins > 0 ? `Starts in ${span(mins)}` : mins > -5 ? "Starting now" : `Due ${span(-mins)} ago`;
  const late = !live && isToday && mins <= -5;
  const maps = navLink(v.site_address), addr = addressLine(v.site_address);
  const href = `/dashboard/jobs/mine/${v.job_id}`;
  return (
    <div className={`overflow-hidden rounded-2xl border animate-[bp-fade_0.25s_ease-out] ${live ? "border-[#fcd38d] bg-[#fffbf3]" : "border-[#9ad9cd] bg-[#f4fbf9]"}`}>
      <Link prefetch={false} href={href} className="block px-3.5 pb-2 pt-3 active:bg-black/[0.02]">
        <div className="flex items-center justify-between gap-2">
          <p className={`flex items-center gap-1.5 text-[12.5px] font-semibold ${live ? "text-[#b45309]" : "text-[#0f766e]"}`}>
            {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#f59e0b]" />}{head}
          </p>
          {chip && <span suppressHydrationWarning className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${late ? "bg-[#fff1f2] text-[#be123c]" : live ? "bg-[#fff1d6] text-[#b45309]" : "bg-white text-[#b45309] ring-1 ring-[#fcd9b6]"}`}>{chip}</span>}
        </div>
        <div className="mt-1.5 flex items-start gap-2.5">
          {live ? <StatusArt s={v.visit_status} size={40} /> : <JobArt size={40} color={v.type_color ?? "#14a39a"} />}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[16.5px] font-semibold leading-tight text-[#0b1f3a]">
              {(v.priority === "urgent" || v.priority === "high") && <span className={`h-2 w-2 shrink-0 rounded-full ${v.priority === "urgent" ? "bg-[#e11d48]" : "bg-[#f59e0b]"}`} title={v.priority} />}
              <span className="truncate">{v.customer_name || v.number}</span>
            </p>
            <p className="mt-0.5 truncate text-[12.5px] text-slate-600">{[v.type_name ?? v.title, `${fmtTime(s)} – ${fmtTime(e)}`].filter(Boolean).join(" · ")}</p>
            {addr && <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-slate-500">{addr}</p>}
          </div>
          {v.estimated_total != null && <span className="shrink-0 text-[13px] font-semibold text-slate-700">{usd(v.estimated_total)}</span>}
        </div>
      </Link>
      <div className="grid grid-cols-4 gap-1 px-2 pb-2.5 pt-1">
        <Action label="Navigate" href={maps} external art={<NavArt size={42} />} />
        <Action label="Call" href={v.customer_phone ? `tel:${v.customer_phone.replace(/[^\d+]/g, "")}` : null} art={<CallArt size={42} />} />
        <Action label="Chat" href={`${href}?chat=1`} internal art={<ChatArt size={42} />} />
        <Action label="Open" href={href} internal art={<OpenArt size={42} />} />
      </div>
    </div>
  );
}

// Ícono redondo con su nombre abajo. Sin dirección o sin teléfono queda apagado.
function Action({ label, href, art, external, internal }: { label: string; href: string | null; art: React.ReactNode; external?: boolean; internal?: boolean }) {
  const cls = "group flex flex-col items-center rounded-xl py-1 transition-all duration-150 hover:bg-white/70 active:scale-90";
  const inner = <><span className="transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:scale-105">{art}</span><span className="mt-0.5 text-[11px] font-semibold text-slate-600">{label}</span></>;
  if (!href) return <span aria-disabled="true" title={`No ${label === "Call" ? "phone number" : "address"} on this job`} className="flex flex-col items-center py-1 opacity-35 grayscale">{inner}</span>;
  if (internal) return <Link prefetch={false} href={href} className={cls}>{inner}</Link>;
  return <a href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})} className={cls}>{inner}</a>;
}

function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-6 text-center">
      <EmptyArt size={84} />
      <p className="mt-2 text-[15px] font-semibold text-[#0b1f3a]">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-[13px] text-slate-500">{hint}</p>
    </div>
  );
}

function TabList({ list, empty, hint, showDay }: { list: MyVisit[]; empty: string; hint: string; showDay?: boolean }) {
  if (!list.length) return <div className="mt-3"><Empty title={empty} hint={hint} /></div>;
  return <div className="mt-3 space-y-2">{list.map((v, i) => <JobRow key={v.visit_id} v={v} showDay={showDay} delay={i} />)}</div>;
}

// Fila compacta (2 líneas): hora a la izquierda, ícono del estado, cliente y trabajo. Al tocar abre el trabajo completo.
function JobRow({ v, live = false, showDay = false, delay = 0 }: { v: MyVisit; live?: boolean; showDay?: boolean; delay?: number }) {
  const s = new Date(v.starts_at), e = new Date(v.ends_at);
  const done = v.visit_status === "completed";
  const held = v.visit_status === "on_hold" || v.visit_status === "paused";
  const urgent = v.priority === "urgent" || v.priority === "high";
  const art = done || held || live;
  return (
    <Link prefetch={false} href={`/dashboard/jobs/mine/${v.job_id}`}
      style={{ animationDelay: `${Math.min(delay, 8) * 40}ms` }}
      className={`group flex items-center gap-2.5 rounded-2xl border px-3 py-2 transition-all duration-150 animate-[bp-fade_0.25s_ease-out_backwards] hover:-translate-y-px hover:shadow-sm active:scale-[0.99] ${done ? "border-slate-200 bg-slate-50 text-slate-500" : held ? "border-[#fecdd3] bg-[#fff7f8]" : live ? "border-[#fcd38d] bg-[#fffbf3]" : "border-slate-200 bg-white hover:border-[#9ad9cd]"}`}>
      <div className="w-[3.4rem] shrink-0 text-right">
        {showDay && <p className="text-[11px] font-semibold uppercase leading-tight text-slate-400">{s.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>}
        <p className={`text-[13.5px] font-semibold leading-tight ${done ? "text-slate-500" : "text-[#0b1f3a]"}`}>{fmtTime(s).replace(" ", " ")}</p>
        {!showDay && <p className="text-[11.5px] leading-tight text-slate-400">{fmtTime(e).replace(" ", " ")}</p>}
      </div>
      <span className="transition-transform duration-150 group-hover:scale-110">
        {art ? <StatusArt s={v.visit_status} size={34} /> : <JobArt size={34} color={v.type_color ?? "#14a39a"} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`flex items-center gap-1.5 truncate text-[15px] font-semibold leading-tight ${done ? "text-slate-500" : "text-[#0b1f3a]"}`}>
          {urgent && <span className={`h-2 w-2 shrink-0 rounded-full ${v.priority === "urgent" ? "bg-[#e11d48]" : "bg-[#f59e0b]"}`} title={v.priority} />}
          <span className="truncate">{v.customer_name || v.number}</span>
        </p>
        <p className="mt-0.5 truncate text-[12.5px] text-slate-500">{[v.type_name ?? v.title, addressLine(v.site_address).split(",")[0]].filter(Boolean).join(" · ")}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {/* "Scheduled" y "In progress" no se escriben: el ícono ya lo dice y así el nombre del cliente cabe completo en el celular */}
        {!done && !live && v.visit_status !== "scheduled" && <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${PILL[v.visit_status] ?? PILL.scheduled}`}>{VISIT_LABEL[v.visit_status]}</span>}
        {v.estimated_total != null && <span className="text-[12px] font-semibold text-slate-600">{usd(v.estimated_total)}</span>}
      </div>
      <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-300 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[#0f766e]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m8 5 5 5-5 5" /></svg>
    </Link>
  );
}
