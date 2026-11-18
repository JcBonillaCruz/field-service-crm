"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { dayStart, isoDay, sameDay } from "@/lib/jobs";
import { KIND_META, RemovedTime, TimeEntry, byDay, fmtClock, hm, moveAnchor, needsTimeSql, rangeLabel, rangeOf, sumDay, timeError, totalOf } from "@/lib/timesheets";
import { useSwipe } from "@/components/ui/useSwipe";
import { Arrow, Chevron, EntryLine, RemovedLine, SplitBar, TimeNeedSql, TimesheetArt } from "@/components/jobs/time/TimeBits";

// Mi hoja de tiempos (Paso 5.7): cada quien ve SUS horas por día y por semana.
// Los tiempos salen solos de los botones del trabajo (On my way, Start, Pause, Finish) y de Clock in / Clock out.
// Nadie cambia sus propias horas: si algo está mal, la oficina lo corrige y aquí queda el motivo.
export default function MyTimesheet({ companyId, userId, weekStartsOn }: { companyId: string; userId: string; weekStartsOn: number }) {
  const [anchor, setAnchor] = useState(() => dayStart(new Date()));
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [removed, setRemoved] = useState<RemovedTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needSql, setNeedSql] = useState(false);
  const [openDay, setOpenDay] = useState<string | null>(() => isoDay(new Date()));
  const [shift, setShift] = useState<{ id: string; started_at: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const { from, to, days } = useMemo(() => rangeOf("week", anchor, weekStartsOn), [anchor, weekStartsOn]);
  const today = new Date();
  const thisWeek = today >= from && today < to;

  const load = useCallback(async () => {
    const sb = createClient();
    const [e, r, s] = await Promise.all([
      sb.rpc("timesheet_entries", { p_company: companyId, p_from: from.toISOString(), p_to: to.toISOString(), p_user: userId }),
      sb.from("tech_time_log").select("id, entry_id, user_id, kind, old_started_at, old_ended_at, reason, actor_name, created_at")
        .eq("company_id", companyId).eq("user_id", userId).eq("action", "delete").gte("old_started_at", from.toISOString()).lt("old_started_at", to.toISOString()),
      sb.from("tech_time_entries").select("id, started_at").eq("company_id", companyId).eq("user_id", userId).eq("kind", "shift").is("ended_at", null).maybeSingle(),
    ]);
    if (e.error) { if (needsTimeSql(e.error)) setNeedSql(true); else setError(timeError(e.error)); }
    else { setError(""); setEntries((e.data ?? []) as TimeEntry[]); }
    setRemoved((r.data ?? []) as RemovedTime[]);
    setShift((s.data as { id: string; started_at: string } | null) ?? null);
    setNow(Date.now());
    setLoading(false);
  }, [companyId, userId, from, to]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  useEffect(() => {
    const iv = setInterval(() => { if (document.visibilityState === "visible") load(); }, 60000);
    const onShow = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onShow);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onShow); };
  }, [load]);

  async function clock() {
    setBusy(true);
    const pos = await new Promise<GeolocationPosition | null>((ok) => navigator.geolocation ? navigator.geolocation.getCurrentPosition(ok, () => ok(null), { enableHighAccuracy: true, timeout: 8000 }) : ok(null));
    const { error: e } = await createClient().rpc("tech_clock", { p_company: companyId, p_action: shift ? "out" : "in", p_lat: pos?.coords.latitude ?? null, p_lng: pos?.coords.longitude ?? null });
    setBusy(false);
    if (e) return setError(timeError(e));
    load();
  }

  const go = (dir: -1 | 1) => { const a = moveAnchor("week", anchor, dir); setAnchor(a); setOpenDay(null); };
  const swipe = useSwipe(() => go(-1), () => { if (!thisWeek) go(1); });

  const sums = useMemo(() => {
    const map = byDay(entries, now);
    return days.map((d) => map.get(isoDay(d)) ?? sumDay(isoDay(d), [], now));
  }, [entries, days, now]);
  const total = totalOf(sums);
  const maxDay = Math.max(8 * 60, ...sums.map((s) => s.worked));
  const removedOf = (key: string) => removed.filter((r) => r.old_started_at && isoDay(new Date(r.old_started_at)) === key);

  if (needSql) return <TimeNeedSql />;

  const metric = (label: string, value: number, color: string) => (
    <div>
      <p className="flex items-baseline justify-between text-[13px]"><span className="text-slate-500">{label}</span><b className="tabular-nums text-[#0b1f3a]">{hm(value, "0m")}</b></p>
      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100">
        <span className="block h-full origin-left animate-[bp-grow-x_0.6s_ease-out] rounded-full transition-[width] duration-500" style={{ width: `${total.worked > 0 ? Math.min(100, (value / total.worked) * 100) : 0}%`, background: color }} />
      </span>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-3 pb-24 pt-3 sm:px-4 lg:pt-6" {...swipe}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="hidden shrink-0 sm:inline-flex"><TimesheetArt size={40} /></span>
          <div className="min-w-0">
            <h1 className="text-[20px] font-semibold tracking-tight text-[#0b1f3a]">My timesheet</h1>
            <p className="truncate text-[13px] text-slate-500">Your hours, day by day</p>
          </div>
        </div>
        <button type="button" onClick={clock} disabled={busy}
          className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-all active:scale-95 disabled:opacity-60 ${shift ? "bg-[#fff1f2] text-[#be123c] ring-1 ring-[#fecdd3]" : "bg-[#0f766e] text-white"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${shift ? "animate-pulse bg-[#e11d48]" : "bg-white"}`} />
          {shift ? <>Clock out <span className="font-normal opacity-80">since {fmtClock(shift.started_at)}</span></> : "Clock in"}
        </button>
      </div>

      {/* Semana: flechas (o deslizar con el dedo) */}
      <div className="mt-3 flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1.5">
        <button type="button" aria-label="Previous week" onClick={() => go(-1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100"><Arrow dir="left" /></button>
        <p className="flex-1 text-center text-[14px] font-semibold text-[#0b1f3a]">{thisWeek ? "This week · " : ""}<span className={thisWeek ? "font-medium text-slate-500" : ""}>{rangeLabel("week", from, to)}</span></p>
        <button type="button" aria-label="Next week" onClick={() => go(1)} disabled={thisWeek} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30"><Arrow dir="right" /></button>
      </div>
      {!thisWeek && <button type="button" onClick={() => { setAnchor(dayStart(new Date())); setOpenDay(isoDay(new Date())); }} className="mt-2 text-[13px] font-semibold text-[#0f766e]">Back to this week</button>}

      {error && <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-[14px] text-red-700">{error}</p>}

      {/* Resumen de la semana: un dato por línea con su barra */}
      <section className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-4">
        {loading ? <div className="h-[132px] animate-pulse rounded-xl bg-slate-100" /> : (
          <>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[12.5px] font-medium text-slate-500">Hours this week</p>
                <p className="text-[30px] font-semibold leading-tight tracking-tight text-[#0b1f3a] tabular-nums">{hm(total.worked, "0h")}</p>
              </div>
              <p className="pb-1 text-right text-[12.5px] leading-snug text-slate-500">{total.days} day{total.days === 1 ? "" : "s"} worked<br />{total.jobs} job{total.jobs === 1 ? "" : "s"}</p>
            </div>
            <div className="mt-4 space-y-3.5">
              {metric("On site", total.site, KIND_META.on_site.color)}
              {metric("Travel", total.travel, KIND_META.travel.color)}
              {metric("Other time", total.other, "#9ad9cd")}
            </div>
          </>
        )}
      </section>

      {/* Día por día */}
      <ul className="mt-4 space-y-2">
        {sums.map((s, i) => {
          const d = days[i], isToday = sameDay(d, today), future = d > today && !isToday;
          const open = openDay === s.key, gone = removedOf(s.key);
          const has = s.entries.length > 0 || gone.length > 0;
          return (
            <li key={s.key} className={`overflow-hidden rounded-2xl border bg-white transition-colors ${isToday ? "border-[#9ad9cd]" : "border-slate-200"} ${future ? "opacity-50" : ""}`}>
              <button type="button" disabled={!has} onClick={() => setOpenDay(open ? null : s.key)} aria-expanded={open}
                className="flex w-full items-center gap-3 px-3.5 py-3 text-left disabled:cursor-default">
                <span className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl ${isToday ? "bg-[#0f766e] text-white" : "bg-slate-100 text-slate-600"}`}>
                  <span className="text-[10px] font-semibold uppercase leading-none">{d.toLocaleDateString("en-US", { weekday: "short" })}</span>
                  <span className="text-[15px] font-semibold leading-tight">{d.getDate()}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[14px] font-medium text-[#0b1f3a]">
                    {!s.entries.length ? <span className="font-normal text-slate-400">{future ? "—" : "No time recorded"}</span>
                      : <span className="tabular-nums">{fmtClock(s.firstIn)} – {s.open ? (s.stale ? "?" : "now") : fmtClock(s.lastOut)}</span>}
                    {s.open && !s.stale && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#16a34a]" title="Clocked in" />}
                    {s.stale && <span className="rounded-full bg-[#fff1f2] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#be123c]">Missed clock-out</span>}
                    {s.edited && <span className="rounded-full bg-[#fff6e6] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#b45309]">Corrected</span>}
                  </span>
                  {s.entries.length > 0 && <span className="mt-1.5 block"><SplitBar site={s.site} travel={s.travel} other={s.other} max={maxDay} /></span>}
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[15px] font-semibold tabular-nums text-[#0b1f3a]">{hm(s.worked, s.entries.length ? "0m" : "")}</span>
                  {s.jobs > 0 && <span className="block text-[11.5px] text-slate-500">{s.jobs} job{s.jobs === 1 ? "" : "s"}</span>}
                </span>
                {has && <Chevron open={open} />}
              </button>
              {open && has && (
                <ul className="divide-y divide-slate-100 border-t border-slate-100 px-3.5">
                  {s.entries.map((e) => <EntryLine key={e.id} e={e} now={now} jobHref={(id) => `/dashboard/jobs/mine/${id}`} />)}
                  {gone.map((r) => <RemovedLine key={r.id} r={r} />)}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-center text-[12.5px] leading-relaxed text-slate-500">
        Time is recorded when you tap Clock in, On my way, Start and Finish.<br />
        Something wrong? Ask the office to correct it — the change shows here with the reason.
      </p>
      <p className="mt-2 text-center"><Link prefetch={false} href="/dashboard/jobs/mine" className="text-[13px] font-semibold text-[#0f766e]">Go to My Jobs</Link></p>
    </div>
  );
}
