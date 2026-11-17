"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions, Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { createClient } from "@/lib/supabase/client";
import { Check, Chevron, optionClass, panelClass } from "@/components/ui/SearchSelect";
import DatePicker from "@/components/ui/DatePicker";
import { BarChart } from "@/components/dashboard/charts";
import { JobsArt } from "@/components/AppIcons";
import { TechDot, TechDots } from "@/components/jobs/EventBar";
import { DelayTag, GroupArt, ProgressRing } from "@/components/jobs/ops/OpsBits";
import { AlertIcon, TeamArt } from "@/components/home/DashArt";
import { OPS_GROUPS, OpsGroup, OpsJob, delayOf, fold, groupOf as groupAt, progressOf } from "@/lib/operations";
import { TeamMember, addDays, dayStart, fmtTime, fromIsoDay, isoDay, jobError, receivesJobs, startOfMonth, startOfWeek } from "@/lib/jobs";
import type { AlertApp, HomeAlert, RevenueData, RevenueRange } from "@/lib/home-dashboard";

// =====================================================================
// Dashboard de trabajos y alertas (Paso 5.3f) — la primera pantalla al entrar.
// Lee los mismos trabajos que Operations (función ops_board) y se actualiza en vivo.
// No cambia nada de Operations, Schedule, Assign jobs ni My Jobs.
// =====================================================================

type Period = "today" | "week" | "month";
const PERIODS: { v: Period; label: string; prev: string }[] = [
  { v: "today", label: "Today", prev: "vs yesterday" },
  { v: "week", label: "This week", prev: "vs last week" },
  { v: "month", label: "This month", prev: "vs last month" },
];
type ListWhen = "today" | "tomorrow" | "week" | "month" | "open" | "pick";
const LIST_WHEN: { v: ListWhen; label: string }[] = [
  { v: "today", label: "Today" }, { v: "tomorrow", label: "Tomorrow" }, { v: "week", label: "This week" },
  { v: "month", label: "This month" }, { v: "open", label: "All open jobs" }, { v: "pick", label: "Pick a date…" },
];
const STATUS_OPTS: { v: OpsGroup | "all"; label: string }[] = [{ v: "all", label: "Any status" }, ...OPS_GROUPS.map((g) => ({ v: g.id, label: g.label }))];
const APP_OPTS: { v: AlertApp | "all"; label: string }[] = [{ v: "all", label: "All apps" }, { v: "jobs", label: "Jobs" }, { v: "inventory", label: "Inventory" }, { v: "finances", label: "Finances" }];
const LEVEL_RANK = { red: 0, orange: 1, blue: 2, gray: 3 } as const;
const PAGE = 12;

