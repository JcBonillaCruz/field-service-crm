"use client";

import { useTranslations } from "next-intl";
import { useFmt, useJobError } from "@/i18n/useFmt";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { locCheck } from "@/lib/live-map";
import { SharingBadge } from "@/components/jobs/tech/LocationPinger";
import {
  JobStatus, SiteAddress, TechChip, VisitStatus, addDays, addressLine, dayStart, isoDay, navLink, sameDay, startOfMonth, startOfWeek,
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
// "48 min" · "1 h 12 min" (igual en inglés y español)
const span = (min: number) => { const m = Math.max(0, Math.round(min)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`; };

// Inicio del técnico o colaborador: saludo, reloj del día, resumen, el próximo trabajo, la semana y su lista.
// La lógica es la de siempre (misma consulta tech_my_visits, mismo Clock in / out); aquí solo cambia cómo se ve.
export default function MyJobs({ companyId, userId, firstName = "" }: { companyId: string; userId: string; firstName?: string }) {
  const [day, setDay] = useState(() => dayStart(new Date()));
  const t = useTranslations("myJobs");
  const ts = useTranslations("status");
  const fmt = useFmt();
  const jobErr = useJobError();
  const [month, setMonth] = useState(() => startOfMonth(new Date())); // mes que muestra el calendario (Paso 5.11b)
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
      // Siempre 60 días atrás y 45 adelante; si el calendario está en otro mes, también ese mes completo
      sb.rpc("tech_my_visits", { p_company: companyId,
        p_from: new Date(Math.min(addDays(t0, -60).getTime(), addDays(month, -7).getTime())).toISOString(),
        p_to: new Date(Math.max(addDays(t0, 45).getTime(), addDays(month, 45).getTime())).toISOString() }),
      // Registros de tiempo de hoy y los que siguen abiertos: de aquí salen las horas del día y el "working 48 min"
      sb.from("tech_time_entries").select("id, kind, started_at, ended_at").eq("company_id", companyId).eq("user_id", userId)
        .or(`ended_at.is.null,started_at.gte.${t0.toISOString()}`).order("started_at", { ascending: true }),
    ]);
    if (v.error) setError(jobErr(v.error)); else { setError(""); setVisits((v.data ?? []) as MyVisit[]); }
    setTimes((s.data ?? []) as TimeRow[]);
    setNow(Date.now());
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, userId, month]);

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
    if (e) return setError(jobErr(e));
    locCheck(); // Paso 5.9: empieza o deja de compartir la ubicación al momento
    load();
  }
  function goDay(d: Date) { setDay(d); const m = startOfMonth(d); if (m.getTime() !== month.getTime()) setMonth(m); }
  const goMonth = (dir: -1 | 1) => setMonth(new Date(month.getFullYear(), month.getMonth() + dir, 1));

  const today = new Date(now);
  const t0 = dayStart(today).getTime();
  const tomorrow = addDays(dayStart(today), 1);
  // Calendario del mes: semanas completas (domingo a sábado); la sexta fila solo si hace falta
  const gridStart = startOfWeek(month, 0);
  const weeksInView = Math.ceil((month.getDay() + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7);
  const days = Array.from({ length: weeksInView * 7 }, (_, i) => addDays(gridStart, i));
  const weekdays = Array.from({ length: 7 }, (_, i) => fmt.date(addDays(gridStart, i), { weekday: "narrow" }));
  const doneOn = (d: Date) => visits.filter((v) => sameDay(new Date(v.starts_at), d) && v.visit_status === "completed").length;
  const count = (d: Date) => visits.filter((v) => sameDay(new Date(v.starts_at), d) && v.visit_status !== "completed" && v.visit_status !== "cancelled").length;
  const byStart = (a: MyVisit, b: MyVisit) => a.starts_at.localeCompare(b.starts_at);

  const open = visits.filter((v) => v.visit_status === "on_my_way" || v.visit_status === "in_progress");
  const ofDay = visits.filter((v) => sameDay(new Date(v.starts_at), day) && v.visit_status === "scheduled").sort(byStart);
  // Un día que no es hoy también muestra lo que ya se hizo o quedó en pausa ese día
  const ofDayPast = sameDay(day, new Date(now)) ? [] : visits.filter((v) => sameDay(new Date(v.starts_at), day) && ["completed", "paused", "on_hold"].includes(v.visit_status)).sort(byStart);
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
  const hello = t(h < 12 ? "morning" : h < 18 ? "afternoon" : "evening");
  const TABS: [Tab, string, number][] = [["today", t("tabToday"), todayLeft], ["new", t("tabNew"), newOnes.length], ["paused", t("tabPaused"), pausedOnes.length], ["done", t("tabDone"), doneOnes.length]];
  const onToday = sameDay(day, today) && month.getTime() === startOfMonth(today).getTime();

  return (
    <div className="min-h-[calc(100dvh-4rem)] w-full max-w-[100vw] overflow-x-hidden bg-[#f4f6f8] px-3 pb-24 pt-3 sm:px-4 lg:px-6 lg:pb-8 lg:pt-5">
      {/* Saludo */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-[20px] font-semibold tracking-tight text-[#0b1f3a] lg:text-[22px]" suppressHydrationWarning>{hello}{firstName ? `, ${firstName}` : ""}</h1>
          <p className="text-[13px] text-slate-500" suppressHydrationWarning>{fmt.dayLong(today)} · {t("title")}</p>
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
              <p className="text-[14.5px] font-semibold leading-tight text-[#0b1f3a]">{shift ? t("onClock") : t("startDay")}</p>
              <p className="mt-0.5 truncate text-[12.5px] text-slate-500" suppressHydrationWarning>
                {shift ? <>{t("since", { time: fmt.time(new Date(shift.started_at)) })} · <span className="font-semibold text-[#0f766e]">{hours.toFixed(1)} h</span></>
                  : hours > 0 ? t("workedToday", { h: hours.toFixed(1) }) : t("tapClockIn")}
              </p>
            </div>
            <button type="button" onClick={clock} disabled={busy}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-all duration-150 hover:-translate-y-px active:scale-95 disabled:opacity-60 ${shift ? "bg-[#fff1f2] text-[#be123c] ring-1 ring-[#fecdd3] hover:bg-[#ffe4e6]" : "bg-[#0f766e] text-white hover:bg-[#0c5f59]"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${shift ? "animate-pulse bg-[#e11d48]" : "bg-white"}`} />
              {shift ? t("clockOut") : t("clockIn")}
            </button>
          </div>

          {/* Avance de hoy */}
          <div className={`flex items-center gap-2 px-3 py-3 ${box}`}>
            <div className="flex shrink-0 flex-col items-center">
              <ProgressRing pct={pct} size={58} color="#e8713a" stroke={6} />
              <span className="mt-1 text-[10.5px] font-medium text-slate-500">{todays.length ? t("doneOf", { done: todayDone, total: todays.length }) : t("noJobsToday")}</span>
            </div>
            <div className="grid min-w-0 flex-1 grid-cols-3">
              <Stat art={<ToolboxArt size={38} />} n={String(todayLeft)} label={t("toDo")} onClick={() => { setTab("today"); goDay(dayStart(new Date())); }} />
              <Stat art={<DoneArt size={38} />} n={String(todayDone)} label={t("done")} onClick={() => setTab("done")} />
              <Stat art={<HoursArt size={38} />} n={hours ? hours.toFixed(1) : "0"} label={t("hours")} href="/dashboard/jobs/my-timesheet" />
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

          {tab === "new" && <TabList list={newOnes} empty={t("emptyNew")} hint={t("emptyNewHint")} showDay />}
          {tab === "paused" && <TabList list={pausedOnes} empty={t("emptyPaused")} hint={t("emptyPausedHint")} showDay />}
          {tab === "done" && <TabList list={doneOnes} empty={t("emptyDone")} hint={t("emptyDoneHint")} showDay />}

          {tab === "today" && <>
            {/* Paso 5.11b: calendario del mes completo. Naranja = trabajos por hacer (hasta 3 puntos), verde = día con todo hecho */}
            <div className={`mt-3 p-2.5 ${box}`}>
              <div className="flex items-center gap-1">
                <button type="button" aria-label={t("prevMonth")} onClick={() => goMonth(-1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-50 hover:text-[#0f766e] active:scale-95"><svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 5-5 5 5 5" /></svg></button>
                <p className="min-w-0 flex-1 text-center text-[15px] font-semibold text-[#0b1f3a]" suppressHydrationWarning>{fmt.date(month, { month: "long", year: "numeric" }).replace(/^./, (c) => c.toUpperCase())}</p>
                <button type="button" aria-label={t("nextMonth")} onClick={() => goMonth(1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-50 hover:text-[#0f766e] active:scale-95"><svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m8 5 5 5-5 5" /></svg></button>
                {!onToday && <button type="button" onClick={() => goDay(dayStart(new Date()))} className="ml-1 shrink-0 rounded-lg bg-[#e9f7f4] px-2.5 py-1.5 text-[12.5px] font-semibold text-[#0f766e] transition-transform active:scale-95">{t("today")}</button>}
              </div>
              <div className="mt-1 grid grid-cols-7">
                {weekdays.map((w, i) => <span key={i} className="py-1 text-center text-[10.5px] font-semibold uppercase text-slate-400" suppressHydrationWarning>{w}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-y-0.5">
                {days.map((d) => {
                  const inMonth = d.getMonth() === month.getMonth();
                  const on = sameDay(d, day), n = count(d), isT = sameDay(d, today), allDone = !n && doneOn(d) > 0;
                  return (
                    <button key={isoDay(d)} type="button" onClick={() => goDay(d)} aria-pressed={on}
                      className={`mx-auto flex h-11 w-11 flex-col items-center justify-center rounded-full transition-all duration-150 active:scale-90 ${on ? "bg-[#0f766e] text-white shadow-sm" : isT ? "text-[#0f766e] ring-2 ring-[#9ad9cd] hover:bg-[#e9f7f4]" : inMonth ? "text-slate-700 hover:bg-slate-50" : "text-slate-300 hover:bg-slate-50"}`}>
                      <span className="text-[14.5px] font-semibold leading-none">{d.getDate()}</span>
                      <span className="mt-1 flex h-1.5 items-center gap-0.5">
                        {n > 0 ? Array.from({ length: Math.min(n, 3) }, (_, i) => <span key={i} className={`h-1.5 w-1.5 rounded-full ${on ? "bg-white" : "bg-[#e8713a]"}`} />)
                          : allDone ? <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-white" : "bg-[#16a34a]"}`} /> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* El trabajo en curso ya está en la tarjeta grande de arriba: aquí solo se repite si hay más de uno */}
            {open.length > 1 && (
              <>
                <p className="mb-1.5 mt-4 flex items-center gap-1.5 text-[12.5px] font-semibold text-[#b45309]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#f59e0b]" />{open.some((v) => v.visit_status === "in_progress") ? t("workingNow") : t("onMyWay")}</p>
                <div className="space-y-2">{open.slice(1).map((v) => <JobRow key={v.visit_id} v={v} live />)}</div>
              </>
            )}

            <p className="mb-1.5 mt-4 text-[12.5px] font-semibold text-slate-500">
              {sameDay(day, today) ? t("today") : fmt.dayLong(day)}{!loading && ofDay.length > 0 ? ` · ${t(sameDay(day, today) ? "jobsLeft" : "jobsCount", { count: ofDay.length })}` : ""}
            </p>
            {loading ? (
              <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-[62px] animate-pulse rounded-2xl bg-slate-200/70" />)}</div>
            ) : ofDay.length === 0 && sameDay(day, today) && open.length > 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-center text-[13px] text-slate-500">{t("nothingElse")}</p>
            ) : ofDay.length === 0 && ofDayPast.length > 0 ? null : ofDay.length === 0 ? (
              <Empty title={sameDay(day, today) && todayDone > 0 && open.length === 0 ? t("allDoneToday") : t("noJobsDay")}
                hint={sameDay(day, today) && todayDone > 0 && open.length === 0 ? t("allDoneHint") : t("noJobsDayHint")} />
            ) : (
              <div className="space-y-2">{ofDay.map((v, i) => <JobRow key={v.visit_id} v={v} delay={i} />)}</div>
            )}
            {/* Paso 5.11b: en un día que no es hoy también salen los terminados o en pausa de ese día */}
            {!loading && ofDayPast.length > 0 && (
              <>
                <p className="mb-1.5 mt-4 text-[12.5px] font-semibold text-slate-500">{t("doneOrPaused")}</p>
                <div className="space-y-2">{ofDayPast.map((v, i) => <JobRow key={v.visit_id} v={v} delay={i} />)}</div>
              </>
            )}
          </>}
        </div>

        {/* ===== Accesos rápidos ===== */}
        <div className="min-w-0 lg:col-start-2 lg:row-start-2">
          <p className="mb-1.5 mt-2 text-[12.5px] font-semibold text-slate-500 lg:mt-0">{t("shortcuts")}</p>
          <div className="grid grid-cols-3 gap-2">
            <Shortcut href="/dashboard/jobs/my-timesheet" label={t("myTimesheet")} art={<TimesheetArt size={40} />} />
            <Shortcut href="/dashboard/inventory/van" label={t("myVan")} art={<VanArt size={40} />} />
            <Shortcut href="/dashboard/inventory/scan" label={t("scanPart")} art={<ScanArt size={40} />} />
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
  const t = useTranslations("myJobs");
  const tc = useTranslations("common");
  const fmt = useFmt();
  const s = new Date(v.starts_at), e = new Date(v.ends_at);
  const live = v.visit_status === "on_my_way" || v.visit_status === "in_progress";
  const mins = (s.getTime() - now) / 60000;
  const isToday = sameDay(s, new Date(now));
  const isTomorrow = sameDay(s, addDays(dayStart(new Date(now)), 1));
  const head = v.visit_status === "in_progress" ? t("workingNow") : v.visit_status === "on_my_way" ? t("onMyWay") : t("upNext");
  const chip = live ? (since ? t(v.visit_status === "on_my_way" ? "driving" : "working", { time: span((now - since) / 60000) }) : "")
    : !isToday ? (isTomorrow ? tc("tomorrow") : fmt.dayShort(s))
    : mins > 0 ? t("startsIn", { time: span(mins) }) : mins > -5 ? t("startingNow") : t("dueAgo", { time: span(-mins) });
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
              {(v.priority === "urgent" || v.priority === "high") && <span className={`h-2 w-2 shrink-0 rounded-full ${v.priority === "urgent" ? "bg-[#e11d48]" : "bg-[#f59e0b]"}`} title={t(`prio.${v.priority}`)} />}
              <span className="truncate">{v.customer_name || v.number}</span>
            </p>
            <p className="mt-0.5 truncate text-[12.5px] text-slate-600">{[v.type_name ?? v.title, `${fmt.time(s)} – ${fmt.time(e)}`].filter(Boolean).join(" · ")}</p>
            {addr && <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-slate-500">{addr}</p>}
          </div>
          {v.estimated_total != null && <span className="shrink-0 text-[13px] font-semibold text-slate-700">{fmt.usd(v.estimated_total)}</span>}
        </div>
      </Link>
      <div className="grid grid-cols-4 gap-1 px-2 pb-2.5 pt-1">
        <Action label={t("navigate")} off={t("noAddress")} href={maps} external art={<NavArt size={42} />} />
        <Action label={tc("call")} off={t("noPhone")} href={v.customer_phone ? `tel:${v.customer_phone.replace(/[^\d+]/g, "")}` : null} art={<CallArt size={42} />} />
        <Action label={t("chat")} href={`${href}?chat=1`} internal art={<ChatArt size={42} />} />
        <Action label={tc("open")} href={href} internal art={<OpenArt size={42} />} />
      </div>
    </div>
  );
}

// Ícono redondo con su nombre abajo. Sin dirección o sin teléfono queda apagado.
function Action({ label, href, art, external, internal, off = "" }: { label: string; href: string | null; art: React.ReactNode; external?: boolean; internal?: boolean; off?: string }) {
  const cls = "group flex flex-col items-center rounded-xl py-1 transition-all duration-150 hover:bg-white/70 active:scale-90";
  const inner = <><span className="transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:scale-105">{art}</span><span className="mt-0.5 text-[11px] font-semibold text-slate-600">{label}</span></>;
  if (!href) return <span aria-disabled="true" title={off} className="flex flex-col items-center py-1 opacity-35 grayscale">{inner}</span>;
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
  const t = useTranslations("myJobs");
  const ts = useTranslations("status");
  const fmt = useFmt();
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
        {showDay && <p className="text-[11px] font-semibold uppercase leading-tight text-slate-400">{fmt.monthDay(s)}</p>}
        <p className={`text-[13.5px] font-semibold leading-tight ${done ? "text-slate-500" : "text-[#0b1f3a]"}`}>{fmt.time(s).replace(" ", " ")}</p>
        {!showDay && <p className="text-[11.5px] leading-tight text-slate-400">{fmt.time(e).replace(" ", " ")}</p>}
      </div>
      <span className="transition-transform duration-150 group-hover:scale-110">
        {/* el check de los terminados va más chico: son muchos y no deben pesar en la lista */}
        {art ? <StatusArt s={v.visit_status} size={done ? 24 : 34} /> : <JobArt size={34} color={v.type_color ?? "#14a39a"} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`flex items-center gap-1.5 truncate text-[15px] font-semibold leading-tight ${done ? "text-slate-500" : "text-[#0b1f3a]"}`}>
          {urgent && <span className={`h-2 w-2 shrink-0 rounded-full ${v.priority === "urgent" ? "bg-[#e11d48]" : "bg-[#f59e0b]"}`} title={t(`prio.${v.priority}`)} />}
          <span className="truncate">{v.customer_name || v.number}</span>
        </p>
        <p className="mt-0.5 truncate text-[12.5px] text-slate-500">{[v.type_name ?? v.title, addressLine(v.site_address).split(",")[0]].filter(Boolean).join(" · ")}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {/* "Scheduled" y "In progress" no se escriben: el ícono ya lo dice y así el nombre del cliente cabe completo en el celular */}
        {!done && !live && v.visit_status !== "scheduled" && <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${PILL[v.visit_status] ?? PILL.scheduled}`}>{ts(v.visit_status)}</span>}
        {v.estimated_total != null && <span className="text-[12px] font-semibold text-slate-600">{fmt.usd(v.estimated_total)}</span>}
      </div>
      <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-300 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[#0f766e]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m8 5 5 5-5 5" /></svg>
    </Link>
  );
}
