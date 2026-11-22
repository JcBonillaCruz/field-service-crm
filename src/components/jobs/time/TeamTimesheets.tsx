"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TeamMember, dayStart, isoDay, receivesJobs, sameDay } from "@/lib/jobs";
import {
  DaySum, Period, RemovedTime, TimeEntry, Totals, byDay, fmtClock as fmtClockEn, hm, isStale, moveAnchor, needsTimeSql, rangeLabel as rangeLabelEn, rangeOf, totalOf,
} from "@/lib/timesheets";
import SelectMenu from "@/components/ui/SelectMenu";
import ExportModal from "@/components/customers/ExportModal";
import { TechDot } from "@/components/jobs/EventBar";
import { Arrow, Chevron, EntryLine, KpiArt, KpiKind, Legend, RemovedLine, SplitBar, TimeNeedSql, TimesheetArt } from "@/components/jobs/time/TimeBits";
import TimeEntryDialog, { TimeAsk } from "@/components/jobs/time/TimeEntryDialog";

import { useTranslations } from "next-intl";
import { useJobsTx, useTimeError } from "@/i18n/useJobsTx";
type Show = "all" | "hours" | "live" | "review";
type Row = { m: TeamMember; days: DaySum[]; total: Totals; live: TimeEntry | null; doing: TimeEntry | null; stale: TimeEntry[] };

