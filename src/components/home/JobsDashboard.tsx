"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmationsStrip } from "@/components/jobs/Confirmations";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions, Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { createClient } from "@/lib/supabase/client";
import { Check, Chevron, optionClass, panelClass } from "@/components/ui/SearchSelect";
import DatePicker from "@/components/ui/DatePicker";
import { BarChart } from "@/components/dashboard/charts";
import { FinanceArt, InventoryArt, JobsArt } from "@/components/AppIcons";
import { TechDot, TechDots } from "@/components/jobs/EventBar";
import { DelayTag, GroupArt, ProgressRing } from "@/components/jobs/ops/OpsBits";
import { AlertIcon, TeamArt } from "@/components/home/DashArt";
import { OpsDialog } from "@/components/jobs/ops/OpsDialogs";
import { loadPhaseProgress, withPhases } from "@/lib/phases";
import { OPS_GROUPS, OpsGroup, OpsJob, fold, groupOf as groupAt, progressOf } from "@/lib/operations";
import { TeamMember, addDays, dayStart, fromIsoDay, isoDay, receivesJobs, startOfMonth, startOfWeek } from "@/lib/jobs";
import { useLocale, useTranslations } from "next-intl";
import { intlTag } from "@/i18n/config";
import { useJobError } from "@/i18n/useFmt";
import { useOpsTx } from "@/i18n/useOpsTx";
import { Member } from "@/lib/team";
import { useTeamTx } from "@/i18n/useTeamTx";
import type { HomeAlert, RevenueData, RevenueRange } from "@/lib/home-dashboard";

// =====================================================================
// Dashboard de trabajos y alertas (Paso 5.3f) — la primera pantalla al entrar.
// Lee los mismos trabajos que Operations (función ops_board) y se actualiza en vivo.
// La conexión de cada persona sale de la presencia que ya usa Team (team_members).
// No cambia nada de Operations, Schedule, Assign jobs ni My Jobs.
// =====================================================================

type Period = "today" | "week" | "month";
const PERIODS_EN: { v: Period; label: string; prev: string }[] = [
  { v: "today", label: "Today", prev: "vs yesterday" },
  { v: "week", label: "This week", prev: "vs last week" },
  { v: "month", label: "This month", prev: "vs last month" },
];
type ListWhen = "today" | "tomorrow" | "week" | "month" | "open" | "pick";
const LIST_WHEN_EN: { v: ListWhen; label: string }[] = [
  { v: "today", label: "Today" }, { v: "tomorrow", label: "Tomorrow" }, { v: "week", label: "This week" },
  { v: "month", label: "This month" }, { v: "open", label: "All open jobs" }, { v: "pick", label: "Pick a date…" },
];
const PAGE = 12;