// Etiqueta de estado (colores de la marca: azul = asignado, naranja = en proceso, rojo = retraso, verde suave = terminado)
const PILL: Record<string, string> = {
  unassigned: "bg-slate-100 text-slate-600 ring-slate-200",
  assigned: "bg-[#eef4ff] text-[#2563eb] ring-[#d6e4ff]",
  on_my_way: "bg-[#eef4ff] text-[#2563eb] ring-[#d6e4ff]",
  in_progress: "bg-[#fff6e6] text-[#b45309] ring-[#fde3b4]",
  paused: "bg-[#fff1e6] text-[#c2410c] ring-[#fed7aa]",
  on_hold: "bg-[#fff1e6] text-[#c2410c] ring-[#fed7aa]",
  delayed: "bg-[#fff1f2] text-[#be123c] ring-[#fecdd3]",
  done: "bg-[#e7f6f1] text-[#0f766e] ring-[#bfe6d8]",
};
function statusOf(j: OpsJob, g: OpsGroup): { key: string; label: string } {
  if (g === "done") return { key: "done", label: "Completed" };
  if (g === "delayed") return { key: "delayed", label: "Delayed" };
  if (g === "unassigned") return { key: "unassigned", label: "Unassigned" };
  const s = j.visit?.status;
  if (s === "on_my_way") return { key: "on_my_way", label: "On the way" };
  if (s === "in_progress") return { key: "in_progress", label: "In progress" };
  if (s === "paused") return { key: "paused", label: "Paused" };
  if (j.status === "on_hold") return { key: "on_hold", label: "On hold" };
  return { key: "assigned", label: "Assigned" };
}
function Pill({ k, children }: { k: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1 ${PILL[k] ?? PILL.unassigned}`}>
    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />{children}</span>;
}

type Person = { id: string; name: string; initials: string; color: string; avatar_url: string | null; state: "on_site" | "on_my_way" | "paused" | "available"; today: number; done: number; next: Date | null };
const PERSON_STATE: Record<Person["state"], { label: string; k: string }> = {
  on_site: { label: "On site", k: "done" }, on_my_way: { label: "On the way", k: "on_my_way" }, paused: { label: "Paused", k: "paused" }, available: { label: "Available", k: "unassigned" },
};

const usd0 = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(v) || 0);
const usd2 = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(v) || 0);
const cityOf = (j: OpsJob) => { const a = j.site_address; if (!a) return ""; return [a.city, a.state].filter(Boolean).join(", ") || a.street || ""; };
const whenText = (j: OpsJob) => {
  const s = j.visit?.starts_at ? new Date(j.visit.starts_at) : null;
  if (!s) return "Not scheduled";
  return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${fmtTime(s)}`;
};

export default function JobsDashboard({ companyId, team, weekStartsOn, canSeePrice, revenue, alerts, header, sample }: {
  companyId: string; team: TeamMember[]; weekStartsOn: number;
  canSeePrice: boolean;          // dueño y manager
  revenue: RevenueData | null;   // solo el dueño
  alerts: HomeAlert[];           // avisos guardados (Jobs, Inventory y —dueño/manager— Finances)
  header?: React.ReactNode;
  sample?: OpsJob[];             // datos de ejemplo (vista previa): no consulta la base
}) {
  const [jobs, setJobs] = useState<OpsJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [period, setPeriod] = useState<Period>("today");
  const reqId = useRef(0);

  // ---------- Datos: los mismos trabajos que Operations ----------
  const load = useCallback(async () => {
    if (sample) { setJobs(sample); setLoading(false); return; }
    const id = ++reqId.current;
    const since = new Date(); since.setMonth(since.getMonth() - 1, 1); since.setHours(0, 0, 0, 0); // terminados desde el mes pasado (para comparar)
    const { data, error: err } = await createClient().rpc("ops_board", { p_company: companyId, p_done_since: since.toISOString() });
    if (id !== reqId.current) return;
    if (err) { setError(jobError(err)); setLoading(false); return; }
    setError(""); setJobs((data ?? []) as OpsJob[]); setLoading(false);
  }, [companyId, sample]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (sample) return;
    const sb = createClient();
    let t: ReturnType<typeof setTimeout>;
    const again = () => { clearTimeout(t); t = setTimeout(load, 700); };
    const ch = sb.channel(`home-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `company_id=eq.${companyId}` }, again)
      .on("postgres_changes", { event: "*", schema: "public", table: "job_visits", filter: `company_id=eq.${companyId}` }, again)
      .on("postgres_changes", { event: "*", schema: "public", table: "job_visit_techs", filter: `company_id=eq.${companyId}` }, again)
      .subscribe();
    const tick = setInterval(() => setNow(Date.now()), 30000); // "Retrasado" aparece solo
    const onVis = () => { if (document.visibilityState === "visible") { setNow(Date.now()); load(); } };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearTimeout(t); clearInterval(tick); sb.removeChannel(ch); document.removeEventListener("visibilitychange", onVis); };
  }, [companyId, load, sample]);

  const withGroup = useMemo(() => jobs.map((j) => ({ j, g: groupAt(j, now) })), [jobs, now]);

  // ---------- Rangos de fechas ----------
  const rangeOf = useCallback((p: Period, shift = 0): [Date, Date] => {
    const d0 = dayStart(new Date(now));
    if (p === "today") { const a = addDays(d0, shift); return [a, addDays(a, 1)]; }
    if (p === "week") { const a = addDays(startOfWeek(d0, weekStartsOn), 7 * shift); return [a, addDays(a, 7)]; }
    const a = startOfMonth(d0); const s = new Date(a.getFullYear(), a.getMonth() + shift, 1); return [s, new Date(s.getFullYear(), s.getMonth() + 1, 1)];
  }, [now, weekStartsOn]);
  const dateOf = (j: OpsJob, g: OpsGroup) => (g === "done" ? (j.completed_at ? new Date(j.completed_at) : j.visit?.starts_at ? new Date(j.visit.starts_at) : null) : j.visit?.starts_at ? new Date(j.visit.starts_at) : null);
  // En el periodo: lo agendado en esas fechas + lo que está pasando ahora o va tarde + lo que no tiene fecha ni persona
  const inRange = useCallback((j: OpsJob, g: OpsGroup, [a, b]: [Date, Date], live = true) => {
    const d = dateOf(j, g);
    if (live && (g === "in_progress" || g === "delayed")) return true;
    if (!d) return g === "unassigned" && live;
    return d >= a && d < b;
  }, []);

  // ---------- KPIs ----------
  const kpi = useMemo(() => {
    const r = rangeOf(period), prev = rangeOf(period, -1);
    const cur = withGroup.filter(({ j, g }) => inRange(j, g, r));
    const count = (g: OpsGroup) => cur.filter((x) => x.g === g).length;
    const prevTotal = withGroup.filter(({ j, g }) => { const d = j.visit?.starts_at ? new Date(j.visit.starts_at) : g === "done" && j.completed_at ? new Date(j.completed_at) : null; return d && d >= prev[0] && d < prev[1]; }).length;
    const prevDone = withGroup.filter(({ j, g }) => g === "done" && j.completed_at && new Date(j.completed_at) >= prev[0] && new Date(j.completed_at) < prev[1]).length;
    const pct = cur.length ? Math.round(cur.reduce((a, x) => a + progressOf(x.j), 0) / cur.length) : 0;
    return { total: cur.length, unassigned: count("unassigned"), working: count("in_progress"), late: count("delayed"), done: count("done"), prevTotal, prevDone, pct };
  }, [withGroup, period, rangeOf, inRange]);

  // ---------- Equipo: quién está en sitio, en camino, en pausa o libre ----------
  const people = useMemo(() => {
    const [a, b] = rangeOf("today");
    const ids = new Set(team.filter((m) => receivesJobs(m)).map((m) => m.user_id));
    withGroup.forEach(({ j }) => j.techs.forEach((t) => ids.add(t.user_id)));
    const list: Person[] = [];
    ids.forEach((id) => {
      const m = team.find((x) => x.user_id === id);
      const chip = jobs.flatMap((j) => j.techs).find((t) => t.user_id === id);
      const mine = withGroup.filter(({ j }) => j.techs.some((t) => t.user_id === id));
      const todays = mine.filter(({ j, g }) => inRange(j, g, [a, b], false) || g === "in_progress");
      const live = mine.map(({ j }) => j.visit?.status);
      const state: Person["state"] = live.includes("in_progress") ? "on_site" : live.includes("on_my_way") ? "on_my_way" : live.includes("paused") ? "paused" : "available";
      const upcoming = todays.filter(({ j, g }) => g !== "done" && j.visit?.starts_at && new Date(j.visit.starts_at).getTime() > now)
        .map(({ j }) => new Date(j.visit!.starts_at!)).sort((x, y) => x.getTime() - y.getTime());
      list.push({
        id, name: m?.full_name || chip?.name || "Team member", initials: m?.initials || chip?.initials || "?", color: m?.color || chip?.color || "#94a3b8",
        avatar_url: m?.avatar_url ?? chip?.avatar_url ?? null, state, today: todays.length, done: todays.filter((x) => x.g === "done").length, next: upcoming[0] ?? null,
      });
    });
    const order = { on_site: 0, on_my_way: 1, paused: 2, available: 3 };
    return list.sort((x, y) => order[x.state] - order[y.state] || y.today - x.today || x.name.localeCompare(y.name));
  }, [team, jobs, withGroup, rangeOf, inRange, now]);
  const freeNow = people.filter((p) => p.state === "available").length;

  // ---------- Avisos: los de trabajos se calculan aquí (en vivo) + los guardados de cada app ----------
  const liveAlerts = useMemo(() => {
    const out: HomeAlert[] = [];
    const soon = addDays(dayStart(new Date(now)), 2).getTime();
    withGroup.forEach(({ j, g }) => {
      const who = j.techs.map((t) => t.name.split(" ")[0]).join(", ");
      const name = j.customer_name || j.title || j.number;
      if (g === "delayed") {
        const d = delayOf(j, now);
        out.push({ id: `late-${j.id}`, app: "jobs", level: "red", kind: "delayed", title: `${d?.label ?? "Late"} · ${name}`, sub: [d?.detail, who].filter(Boolean).join(" · "), pill: "Delayed", href: `/dashboard/jobs/${j.id}`, at: j.visit?.starts_at ?? j.created_at });
      } else if (g === "unassigned") {
        const s = j.visit?.starts_at ? new Date(j.visit.starts_at).getTime() : null;
        if (s !== null && s > soon) return; // sin persona pero falta mucho: aún no es urgente
        const q = new URLSearchParams({ from: "home" }); if (j.visit?.id) q.set("visit", j.visit.id); if (s) q.set("date", isoDay(new Date(s)));
        out.push({ id: `un-${j.id}`, app: "jobs", level: s && s < now ? "red" : "gray", kind: "unassigned", title: `No collaborator · ${name}`, sub: `${j.number} · ${s ? whenText(j) : "Not scheduled yet"}`, pill: "Assign", href: `/dashboard/jobs/assign?${q.toString()}`, at: j.visit?.starts_at ?? j.created_at });
      } else if (j.visit?.status === "paused") {
        out.push({ id: `pa-${j.id}`, app: "jobs", level: "orange", kind: "paused", title: `Paused · ${name}`, sub: [j.number, who].filter(Boolean).join(" · "), pill: "Paused", href: `/dashboard/jobs/${j.id}`, at: j.visit.starts_at ?? j.created_at });
      }
    });
    return out;
  }, [withGroup, now]);
  const allAlerts = useMemo(() => [...liveAlerts, ...alerts].sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || a.at.localeCompare(b.at)), [liveAlerts, alerts]);

  // ---------- Lista de trabajos ----------
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<OpsGroup | "all">("all");
  const [person, setPerson] = useState<string>("all");
  const [when, setWhen] = useState<ListWhen>("today");
  const [pick, setPick] = useState(() => isoDay(new Date()));
  const [shown, setShown] = useState(PAGE);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => setShown(PAGE), [q, status, person, when, pick]);
  const rows = useMemo(() => {
    const d0 = dayStart(new Date(now));
    const r: [Date, Date] | null = when === "today" ? [d0, addDays(d0, 1)] : when === "tomorrow" ? [addDays(d0, 1), addDays(d0, 2)]
      : when === "week" ? rangeOf("week") : when === "month" ? rangeOf("month") : when === "pick" ? [fromIsoDay(pick), addDays(fromIsoDay(pick), 1)] : null;
    const term = fold(q.trim()), digits = q.replace(/\D/g, "");
    return withGroup.filter(({ j, g }) => {
      if (when === "open" ? g === "done" : !inRange(j, g, r!, when === "today")) return false;
      if (status !== "all" && g !== status) return false;
      if (person !== "all" && !j.techs.some((t) => t.user_id === person)) return false;
      if (term && !fold(`${j.number} ${j.customer_name} ${j.title ?? ""} ${j.type_name ?? ""} ${cityOf(j)} ${j.site_address?.street ?? ""} ${j.techs.map((t) => t.name).join(" ")}`).includes(term)
        && !(digits.length >= 3 && (j.customer_phone ?? "").replace(/\D/g, "").includes(digits))) return false;
      return true;
    }).sort((a, b) => {
      const da = a.j.visit?.starts_at ?? "9999", db = b.j.visit?.starts_at ?? "9999";
      return da.localeCompare(db) || a.j.number.localeCompare(b.j.number);
    });
  }, [withGroup, q, status, person, when, pick, now, rangeOf, inRange]);
  const showStatus = (g: OpsGroup | "all") => { setStatus(g); setWhen(g === "unassigned" || g === "delayed" ? "open" : period === "today" ? "today" : period); listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const showPerson = (id: string) => { setPerson(id); setStatus("all"); setWhen("today"); listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const peopleOpts = useMemo(() => [{ v: "all", label: "Everyone" }, ...people.map((p) => ({ v: p.id, label: p.name }))], [people]);
  const periodInfo = PERIODS.find((p) => p.v === period)!;

  return (
    <div className="pb-24 lg:pb-10">
      {header}
      <div className="mx-auto max-w-[1600px] px-3 pt-4 lg:px-8 lg:pt-6">
        {error && <p role="alert" className="mb-4 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-[14px] text-[#be123c]">{error}</p>}

        {/* ======= 1. Resumen (KPIs) + Ingresos del dueño ======= */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[17px] font-semibold text-[#0b1f3a] lg:text-[18px]">Jobs overview</h2>
          <Pick value={period} options={PERIODS} onChange={(v) => setPeriod(v as Period)} ariaLabel="Period for the summary cards" />
        </div>
        <div className={`grid gap-3 lg:gap-4 ${revenue ? "xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]" : ""}`}>
          <div className={`grid grid-cols-2 gap-3 lg:gap-4 ${revenue ? "md:grid-cols-3" : "md:grid-cols-3 2xl:grid-cols-6"}`}>
            <Kpi label="Total jobs" value={kpi.total} art={<JobsArt size={44} />} loading={loading}
              delta={kpi.total - kpi.prevTotal} deltaText={periodInfo.prev} hint={`${kpi.pct}% overall progress`} action="See jobs" onClick={() => showStatus("all")} />
            <Kpi label="Pending" value={kpi.unassigned} art={<GroupArt g="unassigned" size={44} />} loading={loading}
              hint={kpi.unassigned ? "Need a collaborator" : "Everyone has a job"} tone={kpi.unassigned ? "slate" : undefined} action="Assign" onClick={() => showStatus("unassigned")} />
            <Kpi label="Ongoing" value={kpi.working} art={<GroupArt g="in_progress" size={44} />} loading={loading}
              hint="On the way or working" action="See jobs" onClick={() => showStatus("in_progress")} />
            <Kpi label="Delayed" value={kpi.late} art={<GroupArt g="delayed" size={44} />} loading={loading}
              hint={kpi.late ? "Need attention" : "Nothing running late"} tone={kpi.late ? "red" : undefined} action="See jobs" onClick={() => showStatus("delayed")} />
            <Kpi label="Completed" value={kpi.done} art={<GroupArt g="done" size={44} />} loading={loading}
              delta={kpi.done - kpi.prevDone} deltaText={periodInfo.prev} hint={periodInfo.label} action="See jobs" onClick={() => showStatus("done")} />
            <Kpi label="Technician availability" value={freeNow} suffix={people.length ? ` / ${people.length}` : ""} art={<TeamArt size={44} />} loading={loading}
              hint={people.length ? "Free right now" : "No collaborators yet"} action="See team" onClick={() => document.getElementById("bp-team")?.scrollIntoView({ behavior: "smooth", block: "center" })} />
          </div>
          {revenue && <RevenueCard data={revenue} />}
        </div>

        {/* ======= 2. Avisos + Equipo ======= */}
        <div className="mt-4 grid gap-3 lg:mt-5 lg:gap-4 xl:grid-cols-2">
          <AttentionCard alerts={allAlerts} loading={loading} />
          <TeamCard people={people} loading={loading} onPick={showPerson} />
        </div>

        {/* ======= 3. Lista de trabajos ======= */}
        <div ref={listRef} className="mt-4 scroll-mt-24 rounded-2xl border border-slate-200 bg-white lg:mt-5">
          <div className="flex flex-wrap items-center gap-2.5 border-b border-slate-100 px-3 py-3 lg:gap-3 lg:px-5 lg:py-4">
            <div className="mr-auto flex min-w-0 flex-1 items-center gap-2.5 sm:flex-none">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-[#0f766e]">
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v16H4zM8 12l2.5 2.5L16 9" /></svg>
              </span>
              <div>
                <h2 className="text-[17px] font-semibold leading-tight text-[#0b1f3a] lg:text-[18px]">Task list</h2>
                <p className="text-[12.5px] text-slate-500">{loading ? "Loading…" : `${rows.length} job${rows.length === 1 ? "" : "s"}`}</p>
              </div>
              <Link prefetch={false} href="/dashboard/jobs/new" aria-label="Add new job"
                className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0f766e] text-white shadow-sm active:scale-95 sm:hidden">
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>
              </Link>
            </div>
            <label className="relative w-full sm:w-60">
              <span className="sr-only">Search jobs</span>
              <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="9" cy="9" r="5.5" /><path d="m13.5 13.5 3 3" /></svg>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search job, customer, address…"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-[14px] text-slate-800 placeholder:text-slate-400 focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15" />
              {q && <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600">×</button>}
            </label>
            <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:gap-3">
              <Pick value={status} options={STATUS_OPTS} onChange={(v) => setStatus(v as OpsGroup | "all")} ariaLabel="Filter by status" full />
              <Pick value={person} options={peopleOpts} onChange={setPerson} ariaLabel="Filter by collaborator" full />
              <Pick value={when} options={LIST_WHEN} onChange={(v) => setWhen(v as ListWhen)} ariaLabel="Dates" full />
            </div>
            {when === "pick" && <div className="w-full sm:w-44"><DatePicker value={pick} onChange={(v) => v && setPick(v)} /></div>}
            <Link prefetch={false} href="/dashboard/jobs/new"
              className="group hidden h-10 items-center gap-1.5 rounded-lg bg-[#0f766e] px-4 text-[14px] font-semibold text-white shadow-sm transition-all duration-150 hover:-translate-y-px hover:bg-[#0c5f59] hover:shadow-md sm:inline-flex">
              <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>
              Add new
            </Link>
          </div>
          <TaskTable rows={rows.slice(0, shown)} loading={loading} now={now} canSeePrice={canSeePrice} />
          <TaskCards rows={rows.slice(0, shown)} loading={loading} now={now} canSeePrice={canSeePrice} />
          {!loading && !rows.length && (
            <div className="px-6 py-12 text-center">
              <p className="text-[15px] font-semibold text-[#0b1f3a]">No jobs here</p>
              <p className="mt-1 text-[13.5px] text-slate-500">Try another date or status, or create a new job.</p>
            </div>
          )}
          {rows.length > shown && (
            <div className="border-t border-slate-100 p-3 text-center">
              <button type="button" onClick={() => setShown((s) => s + PAGE)} className="rounded-lg px-4 py-2 text-[14px] font-semibold text-[#0f766e] hover:bg-[#e9f7f4]">
                Show more ({rows.length - shown} left)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Selector compacto (Headless UI) ----------
function Pick<T extends string>({ value, options, onChange, ariaLabel, full = false }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; ariaLabel: string; full?: boolean }) {
  const cur = options.find((o) => o.v === value);
  return (
    <Listbox value={value} onChange={onChange}>
      <ListboxButton aria-label={ariaLabel}
        className={`relative flex h-10 min-w-0 items-center ${full ? "w-full sm:w-auto" : ""} sm:max-w-[13rem] gap-2 rounded-lg border border-slate-200 bg-white pl-3.5 pr-9 text-left text-[14px] font-medium text-slate-700 transition-colors hover:border-slate-300 focus:outline-none data-[open]:border-[#0f766e] data-[open]:ring-4 data-[open]:ring-[#14a39a]/15`}>
        <span className="truncate text-[13px] sm:text-[14px]">{cur?.label}</span>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400"><Chevron /></span>
      </ListboxButton>
      <ListboxOptions anchor="bottom end" transition className={`${panelClass} w-[max(var(--button-width),12rem)] focus:outline-none`}>
        {options.map((o) => (
          <ListboxOption key={o.v} value={o.v} className={optionClass}>
            <span className="truncate">{o.label}</span><Check />
          </ListboxOption>
        ))}
      </ListboxOptions>
    </Listbox>
  );
}

// ---------- Tarjeta KPI: blanca, se eleva al pasar el mouse, ícono animado y acción útil ----------
function Kpi({ label, value, suffix = "", art, hint, delta, deltaText, tone, action, onClick, loading }: {
  label: string; value: number; suffix?: string; art: React.ReactNode; hint: string; delta?: number; deltaText?: string;
  tone?: "red" | "slate"; action: string; onClick: () => void; loading: boolean;
}) {
  return (
    <button type="button" onClick={onClick}
      className="group relative flex min-h-[8.5rem] flex-col rounded-2xl border border-slate-200 bg-white p-3.5 text-left transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_28px_rgba(15,40,60,0.09)] lg:p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12.5px] font-medium text-slate-500 lg:text-[13.5px]">{label}</p>
        <span className="-mr-1 -mt-1 shrink-0 scale-90 lg:scale-100">{art}</span>
      </div>
      {loading ? <span className="mt-1 block h-8 w-14 animate-pulse rounded-md bg-slate-100" /> : (
        <p className={`mt-0.5 text-[28px] font-semibold leading-none tracking-tight tabular-nums lg:text-[34px] ${tone === "red" ? "text-[#be123c]" : "text-[#0b1f3a]"}`}>
          {value}<span className="text-[16px] font-medium text-slate-400 lg:text-[18px]">{suffix}</span>
        </p>
      )}
      <div className="mt-auto pt-2 text-[12px] lg:text-[12.5px]">
        {delta !== undefined && !loading && (
          <p className="flex items-center gap-1">
            <span className={`inline-flex items-center gap-0.5 font-semibold ${delta > 0 ? "text-[#0f766e]" : delta < 0 ? "text-[#be123c]" : "text-slate-500"}`}>
              {delta !== 0 && <svg viewBox="0 0 20 20" className={`h-3.5 w-3.5 ${delta < 0 ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15V5M5.5 9.5 10 5l4.5 4.5" /></svg>}
              {delta > 0 ? `+${delta}` : delta}
            </span>
            <span className="truncate text-slate-500">{deltaText}</span>
          </p>
        )}
        <p className="relative h-[1.2em] overflow-hidden">
          <span className="absolute inset-0 truncate text-slate-500 transition-all duration-200 group-hover:-translate-y-full group-hover:opacity-0">{hint}</span>
          <span className="absolute inset-0 translate-y-full truncate font-semibold text-[#0f766e] opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">{action} →</span>
        </p>
      </div>
    </button>
  );
}

// ---------- Ingresos (solo dueño) ----------
const REV_OPTS: { v: RevenueRange; label: string }[] = [{ v: "week", label: "Weekly" }, { v: "month", label: "Monthly" }, { v: "year", label: "Yearly" }];
function RevenueCard({ data }: { data: RevenueData }) {
  const [range, setRange] = useState<RevenueRange>("week");
  const s = data.ranges[range];
  const stats: { label: string; value: number; color: string; note?: string }[] = [
    { label: "Invoiced", value: s.totals.invoiced, color: "#3b82f6" },
    { label: "Collected", value: s.totals.collected, color: "#14a39a" },
    { label: "Outstanding", value: data.outstanding, color: "#94a3b8", note: data.overdue ? `${usd0(data.overdue)} overdue` : "Open balance today" },
    { label: "Costs", value: s.totals.costs, color: "#e8713a" },
    { label: "Profit", value: s.totals.profit, color: s.totals.profit < 0 ? "#be123c" : "#0f766e" },
  ];
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 lg:p-5" aria-label="Revenue overview">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-[17px] font-semibold text-[#0f766e]">$</span>
          <div>
            <h2 className="text-[17px] font-semibold leading-tight text-[#0b1f3a] lg:text-[18px]">Revenue overview</h2>
            <p className="text-[12px] text-slate-500">Only you can see this</p>
          </div>
        </div>
        <Pick value={range} options={REV_OPTS} onChange={(v) => setRange(v as RevenueRange)} ariaLabel="Revenue period" />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5">
        {stats.map((x) => (
          <div key={x.label} className="min-w-0">
            <dt className="flex items-center gap-1.5 text-[12px] text-slate-500"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: x.color }} />{x.label}</dt>
            <dd className="mt-0.5 truncate text-[17px] font-semibold tabular-nums text-[#0b1f3a]" style={x.label === "Profit" ? { color: x.color } : undefined}>{usd0(x.value)}</dd>
            {x.note && <dd className="truncate text-[11px] text-slate-400">{x.note}</dd>}
          </div>
        ))}
      </dl>
      <div className="mt-3">
        <BarChart x={s.labels} label="Revenue overview" format={usd2} height={240} animKey={range} wide={range === "week"}
          emptyText="No money in or out in this period yet."
          series={[
            { key: "inv", label: "Invoiced", color: "#93c5fd", values: s.invoiced },
            { key: "col", label: "Collected", color: "#14a39a", values: s.collected },
            { key: "cost", label: "Costs", color: "#f4a37a", values: s.costs },
          ]} />
      </div>
    </section>
  );
}

// ---------- Necesita atención (todas las apps) ----------
function AttentionCard({ alerts, loading }: { alerts: HomeAlert[]; loading: boolean }) {
  const [app, setApp] = useState<AlertApp | "all">("all");
  const [all, setAll] = useState(false);
  const apps = useMemo(() => new Set(alerts.map((a) => a.app)), [alerts]);
  const list = alerts.filter((a) => app === "all" || a.app === app);
  const shown = all ? list : list.slice(0, 6);
  const reds = alerts.filter((a) => a.level === "red").length;
  const opts = APP_OPTS.filter((o) => o.v === "all" || apps.has(o.v as AlertApp)).map((o) => ({ ...o, label: o.v === "all" ? o.label : `${o.label} (${alerts.filter((a) => a.app === o.v).length})` }));
  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-label="Needs attention">
      {alerts.length > 0 && <span className={`absolute inset-x-0 top-0 h-1 ${reds ? "bg-[#f43f5e]" : "bg-[#f59e0b]"}`} />}
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4 lg:px-5">
        <div className="flex items-center gap-2.5">
          <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${alerts.length ? (reds ? "bg-[#fff1f2] text-[#e11d48]" : "bg-[#fff6e6] text-[#d97706]") : "bg-[#e7f6f1] text-[#0f766e]"}`}>
            <svg viewBox="0 0 24 24" className={`h-[19px] w-[19px] ${alerts.length ? "animate-[bp-ring_2.4s_ease-in-out_infinite] motion-reduce:animate-none" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              {alerts.length ? <path d="M12 3.5 2.5 20h19zM12 10v4.5M12 17.5h.01" /> : <path d="m5 12.5 4.5 4.5L19 7.5" />}
            </svg>
          </span>
          <div>
            <h2 className="text-[17px] font-semibold leading-tight text-[#0b1f3a] lg:text-[18px]">Needs attention</h2>
            <p className="text-[12.5px] text-slate-500">{loading ? "Checking…" : alerts.length ? `${alerts.length} alert${alerts.length === 1 ? "" : "s"}${reds ? ` · ${reds} urgent` : ""}` : "You're all caught up"}</p>
          </div>
        </div>
        {apps.size > 1 && <Pick value={app} options={opts} onChange={(v) => { setApp(v as AlertApp | "all"); setAll(false); }} ariaLabel="Alerts from which app" />}
      </div>
      {loading && !alerts.length ? (
        <ul className="space-y-2 px-4 pb-4 lg:px-5">{[0, 1, 2].map((i) => <li key={i} className="h-14 animate-pulse rounded-xl bg-slate-50" />)}</ul>
      ) : !list.length ? (
        <div className="flex flex-col items-center px-6 pb-8 pt-4 text-center">
          <p className="text-[14.5px] font-semibold text-[#0b1f3a]">Nothing needs you right now</p>
          <p className="mt-1 max-w-sm text-[13px] text-slate-500">Late jobs, jobs without a collaborator, low stock and invoices that are due will show up here.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 px-2 pb-2 lg:px-3">
          {shown.map((a) => (
            <li key={a.id}>
              <Link prefetch={false} href={a.href} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-slate-50 lg:px-3">
                <AlertIcon kind={a.kind} level={a.level} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-[#0b1f3a]">{a.title}</span>
                  <span className="block truncate text-[12.5px] text-slate-500">
                    <span className="font-medium text-slate-400">{a.app === "jobs" ? "Jobs" : a.app === "inventory" ? "Inventory" : "Finances"} · </span>{a.sub}
                  </span>
                </span>
                <Pill k={a.level === "red" ? "delayed" : a.level === "orange" ? "paused" : a.level === "blue" ? "assigned" : "unassigned"}>{a.pill}</Pill>
                <svg viewBox="0 0 20 20" className="hidden h-4 w-4 shrink-0 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-slate-500 sm:block" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m8 5 5 5-5 5" /></svg>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {list.length > 6 && (
        <div className="border-t border-slate-100 px-4 py-2.5 text-center">
          <button type="button" onClick={() => setAll((v) => !v)} className="rounded-lg px-3 py-1.5 text-[13.5px] font-semibold text-[#0f766e] hover:bg-[#e9f7f4]">
            {all ? "Show less" : `See all ${list.length} alerts`}
          </button>
        </div>
      )}
    </section>
  );
}

// ---------- Actividad del equipo ----------
function TeamCard({ people, loading, onPick }: { people: Person[]; loading: boolean; onPick: (id: string) => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? people : people.slice(0, 6);
  const counts = { on_site: 0, on_my_way: 0, paused: 0, available: 0 };
  people.forEach((p) => { counts[p.state] += 1; });
  return (
    <section id="bp-team" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white" aria-label="Team activity">
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4 lg:px-5">
        <div className="flex items-center gap-2.5">
          <span className="group flex"><TeamArt size={36} /></span>
          <div>
            <h2 className="text-[17px] font-semibold leading-tight text-[#0b1f3a] lg:text-[18px]">Team activity</h2>
            <p className="text-[12.5px] text-slate-500">
              {counts.on_site} on site · {counts.on_my_way} on the way · {counts.available} available{counts.paused ? ` · ${counts.paused} paused` : ""}
            </p>
          </div>
        </div>
        <Link prefetch={false} href="/dashboard/jobs/operations" className="shrink-0 rounded-lg px-2.5 py-1.5 text-[13.5px] font-semibold text-[#2563eb] hover:bg-[#eef4ff]">Operations →</Link>
      </div>
      {loading && !people.length ? (
        <ul className="space-y-2 px-4 pb-4 lg:px-5">{[0, 1, 2].map((i) => <li key={i} className="h-14 animate-pulse rounded-xl bg-slate-50" />)}</ul>
      ) : !people.length ? (
        <div className="px-6 pb-8 pt-4 text-center">
          <p className="text-[14.5px] font-semibold text-[#0b1f3a]">No collaborators yet</p>
          <p className="mt-1 text-[13px] text-slate-500">Add people in Team and they will show up here with what they are doing.</p>
          <Link prefetch={false} href="/dashboard/jobs/team" className="mt-3 inline-block rounded-lg px-3 py-1.5 text-[13.5px] font-semibold text-[#0f766e] hover:bg-[#e9f7f4]">Go to Team →</Link>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 px-2 pb-2 lg:px-3">
          {shown.map((p) => {
            const st = PERSON_STATE[p.state];
            return (
              <li key={p.id}>
                <button type="button" onClick={() => onPick(p.id)} className="group flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-slate-50 lg:px-3">
                  <span className="relative shrink-0 transition-transform duration-200 group-hover:scale-105">
                    <TechDot t={{ initials: p.initials, color: p.color, avatar_url: p.avatar_url, name: p.name }} size={38} />
                    <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white ${p.state === "on_site" ? "bg-[#14a39a]" : p.state === "on_my_way" ? "bg-[#3b82f6]" : p.state === "paused" ? "bg-[#f59e0b]" : "bg-slate-300"}`} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-[#0b1f3a]">{p.name}</span>
                    <span className="block truncate text-[12.5px] text-slate-500">
                      {p.today ? `${p.today} job${p.today === 1 ? "" : "s"} today · ${p.done} done` : "No jobs today"}
                      {p.state === "available" && p.next ? ` · next ${fmtTime(p.next)}` : ""}
                    </span>
                  </span>
                  <Pill k={st.k}>{st.label}</Pill>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {people.length > 6 && (
        <div className="border-t border-slate-100 px-4 py-2.5 text-center">
          <button type="button" onClick={() => setAll((v) => !v)} className="rounded-lg px-3 py-1.5 text-[13.5px] font-semibold text-[#0f766e] hover:bg-[#e9f7f4]">
            {all ? "Show less" : `See all ${people.length} collaborators`}
          </button>
        </div>
      )}
    </section>
  );
}

// ---------- Tabla (computadora) ----------
type Row = { j: OpsJob; g: OpsGroup };
const TH = "whitespace-nowrap px-3 py-3 text-left text-[12.5px] font-semibold text-slate-500";
const TD = "px-3 py-3 align-middle";
function TaskTable({ rows, loading, now, canSeePrice }: { rows: Row[]; loading: boolean; now: number; canSeePrice: boolean }) {
  const H = ({ icon, children }: { icon: string; children: React.ReactNode }) => (
    <th className={TH}><span className="inline-flex items-center gap-1.5">
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>{children}</span></th>
  );
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[960px] border-collapse">
        <thead className="border-b border-slate-100 bg-[#fafbfc]">
          <tr>
            <H icon="M5 3h14v18H5zM9 8h6M9 12h6M9 16h3">Job ID</H>
            <H icon="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 21a7.5 7.5 0 0 1 15 0">Customer</H>
            <H icon="M4 15v-3a8 8 0 0 1 16 0v3M4 15h3v5H4zM17 15h3v5h-3z">Service type</H>
            <H icon="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.1-.4-.4-2.1z">Technician</H>
            <H icon="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2">Scheduled time</H>
            <H icon="M4 20h16M7 16V10M12 16V5M17 16v-4">Status</H>
            <H icon="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z">Location</H>
            {canSeePrice && <H icon="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM14.5 9.2c-.4-.9-1.4-1.4-2.5-1.4-1.4 0-2.5.7-2.5 1.8 0 2.6 5 1.4 5 4 0 1.1-1.1 1.9-2.6 1.9-1.3 0-2.4-.6-2.7-1.6M12 6.5v11">Price</H>}
            <th className={`${TH} text-right`}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading && !rows.length && [0, 1, 2, 3].map((i) => (
            <tr key={i}><td colSpan={canSeePrice ? 9 : 8} className="px-3 py-3"><div className="h-8 animate-pulse rounded-md bg-slate-50" /></td></tr>
          ))}
          {rows.map(({ j, g }) => {
            const st = statusOf(j, g);
            return (
              <tr key={j.id} className={`group transition-colors hover:bg-[#f6fbfa] ${g === "done" ? "text-slate-500" : ""}`}>
                <td className={TD}><Link prefetch={false} href={`/dashboard/jobs/${j.id}`} className="whitespace-nowrap font-semibold tabular-nums text-[#0b1f3a] hover:text-[#0f766e] hover:underline">{j.number}</Link></td>
                <td className={TD}>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e9f7f4] text-[12px] font-semibold text-[#0f766e]">{(j.customer_name || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
                    <span className="max-w-[12rem] truncate text-[14px] font-medium text-[#0b1f3a]">{j.customer_name || "—"}</span>
                  </span>
                </td>
                <td className={TD}>
                  <span className="inline-flex max-w-[11rem] items-center gap-2 text-[14px] font-medium" style={{ color: j.type_color || "#475569" }}>
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: j.type_color || "#94a3b8" }} />
                    <span className="truncate">{j.type_name || j.title || "General"}</span>
                  </span>
                </td>
                <td className={TD}>
                  <span className="flex items-center gap-2">
                    <TechDots techs={j.techs} size={26} max={2} />
                    <span className="max-w-[9rem] truncate text-[14px] text-slate-700">{j.techs.length ? j.techs[0].name : <span className="text-slate-400">Nobody yet</span>}{j.techs.length > 1 && <span className="font-semibold text-[#e8713a]"> +{j.techs.length - 1}</span>}</span>
                  </span>
                </td>
                <td className={`${TD} whitespace-nowrap text-[14px] tabular-nums text-slate-700`}>{whenText(j)}</td>
                <td className={TD}>
                  <span className="flex flex-col items-start gap-1">
                    <Pill k={st.key}>{st.label}</Pill>
                    {g === "delayed" ? <DelayTag job={j} now={now} small /> : g !== "done" && g !== "unassigned" && (
                      <span className="flex w-24 items-center gap-1.5"><span className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-[#14a39a] transition-all duration-700" style={{ width: `${progressOf(j)}%` }} /></span><span className="text-[10.5px] tabular-nums text-slate-400">{progressOf(j)}%</span></span>
                    )}
                  </span>
                </td>
                <td className={`${TD} text-[14px] text-slate-700`}><span className="block max-w-[10rem] truncate">{cityOf(j) || "—"}</span></td>
                {canSeePrice && <td className={`${TD} whitespace-nowrap text-[14px] font-semibold tabular-nums text-[#0b1f3a]`}>{Number(j.estimated_total) ? usd2(j.estimated_total) : <span className="font-normal text-slate-400">—</span>}</td>}
                <td className={`${TD} text-right`}><RowMenu j={j} g={g} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Ojo = ver · ⋯ = más acciones (editar, asignar, Operations)
function RowMenu({ j, g }: { j: OpsJob; g: OpsGroup }) {
  const q = new URLSearchParams({ from: "home" }); if (j.visit?.id) q.set("visit", j.visit.id); if (j.visit?.starts_at) q.set("date", isoDay(new Date(j.visit.starts_at)));
  const items = [
    { label: "Open job", href: `/dashboard/jobs/${j.id}`, icon: "M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" },
    ...(g !== "done" ? [{ label: "Edit job", href: `/dashboard/jobs/${j.id}/edit`, icon: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" }] : []),
    ...(g !== "done" ? [{ label: j.techs.length ? "Change collaborators" : "Assign collaborator", href: `/dashboard/jobs/assign?${q.toString()}`, icon: "M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2.5 15a5.5 5.5 0 0 1 11 0M14 12h7M18 9l3 3-3 3" }] : []),
    { label: "See in Operations", href: "/dashboard/jobs/operations", icon: "M3 12h4l2.5-6 4 12 2.5-6H21" },
  ];
  return (
    <span className="inline-flex items-center gap-1">
      <Link prefetch={false} href={`/dashboard/jobs/${j.id}`} aria-label={`Open job ${j.number}`}
        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-all duration-150 hover:scale-110 hover:bg-[#e9f7f4] hover:text-[#0f766e]">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={items[0].icon} /></svg>
      </Link>
      <Menu>
        <MenuButton aria-label={`More actions for job ${j.number}`}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-all duration-150 hover:bg-slate-100 hover:text-slate-700 data-[open]:bg-slate-100 data-[open]:text-slate-700">
          <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="currentColor"><circle cx="4.5" cy="10" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="15.5" cy="10" r="1.6" /></svg>
        </MenuButton>
        <MenuItems anchor="bottom end" transition className={`${panelClass} w-56 focus:outline-none`}>
          {items.map((it) => (
            <MenuItem key={it.label}>
              <Link prefetch={false} href={it.href} className="flex items-center gap-2.5 rounded-md px-3 py-2 text-[14px] text-slate-700 data-[focus]:bg-[#e9f7f4] data-[focus]:text-[#0f766e]">
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={it.icon} /></svg>
                {it.label}
              </Link>
            </MenuItem>
          ))}
        </MenuItems>
      </Menu>
    </span>
  );
}

// ---------- Tarjetas (celular): compactas, 4–5 por pantalla ----------
function TaskCards({ rows, loading, now, canSeePrice }: { rows: Row[]; loading: boolean; now: number; canSeePrice: boolean }) {
  return (
    <ul className="divide-y divide-slate-100 md:hidden">
      {loading && !rows.length && [0, 1, 2].map((i) => <li key={i} className="px-3 py-3"><div className="h-14 animate-pulse rounded-lg bg-slate-50" /></li>)}
      {rows.map(({ j, g }) => {
        const st = statusOf(j, g);
        return (
          <li key={j.id}>
            <Link prefetch={false} href={`/dashboard/jobs/${j.id}`} className={`flex items-center gap-3 px-3 py-3 active:bg-slate-50 ${g === "done" ? "opacity-75" : ""}`}>
              <span className="h-10 w-1 shrink-0 rounded-full" style={{ backgroundColor: j.type_color || "#cbd5e1" }} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[14.5px] font-semibold text-[#0b1f3a]">{j.customer_name || j.number}</span>
                  <span className="shrink-0 text-[12px] tabular-nums text-slate-400">{j.number}</span>
                </span>
                <span className="block truncate text-[12.5px] text-slate-500">{j.type_name || j.title || "General"} · {whenText(j)}{cityOf(j) ? ` · ${cityOf(j)}` : ""}</span>
                <span className="mt-1 flex items-center gap-2">
                  <Pill k={st.key}>{st.label}</Pill>
                  {g === "delayed" && <DelayTag job={j} now={now} small />}
                  {canSeePrice && Number(j.estimated_total) > 0 && <span className="text-[12.5px] font-semibold tabular-nums text-[#0b1f3a]">{usd0(j.estimated_total)}</span>}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1.5">
                <TechDots techs={j.techs} size={24} max={2} />
                {g !== "done" && g !== "unassigned" && <ProgressRing pct={progressOf(j)} size={26} stroke={3} color="#e8713a" />}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