// Timesheets de la oficina (Paso 5.7): horas de todo el equipo por semana, 2 semanas o mes.
// Se corrige con motivo (queda firmado) y se exporta a Excel con el mismo pop-up de siempre.
export default function TeamTimesheets({ companyId, team, weekStartsOn, canDelete }: {
  companyId: string; team: TeamMember[]; weekStartsOn: number; canDelete: boolean;
}) {
  const t = useTranslations("teamTime");
  const tc = useTranslations("common");
  const tr = useTranslations("roles");
  const jt = useJobsTx();
  const timeError = useTimeError();
  const fmtClock = (iso: string | null | undefined) => fmtClockEn(iso, jt.tag);
  const rangeLabel = (p: Period, a: Date, b: Date) => rangeLabelEn(p, a, b, jt.tag);
  const SHOW_OPTIONS = [{ value: "all", label: t("sAll") }, { value: "hours", label: t("sHours") }, { value: "live", label: t("sLive") }, { value: "review", label: t("sReview") }];
  const PERIOD_OPTIONS = [{ value: "week", label: t("pWeek") }, { value: "2weeks", label: t("p2weeks") }, { value: "month", label: t("pMonth") }];
  const [period, setPeriod] = useState<Period>("week");
  const [anchor, setAnchor] = useState(() => dayStart(new Date()));
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [removed, setRemoved] = useState<RemovedTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needSql, setNeedSql] = useState(false);
  const [q, setQ] = useState("");
  const [show, setShow] = useState<Show>("all");
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [ask, setAsk] = useState<TimeAsk | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState<{ m: string; err?: boolean } | null>(null);
  const flash = (m: string, err = false) => { setToast({ m, err }); setTimeout(() => setToast((x) => (x?.m === m ? null : x)), err ? 5000 : 2600); };

  const { from, to, days } = useMemo(() => rangeOf(period, anchor, weekStartsOn), [period, anchor, weekStartsOn]);
  const today = new Date();
  const current = today >= from && today < to;

  const load = useCallback(async () => {
    const sb = createClient();
    const [e, r] = await Promise.all([
      sb.rpc("timesheet_entries", { p_company: companyId, p_from: from.toISOString(), p_to: to.toISOString() }),
      sb.from("tech_time_log").select("id, entry_id, user_id, kind, old_started_at, old_ended_at, reason, actor_name, created_at")
        .eq("company_id", companyId).eq("action", "delete").gte("old_started_at", from.toISOString()).lt("old_started_at", to.toISOString()),
    ]);
    if (e.error) { if (needsTimeSql(e.error)) setNeedSql(true); else setError(timeError(e.error)); }
    else { setError(""); setEntries((e.data ?? []) as TimeEntry[]); }
    setRemoved((r.data ?? []) as RemovedTime[]);
    setNow(Date.now());
    setLoading(false);
  }, [companyId, from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setLoading(true); load(); }, [load]);
  // En vivo: cuando alguien marca entrada/salida o empieza un trabajo (y de todos modos cada minuto)
  useEffect(() => {
    const sb = createClient();
    let tm: ReturnType<typeof setTimeout>;
    const again = () => { clearTimeout(tm); tm = setTimeout(load, 600); };
    const ch = sb.channel(`timesheets-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tech_time_entries", filter: `company_id=eq.${companyId}` }, again).subscribe();
    const iv = setInterval(() => { if (document.visibilityState === "visible") load(); }, 60000);
    const onShow = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onShow);
    return () => { clearTimeout(tm); clearInterval(iv); sb.removeChannel(ch); document.removeEventListener("visibilitychange", onShow); };
  }, [companyId, load]);

  // Una fila por persona: quien recibe trabajos + cualquiera que tenga horas en el periodo
  const rows = useMemo<Row[]>(() => {
    const keys = new Set(days.map(isoDay));
    const byUser = new Map<string, TimeEntry[]>();
    for (const e of entries) byUser.set(e.user_id, [...(byUser.get(e.user_id) ?? []), e]);
    return team.filter((m) => receivesJobs(m) || byUser.has(m.user_id)).map((m) => {
      const mine = byUser.get(m.user_id) ?? [];
      const map = byDay(mine, now);
      const list = Array.from(map.values()).filter((d) => keys.has(d.key)).sort((a, b) => a.key.localeCompare(b.key));
      const open = mine.filter((e) => !e.ended_at && !isStale(e, now));
      return {
        m, days: list, total: totalOf(list),
        live: open.find((e) => e.kind === "shift") ?? null, doing: open.find((e) => e.kind !== "shift") ?? null,
        stale: mine.filter((e) => isStale(e, now)),
      };
    });
  }, [team, entries, days, now]);

  const sum = useMemo(() => rows.reduce((a, r) => ({ worked: a.worked + r.total.worked, site: a.site + r.total.site, travel: a.travel + r.total.travel }), { worked: 0, site: 0, travel: 0 }), [rows]);
  const liveCount = rows.filter((r) => r.live || r.doing).length;
  const reviewCount = rows.filter((r) => r.stale.length).length;

  const list = useMemo(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter((r) => {
      if (show === "hours" && r.total.worked <= 0) return false;
      if (show === "live" && !(r.live || r.doing)) return false;
      if (show === "review" && !r.stale.length) return false;
      return terms.every((w) => `${r.m.full_name} ${r.m.job_title ?? ""} ${r.m.role}`.toLowerCase().includes(w));
    }).sort((a, b) => Number(Boolean(b.stale.length)) - Number(Boolean(a.stale.length)) || b.total.worked - a.total.worked || a.m.full_name.localeCompare(b.m.full_name));
  }, [rows, q, show]);
  const maxWorked = Math.max(1, ...rows.map((r) => r.total.worked));

  if (needSql) return <TimeNeedSql />;

  const toggle = (id: string) => setOpenIds((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  const done = (msg: string) => { setAsk(null); flash(msg); load(); };
  const go = (dir: -1 | 1) => setAnchor(moveAnchor(period, anchor, dir));
  const label = rangeLabel(period, from, to);

  const status = (r: Row) =>
    r.stale.length ? <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff1f2] px-2 py-0.5 text-[11.5px] font-semibold text-[#be123c]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#e11d48]" />{t("missed")}</span>
      : r.doing ? <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff6e6] px-2 py-0.5 text-[11.5px] font-semibold text-[#b45309]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#f59e0b]" />{r.doing.kind === "travel" ? t("driving") : t("onSite")}{r.doing.job_number ? ` · ${r.doing.job_number}` : ""}</span>
        : r.live ? <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e7f8ee] px-2 py-0.5 text-[11.5px] font-semibold text-[#15803d]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#22c55e]" />{t("inSince", { t: fmtClock(r.live.started_at) })}</span>
          : <span className="text-[12.5px] text-slate-400">{t("off")}</span>;

  // Lo que se abre al tocar a una persona: sus días, cada registro con su lápiz y "+ Add time"
  const detail = (r: Row) => {
    const gone = removed.filter((x) => x.user_id === r.m.user_id);
    const goneOf = (key: string) => gone.filter((x) => x.old_started_at && isoDay(new Date(x.old_started_at)) === key);
    const keys = Array.from(new Set([...r.days.map((d) => d.key), ...gone.map((x) => isoDay(new Date(x.old_started_at as string)))])).sort();
    const maxDay = Math.max(8 * 60, ...r.days.map((d) => d.worked));
    return (
      <div className="bg-[#f8fafb] px-3.5 py-3 lg:px-5">
        {r.stale.filter((e) => !keys.includes(isoDay(new Date(e.started_at)))).map((e) => (
          <div key={e.id} className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-[#fecdd3] bg-white px-3 py-2 text-[13px] text-[#be123c]">
            <span className="min-w-0 flex-1">{t("stillOpen", { day: jt.dayShort(new Date(e.started_at)), t: fmtClock(e.started_at) })}</span>
            <button type="button" onClick={() => setAsk({ entry: e })} className="rounded-lg bg-[#be123c] px-2.5 py-1 text-[12.5px] font-semibold text-white">{t("fix")}</button>
          </div>
        ))}
        {keys.length === 0 ? <p className="py-2 text-[13px] text-slate-500">{t("noTime")}</p> : (
          <ul className="space-y-2">
            {keys.map((key) => {
              const d = r.days.find((x) => x.key === key);
              const date = new Date(`${key}T12:00:00`);
              return (
                <li key={key} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <p className="w-28 shrink-0 text-[13.5px] font-semibold text-[#0b1f3a]">{jt.dayShort(date)}</p>
                    {d && d.entries.length > 0 && <>
                      <p className="text-[13px] tabular-nums text-slate-600">{fmtClock(d.firstIn)} – {d.open ? (d.stale ? "?" : t("now")) : fmtClock(d.lastOut)}</p>
                      <span className="hidden w-40 lg:block"><SplitBar site={d.site} travel={d.travel} other={d.other} max={maxDay} /></span>
                      <p className="ml-auto text-[13px] text-slate-500">{t.rich("siteTravel", { s: hm(d.site, "0m"), t: hm(d.travel, "0m"), b: (c) => <b className="tabular-nums text-slate-700">{c}</b> })}</p>
                      <p className="w-16 text-right text-[14px] font-semibold tabular-nums text-[#0b1f3a]">{hm(d.worked, "0m")}</p>
                    </>}
                  </div>
                  <ul className="mt-1 divide-y divide-slate-100 border-t border-slate-100">
                    {d?.entries.map((e) => <EntryLine key={e.id} e={e} now={now} jobHref={(id) => `/dashboard/jobs/${id}`} onEdit={(x) => setAsk({ entry: x })} />)}
                    {goneOf(key).map((x) => <RemovedLine key={x.id} r={x} />)}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => setAsk({ add: { userId: r.m.user_id, day: current ? isoDay(today) : isoDay(from) } })}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#0f766e] hover:underline">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4v12M4 10h12" /></svg>{t("addFor", { name: r.m.full_name.split(" ")[0] })}
          </button>
          <Legend />
        </div>
      </div>
    );
  };

  const kpi = (kind: KpiKind, title: string, value: string, hint: string, onClick?: () => void, on = false) => (
    <button type="button" onClick={onClick} disabled={!onClick}
      className={`group flex items-center gap-3 rounded-2xl border bg-white px-3.5 py-3 text-left transition-all duration-200 enabled:hover:-translate-y-0.5 enabled:hover:shadow-[0_8px_24px_rgba(15,40,60,0.08)] disabled:cursor-default ${on ? "border-[#14a39a] ring-2 ring-[#14a39a]/15" : "border-slate-200"}`}>
      <KpiArt kind={kind} />
      <span className="min-w-0">
        <span className="block text-[12px] font-medium text-slate-500">{title}</span>
        <span className="block text-[20px] font-semibold leading-tight tabular-nums text-[#0b1f3a]">{value}</span>
        <span className="block truncate text-[11.5px] text-slate-400">{hint}</span>
      </span>
    </button>
  );

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[#f4f6f8] px-3 pb-24 pt-4 lg:px-6 lg:pb-8 lg:pt-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto flex min-w-0 items-center gap-3">
          <span className="hidden shrink-0 sm:inline-flex"><TimesheetArt size={44} /></span>
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold tracking-tight text-[#0b1f3a]">{t("title")}</h1>
            <p className="text-[13px] text-slate-500">{t("intro")}</p>
          </div>
        </div>
        <button type="button" onClick={() => setAsk({ add: { day: current ? isoDay(today) : isoDay(from) } })}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[14px] font-semibold text-slate-700 transition-colors hover:border-[#14a39a] hover:text-[#0f766e]">
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4v12M4 10h12" /></svg>{t("addTime")}
        </button>
        <button type="button" onClick={() => setExportOpen(true)}
          className="group inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#0f766e] px-3.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#0c5f59]">
          <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform duration-200 group-hover:translate-y-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3v9M6.5 8.5 10 12l3.5-3.5M4 15.5h12" /></svg>{t("export")}
        </button>
      </div>

      {/* Periodo: semana / 2 semanas / mes, con flechas */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
          <button type="button" aria-label={t("prev")} onClick={() => go(-1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100"><Arrow dir="left" /></button>
          <p className="min-w-[10.5rem] px-1 text-center text-[14px] font-semibold text-[#0b1f3a]">{label}</p>
          <button type="button" aria-label={t("next")} onClick={() => go(1)} disabled={current} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30"><Arrow dir="right" /></button>
        </div>
        {!current && <button type="button" onClick={() => setAnchor(dayStart(new Date()))} className="text-[13px] font-semibold text-[#0f766e]">{tc("today")}</button>}
        <div className="w-32"><SelectMenu value={period} options={PERIOD_OPTIONS} onChange={(v) => setPeriod(v as Period)} ariaLabel={t("period")} /></div>
        <div className="w-44"><SelectMenu value={show} options={SHOW_OPTIONS} onChange={(v) => setShow(v as Show)} ariaLabel={t("show")} /></div>
        <div className="relative w-full sm:ml-auto sm:w-64">
          <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.9"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} aria-label={t("search")}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-[14px] focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15" />
          {q && <button type="button" onClick={() => setQ("")} aria-label={t("clear")} className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition-all hover:rotate-90 hover:bg-red-50 hover:text-red-600">
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 5l10 10M15 5 5 15" /></svg></button>}
        </div>
      </div>

      {error && <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-[14px] text-red-700">{error}</p>}

      <div className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        {kpi("hours", t("kHours"), hm(sum.worked, "0h"), label)}
        {kpi("site", t("kSite"), hm(sum.site, "0h"), sum.worked > 0 ? t("pctHours", { n: Math.round((sum.site / sum.worked) * 100) }) : t("atJobs"))}
        {kpi("travel", t("kTravel"), hm(sum.travel, "0h"), sum.worked > 0 ? t("pctHours", { n: Math.round((sum.travel / sum.worked) * 100) }) : t("toJobs"))}
        {kpi("live", t("kLive"), String(liveCount), liveCount ? t("tapWho") : t("nobody"), () => setShow(show === "live" ? "all" : "live"), show === "live")}
        {kpi("review", t("kReview"), String(reviewCount), reviewCount ? t("missedOuts") : t("allGood"), () => setShow(show === "review" ? "all" : "review"), show === "review")}
      </div>

      {loading ? (
        <div className="mt-3 space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-white" />)}</div>
      ) : list.length === 0 ? (
        <div className="mt-4 flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center">
          <TimesheetArt size={56} />
          <p className="mt-3 text-[16px] font-semibold text-[#0b1f3a]">{rows.length === 0 ? t("noMembers") : t("noMatch")}</p>
          <p className="mt-1 max-w-sm text-[13.5px] text-slate-500">{rows.length === 0 ? t("noMembersHint") : t("noMatchHint")}</p>
          {rows.length > 0 && <button type="button" onClick={() => { setQ(""); setShow("all"); }} className="mt-4 text-[14px] font-semibold text-[#0f766e] hover:underline">{t("showAll")}</button>}
        </div>
      ) : (
        <>
          {/* Computadora: tabla; al tocar una fila se abre el detalle por día */}
          <div className="mt-3 hidden overflow-hidden rounded-2xl border border-slate-200 bg-white lg:block">
            <table className="w-full text-left text-[14px]">
              <thead><tr className="border-b border-slate-200 text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="py-3 pl-5 pr-3">{t("thMember")}</th><th className="py-3 pr-3">{t("thNow")}</th><th className="py-3 pr-3 text-right" title={t("thDaysHint")}>{t("thDays")}</th><th className="py-3 pr-3 text-right">{t("thSite")}</th>
                <th className="py-3 pr-3 text-right">{t("thTravel")}</th><th className="py-3 pr-3 text-right">{t("thOther")}</th><th className="py-3 pr-3 text-right">{t("thJobs")}</th><th className="w-56 py-3 pr-3">{t("thHours")}</th><th className="w-10 py-3 pr-4" />
              </tr></thead>
              <tbody>
                {list.map((r) => {
                  const open = openIds.includes(r.m.user_id);
                  return [
                    <tr key={r.m.user_id} onClick={() => toggle(r.m.user_id)} className={`cursor-pointer border-b border-slate-100 transition-colors hover:bg-[#f6fcfa] ${open ? "bg-[#f6fcfa]" : ""}`}>
                      <td className="py-2.5 pl-5 pr-3"><span className="flex items-center gap-2.5"><TechDot t={{ initials: r.m.initials, color: r.m.color, avatar_url: r.m.avatar_url, name: r.m.full_name }} size={32} />
                        <span className="min-w-0"><span className="block truncate font-medium text-[#0b1f3a]">{r.m.full_name}</span>
                          <span className="block truncate text-[12px] capitalize text-slate-500">{r.m.job_title || (tr.has(r.m.role as never) ? tr(r.m.role as never) : r.m.role)}{r.m.worker_type === "subcontractor" ? t("sub") : ""}</span></span></span></td>
                      <td className="py-2.5 pr-3">{status(r)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-slate-700">{r.total.days || "—"}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-slate-700">{hm(r.total.site)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-slate-700">{hm(r.total.travel)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-slate-500">{hm(r.total.other)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-slate-700">{r.total.jobs || "—"}</td>
                      <td className="py-2.5 pr-3"><span className="flex items-center gap-2.5">
                        <span className="w-[4.6rem] shrink-0 font-semibold tabular-nums text-[#0b1f3a]">{hm(r.total.worked)}</span>
                        <SplitBar site={r.total.site} travel={r.total.travel} other={r.total.other} max={maxWorked} />
                        {r.total.edited && <span title={t("corrections")} className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#f59e0b]" />}</span></td>
                      <td className="py-2.5 pr-4"><Chevron open={open} /></td>
                    </tr>,
                    open && <tr key={`${r.m.user_id}-d`} className="border-b border-slate-100"><td colSpan={9} className="p-0">{detail(r)}</td></tr>,
                  ];
                })}
              </tbody>
            </table>
          </div>

          {/* Celular: una tarjeta compacta por persona */}
          <ul className="mt-3 space-y-2 lg:hidden">
            {list.map((r) => {
              const open = openIds.includes(r.m.user_id);
              return (
                <li key={r.m.user_id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <button type="button" onClick={() => toggle(r.m.user_id)} aria-expanded={open} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
                    <TechDot t={{ initials: r.m.initials, color: r.m.color, avatar_url: r.m.avatar_url, name: r.m.full_name }} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-[#0b1f3a]">{r.m.full_name}</span>
                      <span className="mt-0.5 block">{status(r)}</span>
                      {r.total.worked > 0 && <span className="mt-1.5 block"><SplitBar site={r.total.site} travel={r.total.travel} other={r.total.other} max={maxWorked} /></span>}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[16px] font-semibold tabular-nums text-[#0b1f3a]">{hm(r.total.worked)}</span>
                      <span className="block text-[11.5px] text-slate-500">{r.total.days ? t("nDays", { n: r.total.days }) : t("noHours")}</span>
                    </span>
                    <Chevron open={open} />
                  </button>
                  {open && <div className="border-t border-slate-100">{detail(r)}</div>}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[12.5px] text-slate-500">{t("footer")}</p>
        </>
      )}

      <TimeEntryDialog ask={ask} companyId={companyId} team={team} canDelete={canDelete} onClose={() => setAsk(null)} onDone={done} />
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} initialModule="Timesheets" defaultScope="view"
        view={{ module: "Timesheets", label, ids: list.map((r) => r.m.user_id), columns: [], range: { from: isoDay(from), to: isoDay(days[days.length - 1]) } }} />
      {toast && <div role="status" className={`fixed bottom-5 left-1/2 z-[95] max-w-[92vw] -translate-x-1/2 rounded-xl px-4 py-2.5 text-[13.5px] font-medium text-white shadow-lg animate-[bp-pop-in_0.2s_ease-out] ${toast.err ? "bg-[#be123c]" : "bg-[#0b1f3a]"}`}>{toast.m}</div>}
    </div>
  );
}