// Etiqueta de estado (azul = asignado/en camino, naranja = en proceso/pausa, rojo = retraso, verde = terminado/disponible)
const PILL: Record<string, string> = {
  unassigned: "bg-slate-100 text-slate-600 ring-slate-200",
  assigned: "bg-[#eef4ff] text-[#2563eb] ring-[#d6e4ff]",
  on_my_way: "bg-[#eef4ff] text-[#2563eb] ring-[#d6e4ff]",
  in_progress: "bg-[#fff6e6] text-[#b45309] ring-[#fde3b4]",
  paused: "bg-[#fff1e6] text-[#c2410c] ring-[#fed7aa]",
  on_hold: "bg-[#fff1e6] text-[#c2410c] ring-[#fed7aa]",
  delayed: "bg-[#fff1f2] text-[#be123c] ring-[#fecdd3]",
  done: "bg-[#e7f6f1] text-[#0f766e] ring-[#bfe6d8]",
  green: "bg-[#e8f8ee] text-[#15803d] ring-[#bbe8cb]",
  teal: "bg-[#e7f6f1] text-[#0f766e] ring-[#bfe6d8]",
};
function statusKey(j: OpsJob, g: OpsGroup): string {
  if (g === "done" || g === "delayed" || g === "unassigned") return g;
  const s = j.visit?.status;
  if (s === "on_my_way" || s === "in_progress" || s === "paused") return s;
  if (j.status === "on_hold") return "on_hold";
  return "assigned";
}
function Pill({ k, children }: { k: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1 ${PILL[k] ?? PILL.unassigned}`}>
    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />{children}</span>;
}

// ---------- Personas: lo que está haciendo + si tiene la app abierta ----------
type PState = "on_site" | "on_my_way" | "paused" | "available" | "idle" | "offline";
type Person = {
  id: string; name: string; initials: string; color: string; avatar_url: string | null; phone: string | null;
  state: PState; seen: string; today: number; done: number; next: Date | null;
};
const PERSON_STATE_EN: Record<PState, { label: string; k: string; dot: string }> = {
  on_site: { label: "On site", k: "teal", dot: "bg-[#14a39a]" },
  on_my_way: { label: "On the way", k: "on_my_way", dot: "bg-[#3b82f6]" },
  paused: { label: "Paused", k: "paused", dot: "bg-[#f59e0b]" },
  available: { label: "Available", k: "green", dot: "bg-[#22c55e]" },
  idle: { label: "Idle", k: "in_progress", dot: "bg-[#f59e0b]" },
  offline: { label: "Offline", k: "unassigned", dot: "bg-slate-300" },
};
const STATE_ORDER: Record<PState, number> = { on_site: 0, on_my_way: 1, paused: 2, available: 3, idle: 4, offline: 5 };

const cityOf = (j: OpsJob) => { const a = j.site_address; if (!a) return ""; return [a.city, a.state].filter(Boolean).join(", ") || a.street || ""; };
const firstNames = (j: OpsJob) => j.techs.map((t) => t.name.split(" ")[0]).join(", ");
const assignLink = (j: OpsJob) => {
  const q = new URLSearchParams({ from: "home" }); if (j.visit?.id) q.set("visit", j.visit.id); if (j.visit?.starts_at) q.set("date", isoDay(new Date(j.visit.starts_at)));
  return `/dashboard/jobs/assign?${q.toString()}`;
};

// ---------- Avisos de trabajos: 6 grupos ----------
type JobCat = "delayed" | "unassigned" | "paused" | "followup" | "on_my_way" | "working";
const JOB_CATS_EN: { id: JobCat; label: string; hint: string; level: "red" | "orange" | "gray" | "blue" | "teal"; icon: string }[] = [
  { id: "delayed", label: "Running late", hint: "Past the arrival or end time", level: "red", icon: "delayed" },
  { id: "unassigned", label: "No collaborator", hint: "Today, tomorrow or overdue", level: "gray", icon: "unassigned" },
  { id: "paused", label: "Paused", hint: "Work stopped for now", level: "orange", icon: "paused" },
  { id: "followup", label: "Follow-ups", hint: "Left to finish later or check", level: "orange", icon: "needs_followup" },
  { id: "on_my_way", label: "On the way", hint: "Driving to the job", level: "blue", icon: "on_my_way" },
  { id: "working", label: "Working now", hint: "On site right now", level: "teal", icon: "working" },
];
// Paso 6.2a: todo lo de arriba en el idioma de la persona. Cada componente llama useDash() y usa los mismos nombres.
function useDash() {
  const T = useTranslations("dash");
  const tag = intlTag(useLocale());
  const ox = useOpsTx();
  const fmtTime = (d: Date) => d.toLocaleTimeString(tag, { hour: "numeric", minute: "2-digit" });
  const usd0 = (v: number) => new Intl.NumberFormat(tag, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(v) || 0);
  const usd2 = (v: number) => new Intl.NumberFormat(tag, { style: "currency", currency: "USD" }).format(Number(v) || 0);
  return {
    T, tag, ox, fmtTime, usd0, usd2,
    PERIODS: PERIODS_EN.map((p) => ({ ...p, label: T(`p.${p.v}` as never), prev: T(`pv.${p.v}` as never) })),
    LIST_WHEN: LIST_WHEN_EN.map((w) => ({ ...w, label: T(`lw.${w.v}` as never) })),
    STATUS_OPTS: [{ v: "all" as OpsGroup | "all", label: T("anyStatus") }, ...ox.groups.filter((g) => g.id !== "to_invoice").map((g) => ({ v: g.id as OpsGroup | "all", label: g.label }))],
    statusOf: (j: OpsJob, g: OpsGroup) => { const key = statusKey(j, g); return { key, label: T(`st.${key}` as never) }; },
    PERSON_STATE: Object.fromEntries(Object.entries(PERSON_STATE_EN).map(([k, v]) => [k, { ...v, label: T(`ps.${k}` as never) }])) as typeof PERSON_STATE_EN,
    JOB_CATS: JOB_CATS_EN.map((c) => ({ ...c, label: T(`jc.${c.id}` as never), hint: T(`jch.${c.id}` as never) })),
    whenText: (j: OpsJob) => {
      const s = j.visit?.starts_at ? new Date(j.visit.starts_at) : null;
      if (!s) return T("notScheduled");
      return `${s.toLocaleDateString(tag, { month: "short", day: "numeric" })}, ${fmtTime(s)}`;
    },
    // "hace 20 min", "hace 5 h", "hace 3 días"
    agoText: (iso: string | null | undefined, now: number) => {
      if (!iso) return "";
      const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
      if (m < 60) return T("minAgo", { n: m });
      if (m < 24 * 60) return T("hAgo", { n: Math.floor(m / 60) });
      return T("daysAgo", { n: Math.floor(m / 1440) });
    },
  };
}
type JobAlert = { id: string; cat: JobCat; title: string; number: string; sub: string; tag: React.ReactNode; href: string; sort: number; job?: OpsJob };

export default function JobsDashboard({ companyId, team, weekStartsOn, canSeePrice, revenue, monthReport, alerts, header, sample, samplePresence, variant = "home", canDelete = false }: {
  companyId: string; team: TeamMember[]; weekStartsOn: number;
  canSeePrice: boolean;          // dueño y manager
  revenue: RevenueData | null;   // dueño y manager (Paso 5.10f)
  monthReport?: React.ReactNode; // Paso 5.10e: tarjeta "This month's report" (dueño y manager)
  alerts: HomeAlert[];           // avisos guardados: seguimiento de trabajos + inventario
  header?: React.ReactNode;
  sample?: OpsJob[];             // datos de ejemplo (vista previa): no consulta la base
  samplePresence?: Member[];
  variant?: "home" | "jobs";      // "jobs" = el Dashboard propio de la app Jobs (sin inventario ni finanzas)
  canDelete?: boolean;           // dueño y manager: papelera en la lista de trabajos
}) {
  const D = useDash();
  const presenceOf = useTeamTx().presence;
  const jobError = useJobError();
  const { PERIODS, LIST_WHEN, STATUS_OPTS, statusOf, PERSON_STATE, JOB_CATS, usd0, usd2, whenText, agoText, fmtTime } = D;
  const [jobs, setJobs] = useState<OpsJob[]>([]);
  const [members, setMembers] = useState<Member[] | null>(samplePresence ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [period, setPeriod] = useState<Period>("today");
  const [openPerson, setOpenPerson] = useState<string | null>(null);
  const reqId = useRef(0);

  // ---------- Datos: los mismos trabajos que Operations ----------
  const load = useCallback(async () => {
    if (sample) { setJobs(sample); setLoading(false); return; }
    const id = ++reqId.current;
    const since = new Date(); since.setMonth(Math.min(since.getMonth() - 1, 0), 1); since.setHours(0, 0, 0, 0); // terminados desde enero (o el mes pasado si es enero)
    const sb = createClient();
    const [{ data, error: err }, phases] = await Promise.all([
      sb.rpc("ops_board", { p_company: companyId, p_done_since: since.toISOString() }),
      loadPhaseProgress(sb, companyId), // Paso 5.4: % por fases
    ]);
    if (id !== reqId.current) return;
    if (err) { setError(jobError(err)); setLoading(false); return; }
    setError(""); setJobs(withPhases((data ?? []) as OpsJob[], phases)); setLoading(false);
  }, [companyId, sample]);
  // Conexión de cada persona (la misma de Team: verde = usando la app, naranja = abierta sin moverse, gris = fuera)
  const loadPresence = useCallback(async () => {
    if (samplePresence) return;
    const { data, error: err } = await createClient().rpc("team_members", { p_company: companyId });
    if (!err) setMembers((data ?? []) as Member[]);
  }, [companyId, samplePresence]);
  useEffect(() => { load(); loadPresence(); }, [load, loadPresence]);
  useEffect(() => {
    if (sample) return;
    const sb = createClient();
    let t: ReturnType<typeof setTimeout>;
    const again = () => { clearTimeout(t); t = setTimeout(load, 700); };
    const ch = sb.channel(`home-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `company_id=eq.${companyId}` }, again)
      .on("postgres_changes", { event: "*", schema: "public", table: "job_visits", filter: `company_id=eq.${companyId}` }, again)
      .on("postgres_changes", { event: "*", schema: "public", table: "job_visit_techs", filter: `company_id=eq.${companyId}` }, again)
      .on("postgres_changes", { event: "*", schema: "public", table: "job_phases", filter: `company_id=eq.${companyId}` }, again)
      .subscribe();
    const tick = setInterval(() => { setNow(Date.now()); loadPresence(); }, 60000); // "Retrasado" y la conexión se actualizan solos
    const onVis = () => { if (document.visibilityState === "visible") { setNow(Date.now()); load(); loadPresence(); } };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearTimeout(t); clearInterval(tick); sb.removeChannel(ch); document.removeEventListener("visibilitychange", onVis); };
  }, [companyId, load, loadPresence, sample]);

  const withGroup = useMemo(() => jobs.map((j) => ({ j, g: groupAt(j, now) })), [jobs, now]);

  // ---------- Rangos de fechas ----------
  const rangeOf = useCallback((p: Period, shift = 0): [Date, Date] => {
    const d0 = dayStart(new Date(now));
    if (p === "today") { const a = addDays(d0, shift); return [a, addDays(a, 1)]; }
    if (p === "week") { const a = addDays(startOfWeek(d0, weekStartsOn), 7 * shift); return [a, addDays(a, 7)]; }
    const a = startOfMonth(d0); const s = new Date(a.getFullYear(), a.getMonth() + shift, 1); return [s, new Date(s.getFullYear(), s.getMonth() + 1, 1)];
  }, [now, weekStartsOn]);
  // En el periodo: lo agendado en esas fechas + lo que está pasando ahora o va tarde + lo que no tiene fecha ni persona
  const inRange = useCallback((j: OpsJob, g: OpsGroup, [a, b]: [Date, Date], live = true) => {
    const d = g === "done" ? (j.completed_at ? new Date(j.completed_at) : j.visit?.starts_at ? new Date(j.visit.starts_at) : null) : j.visit?.starts_at ? new Date(j.visit.starts_at) : null;
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

  const kpiGroups = useMemo(() => {
    const r = rangeOf("today");
    const m = Object.fromEntries(OPS_GROUPS.map((g) => [g.id, 0])) as Record<OpsGroup, number>;
    withGroup.forEach(({ j, g }) => { if (inRange(j, g, r) || (g === "assigned" && !j.visit?.starts_at)) m[g] += 1; });
    return m;
  }, [withGroup, rangeOf, inRange]);

  // ---------- Equipo ----------
  const people = useMemo(() => {
    const [a, b] = rangeOf("today");
    const active = (members ?? []).filter((m) => m.is_active);
    const ids = new Set(team.filter((m) => receivesJobs(m)).map((m) => m.user_id));
    withGroup.forEach(({ j }) => j.techs.forEach((t) => ids.add(t.user_id)));
    if (members) Array.from(ids).forEach((id) => { if (!active.some((m) => m.user_id === id)) ids.delete(id); }); // quitados del equipo
    const list: Person[] = [];
    ids.forEach((id) => {
      const m = team.find((x) => x.user_id === id);
      const chip = jobs.flatMap((j) => j.techs).find((t) => t.user_id === id);
      const mine = withGroup.filter(({ j }) => j.techs.some((t) => t.user_id === id));
      const todays = mine.filter(({ j, g }) => inRange(j, g, [a, b], false) || g === "in_progress");
      const live = mine.map(({ j }) => j.visit?.status);
      const mem = members?.find((x) => x.user_id === id);
      const pres = mem ? presenceOf(mem, now) : null;
      const state: PState = live.includes("in_progress") ? "on_site" : live.includes("on_my_way") ? "on_my_way" : live.includes("paused") ? "paused"
        : !pres ? "available" : pres.tone === "on" ? "available" : pres.tone === "idle" ? "idle" : "offline";
      const upcoming = todays.filter(({ j, g }) => g !== "done" && j.visit?.starts_at && new Date(j.visit.starts_at).getTime() > now)
        .map(({ j }) => new Date(j.visit!.starts_at!)).sort((x, y) => x.getTime() - y.getTime());
      list.push({
        id, name: m?.full_name || mem?.full_name || chip?.name || D.T("member"), initials: m?.initials || chip?.initials || "?", color: m?.color || chip?.color || "#94a3b8",
        avatar_url: m?.avatar_url ?? chip?.avatar_url ?? null, phone: m?.phone ?? mem?.phone ?? null,
        state, seen: pres ? pres.label : "", today: todays.length, done: todays.filter((x) => x.g === "done").length, next: upcoming[0] ?? null,
      });
    });
    return list.sort((x, y) => STATE_ORDER[x.state] - STATE_ORDER[y.state] || y.today - x.today || x.name.localeCompare(y.name));
  }, [team, members, jobs, withGroup, rangeOf, inRange, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const freeNow = people.filter((p) => p.state === "available").length;

  // ---------- Avisos de trabajos (en vivo) + los guardados de seguimiento ----------
  const jobAlerts = useMemo(() => {
    const out: JobAlert[] = [];
    const soon = addDays(dayStart(new Date(now)), 2).getTime();
    withGroup.forEach(({ j, g }) => {
      const who = firstNames(j);
      const name = j.customer_name || j.title || j.number;
      const v = j.visit;
      const what = j.type_name || j.title || D.T("job");
      if (g === "done") return;
      if (g === "delayed") {
        const d = D.ox.delay(j, now);
        out.push({ id: `late-${j.id}`, cat: "delayed", title: name, number: j.number, sub: [what, who || D.T("noCollab"), d?.detail].filter(Boolean).join(" · "),
          tag: <Pill k="delayed">{d?.label ?? D.T("late")}</Pill>, href: `/dashboard/jobs/${j.id}`, sort: -(d?.minutes ?? 0), job: j });
        return;
      }
      if (g === "unassigned") {
        const s = v?.starts_at ? new Date(v.starts_at).getTime() : null;
        if (s !== null && s > soon) return; // sin persona pero falta mucho: aún no es urgente
        out.push({ id: `un-${j.id}`, cat: "unassigned", title: name, number: j.number, sub: `${what} · ${s ? whenText(j) : D.T("notSchedYet")}`,
          tag: <Pill k="assigned">{D.T("assignArrow")}</Pill>, href: assignLink(j), sort: s ?? 0, job: j });
        return;
      }
      if (v?.status === "paused") {
        out.push({ id: `pa-${j.id}`, cat: "paused", title: name, number: j.number, sub: [what, who].filter(Boolean).join(" · "),
          tag: <Pill k="paused">{D.T("paused")}</Pill>, href: `/dashboard/jobs/${j.id}`, sort: 0, job: j });
      } else if (j.status === "on_hold") {
        out.push({ id: `oh-${j.id}`, cat: "followup", title: name, number: j.number, sub: [what, who, D.T("leftLater")].filter(Boolean).join(" · "),
          tag: <Pill k="on_hold">{D.T("onHold")}</Pill>, href: `/dashboard/jobs/${j.id}`, sort: 0, job: j });
      } else if (v?.status === "on_my_way") {
        out.push({ id: `om-${j.id}`, cat: "on_my_way", title: name, number: j.number, sub: [who, v.on_my_way_at ? D.T("leftAgo", { t: agoText(v.on_my_way_at, now) }) : "", v.starts_at ? D.T("dueAt", { t: fmtTime(new Date(v.starts_at)) }) : ""].filter(Boolean).join(" · "),
          tag: <Pill k="on_my_way">{D.T("onTheWay")}</Pill>, href: `/dashboard/jobs/${j.id}`, sort: 0 });
      } else if (v?.status === "in_progress") {
        out.push({ id: `wk-${j.id}`, cat: "working", title: name, number: j.number, sub: [what, who, v.started_at ? D.T("startedAt", { t: fmtTime(new Date(v.started_at)) }) : ""].filter(Boolean).join(" · "),
          tag: <span className="flex items-center gap-2"><ProgressRing pct={progressOf(j)} size={30} stroke={3} color="#e8713a" /></span>, href: `/dashboard/jobs/${j.id}`, sort: 0 });
      }
    });
    // Guardados: quedó a medias (re-agendar) · Tune-Up con lecturas fuera de rango
    alerts.filter((a) => a.app === "jobs").forEach((a) => out.push({
      id: a.id, cat: "followup", title: a.title, number: "", sub: a.kind.startsWith("plan_") ? a.sub : `${a.sub} · ${agoText(a.at, now)}`,
      tag: <Pill k={a.level === "red" ? "delayed" : "paused"}>{a.pill}</Pill>, href: a.href, sort: 0,
    }));
    return out;
  }, [withGroup, alerts, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const stock = useMemo(() => alerts.filter((a) => a.app === "inventory"), [alerts]);
  const invoices = useMemo(() => alerts.filter((a) => a.app === "finances"), [alerts]);

  // ---------- Lista de trabajos ----------
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<OpsGroup | "all">("all");
  const [person, setPerson] = useState<string>("all");
  const [when, setWhen] = useState<ListWhen>("today");
  const [pick, setPick] = useState(() => isoDay(new Date()));
  const [shown, setShown] = useState(PAGE);
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
  const peopleOpts = useMemo(() => [{ v: "all", label: D.T("everyone") }, ...people.map((p) => ({ v: p.id, label: p.name }))], [people]);
  const periodInfo = PERIODS.find((p) => p.v === period)!;
  const opsHref = (g?: OpsGroup) => `/dashboard/jobs/operations${g ? `?focus=${g}` : ""}`;
  const selected = people.find((p) => p.id === openPerson) ?? null;

  if (variant === "jobs") return (
    <JobsHub header={header} error={error} loading={loading} membersLoading={!members} now={now} withGroup={withGroup} people={people}
      jobAlerts={jobAlerts} kpiGroups={kpiGroups} canSeePrice={canSeePrice} onPerson={setOpenPerson}
      team={team} canDelete={canDelete} onReload={load} rangeOf={rangeOf} inRange={inRange}
      drawer={selected && <PersonDrawer p={selected} rows={withGroup.filter(({ j }) => j.techs.some((t) => t.user_id === selected.id))} now={now} onClose={() => setOpenPerson(null)} />} />
  );

  return (
    <div className="pb-24 lg:pb-10">
      {header}
      <div className="w-full px-4 pt-5 lg:px-8 lg:pt-6">
        {error && <p role="alert" className="mb-4 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-[14px] text-[#be123c]">{error}</p>}

        {/* Paso 5.8b: qué respondieron los clientes de las próximas visitas */}
        <ConfirmationsStrip className="mb-5 lg:mb-6" />

        {/* ======= 1. Resumen (KPIs): cada tarjeta lleva a sus trabajos ======= */}
        <div className="mb-4 flex items-center justify-between gap-3 lg:mb-3">
          <div>
            <h2 className="text-[18px] font-semibold text-[#0b1f3a] lg:text-[20px]">{D.T("overview")}</h2>
            <p className="hidden text-[13px] text-slate-500 sm:block">{D.T("tapCard")}</p>
          </div>
          <Pick value={period} options={PERIODS} onChange={(v) => setPeriod(v as Period)} ariaLabel={D.T("periodCards")} />
        </div>
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 lg:gap-4 2xl:grid-cols-6">
          <Kpi label={D.T("k.total")} value={kpi.total} art={<JobsArt size={46} />} loading={loading} href={opsHref()}
            delta={kpi.total - kpi.prevTotal} deltaText={periodInfo.prev} hint={D.T("overallPct", { n: kpi.pct })} action={D.T("openOps")} bar={kpi.pct} barColor="#14a39a" />
          <Kpi label={D.T("k.pending")} value={kpi.unassigned} art={<GroupArt g="unassigned" size={46} />} loading={loading} href="/dashboard/jobs/assign"
            hint={kpi.unassigned ? D.T("needCollab") : D.T("everyoneJob")} action={D.T("assignThem")} />
          <Kpi label={D.T("k.ongoing")} value={kpi.working} art={<GroupArt g="in_progress" size={46} />} loading={loading} href={opsHref("in_progress")}
            hint={D.T("onWayOrWorking")} action={D.T("seeWho")} />
          <Kpi label={D.T("k.delayed")} value={kpi.late} art={<GroupArt g="delayed" size={46} />} loading={loading} href={opsHref("delayed")}
            hint={kpi.late ? D.T("needAttention") : D.T("nothingLate")} tone={kpi.late ? "red" : undefined} action={D.T("seeLate")} />
          <Kpi label={D.T("k.completed")} value={kpi.done} art={<GroupArt g="done" size={46} />} loading={loading} href={opsHref("done")}
            delta={kpi.done - kpi.prevDone} deltaText={periodInfo.prev} hint={periodInfo.label} action={D.T("seeFinished")} tone={kpi.done ? "green" : undefined} />
          <Kpi label={D.T("k.avail")} value={freeNow} suffix={people.length ? ` / ${people.length}` : ""} art={<TeamArt size={46} />} loading={loading || !members} href="/dashboard/jobs/assign"
            hint={people.length ? (freeNow ? D.T("onlineFree") : D.T("nobodyFree")) : D.T("noCollabs")} tone={freeNow ? "green" : undefined} action={D.T("assignJobs")} />
        </div>

        {/* ======= Reporte del mes (Paso 5.10e · dueño y manager): ingreso, gastos y ganancia real ======= */}
        {monthReport && <div className="mt-7 lg:mt-6">{monthReport}</div>}

        {/* ======= 2. Trabajos (lo principal) + Equipo ======= */}
        <div className="mt-7 grid grid-cols-[minmax(0,1fr)] gap-6 lg:mt-6 lg:gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(20rem,1fr)]">
          <JobsAlertsSection items={jobAlerts} loading={loading} />
          <TeamCard people={people} loading={loading || !members} onPick={setOpenPerson} />
        </div>

        {/* ======= 3. Inventario + Cobros (facturas por vencer o vencidas) ======= */}
        <div className={`mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:mt-6 lg:gap-4 ${canSeePrice ? "xl:grid-cols-2" : ""}`}>
          <InventorySection items={stock} wide={!canSeePrice} />
          {canSeePrice && <InvoicesSection items={invoices} />}
        </div>

        {/* ======= 4. Ingresos (dueño y manager) ======= */}
        {revenue && <div className="mt-6"><RevenueCard data={revenue} /></div>}

        {/* ======= 5. Lista de trabajos ======= */}
        <div id="bp-task-list" className="mt-6 scroll-mt-24 rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center gap-2.5 border-b border-slate-100 px-3 py-3 lg:gap-3 lg:px-5 lg:py-4">
            <div className="mr-auto flex min-w-0 flex-1 items-center gap-2.5 sm:flex-none">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-[#0f766e]">
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v16H4zM8 12l2.5 2.5L16 9" /></svg>
              </span>
              <div>
                <h2 className="text-[17px] font-semibold leading-tight text-[#0b1f3a] lg:text-[18px]">{D.T("taskList")}</h2>
                <p className="text-[12.5px] text-slate-500">{loading ? D.T("loading") : D.T("nJobs", { n: rows.length })}</p>
              </div>
              <Link prefetch={false} href="/dashboard/jobs/new" aria-label={D.T("addNewJob")}
                className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0f766e] text-white shadow-sm active:scale-95 sm:hidden">
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>
              </Link>
            </div>
            <label className="relative w-full sm:w-60">
              <span className="sr-only">{D.T("searchJobs")}</span>
              <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="9" cy="9" r="5.5" /><path d="m13.5 13.5 3 3" /></svg>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={D.T("searchPh")}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-[14px] text-slate-800 placeholder:text-slate-400 focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15" />
              {q && <button type="button" onClick={() => setQ("")} aria-label={D.T("clearSearch")} className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600">×</button>}
            </label>
            <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:gap-3">
              <Pick value={status} options={STATUS_OPTS} onChange={(v) => setStatus(v as OpsGroup | "all")} ariaLabel={D.T("fStatus")} full />
              <Pick value={person} options={peopleOpts} onChange={setPerson} ariaLabel={D.T("fCollab")} full />
              <Pick value={when} options={LIST_WHEN} onChange={(v) => setWhen(v as ListWhen)} ariaLabel={D.T("dates")} full />
            </div>
            {when === "pick" && <div className="w-full sm:w-44"><DatePicker value={pick} onChange={(v) => v && setPick(v)} /></div>}
            <Link prefetch={false} href="/dashboard/jobs/new"
              className="group hidden h-10 items-center gap-1.5 rounded-lg bg-[#0f766e] px-4 text-[14px] font-semibold text-white shadow-sm transition-all duration-150 hover:-translate-y-px hover:bg-[#0c5f59] hover:shadow-md sm:inline-flex">
              <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>
              {D.T("addNew")}
            </Link>
          </div>
          <TaskTable rows={rows.slice(0, shown)} loading={loading} now={now} canSeePrice={canSeePrice} />
          <TaskCards rows={rows.slice(0, shown)} loading={loading} now={now} canSeePrice={canSeePrice} />
          {!loading && !rows.length && (
            <div className="px-6 py-12 text-center">
              <p className="text-[15px] font-semibold text-[#0b1f3a]">{D.T("noJobsHere")}</p>
              <p className="mt-1 text-[13.5px] text-slate-500">{D.T("tryAnother")}</p>
            </div>
          )}
          {rows.length > shown && (
            <div className="border-t border-slate-100 p-3 text-center">
              <button type="button" onClick={() => setShown((s) => s + PAGE)} className="rounded-lg px-4 py-2 text-[14px] font-semibold text-[#0f766e] hover:bg-[#e9f7f4]">
                {D.T("showMore", { n: rows.length - shown })}
              </button>
            </div>
          )}
        </div>
      </div>

      {selected && <PersonDrawer p={selected} rows={withGroup.filter(({ j }) => j.techs.some((t) => t.user_id === selected.id))} now={now} onClose={() => setOpenPerson(null)} />}
    </div>
  );
}

// ---------- Tarjeta KPI: blanca, se eleva al pasar el mouse, ícono animado y lleva a sus trabajos ----------
function Kpi({ label, value, suffix = "", art, hint, delta, deltaText, tone, action, href, loading, bar, barColor }: {
  label: string; value: number; suffix?: string; art: React.ReactNode; hint: string; delta?: number; deltaText?: string;
  tone?: "red" | "green"; action: string; href: string; loading: boolean; bar?: number; barColor?: string;
}) {
  const D = useDash();
  const { PERIODS, LIST_WHEN, STATUS_OPTS, statusOf, PERSON_STATE, JOB_CATS, usd0, usd2, whenText, agoText, fmtTime } = D;
  return (
    <Link prefetch={false} href={href}
      className="group relative flex min-h-[9rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-3.5 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_14px_30px_rgba(15,40,60,0.10)] lg:p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12.5px] font-medium text-slate-500 lg:text-[13.5px]">{label}</p>
        <span className="-mr-1 -mt-1 shrink-0 scale-90 lg:scale-100">{art}</span>
      </div>
      {loading ? <span className="mt-1 block h-8 w-14 animate-pulse rounded-md bg-slate-100" /> : (
        <p className={`mt-0.5 text-[30px] font-semibold leading-none tracking-tight tabular-nums lg:text-[36px] ${tone === "red" ? "text-[#be123c]" : tone === "green" ? "text-[#15803d]" : "text-[#0b1f3a]"}`}>
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
        <p className="relative h-[1.25em] overflow-hidden">
          <span className="absolute inset-0 truncate text-slate-500 transition-all duration-200 group-hover:-translate-y-full group-hover:opacity-0">{hint}</span>
          <span className="absolute inset-0 translate-y-full truncate font-semibold text-[#0f766e] opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">{action} →</span>
        </p>
      </div>
      {bar !== undefined && !loading && (
        <span className="absolute inset-x-0 bottom-0 h-1 bg-slate-100"><span className="block h-full transition-all duration-700" style={{ width: `${bar}%`, backgroundColor: barColor }} /></span>
      )}
    </Link>
  );
}

// ---------- Sección Jobs: todo lo que pasa con los trabajos (lo principal) ----------
const CAT_TONE: Record<string, { bg: string; ring: string; text: string }> = {
  red: { bg: "bg-[#fff1f2]", ring: "ring-[#fecdd3]", text: "text-[#be123c]" },
  orange: { bg: "bg-[#fff6e6]", ring: "ring-[#fde3b4]", text: "text-[#b45309]" },
  gray: { bg: "bg-slate-50", ring: "ring-slate-200", text: "text-slate-700" },
  blue: { bg: "bg-[#eef4ff]", ring: "ring-[#d6e4ff]", text: "text-[#1d4ed8]" },
  teal: { bg: "bg-[#e7f6f1]", ring: "ring-[#bfe6d8]", text: "text-[#0f766e]" },
};
function JobsAlertsSection({ items, loading }: { items: JobAlert[]; loading: boolean }) {
  const D = useDash();
  const { PERIODS, LIST_WHEN, STATUS_OPTS, statusOf, PERSON_STATE, JOB_CATS, usd0, usd2, whenText, agoText, fmtTime } = D;
  const [cat, setCat] = useState<JobCat | null>(null);
  const [all, setAll] = useState(false);
  const count = (c: JobCat) => items.filter((i) => i.cat === c).length;
  const order: Record<JobCat, number> = { delayed: 0, unassigned: 1, paused: 2, followup: 3, on_my_way: 4, working: 5 };
  const list = items.filter((i) => !cat || i.cat === cat).sort((a, b) => order[a.cat] - order[b.cat] || a.sort - b.sort);
  const shown = all ? list : list.slice(0, 7);
  const urgent = count("delayed") + count("unassigned");
  return (
    <section className="rounded-2xl border border-slate-200 bg-white" aria-label={D.T("jobsAria")}>
      <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-5 lg:px-5 lg:pt-4">
        <div className="group flex min-w-0 items-center gap-3">
          <JobsArt size={42} />
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-semibold leading-tight text-[#0b1f3a] sm:text-[18px] lg:text-[19px]">{D.T("jobsNow")}</h2>
            <p className="mt-0.5 truncate text-[12.5px] text-slate-500">{loading ? D.T("checking") : urgent ? D.T("needYou", { n: urgent }) : D.T("nothingUrgent")}<span className="hidden sm:inline">{loading ? "" : D.T("tapBox")}</span></p>
          </div>
        </div>
        <Link prefetch={false} href="/dashboard/jobs/operations" className="shrink-0 rounded-lg px-2.5 py-1.5 text-[13.5px] font-semibold text-[#2563eb] hover:bg-[#eef4ff]">{D.T("opsArrow")}</Link>
      </div>
      {/* 6 cajitas: tocar una filtra la lista */}
      <div className="grid grid-cols-2 gap-3 px-4 pt-4 sm:grid-cols-6 sm:gap-2 lg:gap-2.5 lg:px-5 lg:pt-3">
        {JOB_CATS.map((c) => {
          const n = count(c.id), on = cat === c.id, t = CAT_TONE[c.level];
          return (
            <button key={c.id} type="button" onClick={() => { setCat(on ? null : c.id); setAll(false); }} aria-pressed={on}
              className={`group relative flex flex-col items-start rounded-2xl p-3.5 text-left ring-1 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(15,40,60,0.08)] sm:rounded-xl sm:p-2.5 lg:p-3 ${n ? `${t.bg} ${t.ring}` : "bg-white ring-slate-200"} ${on ? "ring-2 ring-[#0f766e]" : ""}`}>
              <span className="flex w-full items-center justify-between">
                <AlertIcon kind={c.icon} level={n ? c.level : "gray"} size={30} />
                <span className={`text-[22px] font-semibold leading-none tabular-nums lg:text-[24px] ${n ? t.text : "text-slate-300"}`}>{loading ? "–" : n}</span>
              </span>
              <span className={`mt-3 block text-[13.5px] font-semibold leading-tight sm:mt-2 sm:text-[12.5px] lg:text-[13px] ${n ? "text-[#0b1f3a]" : "text-slate-400"}`}>{c.label}</span>
              <span className="mt-0.5 hidden text-[11px] leading-tight text-slate-400 lg:block">{c.hint}</span>
            </button>
          );
        })}
      </div>
      {loading && !items.length ? (
        <ul className="space-y-2 p-4 lg:px-5">{[0, 1, 2].map((i) => <li key={i} className="h-14 animate-pulse rounded-xl bg-slate-50" />)}</ul>
      ) : !list.length ? (
        <div className="flex flex-col items-center px-6 pb-8 pt-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e7f6f1] text-[#0f766e]">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
          </span>
          <p className="mt-2 text-[14.5px] font-semibold text-[#0b1f3a]">{cat ? D.T("nothingIn", { c: JOB_CATS.find((c) => c.id === cat)!.label }) : D.T("allOnTrack")}</p>
          <p className="mt-1 max-w-sm text-[13px] text-slate-500">{D.T("alertsHint")}</p>
        </div>
      ) : (
        <ul className="mt-5 divide-y divide-slate-100 border-t border-slate-100 px-2 pb-3 pt-1.5 lg:mt-2 lg:border-0 lg:px-3 lg:pb-2 lg:pt-0">
          {shown.map((a) => {
            const c = JOB_CATS.find((x) => x.id === a.cat)!;
            return (
              <li key={a.id}>
                <Link prefetch={false} href={a.href} className="group flex items-center gap-3.5 rounded-xl px-2 py-3.5 transition-colors hover:bg-slate-50 lg:gap-3 lg:px-3 lg:py-2.5">
                  <AlertIcon kind={c.icon} level={c.level} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate text-[14.5px] font-semibold text-[#0b1f3a]">{a.title}</span>
                      {a.number && <span className="hidden shrink-0 text-[12px] tabular-nums text-slate-400 sm:inline">{a.number}</span>}
                    </span>
                    <span className="mt-0.5 block truncate text-[12.5px] text-slate-500 lg:mt-0">{a.number && <span className="tabular-nums text-slate-400 sm:hidden">{a.number} · </span>}{a.sub}</span>
                  </span>
                  <span className="shrink-0">{a.tag}</span>
                  <svg viewBox="0 0 20 20" className="hidden h-4 w-4 shrink-0 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-slate-500 sm:block" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m8 5 5 5-5 5" /></svg>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {list.length > 7 && (
        <div className="border-t border-slate-100 px-4 py-2.5 text-center">
          <button type="button" onClick={() => setAll((v) => !v)} className="rounded-lg px-3 py-1.5 text-[13.5px] font-semibold text-[#0f766e] hover:bg-[#e9f7f4]">
            {all ? D.T("showLess") : D.T("seeAll", { n: list.length })}
          </button>
        </div>
      )}
    </section>
  );
}

// ---------- Sección Inventory: lo que se está acabando ----------
function InventorySection({ items, wide }: { items: HomeAlert[]; wide: boolean }) {
  const D = useDash();
  const { PERIODS, LIST_WHEN, STATUS_OPTS, statusOf, PERSON_STATE, JOB_CATS, usd0, usd2, whenText, agoText, fmtTime } = D;
  const [all, setAll] = useState(false);
  const out = items.filter((i) => (i.qty ?? 0) <= 0), low = items.filter((i) => (i.qty ?? 0) > 0);
  const list = [...out, ...low];
  const shown = all ? list : list.slice(0, wide ? 8 : 5);
  return (
    <section className="flex flex-col rounded-2xl border border-slate-200 bg-white" aria-label={D.T("inventory")}>
      <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-5 lg:px-5 lg:pt-4">
        <div className="group flex min-w-0 items-center gap-3">
          <InventoryArt size={42} />
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-semibold leading-tight text-[#0b1f3a] sm:text-[18px] lg:text-[19px]">{D.T("inventory")}</h2>
            <p className="mt-0.5 truncate text-[12.5px] text-slate-500">{list.length ? D.T("needRestock") : D.T("allStocked")}</p>
          </div>
        </div>
        <Link prefetch={false} href="/dashboard/inventory" className="shrink-0 rounded-lg px-2.5 py-1.5 text-[13.5px] font-semibold text-[#b45309] hover:bg-[#fff6e6]">{D.T("openInv")}</Link>
      </div>
      <div className="grid grid-cols-2 gap-3 px-4 pt-4 lg:gap-2.5 lg:px-5 lg:pt-3">
        {[{ n: out.length, label: D.T("outStock"), hint: D.T("noneLeft"), level: "red" as const, kind: "out_of_stock" }, { n: low.length, label: D.T("lowStock"), hint: D.T("belowAlert"), level: "orange" as const, kind: "low_stock" }].map((t) => (
          <div key={t.label} className={`group flex items-center gap-3 rounded-2xl p-3.5 ring-1 lg:rounded-xl lg:p-3 ${t.n ? `${CAT_TONE[t.level].bg} ${CAT_TONE[t.level].ring}` : "bg-white ring-slate-200"}`}>
            <AlertIcon kind={t.kind} level={t.n ? t.level : "gray"} size={34} />
            <span className="min-w-0">
              <span className={`block text-[22px] font-semibold leading-none tabular-nums ${t.n ? CAT_TONE[t.level].text : "text-slate-300"}`}>{t.n}</span>
              <span className={`mt-1 block truncate text-[12.5px] font-semibold ${t.n ? "text-[#0b1f3a]" : "text-slate-400"}`}>{t.label}</span>
            </span>
          </div>
        ))}
      </div>
      {!list.length ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-8 pt-6 text-center">
          <span className="group"><InventoryArt size={56} /></span>
          <p className="mt-2 text-[14.5px] font-semibold text-[#0b1f3a]">{D.T("noStockAlerts")}</p>
          <p className="mt-1 max-w-sm text-[13px] text-slate-500">{D.T("stockHint")}</p>
        </div>
      ) : (
        <ul className={`mt-2 grid px-2 pb-2 lg:px-3 ${wide ? "lg:grid-cols-2 lg:gap-x-4" : ""}`}>
          {shown.map((a) => {
            const qty = a.qty ?? 0, min = Math.max(1, a.min ?? 1), pct = Math.min(100, Math.round((qty / (min * 2)) * 100));
            return (
              <li key={a.id} className="border-b border-slate-100 last:border-0">
                <Link prefetch={false} href={a.href} className="group flex items-center gap-3.5 rounded-xl px-2 py-3.5 transition-colors hover:bg-slate-50 lg:gap-3 lg:px-3 lg:py-2.5">
                  <AlertIcon kind={a.kind} level={a.level} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-[#0b1f3a]">{a.item ?? a.title}</span>
                    <span className="block truncate text-[12.5px] text-slate-500">{a.location}</span>
                    <span className="mt-1.5 flex items-center gap-2">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <span className={`block h-full rounded-full transition-all duration-700 ${qty <= 0 ? "bg-[#f43f5e]" : "bg-[#f59e0b]"}`} style={{ width: `${Math.max(qty <= 0 ? 0 : 6, pct)}%` }} />
                      </span>
                      <span className={`shrink-0 text-[11.5px] font-semibold tabular-nums ${qty <= 0 ? "text-[#be123c]" : "text-[#b45309]"}`}>{D.T("leftAlert", { q: qty, m: a.min ?? 0 })}</span>
                    </span>
                  </span>
                  <span className="hidden shrink-0 text-[13px] font-semibold text-[#0f766e] opacity-0 transition-opacity group-hover:opacity-100 sm:inline">{D.T("restock")}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {list.length > shown.length && !all && (
        <div className="border-t border-slate-100 px-4 py-2.5 text-center">
          <button type="button" onClick={() => setAll(true)} className="rounded-lg px-3 py-1.5 text-[13.5px] font-semibold text-[#0f766e] hover:bg-[#e9f7f4]">{D.T("seeAll", { n: list.length })}</button>
        </div>
      )}
    </section>
  );
}

// ---------- Equipo: quién está trabajando, en camino, disponible (app abierta) o fuera ----------
function TeamCard({ people, loading, onPick }: { people: Person[]; loading: boolean; onPick: (id: string) => void }) {
  const D = useDash();
  const { PERIODS, LIST_WHEN, STATUS_OPTS, statusOf, PERSON_STATE, JOB_CATS, usd0, usd2, whenText, agoText, fmtTime } = D;
  const [all, setAll] = useState(false);
  const shown = all ? people : people.slice(0, 7);
  const n = (s: PState) => people.filter((p) => p.state === s).length;
  const chips: { s: PState; label: string }[] = [{ s: "on_site", label: PERSON_STATE.on_site.label }, { s: "on_my_way", label: PERSON_STATE.on_my_way.label }, { s: "available", label: PERSON_STATE.available.label }, { s: "offline", label: PERSON_STATE.offline.label }];
  return (
    <section className="flex flex-col rounded-2xl border border-slate-200 bg-white" aria-label={D.T("teamActivity")}>
      <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-5 lg:px-5 lg:pt-4">
        <div className="group flex min-w-0 items-center gap-3">
          <TeamArt size={42} />
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-semibold leading-tight text-[#0b1f3a] sm:text-[18px] lg:text-[19px]">{D.T("teamActivity")}</h2>
            <p className="mt-0.5 truncate text-[12.5px] text-slate-500">{D.T("tapPerson")}</p>
          </div>
        </div>
      </div>
      <ul className="mx-4 mt-4 divide-y divide-slate-100 rounded-2xl bg-slate-50/70 px-3.5 ring-1 ring-slate-100 sm:hidden">
        {chips.map((c) => (
          <li key={c.s} className="flex items-center gap-3 py-3">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${PERSON_STATE[c.s].dot}`} />
            <span className="flex-1 text-[14px] text-slate-600">{c.label}</span>
            <span className={`text-[16px] font-semibold tabular-nums ${n(c.s) ? "text-[#0b1f3a]" : "text-slate-300"}`}>{n(c.s)}</span>
          </li>
        ))}
      </ul>
      <div className="hidden flex-wrap gap-1.5 px-4 pt-3 sm:flex lg:px-5">
        {chips.map((c) => (
          <span key={c.s} className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[12px] font-medium text-slate-600 ring-1 ring-slate-200">
            <span className={`h-2 w-2 rounded-full ${PERSON_STATE[c.s].dot}`} />{n(c.s)} {c.label.toLowerCase()}
          </span>
        ))}
      </div>
      {loading && !people.length ? (
        <ul className="space-y-2 p-4 lg:px-5">{[0, 1, 2].map((i) => <li key={i} className="h-14 animate-pulse rounded-xl bg-slate-50" />)}</ul>
      ) : !people.length ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-8 pt-4 text-center">
          <p className="text-[14.5px] font-semibold text-[#0b1f3a]">{D.T("noCollabs")}</p>
          <p className="mt-1 text-[13px] text-slate-500">{D.T("addPeople")}</p>
          <Link prefetch={false} href="/dashboard/jobs/team" className="mt-3 inline-block rounded-lg px-3 py-1.5 text-[13.5px] font-semibold text-[#0f766e] hover:bg-[#e9f7f4]">{D.T("goTeam")}</Link>
        </div>
      ) : (
        <ul className="mt-5 divide-y divide-slate-100 border-t border-slate-100 px-2 pb-3 pt-1.5 lg:mt-2 lg:border-0 lg:px-3 lg:pb-2 lg:pt-0">
          {shown.map((p) => {
            const st = PERSON_STATE[p.state];
            return (
              <li key={p.id}>
                <button type="button" onClick={() => onPick(p.id)} className="group flex w-full items-center gap-3.5 rounded-xl px-2 py-3.5 text-left transition-colors hover:bg-slate-50 lg:gap-3 lg:px-3 lg:py-2.5">
                  <span className={`relative shrink-0 transition-transform duration-200 group-hover:scale-105 ${p.state === "offline" ? "opacity-60 grayscale" : ""}`}>
                    <TechDot t={{ initials: p.initials, color: p.color, avatar_url: p.avatar_url, name: p.name }} size={40} />
                    <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-white ${st.dot} ${p.state === "available" ? "animate-pulse" : ""}`} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-[#0b1f3a]">{p.name}</span>
                    <span className="block truncate text-[12.5px] text-slate-500">
                      {p.today ? D.T("todayDone", { n: p.today, d: p.done }) : D.T("noJobsToday")}
                      {p.state === "offline" && p.seen ? ` · ${p.seen.replace("Offline · ", D.T("seenLower"))}` : p.state === "available" && p.next ? D.T("nextAt", { t: fmtTime(p.next) }) : ""}
                    </span>
                  </span>
                  <Pill k={st.k}>{st.label}</Pill>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {people.length > 7 && (
        <div className="mt-auto border-t border-slate-100 px-4 py-2.5 text-center">
          <button type="button" onClick={() => setAll((v) => !v)} className="rounded-lg px-3 py-1.5 text-[13.5px] font-semibold text-[#0f766e] hover:bg-[#e9f7f4]">
            {all ? D.T("showLess") : D.T("seeAll", { n: people.length })}
          </button>
        </div>
      )}
    </section>
  );
}

// ---------- Panel de una persona: sus trabajos de hoy, los próximos y los terminados ----------
function PersonDrawer({ p, rows, now, onClose }: { p: Person; rows: { j: OpsJob; g: OpsGroup }[]; now: number; onClose: () => void }) {
  const D = useDash();
  const { PERIODS, LIST_WHEN, STATUS_OPTS, statusOf, PERSON_STATE, JOB_CATS, usd0, usd2, whenText, agoText, fmtTime } = D;
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true));
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(r); document.removeEventListener("keydown", onKey); };
  }, [onClose]);
  const d0 = dayStart(new Date(now)), d1 = addDays(d0, 1), week = addDays(d0, 8), ago7 = addDays(d0, -7);
  const at = (j: OpsJob) => (j.visit?.starts_at ? new Date(j.visit.starts_at) : null);
  const byTime = (a: { j: OpsJob }, b: { j: OpsJob }) => (a.j.visit?.starts_at ?? "9").localeCompare(b.j.visit?.starts_at ?? "9");
  const nowRows = rows.filter(({ j }) => ["on_my_way", "in_progress", "paused"].includes(j.visit?.status ?? ""));
  const todayRows = rows.filter((r) => !nowRows.includes(r) && r.g !== "done" && at(r.j) && at(r.j)! >= d0 && at(r.j)! < d1).sort(byTime);
  const lateRows = rows.filter((r) => !nowRows.includes(r) && r.g === "delayed" && !todayRows.includes(r));
  const nextRows = rows.filter((r) => r.g !== "done" && at(r.j) && at(r.j)! >= d1 && at(r.j)! < week).sort(byTime);
  const doneRows = rows.filter((r) => r.g === "done" && r.j.completed_at && new Date(r.j.completed_at) >= ago7).sort((a, b) => (b.j.completed_at ?? "").localeCompare(a.j.completed_at ?? ""));
  const st = PERSON_STATE[p.state];
  const Group = ({ title, list, empty }: { title: string; list: { j: OpsJob; g: OpsGroup }[]; empty?: string }) => (!list.length && !empty ? null : (
    <div className="mt-5">
      <h3 className="mb-1.5 flex items-center justify-between px-1 text-[12px] font-semibold uppercase tracking-wide text-slate-400">{title}<span className="tabular-nums">{list.length}</span></h3>
      {!list.length ? <p className="rounded-xl bg-slate-50 px-3 py-3 text-[13px] text-slate-500">{empty}</p> : (
        <ul className="space-y-1.5">
          {list.map(({ j, g }) => {
            const s = statusOf(j, g);
            return (
              <li key={j.id}>
                <Link prefetch={false} href={`/dashboard/jobs/${j.id}`} className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition-all hover:-translate-y-px hover:border-slate-300 hover:shadow-sm">
                  <span className="h-9 w-1 shrink-0 rounded-full" style={{ backgroundColor: j.type_color || "#cbd5e1" }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-[#0b1f3a]">{j.customer_name || j.number}</span>
                    <span className="block truncate text-[12.5px] text-slate-500">{j.type_name || j.title || D.T("job")} · {g === "done" && j.completed_at ? D.T("doneOn", { d: new Date(j.completed_at).toLocaleDateString(D.tag, { month: "short", day: "numeric" }) }) : whenText(j)}</span>
                  </span>
                  {g === "delayed" ? <LateHint j={j} now={now}><Pill k={s.key}>{s.label}</Pill></LateHint> : <Pill k={s.key}>{s.label}</Pill>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  ));
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label={p.name}>
      <button type="button" aria-label={D.T("close")} onClick={onClose} className={`absolute inset-0 bg-[#0b1f3a]/40 transition-opacity duration-200 ${shown ? "opacity-100" : "opacity-0"}`} />
      <div className={`absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-[#f7f9fb] shadow-[0_0_60px_rgba(15,40,60,0.25)] transition-transform duration-300 ease-out ${shown ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-start gap-3 border-b border-slate-200 bg-white px-5 py-5">
          <span className="relative shrink-0">
            <TechDot t={{ initials: p.initials, color: p.color, avatar_url: p.avatar_url, name: p.name }} size={52} />
            <span className={`absolute bottom-0 right-0 h-4 w-4 rounded-full ring-2 ring-white ${st.dot}`} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[19px] font-semibold text-[#0b1f3a]">{p.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Pill k={st.k}>{st.label}</Pill>
              {p.seen && <span className="text-[12.5px] text-slate-500">{p.seen.replace(/^Offline · /, D.T("lastSeen"))}</span>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={D.T("close")}
            className="group flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition-all hover:bg-[#fff1f2] hover:text-[#e11d48]">
            <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform duration-300 group-hover:rotate-90" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m5 5 10 10M15 5 5 15" /></svg>
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 border-b border-slate-200 bg-white px-5 py-3 text-center">
          {[{ n: p.today, l: D.T("d.today") }, { n: p.done, l: D.T("d.doneToday") }, { n: nextRows.length, l: D.T("d.next7") }].map((x) => (
            <div key={x.l}><p className="text-[20px] font-semibold tabular-nums text-[#0b1f3a]">{x.n}</p><p className="text-[12px] text-slate-500">{x.l}</p></div>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-6">
          <Group title={D.T("g.now")} list={nowRows} />
          <Group title={D.T("g.late")} list={lateRows} />
          <Group title={D.T("g.rest")} list={todayRows} empty={D.T("g.restEmpty")} />
          <Group title={D.T("g.next")} list={nextRows} empty={D.T("g.nextEmpty")} />
          <Group title={D.T("g.done")} list={doneRows} />
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-slate-200 bg-white px-5 py-4">
          <Link prefetch={false} href={`/dashboard/jobs/schedule?tech=${p.id}&view=week`}
            className="flex h-11 items-center justify-center gap-2 rounded-lg border border-[#0f766e] text-[14.5px] font-semibold text-[#0f766e] transition-colors hover:bg-[#e9f7f4]">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" /></svg>
            {D.T("theirCal")}
          </Link>
          <Link prefetch={false} href="/dashboard/jobs/assign"
            className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#0f766e] text-[14.5px] font-semibold text-white shadow-sm transition-colors hover:bg-[#0c5f59]">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2.5 15a5.5 5.5 0 0 1 11 0M14 12h7M18 9l3 3-3 3" /></svg>
            {D.T("assignJobs")}
          </Link>
          {p.phone && (
            <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`} className="col-span-2 flex h-10 items-center justify-center gap-2 rounded-lg text-[14px] font-semibold text-slate-600 hover:bg-slate-100">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>
              Call {p.name.split(" ")[0]}
            </a>
          )}
        </div>
      </div>
    </div>,
    document.body,
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


// ---------- Ingresos (solo dueño) ----------
const REV_OPTS: { v: RevenueRange; label: string }[] = [{ v: "week", label: "Weekly" }, { v: "month", label: "Monthly" }, { v: "year", label: "Yearly" }];
function RevenueCard({ data }: { data: RevenueData }) {
  const D = useDash();
  const { PERIODS, LIST_WHEN, STATUS_OPTS, statusOf, PERSON_STATE, JOB_CATS, usd0, usd2, whenText, agoText, fmtTime } = D;
  const [range, setRange] = useState<RevenueRange>("week");
  const s = data.ranges[range];
  const stats: { label: string; value: number; color: string; note?: string; profit?: boolean }[] = [
    { label: D.T("invoiced"), value: s.totals.invoiced, color: "#3b82f6" },
    { label: D.T("collected"), value: s.totals.collected, color: "#14a39a" },
    { label: D.T("outstanding"), value: data.outstanding, color: "#94a3b8", note: data.overdue ? D.T("overdueV", { v: usd0(data.overdue) }) : D.T("openBalance") },
    { label: D.T("costs"), value: s.totals.costs, color: "#e8713a" },
    { label: D.T("profit"), value: s.totals.profit, color: s.totals.profit < 0 ? "#be123c" : "#0f766e", profit: true },
  ];
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 lg:p-5" aria-label={D.T("revOverview")}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-[17px] font-semibold text-[#0f766e]">$</span>
          <div>
            <h2 className="text-[17px] font-semibold leading-tight text-[#0b1f3a] lg:text-[18px]">{D.T("revOverview")}</h2>
            <p className="text-[12px] text-slate-500">{D.T("ownerOnly")}</p>
          </div>
        </div>
        <Pick value={range} options={REV_OPTS.map((o) => ({ ...o, label: D.T(`rev.${o.v}` as never) }))} onChange={(v) => setRange(v as RevenueRange)} ariaLabel={D.T("revPeriod")} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5">
        {stats.map((x) => (
          <div key={x.label} className="min-w-0">
            <dt className="flex items-center gap-1.5 text-[12px] text-slate-500"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: x.color }} />{x.label}</dt>
            <dd className="mt-0.5 truncate text-[17px] font-semibold tabular-nums text-[#0b1f3a]" style={x.profit ? { color: x.color } : undefined}>{usd0(x.value)}</dd>
            {x.note && <dd className="truncate text-[11px] text-slate-400">{x.note}</dd>}
          </div>
        ))}
      </dl>
      <div className="mt-3">
        <BarChart x={s.labels} label={D.T("revOverview")} format={usd2} height={240} animKey={range} wide={range === "week"}
          emptyText={D.T("noMoney")}
          series={[
            { key: "inv", label: D.T("invoiced"), color: "#93c5fd", values: s.invoiced },
            { key: "col", label: D.T("collected"), color: "#14a39a", values: s.collected },
            { key: "cost", label: D.T("costs"), color: "#f4a37a", values: s.costs },
          ]} />
      </div>
    </section>
  );
}


// ---------- Tabla (computadora) ----------
type Row = { j: OpsJob; g: OpsGroup };
const TH = "whitespace-nowrap px-3 py-3 text-left text-[12.5px] font-semibold text-slate-500";
const TD = "px-3 py-3 align-middle";
function TaskTable({ rows, loading, now, canSeePrice }: { rows: Row[]; loading: boolean; now: number; canSeePrice: boolean }) {
  const D = useDash();
  const { PERIODS, LIST_WHEN, STATUS_OPTS, statusOf, PERSON_STATE, JOB_CATS, usd0, usd2, whenText, agoText, fmtTime } = D;
  const H = ({ icon, children }: { icon: string; children: React.ReactNode }) => (
    <th className={TH}><span className="inline-flex items-center gap-1.5">
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>{children}</span></th>
  );
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[960px] border-collapse">
        <thead className="border-b border-slate-100 bg-[#fafbfc]">
          <tr>
            <H icon="M5 3h14v18H5zM9 8h6M9 12h6M9 16h3">{D.T("h.jobId")}</H>
            <H icon="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 21a7.5 7.5 0 0 1 15 0">{D.T("h.customer")}</H>
            <H icon="M4 15v-3a8 8 0 0 1 16 0v3M4 15h3v5H4zM17 15h3v5h-3z">{D.T("h.service")}</H>
            <H icon="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.1-.4-.4-2.1z">{D.T("h.tech")}</H>
            <H icon="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2">{D.T("h.time")}</H>
            <H icon="M4 20h16M7 16V10M12 16V5M17 16v-4">{D.T("h.status")}</H>
            <H icon="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z">{D.T("h.location")}</H>
            {canSeePrice && <H icon="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM14.5 9.2c-.4-.9-1.4-1.4-2.5-1.4-1.4 0-2.5.7-2.5 1.8 0 2.6 5 1.4 5 4 0 1.1-1.1 1.9-2.6 1.9-1.3 0-2.4-.6-2.7-1.6M12 6.5v11">{D.T("h.price")}</H>}
            <th className={`${TH} text-right`}>{D.T("h.actions")}</th>
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
                <td className={TD}><Link prefetch={false} href={`/dashboard/jobs/${j.id}`} className="whitespace-nowrap text-[13.5px] font-semibold tabular-nums text-[#0b1f3a] hover:text-[#0f766e] hover:underline">{j.number}</Link></td>
                <td className={TD}>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e9f7f4] text-[12px] font-semibold text-[#0f766e]">{(j.customer_name || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
                    <span className="max-w-[12rem] truncate text-[14px] font-medium text-[#0b1f3a]">{j.customer_name || "—"}</span>
                  </span>
                </td>
                <td className={TD}>
                  <span className="inline-flex max-w-[11rem] items-center gap-2 text-[14px] font-medium" style={{ color: j.type_color || "#475569" }}>
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: j.type_color || "#94a3b8" }} />
                    <span className="truncate">{j.type_name || j.title || D.T("general")}</span>
                  </span>
                </td>
                <td className={TD}>
                  <span className="flex items-center gap-2">
                    <TechDots techs={j.techs} size={26} max={2} />
                    <span className="max-w-[9rem] truncate text-[14px] text-slate-700">{j.techs.length ? j.techs[0].name : <span className="text-slate-400">{D.T("nobodyYet")}</span>}{j.techs.length > 1 && <span className="font-semibold text-[#e8713a]"> +{j.techs.length - 1}</span>}</span>
                  </span>
                </td>
                <td className={`${TD} whitespace-nowrap text-[14px] tabular-nums text-slate-700`}>{whenText(j)}</td>
                <td className={TD}>
                  <span className="flex flex-col items-start gap-1">
                    {g === "delayed" ? <LateHint j={j} now={now}><Pill k={st.key}>{st.label}</Pill></LateHint> : <Pill k={st.key}>{st.label}</Pill>}
                    {g !== "delayed" && g !== "done" && g !== "unassigned" && (
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
  const D = useDash();
  const { PERIODS, LIST_WHEN, STATUS_OPTS, statusOf, PERSON_STATE, JOB_CATS, usd0, usd2, whenText, agoText, fmtTime } = D;
  const q = new URLSearchParams({ from: "home" }); if (j.visit?.id) q.set("visit", j.visit.id); if (j.visit?.starts_at) q.set("date", isoDay(new Date(j.visit.starts_at)));
  const items = [
    { label: D.T("openJob"), href: `/dashboard/jobs/${j.id}`, icon: "M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" },
    ...(g !== "done" ? [{ label: D.T("editJob"), href: `/dashboard/jobs/${j.id}/edit`, icon: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" }] : []),
    ...(g !== "done" ? [{ label: j.techs.length ? D.T("changeCollabs") : D.T("assignCollab"), href: `/dashboard/jobs/assign?${q.toString()}`, icon: "M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2.5 15a5.5 5.5 0 0 1 11 0M14 12h7M18 9l3 3-3 3" }] : []),
    { label: D.T("seeOps"), href: "/dashboard/jobs/operations", icon: "M3 12h4l2.5-6 4 12 2.5-6H21" },
  ];
  return (
    <span className="inline-flex items-center gap-1">
      <Link prefetch={false} href={`/dashboard/jobs/${j.id}`} aria-label={D.T("openJobN", { n: j.number })}
        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-all duration-150 hover:scale-110 hover:bg-[#e9f7f4] hover:text-[#0f766e]">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={items[0].icon} /></svg>
      </Link>
      <Menu>
        <MenuButton aria-label={D.T("moreActions", { n: j.number })}
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
  const D = useDash();
  const { PERIODS, LIST_WHEN, STATUS_OPTS, statusOf, PERSON_STATE, JOB_CATS, usd0, usd2, whenText, agoText, fmtTime } = D;
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
                <span className="block truncate text-[12.5px] text-slate-500">{j.type_name || j.title || D.T("general")} · {whenText(j)}{cityOf(j) ? ` · ${cityOf(j)}` : ""}</span>
                <span className="mt-1 flex items-center gap-2">
                  {g === "delayed" ? <LateHint j={j} now={now}><Pill k={st.key}>{st.label}</Pill></LateHint> : <Pill k={st.key}>{st.label}</Pill>}
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

// ---------- "Delayed" con su detalle al pasar el mouse (cuántos días, por qué y qué hacer) ----------
function lateAdvice(j: OpsJob, T: ReturnType<typeof useDash>["T"]) {
  const s = j.visit?.status;
  if (!j.techs.length) return T("adv.assign");
  if (s === "on_my_way") return T("adv.omw");
  if (s === "in_progress" || s === "paused") return T("adv.working", { name: j.techs[0].name.split(" ")[0] });
  return T("adv.call");
}
function LateHint({ j, now, children }: { j: OpsJob; now: number; children: React.ReactNode }) {
  const D = useDash();
  const { PERIODS, LIST_WHEN, STATUS_OPTS, statusOf, PERSON_STATE, JOB_CATS, usd0, usd2, whenText, agoText, fmtTime } = D;
  const d = D.ox.delay(j, now);
  const ref = useRef<HTMLSpanElement>(null);
  const [at, setAt] = useState<{ x: number; y: number; below: boolean } | null>(null);
  if (!d) return <>{children}</>;
  // La leyenda flota por encima de todo (no la corta la tabla): arriba del estado, o abajo si no cabe
  const show = () => { const r = ref.current?.getBoundingClientRect(); if (r) setAt({ x: r.left + r.width / 2, y: r.top < 150 ? r.bottom : r.top, below: r.top < 150 }); };
  return (
    <span ref={ref} className="inline-flex cursor-help" tabIndex={0} aria-label={`${d.label}. ${d.detail}`}
      onMouseEnter={show} onMouseLeave={() => setAt(null)} onFocus={show} onBlur={() => setAt(null)}>
      {children}
      {at && typeof document !== "undefined" && createPortal(
        <span role="tooltip" style={{ left: Math.min(Math.max(at.x, 132), window.innerWidth - 132), top: at.y }}
          className={`pointer-events-none fixed z-[120] w-60 -translate-x-1/2 rounded-xl border border-[#bfe6d8] bg-white px-3 py-2.5 text-left shadow-[0_10px_28px_rgba(15,40,60,0.14)] animate-[bp-fade_0.15s_ease-out] ${at.below ? "mt-2" : "-translate-y-full -mt-2"}`}>
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[#be123c]">
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="10" cy="11" r="6.5" /><path d="M10 7.5V11l2.2 1.6M8 2.5h4" /></svg>
            {d.label}
          </span>
          <span className="mt-0.5 block text-[12px] leading-snug text-slate-600">{d.detail}</span>
          <span className="mt-1.5 block border-t border-slate-100 pt-1.5 text-[12px] font-medium leading-snug text-[#0f766e]">{lateAdvice(j, D.T)}</span>
        </span>,
        document.body,
      )}
    </span>
  );
}

// ---------- Inicio: cobros (facturas vencidas o por vencer, para llamar al cliente) ----------
function InvoicesSection({ items }: { items: HomeAlert[] }) {
  const D = useDash();
  const { PERIODS, LIST_WHEN, STATUS_OPTS, statusOf, PERSON_STATE, JOB_CATS, usd0, usd2, whenText, agoText, fmtTime } = D;
  const [all, setAll] = useState(false);
  const overdue = items.filter((i) => (i.days ?? 0) < 0).sort((a, b) => (a.days ?? 0) - (b.days ?? 0));
  const soon = items.filter((i) => (i.days ?? 0) >= 0).sort((a, b) => (a.days ?? 0) - (b.days ?? 0));
  const list = [...overdue, ...soon];
  const shown = all ? list : list.slice(0, 5);
  const sum = (l: HomeAlert[]) => l.reduce((a, i) => a + (i.amount ?? 0), 0);
  const dueText = (d: number) => (d < 0 ? D.T("overdueDays", { n: -d }) : d === 0 ? D.T("dueToday") : d === 1 ? D.T("dueTomorrow") : D.T("dueIn", { n: d }));
  return (
    <section className="flex flex-col rounded-2xl border border-slate-200 bg-white" aria-label={D.T("payments")}>
      <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-5 lg:px-5 lg:pt-4">
        <div className="group flex min-w-0 items-center gap-3">
          <FinanceArt size={42} />
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-semibold leading-tight text-[#0b1f3a] sm:text-[18px] lg:text-[19px]">{D.T("payments")}</h2>
            <p className="mt-0.5 truncate text-[12.5px] text-slate-500">{list.length ? D.T("callCollect") : D.T("noOverdue")}</p>
          </div>
        </div>
        <Link prefetch={false} href="/dashboard/invoices" className="shrink-0 rounded-lg px-2.5 py-1.5 text-[13.5px] font-semibold text-[#2563eb] hover:bg-[#eef4ff]">{D.T("invoicesArrow")}</Link>
      </div>
      <div className="grid grid-cols-2 gap-3 px-4 pt-4 lg:gap-2.5 lg:px-5 lg:pt-3">
        {[{ l: overdue, label: D.T("overdue"), level: "red" as const, kind: "overdue" }, { l: soon, label: D.T("due7"), level: "orange" as const, kind: "due_soon" }].map((t) => (
          <div key={t.label} className={`group flex items-center gap-3 rounded-2xl p-3.5 ring-1 lg:rounded-xl lg:p-3 ${t.l.length ? `${CAT_TONE[t.level].bg} ${CAT_TONE[t.level].ring}` : "bg-white ring-slate-200"}`}>
            <AlertIcon kind={t.kind} level={t.l.length ? t.level : "gray"} size={34} />
            <span className="min-w-0">
              <span className={`block text-[20px] font-semibold leading-none tabular-nums ${t.l.length ? CAT_TONE[t.level].text : "text-slate-300"}`}>{usd0(sum(t.l))}</span>
              <span className={`mt-1 block truncate text-[12.5px] font-semibold ${t.l.length ? "text-[#0b1f3a]" : "text-slate-400"}`}>{t.l.length} {t.label.toLowerCase()}</span>
            </span>
          </div>
        ))}
      </div>
      {!list.length ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-8 pt-6 text-center">
          <span className="group"><FinanceArt size={56} /></span>
          <p className="mt-2 text-[14.5px] font-semibold text-[#0b1f3a]">{D.T("nothingCollect")}</p>
          <p className="mt-1 max-w-sm text-[13px] text-slate-500">{D.T("collectHint")}</p>
        </div>
      ) : (
        <ul className="mt-5 border-t border-slate-100 px-2 pb-3 pt-1.5 lg:mt-2 lg:border-0 lg:px-3 lg:pb-2 lg:pt-0">
          {shown.map((a) => {
            const d = a.days ?? 0;
            return (
              <li key={a.id} className="border-b border-slate-100 last:border-0">
                <Link prefetch={false} href={a.href} className="group flex items-center gap-3.5 rounded-xl px-2 py-3.5 transition-colors hover:bg-slate-50 lg:gap-3 lg:px-3 lg:py-2.5">
                  <AlertIcon kind={a.kind} level={d < 0 ? "red" : d <= 1 ? "orange" : "blue"} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate text-[14.5px] font-semibold text-[#0b1f3a]">{a.customer}</span>
                      <span className="hidden shrink-0 text-[12px] tabular-nums text-slate-400 sm:inline">{a.number}</span>
                    </span>
                    <span className={`mt-0.5 block truncate text-[12.5px] font-medium lg:mt-0 ${d < 0 ? "text-[#be123c]" : "text-[#b45309]"}`}>{dueText(d)}<span className="hidden sm:inline"> · {d < 0 ? D.T("callToCollect") : D.T("remindCustomer")}</span><span className="font-normal tabular-nums text-slate-400 sm:hidden"> · {a.number}</span></span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[14.5px] font-semibold tabular-nums text-[#0b1f3a]">{usd2(a.amount ?? 0)}</span>
                    <span className="hidden text-[11.5px] font-semibold text-[#0f766e] opacity-0 transition-opacity group-hover:opacity-100 lg:block">{D.T("followUp")}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {list.length > shown.length && (
        <div className="mt-auto border-t border-slate-100 px-4 py-2.5 text-center">
          <button type="button" onClick={() => setAll(true)} className="rounded-lg px-3 py-1.5 text-[13.5px] font-semibold text-[#0f766e] hover:bg-[#e9f7f4]">{D.T("seeAll", { n: list.length })}</button>
        </div>
      )}
    </section>
  );
}

// =====================================================================
// Dashboard de la app Jobs: distinto al inicio. Solo trabajos y equipo:
// resumen por estado · atención · equipo · próximos · trabajos de hoy · avance de cada técnico.
// =====================================================================
const progColor = (g: OpsGroup) => (g === "done" ? "bg-[#14a39a]" : g === "delayed" ? "bg-[#f43f5e]" : g === "in_progress" ? "bg-[#f59e0b]" : "bg-[#3b82f6]");
function Progress({ j, g, w = "w-28" }: { j: OpsJob; g: OpsGroup; w?: string }) {
  const pct = progressOf(j);
  return (
    <span className={`flex items-center gap-2 ${w}`}>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <span className={`block h-full rounded-full transition-all duration-700 ${progColor(g)}`} style={{ width: `${Math.max(pct, 3)}%` }} />
      </span>
      <span className="w-8 shrink-0 text-right text-[11.5px] font-semibold tabular-nums text-slate-500">{pct}%</span>
    </span>
  );
}
function StatusCell({ j, g, now }: { j: OpsJob; g: OpsGroup; now: number }) {
  const D = useDash();
  const { PERIODS, LIST_WHEN, STATUS_OPTS, statusOf, PERSON_STATE, JOB_CATS, usd0, usd2, whenText, agoText, fmtTime } = D;
  const st = statusOf(j, g);
  return g === "delayed" ? <LateHint j={j} now={now}><Pill k={st.key}>{st.label}</Pill></LateHint> : <Pill k={st.key}>{st.label}</Pill>;
}
function CardHead({ icon, title, sub, link }: { icon: React.ReactNode; title: string; sub?: string; link?: { href: string; label: string } }) {
  const D = useDash();
  const { PERIODS, LIST_WHEN, STATUS_OPTS, statusOf, PERSON_STATE, JOB_CATS, usd0, usd2, whenText, agoText, fmtTime } = D;
  return (
    <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4 lg:px-5">
      <div className="group flex min-w-0 items-center gap-2.5">
        {icon}
        <div className="min-w-0">
          <h2 className="truncate text-[17px] font-semibold leading-tight text-[#0b1f3a]">{title}</h2>
          {sub && <p className="truncate text-[12.5px] text-slate-500">{sub}</p>}
        </div>
      </div>
      {link && <Link prefetch={false} href={link.href} className="shrink-0 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-[#2563eb] hover:bg-[#eef4ff]">{link.label} →</Link>}
    </div>
  );
}

type HubPeriod = "today" | "week" | "month" | "year";
const HUB_PERIODS_EN: HubPeriod[] = ["today", "week", "month", "year"];
function JobsHub({ header, error, loading, membersLoading, now, withGroup, people, jobAlerts, kpiGroups, canSeePrice, onPerson, drawer, team, canDelete, onReload, rangeOf, inRange }: {
  header?: React.ReactNode; error: string; loading: boolean; membersLoading: boolean; now: number; withGroup: { j: OpsJob; g: OpsGroup }[];
  people: Person[]; jobAlerts: JobAlert[]; kpiGroups: Record<OpsGroup, number>; canSeePrice: boolean; onPerson: (id: string) => void; drawer: React.ReactNode;
  team: TeamMember[]; canDelete: boolean; onReload: () => void;
  rangeOf: (p: Period, shift?: number) => [Date, Date]; inRange: (j: OpsJob, g: OpsGroup, r: [Date, Date], live?: boolean) => boolean;
}) {
  const D = useDash();
  const { PERIODS, LIST_WHEN, STATUS_OPTS, statusOf, PERSON_STATE, JOB_CATS, usd0, usd2, whenText, agoText, fmtTime } = D;
  const HUB_PERIODS = HUB_PERIODS_EN.map((v) => ({ v, label: D.T(`hp.${v}` as never) }));
  const [listPeriod, setListPeriod] = useState<HubPeriod>("today");
  const [del, setDel] = useState<OpsJob | null>(null);
  const [toast, setToast] = useState("");
  const d0 = dayStart(new Date(now)), d1 = addDays(d0, 1), d2 = addDays(d0, 2);
  const start = (j: OpsJob) => (j.visit?.starts_at ? new Date(j.visit.starts_at) : null);
  const live = (j: OpsJob) => ["on_my_way", "in_progress", "paused"].includes(j.visit?.status ?? "");
  const timeOf = (j: OpsJob) => { const s = start(j); return !s ? "—" : s >= d0 && s < d1 ? fmtTime(s) : whenText(j); };
  // Trabajos de hoy: los agendados hoy + lo que está pasando + lo que va tarde
  const today = withGroup.filter(({ j, g }) => live(j) || g === "delayed" || (start(j) && start(j)! >= d0 && start(j)! < d1) || (g === "done" && j.completed_at && new Date(j.completed_at) >= d0))
    .sort((a, b) => (a.j.visit?.starts_at ?? "9").localeCompare(b.j.visit?.starts_at ?? "9"));
  const upcoming = withGroup.filter(({ j, g }) => g !== "done" && start(j) && start(j)!.getTime() >= now - 30 * 60000 && start(j)! < d2)
    .sort((a, b) => (a.j.visit?.starts_at ?? "").localeCompare(b.j.visit?.starts_at ?? "")).slice(0, 6);
  const attention = jobAlerts.filter((a) => ["delayed", "unassigned", "paused", "followup"].includes(a.cat));
  const order: Record<string, number> = { delayed: 0, paused: 1, followup: 2, unassigned: 3 };
  attention.sort((a, b) => order[a.cat] - order[b.cat] || a.sort - b.sort);
  const [shownToday, setShownToday] = useState(10);
  useEffect(() => setShownToday(10), [listPeriod]);
  const listRows = listPeriod === "today" ? today : (() => {
    const y = new Date(now).getFullYear();
    const r: [Date, Date] = listPeriod === "year" ? [new Date(y, 0, 1), new Date(y + 1, 0, 1)] : rangeOf(listPeriod);
    return withGroup.filter(({ j, g }) => inRange(j, g, r)).sort((a, b) => (a.j.visit?.starts_at ?? "9").localeCompare(b.j.visit?.starts_at ?? "9"));
  })();
  const listLabel = HUB_PERIODS.find((p) => p.v === listPeriod)!.label;
  // Lo que hace cada persona ahora (o lo próximo que tiene)
  const doing = (id: string) => {
    const mine = withGroup.filter(({ j }) => j.techs.some((t) => t.user_id === id));
    return mine.find(({ j }) => live(j)) ?? mine.filter(({ g, j }) => g !== "done" && start(j) && start(j)! >= d0 && start(j)! < d1).sort((a, b) => (a.j.visit?.starts_at ?? "").localeCompare(b.j.visit?.starts_at ?? ""))[0] ?? null;
  };
  const techs = people.map((p) => ({ p, rows: today.filter(({ j }) => j.techs.some((t) => t.user_id === p.id)) })).filter((x) => x.rows.length);
  const ops = (g?: OpsGroup) => `/dashboard/jobs/operations${g ? `?focus=${g}` : ""}`;
  const TITLE: Record<string, string> = { delayed: D.T("t.delayed"), unassigned: D.T("t.unassigned"), paused: D.T("t.paused"), followup: D.T("t.followup") };

  return (
    <div className="pb-24 lg:pb-10">
      {header}
      <div className="w-full px-4 pt-5 lg:px-8 lg:pt-6">
        {error && <p role="alert" className="mb-4 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-[14px] text-[#be123c]">{error}</p>}

        {/* 1. Resumen de hoy por estado */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:gap-4 xl:grid-cols-5">
          <Kpi label={D.T("k.unassigned")} value={kpiGroups.unassigned} art={<GroupArt g="unassigned" size={46} />} loading={loading} href="/dashboard/jobs/assign" hint={D.T("needCollab")} action={D.T("assignThem")} />
          <Kpi label={D.T("k.assigned")} value={kpiGroups.assigned} art={<GroupArt g="assigned" size={46} />} loading={loading} href={ops("assigned")} hint={D.T("readyStart")} action={D.T("seeJobs")} />
          <Kpi label={D.T("k.inProgress")} value={kpiGroups.in_progress} art={<GroupArt g="in_progress" size={46} />} loading={loading} href={ops("in_progress")} hint={D.T("activeJobs")} action={D.T("seeWho")} />
          <Kpi label={D.T("k.delayed")} value={kpiGroups.delayed} art={<GroupArt g="delayed" size={46} />} loading={loading} href={ops("delayed")} hint={kpiGroups.delayed ? D.T("needAttention") : D.T("nothingLate2")} tone={kpiGroups.delayed ? "red" : undefined} action={D.T("seeLate")} />
          <Kpi label={D.T("k.completed")} value={kpiGroups.done} art={<GroupArt g="done" size={46} />} loading={loading} href={ops("done")} hint={D.T("finishedToday")} tone={kpiGroups.done ? "green" : undefined} action={D.T("seeFinished")} />
        </div>

        {/* Paso 5.8b: qué respondieron los clientes de las próximas visitas */}
        <ConfirmationsStrip className="mt-5 lg:mt-6" />

        {/* 2. Atención · Equipo · Próximos */}
        <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-4 lg:mt-6 lg:grid-cols-2 2xl:grid-cols-3">
          <section className="flex flex-col rounded-2xl border border-slate-200 bg-white" aria-label={D.T("needsAttention")}>
            <CardHead icon={<AlertIcon kind="check" level={attention.length ? "red" : "teal"} size={36} />} title={D.T("needsAttention")}
              sub={loading ? D.T("checking") : attention.length ? D.T("needYouN", { n: attention.length }) : D.T("nothingNeeds")} link={{ href: ops(), label: D.T("seeAllL") }} />
            {!attention.length ? <p className="px-5 pb-6 pt-2 text-[13.5px] text-slate-500">{loading ? "" : D.T("attentionEmpty")}</p> : (
              <ul className="divide-y divide-slate-100 px-2 pb-2 lg:px-3">
                {attention.slice(0, 6).map((a) => {
                  const c = JOB_CATS.find((x) => x.id === a.cat)!;
                  return (
                    <li key={a.id}>
                      <Link prefetch={false} href={a.href} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-slate-50">
                        <AlertIcon kind={c.icon} level={c.level} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold text-[#0b1f3a]">{TITLE[a.cat] ?? a.title}</span>
                          <span className="block truncate text-[12.5px] text-slate-500">{a.job ? `${a.job.customer_name || a.job.number} · ${a.job.type_name || a.job.title || D.T("job")}` : a.title}</span>
                        </span>
                        {a.cat === "delayed" && a.job ? <LateHint j={a.job} now={now}><Pill k="delayed">{D.T("k.delayed")}</Pill></LateHint>
                          : a.cat === "unassigned" ? <Pill k="unassigned">{D.T("pending")}</Pill> : a.cat === "paused" ? <Pill k="paused">{D.T("paused")}</Pill> : <Pill k="on_hold">{D.T("followUpPill")}</Pill>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="flex flex-col rounded-2xl border border-slate-200 bg-white" aria-label={D.T("teamActivity")}>
            <CardHead icon={<TeamArt size={36} />} title={D.T("teamActivity")} sub={membersLoading ? D.T("checkingOnline") : D.T("availWorking", { a: people.filter((p) => p.state === "available").length, w: people.filter((p) => ["on_site", "on_my_way", "paused"].includes(p.state)).length })}
              link={{ href: "/dashboard/jobs/team", label: D.T("team") }} />
            {!people.length ? <p className="px-5 pb-6 pt-2 text-[13.5px] text-slate-500">{loading ? "" : D.T("addPeopleShort")}</p> : (
              <ul className="divide-y divide-slate-100 px-2 pb-2 lg:px-3">
                {people.slice(0, 6).map((p) => {
                  const st = PERSON_STATE[p.state], cur = doing(p.id);
                  return (
                    <li key={p.id}>
                      <button type="button" onClick={() => onPerson(p.id)} className="group flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-slate-50">
                        <span className={`relative shrink-0 transition-transform duration-200 group-hover:scale-105 ${p.state === "offline" ? "opacity-60 grayscale" : ""}`}>
                          <TechDot t={{ initials: p.initials, color: p.color, avatar_url: p.avatar_url, name: p.name }} size={38} />
                          <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white ${st.dot}`} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold text-[#0b1f3a]">{p.name}</span>
                          <span className="block truncate text-[12.5px] text-slate-500">
                            {cur ? <>{cur.j.type_name || cur.j.title || D.T("job")} · <span className="font-medium text-[#2563eb]">{statusOf(cur.j, cur.g).label}</span></> : p.state === "offline" ? (p.seen.replace("Offline · ", D.T("seen")) || D.T("offline")) : D.T("noJobsLeft")}
                          </span>
                        </span>
                        <span className={`flex shrink-0 items-center gap-1.5 text-[12.5px] font-semibold ${p.state === "available" ? "text-[#15803d]" : p.state === "on_site" ? "text-[#0f766e]" : p.state === "on_my_way" ? "text-[#2563eb]" : p.state === "offline" ? "text-slate-400" : "text-[#b45309]"}`}>
                          <span className={`h-2 w-2 rounded-full ${st.dot}`} />{st.label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="flex flex-col rounded-2xl border border-slate-200 bg-white lg:col-span-2 2xl:col-span-1" aria-label={D.T("upcoming")}>
            <CardHead icon={<AlertIcon kind="calendar" level="blue" size={36} />} title={D.T("upcoming")} sub={D.T("todayTomorrow")} link={{ href: "/dashboard/jobs/schedule?view=day", label: D.T("calendar") }} />
            {!upcoming.length ? <p className="px-5 pb-6 pt-2 text-[13.5px] text-slate-500">{loading ? "" : D.T("noMoreJobs")}</p> : (
              <ul className="divide-y divide-slate-100 px-2 pb-2 lg:px-3">
                {upcoming.map(({ j, g }) => {
                  const s = start(j)!;
                  return (
                    <li key={j.id}>
                      <Link prefetch={false} href={`/dashboard/jobs/${j.id}`} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-slate-50">
                        <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white leading-none transition-transform duration-200 group-hover:scale-105">
                          <span className="text-[9.5px] font-semibold uppercase text-[#e8713a]">{s.toLocaleDateString(D.tag, { weekday: "short" })}</span>
                          <span className="mt-0.5 text-[15px] font-semibold tabular-nums text-[#0b1f3a]">{s.getDate()}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-semibold tabular-nums text-[#2563eb]">{fmtTime(s)}</span>
                          <span className="block truncate text-[13px] font-medium text-[#0b1f3a]">{j.customer_name || j.number}</span>
                          <span className="block truncate text-[12px] text-slate-500">{j.type_name || j.title || D.T("job")}{j.techs.length ? ` · ${firstNames(j)}` : ""}</span>
                        </span>
                        <StatusCell j={j} g={g} now={now} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* 3. Trabajos (hoy, semana, mes o año) con su avance */}
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white lg:mt-6" aria-label={D.T("jobsAria")}>
          <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4 lg:px-5">
            <div className="group flex min-w-0 items-center gap-2.5">
              <JobsArt size={36} />
              <div className="min-w-0">
                <h2 className="truncate text-[17px] font-semibold leading-tight text-[#0b1f3a]">{listPeriod === "today" ? D.T("todaysJobs") : D.T("jobsPeriod", { p: listLabel.toLowerCase() })}</h2>
                <p className="truncate text-[12.5px] text-slate-500">{loading ? D.T("loading") : D.T("liveProgress", { n: listRows.length })}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Pick value={listPeriod} options={HUB_PERIODS} onChange={(v) => setListPeriod(v as HubPeriod)} ariaLabel={D.T("showJobsFor")} />
              <Link prefetch={false} href={ops()} className="hidden shrink-0 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-[#2563eb] hover:bg-[#eef4ff] sm:inline">{D.T("opsArrow")}</Link>
            </div>
          </div>
          {!listRows.length && !loading ? <p className="px-5 pb-6 pt-1 text-[13.5px] text-slate-500">{D.T("noJobsP", { p: listPeriod === "today" ? D.T("todayL") : listLabel.toLowerCase() })}</p> : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[860px] border-collapse">
                  <thead className="border-y border-slate-100 bg-[#fafbfc]">
                    <tr>{[D.T("hh.job"), D.T("hh.customer"), D.T("hh.service"), listPeriod === "today" ? D.T("hh.time") : D.T("hh.scheduled"), D.T("hh.collabs"), D.T("hh.status"), D.T("hh.progress")].map((h) => <th key={h} className={TH}>{h}</th>)}<th className={`${TH} text-right`}>{D.T("h.actions")}</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {listRows.slice(0, shownToday).map(({ j, g }) => (
                      <tr key={j.id} className={`group transition-colors hover:bg-[#f6fbfa] ${g === "done" ? "text-slate-500" : ""}`}>
                        <td className={TD}><Link prefetch={false} href={`/dashboard/jobs/${j.id}`} className="whitespace-nowrap text-[13.5px] font-semibold tabular-nums text-[#2563eb] hover:underline">{j.number}</Link></td>
                        <td className={`${TD} text-[14px] font-medium text-[#0b1f3a]`}><span className="block max-w-[13rem] truncate">{j.customer_name || "—"}</span></td>
                        <td className={`${TD} text-[14px] text-slate-700`}><span className="inline-flex max-w-[11rem] items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: j.type_color || "#94a3b8" }} /><span className="truncate">{j.type_name || j.title || D.T("general")}</span></span></td>
                        <td className={`${TD} whitespace-nowrap text-[14px] tabular-nums text-slate-700`}>{timeOf(j)}</td>
                        <td className={TD}><span className="flex items-center gap-2"><TechDots techs={j.techs} size={24} max={2} /><span className="max-w-[9rem] truncate text-[13.5px] text-slate-700">{j.techs.length ? j.techs[0].name : <span className="text-slate-400">{D.T("nobodyYet")}</span>}{j.techs.length > 1 && <span className="font-semibold text-[#e8713a]"> +{j.techs.length - 1}</span>}</span></span></td>
                        <td className={TD}><StatusCell j={j} g={g} now={now} /></td>
                        <td className={TD}><Progress j={j} g={g} w="w-36" /></td>
                        <td className={`${TD} text-right`}>
                          <span className="inline-flex items-center gap-1">
                            <RowMenu j={j} g={g} />
                            {canDelete && (
                              <button type="button" onClick={() => setDel(j)} aria-label={D.T("deleteJobN", { n: j.number })} title={D.T("delete")}
                                className="group/del flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-all duration-150 hover:scale-110 hover:bg-[#fff1f2] hover:text-[#e11d48]">
                                <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                  <path className="origin-[12px_6px] transition-transform duration-200 group-hover/del:-rotate-12" d="M4 6.5h16M9.5 6.5V4.5h5v2" />
                                  <path d="M6 6.5 7 20h10l1-13.5M10 10.5v6M14 10.5v6" />
                                </svg>
                              </button>
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TaskCards rows={listRows.slice(0, shownToday)} loading={loading} now={now} canSeePrice={canSeePrice} />
              {listRows.length > shownToday && (
                <div className="border-t border-slate-100 p-3 text-center">
                  <button type="button" onClick={() => setShownToday((n) => n + 10)} className="rounded-lg px-4 py-2 text-[14px] font-semibold text-[#0f766e] hover:bg-[#e9f7f4]">{D.T("showMore", { n: listRows.length - shownToday })}</button>
                </div>
              )}
            </>
          )}
        </section>

        {/* 4. Avance de cada técnico */}
        <div className="mt-5 lg:mt-6">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-semibold text-[#0b1f3a]">{D.T("progressBy")}</h2>
              <p className="text-[13px] text-slate-500">{D.T("progressHint")}</p>
            </div>
          </div>
          {!techs.length ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-[13.5px] text-slate-500">{loading ? D.T("loading") : D.T("nobodyToday")}</div>
          ) : (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {techs.map(({ p, rows }) => {
                const st = PERSON_STATE[p.state];
                const avg = Math.round(rows.reduce((a, r) => a + progressOf(r.j), 0) / rows.length);
                return (
                  <section key={p.id} className="rounded-2xl border border-slate-200 bg-white transition-shadow hover:shadow-[0_12px_28px_rgba(15,40,60,0.08)]">
                    <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
                      <span className="relative shrink-0">
                        <TechDot t={{ initials: p.initials, color: p.color, avatar_url: p.avatar_url, name: p.name }} size={40} />
                        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white ${st.dot}`} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-[#0b1f3a]">{p.name}</span>
                        <span className="block text-[12.5px] text-slate-500">{D.T("todayState", { n: rows.length, s: st.label.toLowerCase() })}</span>
                      </span>
                      <ProgressRing pct={avg} size={40} stroke={4} color="#e8713a" />
                      <button type="button" onClick={() => onPerson(p.id)} className="shrink-0 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-[#2563eb] hover:bg-[#eef4ff]">{D.T("details")}</button>
                    </div>
                    <ul className="divide-y divide-slate-100">
                      {rows.slice(0, 4).map(({ j, g }) => (
                        <li key={j.id}>
                          <Link prefetch={false} href={`/dashboard/jobs/${j.id}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50">
                            <span className="min-w-0 flex-1">
                              <span className="flex items-baseline gap-2">
                                <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-slate-400">{j.number}</span>
                                <span className="truncate text-[14px] font-semibold text-[#0b1f3a]">{j.type_name || j.title || D.T("job")}</span>
                              </span>
                              <span className="block truncate text-[12.5px] text-slate-500">{j.customer_name}{start(j) ? ` · ${timeOf(j)}` : ""}</span>
                              <span className="mt-1.5 block"><Progress j={j} g={g} w="w-full max-w-[14rem]" /></span>
                            </span>
                            <StatusCell j={j} g={g} now={now} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                    {rows.length > 4 && <button type="button" onClick={() => onPerson(p.id)} className="w-full border-t border-slate-100 py-2 text-[13px] font-semibold text-[#0f766e] hover:bg-[#e9f7f4]">+{rows.length - 4} more</button>}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {drawer}
      <OpsDialog ask={del ? { kind: "delete", job: del } : null} team={team} onClose={() => setDel(null)}
        onDone={(msg) => { setDel(null); setToast(msg); onReload(); setTimeout(() => setToast(""), 2600); }} />
      {toast && <div role="status" className="fixed bottom-5 left-1/2 z-[95] max-w-[92vw] -translate-x-1/2 rounded-xl bg-[#0b1f3a] px-4 py-2.5 text-[13.5px] font-medium text-white shadow-lg animate-[bp-pop-in_0.2s_ease-out]">{toast}</div>}
    </div>
  );
}
