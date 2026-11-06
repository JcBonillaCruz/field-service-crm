"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, MenuButton, MenuItem, MenuItems, Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { createClient } from "@/lib/supabase/client";
import { JobSettings, TeamMember, addDays, addressLine, afterHoursOf, dayStart, fromIsoDay, isoDay, jobError, receivesJobs, startOfMonth, startOfWeek } from "@/lib/jobs";
import { Modal, btnGhost, btnPrimary } from "@/components/sales/SalesBits";
import { OPS_GROUPS, OpsGroup, OpsJob, delayOf, fold, groupOf as groupAt, progressOf } from "@/lib/operations";
import { TechDot } from "@/components/jobs/EventBar";
import { CardMenu, GroupArt, OpsCard, ProgressRing } from "@/components/jobs/ops/OpsBits";
import OpsConnections from "@/components/jobs/ops/OpsConnections";
import { MoveTarget, OpsAsk, OpsDialog } from "@/components/jobs/ops/OpsDialogs";

type View = "board" | "connections";
type When = "today" | "week" | "last_week" | "month" | "last_month" | "quarter" | "all";
const WHEN: { v: When; label: string; hint: string }[] = [
  { v: "today", label: "Today", hint: "Jobs of today" },
  { v: "week", label: "This week", hint: "Sunday to Saturday" },
  { v: "last_week", label: "Last week", hint: "The week before this one" },
  { v: "month", label: "This month", hint: "The whole month" },
  { v: "last_month", label: "Last month", hint: "The month before this one" },
  { v: "quarter", label: "3 months", hint: "The last 3 months (and the next 3 for open jobs)" },
  { v: "all", label: "All time", hint: "Everything, including old completed jobs" },
];
// Filtro propio de cada columna: periodo (o el de la página) + búsqueda
type ColFilter = { when: When | "custom" | null; q: string; from?: string; to?: string }; // from/to = "yyyy-mm-dd" (calendario)
const NO_FILTER: ColFilter = { when: null, q: "" };
const fmtD = (iso: string) => fromIsoDay(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
// Periodo de la página movido con las flechas o escogido en el calendario (from/to = días incluidos)
type Span = { unit: "day" | "week" | "month" | "range"; from: string; to: string };
function spanLabel(s: Span) {
  const a = fromIsoDay(s.from);
  if (s.unit === "day" || s.from === s.to) return a.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  if (s.unit === "month") return a.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return `${fmtD(s.from)} – ${fmtD(s.to)}`;
}
function rangeOf(w: When, now: number, weekStartsOn: number, done: boolean): [Date, Date] | null {
  const today = dayStart(new Date(now)), wk = startOfWeek(today, weekStartsOn);
  switch (w) {
    case "today": return [today, addDays(today, 1)];
    case "week": return [wk, addDays(wk, 7)];
    case "last_week": return [addDays(wk, -7), wk];
    case "month": return [startOfMonth(today), new Date(today.getFullYear(), today.getMonth() + 1, 1)];
    case "last_month": return [new Date(today.getFullYear(), today.getMonth() - 1, 1), startOfMonth(today)];
    case "quarter": return [addDays(today, -91), done ? addDays(today, 1) : addDays(today, 92)];
    default: return null;
  }
}
const MOVABLE: OpsGroup[] = ["unassigned", "assigned", "in_progress"];
const ICON = {
  open: "M14 4h6v6M20 4l-9 9M10 6H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5",
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  unassigned: "M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3.5 20a6.5 6.5 0 0 1 11-4.7M16 16l5 5M21 16l-5 5",
  assigned: "M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3.5 20a6.5 6.5 0 0 1 13 0M16 12l2 2 4-4",
  in_progress: "M15 4.5a4.5 4.5 0 0 0-5.7 5.7L3.6 15.9a1.7 1.7 0 0 0 2.5 2.5l5.7-5.7a4.5 4.5 0 0 0 5.7-5.7l-2.7 2.7-2.3-.4-.4-2.3z",
  cancel: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8",
  del: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
};
const UNASSIGNED = "__none";
const btn = "inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[14px] font-medium text-slate-700 transition-colors hover:border-[#14a39a] hover:text-[#0f766e] data-[open]:border-[#0f766e] data-[open]:text-[#0f766e] focus:outline-none";

// =====================================================================
// Centro de Operaciones: todos los trabajos en 5 grupos, en vivo.
// Sin asignar · Asignados · En progreso · Retrasados · Terminados
// =====================================================================
export default function OperationsCenter({ companyId, team, weekStartsOn, canDelete, hours, money }: {
  companyId: string; team: TeamMember[]; weekStartsOn: number; canDelete: boolean; hours: Pick<JobSettings, "day_start" | "day_end" | "business_days">;
  money: "owner" | "manager" | null; // quién ve dinero arriba (la oficina no)
}) {
  const router = useRouter();
  const [jobs, setJobs] = useState<OpsJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [view, setView] = useState<View>("board");
  // En el celular solo se usa Connections (es la vista más cómoda con el dedo)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const on = () => setIsMobile(mq.matches); on();
    mq.addEventListener("change", on); return () => mq.removeEventListener("change", on);
  }, []);
  const shownView: View = isMobile ? "connections" : view;
  const [when, setWhenState] = useState<When>("week");
  const [span, setSpanState] = useState<Span | null>(null); // si hay uno, manda sobre "when"
  const [ask, setAsk] = useState<OpsAsk | null>(null);
  const [colF, setColF] = useState<Record<OpsGroup, ColFilter>>({ unassigned: NO_FILTER, assigned: NO_FILTER, in_progress: NO_FILTER, delayed: NO_FILTER, done: NO_FILTER });
  const [searchOpen, setSearchOpen] = useState<Partial<Record<OpsGroup, boolean>>>({});
  const setCol = (g: OpsGroup, f: Partial<ColFilter>) => setColF((m) => ({ ...m, [g]: { ...m[g], ...f } }));
  const [toast, setToast] = useState<{ m: string; err?: boolean } | null>(null);
  const flash = (m: string, err = false) => { setToast({ m, err }); setTimeout(() => setToast((t) => (t?.m === m ? null : t)), err ? 5000 : 2600); };
  // Orden de las columnas y de las tarjetas (cada quien lo acomoda a su gusto; se guarda en este navegador)
  const [colOrder, setColOrder] = useState<OpsGroup[]>(OPS_GROUPS.map((g) => g.id));
  const [cardOrder, setCardOrder] = useState<Record<string, string[]>>({});
  const [drag, setDrag] = useState<{ kind: "card"; id: string; from: OpsGroup } | { kind: "col"; id: OpsGroup } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<string[]>([]);
  const [focus, setFocus] = useState<OpsGroup | null>(null); // al tocar un resumen: solo ese grupo
  const [mobileGroup, setMobileGroup] = useState<OpsGroup>("assigned");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    try {
      const v = localStorage.getItem("bp-ops-view"); if (v === "board" || v === "connections") setView(v);
      const w = localStorage.getItem("bp-ops-when") as When | null; if (w && WHEN.some((x) => x.v === w)) setWhenState(w);
      const sp = JSON.parse(localStorage.getItem("bp-ops-span") || "null") as Span | null; if (sp?.from && sp.to && sp.unit) setSpanState(sp);
      const c = JSON.parse(localStorage.getItem(`bp-ops-cols-${companyId}`) || "null") as OpsGroup[] | null;
      if (c && c.length === OPS_GROUPS.length && OPS_GROUPS.every((g) => c.includes(g.id))) setColOrder(c);
      setCardOrder(JSON.parse(localStorage.getItem(`bp-ops-cards-${companyId}`) || "{}"));
    } catch { /* */ }
  }, [companyId]);
  const setWhen = (w: When) => { setWhenState(w); setSpanState(null); try { localStorage.setItem("bp-ops-when", w); localStorage.removeItem("bp-ops-span"); } catch { /* */ } };
  const setSpan = (sp: Span) => { setSpanState(sp); try { localStorage.setItem("bp-ops-span", JSON.stringify(sp)); } catch { /* */ } };
  const periodLabel = span ? spanLabel(span) : WHEN.find((w) => w.v === when)!.label;
  const pageRange = useCallback((done: boolean, at: number): [Date, Date] | null =>
    span ? [fromIsoDay(span.from), addDays(fromIsoDay(span.to), 1)] : rangeOf(when, at, weekStartsOn, done), [span, when, weekStartsOn]);
  const saveCols = (c: OpsGroup[]) => { setColOrder(c); try { localStorage.setItem(`bp-ops-cols-${companyId}`, JSON.stringify(c)); } catch { /* */ } };
  const saveCards = (o: Record<string, string[]>) => { setCardOrder(o); try { localStorage.setItem(`bp-ops-cards-${companyId}`, JSON.stringify(o)); } catch { /* */ } };
  const pickView = (v: View) => { setView(v); try { localStorage.setItem("bp-ops-view", v); } catch { /* */ } };

  const load = useCallback(async () => {
    const id = ++reqId.current;
    const base = addDays(dayStart(new Date()), -100).getTime();
    const since = (!span && when === "all") || colF.done.when === "all" ? new Date(2000, 0, 1)
      : new Date(Math.min(base, span ? fromIsoDay(span.from).getTime() : base, colF.done.when === "custom" && colF.done.from ? fromIsoDay(colF.done.from).getTime() : base));
    const { data, error: err } = await createClient().rpc("ops_board", { p_company: companyId, p_done_since: since.toISOString() });
    if (id !== reqId.current) return;
    if (err) { setError(jobError(err)); setLoading(false); return; }
    setError(""); setJobs((data ?? []) as OpsJob[]); setLoading(false); setUpdatedAt(Date.now());
  }, [companyId, when, span, colF.done.when, colF.done.from]);

  useEffect(() => { load(); }, [load]);
  // En vivo: cuando alguien asigna, mueve o el colaborador cambia de estado
  useEffect(() => {
    const sb = createClient();
    let t: ReturnType<typeof setTimeout>;
    const again = () => { clearTimeout(t); t = setTimeout(load, 600); };
    const ch = sb.channel(`ops-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `company_id=eq.${companyId}` }, again)
      .on("postgres_changes", { event: "*", schema: "public", table: "job_visits", filter: `company_id=eq.${companyId}` }, again)
      .on("postgres_changes", { event: "*", schema: "public", table: "job_visit_techs", filter: `company_id=eq.${companyId}` }, again)
      .subscribe();
    // El reloj: "Retrasado" aparece solo sin recargar
    const tick = setInterval(() => setNow(Date.now()), 30000);
    const onVis = () => { if (document.visibilityState === "visible") { setNow(Date.now()); load(); } };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearTimeout(t); clearInterval(tick); sb.removeChannel(ch); document.removeEventListener("visibilitychange", onVis); };
  }, [companyId, load]);

  const groupOf = useCallback((j: OpsJob) => groupAt(j, now), [now]);
  const isAfter = useCallback((j: OpsJob) => afterHoursOf(j.visit?.starts_at ? new Date(j.visit.starts_at) : null, j.visit?.ends_at ? new Date(j.visit.ends_at) : null, hours), [hours]);

  const matches = useCallback((j: OpsJob, query: string) => {
    const term = fold(query.trim()), digits = query.replace(/\D/g, "");
    if (!term) return true;
    return fold(`${j.number} ${j.customer_name} ${j.title ?? ""} ${j.type_name ?? ""} ${addressLine(j.site_address)} ${j.techs.map((t) => t.name).join(" ")}`).includes(term)
      || (digits.length >= 3 && (j.customer_phone ?? "").replace(/\D/g, "").includes(digits));
  }, []);
  // ¿Entra en el periodo? Terminados por la fecha en que se terminaron; los demás por su fecha agendada.
  // Con el periodo de la página, lo que está pasando ahora y lo atrasado siempre se ve; si la columna tiene su propio filtro, se respeta tal cual.
  const inPeriod = useCallback((j: OpsJob, g: OpsGroup, f: ColFilter) => {
    const own = Boolean(f.when);
    let r: [Date, Date] | null;
    if (f.when === "custom") r = f.from && f.to ? [fromIsoDay(f.from), addDays(fromIsoDay(f.to), 1)] : null;
    else r = f.when ? rangeOf(f.when, now, weekStartsOn, g === "done") : pageRange(g === "done", now);
    if (!r) return true;
    const [from, to] = r;
    const s = j.visit?.starts_at ? new Date(j.visit.starts_at) : null;
    const d = g === "done" ? (j.completed_at ? new Date(j.completed_at) : s) : s;
    if (!d) return g !== "done"; // sin fecha: siempre a la vista (necesita atención)
    if (!own && (g === "in_progress" || g === "delayed")) return true;
    return d >= from && d < to;
  }, [now, weekStartsOn, pageRange]);

  const shown = useMemo(() => jobs.filter((j) => {
    if (!matches(j, q)) return false;
    if (people.length && !(people.includes(UNASSIGNED) && !j.techs.length) && !j.techs.some((t) => people.includes(t.user_id))) return false;
    return true;
  }), [jobs, q, people, matches]);

  const byGroup = useMemo(() => {
    const m = Object.fromEntries(OPS_GROUPS.map((g) => [g.id, [] as OpsJob[]])) as Record<OpsGroup, OpsJob[]>;
    shown.forEach((j) => {
      const g = groupOf(j), f = colF[g];
      if (!inPeriod(j, g, f) || !matches(j, f.q)) return;
      m[g].push(j);
    });
    // Retrasados: el más tarde primero · Terminados: el más reciente primero
    m.delayed.sort((a, b) => (delayOf(b, now)?.minutes ?? 0) - (delayOf(a, now)?.minutes ?? 0));
    m.done.sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
    // El orden que la persona acomodó a mano manda (los nuevos quedan al final en su orden normal)
    (Object.keys(m) as OpsGroup[]).forEach((g) => {
      const pos = new Map((cardOrder[g] ?? []).map((id, i) => [id, i]));
      if (!pos.size) return;
      const base = new Map(m[g].map((j, i) => [j.id, i]));
      m[g].sort((a, b) => (pos.get(a.id) ?? 9999 + (base.get(a.id) ?? 0)) - (pos.get(b.id) ?? 9999 + (base.get(b.id) ?? 0)));
    });
    return m;
  }, [shown, groupOf, now, cardOrder, colF, inPeriod, matches]);

  const connJobs = useMemo(() => (focus ? byGroup[focus] : OPS_GROUPS.flatMap((g) => byGroup[g.id])), [byGroup, focus]);

  // ---------- Progreso total y dinero del periodo ----------
  const totals = useMemo(() => {
    const all = OPS_GROUPS.flatMap((g) => byGroup[g.id]);
    const pct = all.length ? Math.round(all.reduce((a, j) => a + progressOf(j), 0) / all.length) : 0;
    const open = all.filter((j) => j.status !== "completed");
    const openPct = open.length ? Math.round(open.reduce((a, j) => a + progressOf(j), 0) / open.length) : 0;
    return { pct, openPct, total: all.length, done: byGroup.done.length, working: byGroup.in_progress.length, late: byGroup.delayed.length, assigned: byGroup.assigned.length, unassigned: byGroup.unassigned.length };
  }, [byGroup]);
  const [cash, setCash] = useState<Money | null>(null);
  useEffect(() => {
    if (!money) return;
    const r = pageRange(true, Date.now());
    createClient().rpc("ops_money", { p_company: companyId, p_from: r?.[0].toISOString() ?? null, p_to: r?.[1].toISOString() ?? null })
      .then(({ data, error: e }) => setCash(e ? null : (data as Money)), () => setCash(null));
  }, [companyId, pageRange, money, updatedAt]);
  const filtersOn = people.length ? 1 : 0;
  const peopleList = useMemo(() => {
    const ids = new Set(jobs.flatMap((j) => j.techs.map((t) => t.user_id)));
    return team.filter((m) => receivesJobs(m) || ids.has(m.user_id));
  }, [team, jobs]);

  // Celular: deslizar a la izquierda/derecha cambia de grupo
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current; touch.current = null; if (!s) return;
    const dx = e.changedTouches[0].clientX - s.x, dy = e.changedTouches[0].clientY - s.y;
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.7) return;
    const i = colOrder.indexOf(mobileGroup);
    setMobileGroup(colOrder[Math.min(colOrder.length - 1, Math.max(0, i + (dx < 0 ? 1 : -1)))]);
  };

  const ordered = colOrder.map((id) => OPS_GROUPS.find((g) => g.id === id)!);
  const columns = focus ? ordered.filter((g) => g.id === focus) : ordered;

  // Sin asignar: tocar la tarjeta abre "Assign jobs" con ese trabajo ya escogido
  const assignHref = (j: OpsJob) => {
    const q = new URLSearchParams({ from: "ops" });
    if (j.visit?.id) q.set("visit", j.visit.id);
    if (j.visit?.starts_at) { const d = new Date(j.visit.starts_at); q.set("date", `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`); }
    return `/dashboard/jobs/assign?${q.toString()}`;
  };
  const hrefFor = (j: OpsJob, g: OpsGroup) => (g === "unassigned" && !j.techs.length ? assignHref(j) : undefined);

  // ---------- Menú ⋯ de cada tarjeta (también sirve para mover en el celular) ----------
  const menuFor = (j: OpsJob, g: OpsGroup): CardMenu => {
    if (g === "done") return [{ label: "Open job", icon: ICON.open, onClick: () => router.push(`/dashboard/jobs/${j.id}`) }];
    const moves: CardMenu = MOVABLE.filter((t) => t !== g).map((t, i) => ({
      label: `Move to ${OPS_GROUPS.find((x) => x.id === t)!.label}`, icon: ICON[t as MoveTarget], divider: i === 0,
      onClick: () => setAsk({ kind: "move", job: j, from: g, to: t as MoveTarget }),
    }));
    return [
      { label: "Open job", icon: ICON.open, onClick: () => router.push(`/dashboard/jobs/${j.id}`) },
      { label: "Edit job", icon: ICON.edit, onClick: () => router.push(`/dashboard/jobs/${j.id}/edit`) },
      ...moves,
      { label: "Cancel job", icon: ICON.cancel, danger: true, divider: true, onClick: () => setAsk({ kind: "cancel", job: j }) },
      ...(canDelete ? [{ label: "Delete job", icon: ICON.del, danger: true, onClick: () => setAsk({ kind: "delete", job: j }) }] : []),
    ];
  };

  // ---------- Arrastrar y soltar ----------
  const cardDrag = (j: OpsJob, g: OpsGroup) => g === "done" ? undefined : ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => { e.stopPropagation(); e.dataTransfer.setData("text/plain", `card:${j.id}`); e.dataTransfer.effectAllowed = "move"; setDrag({ kind: "card", id: j.id, from: g }); },
    onDragEnd: () => { setDrag(null); setOver(null); },
  });
  const accepts = (g: OpsGroup) => (drag?.kind === "col" ? true : drag?.kind === "card" ? (g === drag.from || MOVABLE.includes(g)) : false);
  function dropOnColumn(g: OpsGroup, beforeId: string | null) {
    const d = drag; setDrag(null); setOver(null);
    if (!d) return;
    if (d.kind === "col") {
      if (d.id === g) return;
      const next = colOrder.filter((x) => x !== d.id); next.splice(next.indexOf(g), 0, d.id); saveCols(next); return;
    }
    const job = jobs.find((x) => x.id === d.id); if (!job) return;
    if (g === d.from) { // mismo grupo: acomodar el orden
      const ids = byGroup[g].map((x) => x.id).filter((x) => x !== d.id);
      const i = beforeId ? ids.indexOf(beforeId) : -1;
      ids.splice(i < 0 ? ids.length : i, 0, d.id);
      saveCards({ ...cardOrder, [g]: ids }); return;
    }
    if (!MOVABLE.includes(g)) return flash(g === "done" ? "Use Finish on the job to complete it." : "Delayed is automatic: a job shows here when it's running late.", true);
    setAsk({ kind: "move", job, from: d.from, to: g as MoveTarget });
  }
  // Mover, arrastrar o reasignar en Operations es solo acomodar: no se manda ningún aviso ni se pregunta nada
  const afterAction = (msg: string) => { setAsk(null); flash(msg); load(); };

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[#f4f6f8] px-3 pb-24 pt-4 lg:px-6 lg:pb-8 lg:pt-5">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight text-[#0b1f3a]">Operations</h1>
          <p className="text-[13px] text-slate-500">Every job, who&apos;s on it and how far along it is{updatedAt ? ` · updated ${new Date(updatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ""}.</p>
        </div>
        {/* Computadora */}
        <div className="relative hidden w-72 lg:block">
          <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.9"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search job, customer, phone, address" aria-label="Search jobs"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-[14px] focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15" />
          {q && <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition-all hover:rotate-90 hover:bg-red-50 hover:text-red-600">
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 5l10 10M15 5 5 15" /></svg></button>}
        </div>
        <div className="hidden items-center gap-3 lg:flex">
          {shownView === "board" && <PeriodNav when={when} span={span} label={periodLabel} setWhen={setWhen} setSpan={setSpan} weekStartsOn={weekStartsOn} />}
          <ViewMenu view={view} setView={pickView} />
          <FiltersMenu people={people} setPeople={setPeople} list={peopleList} active={filtersOn} />
          <Link prefetch={false} href="/dashboard/jobs/new" className="group/n inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#0f766e] px-4 text-[14.5px] font-semibold text-white shadow-sm shadow-[#0f766e]/30 transition-colors hover:bg-[#0c5f59]">
            <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform duration-200 group-hover/n:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>New job
          </Link>
        </div>
      </div>
      {/* Celular: arriba Vista y Filtros (con su nombre) · luego buscar · luego el periodo */}
      <div className="mt-3 space-y-2 lg:hidden">
        <FiltersMenu people={people} setPeople={setPeople} list={peopleList} active={filtersOn} mobile />
        <div className="relative">
          <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.9"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search job, customer, phone, address" aria-label="Search jobs"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-[14px] focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15" />
          {q && <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition-all hover:rotate-90 hover:bg-red-50 hover:text-red-600">
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 5l10 10M15 5 5 15" /></svg></button>}
        </div>
        <div className="flex justify-end"><PeriodNav when={when} span={span} label={periodLabel} setWhen={setWhen} setSpan={setSpan} weekStartsOn={weekStartsOn} /></div>
      </div>
      <Link prefetch={false} href="/dashboard/jobs/new" aria-label="New job"
        className="fixed bottom-6 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#0f766e] text-white shadow-lg shadow-[#0f766e]/30 transition-transform active:scale-95 lg:hidden">
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
      </Link>

      {error && <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-800">{error}</p>}

      <Overview totals={totals} cash={cash} money={money} period={periodLabel} />

      {/* Resumen de los 5 grupos (tocar = ver solo ese grupo) */}
      <div className="mt-4 hidden gap-2.5 sm:grid sm:grid-cols-3 xl:grid-cols-5">
        {ordered.map((g) => {
          const n = byGroup[g.id].length, on = focus === g.id;
          return (
            <button key={g.id} type="button" onClick={() => { setFocus(on ? null : g.id); setMobileGroup(g.id); }}
              className={`group rounded-2xl border bg-white p-3 text-left transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,40,60,0.09)] lg:p-3.5 ${on ? "border-[#0f766e] ring-4 ring-[#14a39a]/10" : "border-slate-200 hover:border-slate-300"} `}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-medium text-slate-500">{g.label}</p>
                  <p className={`mt-0.5 text-[24px] font-semibold tabular-nums tracking-tight ${g.id === "delayed" && n ? "text-[#be123c]" : "text-[#0b1f3a]"}`}>{loading ? "–" : n}</p>
                </div>
                <GroupArt g={g.id} size={42} />
              </div>
              <p className="truncate text-[12px] text-slate-500">{on ? "Showing only this group · tap to show all" : g.hint}</p>
            </button>
          );
        })}
      </div>

      {shownView === "connections" ? (
        <div className="mt-4">
          {focus && <FocusNote label={OPS_GROUPS.find((g) => g.id === focus)!.label} onClear={() => setFocus(null)} />}
          {loading ? <div className="h-80 animate-pulse rounded-2xl bg-white" /> : <OpsConnections companyId={companyId}
            period={<PeriodNav when={when} span={span} label={periodLabel} setWhen={setWhen} setSpan={setSpan} weekStartsOn={weekStartsOn} compact />} jobs={connJobs} groupOf={groupOf} team={team} now={now} menuFor={menuFor} isAfter={isAfter} hrefFor={hrefFor}
            onChanged={(m, _n, err) => (err ? flash(m, true) : afterAction(m))}
            onUnassign={(j) => setAsk({ kind: "move", job: j, from: groupOf(j), to: "unassigned" })} />}
        </div>
      ) : (
        <>
          {/* Computadora: columnas */}
          <div className={`mt-4 hidden gap-3 lg:grid ${focus ? "lg:grid-cols-1" : "lg:grid-cols-5"}`}>
            {columns.map((g) => {
              const can = accepts(g.id), isOver = over === g.id;
              const blocked = drag?.kind === "card" && !can;
              return (
                <section key={g.id}
                  onDragOver={(e) => { if (drag && (can || drag.kind === "card")) { e.preventDefault(); e.dataTransfer.dropEffect = can ? "move" : "none"; if (over !== g.id) setOver(g.id); } }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o === g.id ? null : o)); }}
                  onDrop={(e) => { e.preventDefault(); dropOnColumn(g.id, null); }}
                  className={`relative flex max-h-[calc(100dvh-17.5rem)] min-h-[16rem] flex-col rounded-2xl border transition-all duration-150
                    ${isOver && can && drag?.kind === "card" && drag.from !== g.id ? "border-[#0f766e] bg-[#eef9f6] shadow-[0_0_0_4px_rgba(20,163,154,0.12)]" : isOver && drag?.kind === "col" ? "border-dashed border-[#0f766e] bg-[#f3fbf8]" : "border-slate-200 bg-[#f8fafb]"}
                    ${blocked ? "opacity-60" : ""}`}>
                  <div draggable={!focus}
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", `col:${g.id}`); e.dataTransfer.effectAllowed = "move"; setDrag({ kind: "col", id: g.id }); }}
                    onDragEnd={() => { setDrag(null); setOver(null); }}
                    title={focus ? undefined : "Drag to reorder the columns"}
                    className={`group/h flex items-center gap-2 border-b border-slate-200/70 px-3 py-2.5 ${focus ? "" : "cursor-grab active:cursor-grabbing"}`}>
                    {!focus && <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0 text-slate-300 transition-colors group-hover/h:text-slate-500" fill="currentColor"><circle cx="7" cy="5" r="1.4" /><circle cx="13" cy="5" r="1.4" /><circle cx="7" cy="10" r="1.4" /><circle cx="13" cy="10" r="1.4" /><circle cx="7" cy="15" r="1.4" /><circle cx="13" cy="15" r="1.4" /></svg>}
                    <span className={`h-2.5 w-2.5 rounded-full ${g.dot}`} />
                    <p className="text-[13.5px] font-semibold text-[#0b1f3a]">{g.label}</p>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[12px] font-semibold text-slate-500 ring-1 ring-slate-200">{byGroup[g.id].length}</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      {focus && <button type="button" onClick={() => setFocus(null)} className="text-[12.5px] font-semibold text-[#0f766e] hover:underline">Show all</button>}
                      <button type="button" onClick={() => setSearchOpen((m) => ({ ...m, [g.id]: !m[g.id] }))} aria-label={`Search in ${g.label}`} title={`Search in ${g.label}`}
                        className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${searchOpen[g.id] || colF[g.id].q ? "bg-[#eef4ff] text-[#2563eb]" : "text-slate-400 hover:bg-white hover:text-[#0b1f3a]"}`}>
                        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg></button>
                      <ColumnTools label={g.label} f={colF[g.id]} pageLabel={periodLabel} onChange={(f) => setCol(g.id, f)} />
                    </span>
                  </div>
                  {colF[g.id].q !== "" || searchOpen[g.id] ? (
                    <div className="relative mx-2 mt-2">
                      <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.9"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg>
                      <input autoFocus value={colF[g.id].q} onChange={(e) => setCol(g.id, { q: e.target.value })} placeholder={`Search in ${g.label}`}
                        className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-7 text-[13px] focus:border-[#0f766e] focus:outline-none" />
                      <button type="button" onClick={() => { setCol(g.id, { q: "" }); setSearchOpen((m) => ({ ...m, [g.id]: false })); }} aria-label="Close search"
                        className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition-all hover:rotate-90 hover:bg-red-50 hover:text-red-600">
                        <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 5l10 10M15 5 5 15" /></svg></button>
                    </div>
                  ) : null}
                  {drag?.kind === "card" && drag.from !== g.id && (
                    <p className={`mx-2 mt-2 rounded-lg border-2 border-dashed py-1.5 text-center text-[12px] font-semibold ${can ? "border-[#14a39a] text-[#0f766e]" : "border-slate-300 text-slate-400"}`}>
                      {can ? `Drop to move to ${g.label}` : g.id === "done" ? "Finish the job to complete it" : "Automatic — late jobs show here"}
                    </p>
                  )}
                  <div className={`flex-1 overflow-y-auto p-2 ${focus ? "grid content-start gap-2 sm:grid-cols-2 xl:grid-cols-4" : "space-y-2"}`}>
                    {loading ? [0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-white" />)
                      : byGroup[g.id].length === 0 ? <EmptyGroup g={g.id} />
                      : byGroup[g.id].map((j) => (
                        <div key={j.id} className="animate-[bp-fade_0.2s_ease-out]"
                          onDragOver={(e) => { if (drag?.kind === "card" && drag.from === g.id) { e.preventDefault(); e.stopPropagation(); } }}
                          onDrop={(e) => { if (drag?.kind === "card" && drag.from === g.id) { e.preventDefault(); e.stopPropagation(); dropOnColumn(g.id, j.id); } }}>
                          <OpsCard job={j} group={g.id} now={now} afterHours={isAfter(j)} href={hrefFor(j, g.id)} menu={menuFor(j, g.id)} drag={cardDrag(j, g.id)} dragging={drag?.kind === "card" && drag.id === j.id} />
                        </div>
                      ))}
                  </div>
                </section>
              );
            })}
          </div>

          {/* Celular: un desplegable para el grupo (empieza en Asignados), su periodo, y tarjetas chiquitas en 2 columnas */}
          <div className="mt-4 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1"><GroupPicker groups={ordered} value={mobileGroup} onChange={setMobileGroup} counts={byGroup} /></div>
              <ColumnTools label={OPS_GROUPS.find((x) => x.id === mobileGroup)!.label} f={colF[mobileGroup]} pageLabel={periodLabel} onChange={(f) => setCol(mobileGroup, f)} wide />
            </div>
            <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="mt-2.5 min-h-[50vh]">
              <div key={mobileGroup} className="animate-[bp-fade_0.2s_ease-out]">
                {loading ? <div className="grid grid-cols-2 gap-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-white" />)}</div>
                  : byGroup[mobileGroup].length === 0 ? <EmptyGroup g={mobileGroup} />
                  : <div className="grid grid-cols-2 gap-2">{byGroup[mobileGroup].map((j) => <OpsCard key={j.id} job={j} group={mobileGroup} now={now} tiny afterHours={isAfter(j)} href={hrefFor(j, mobileGroup)} menu={menuFor(j, mobileGroup)} />)}</div>}
              </div>
              <p className="mt-3 text-center text-[11.5px] text-slate-400">Swipe left or right to change group</p>
            </div>
          </div>
        </>
      )}
      <OpsDialog ask={ask} team={team} onClose={() => setAsk(null)} onDone={afterAction} />
      {toast && <div role="status" className={`fixed bottom-5 left-1/2 z-[95] max-w-[92vw] -translate-x-1/2 rounded-xl px-4 py-2.5 text-[13.5px] font-medium text-white shadow-lg animate-[bp-pop-in_0.2s_ease-out] ${toast.err ? "bg-[#be123c]" : "bg-[#0b1f3a]"}`}>{toast.m}</div>}
    </div>
  );
}

function FocusNote({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <p className="mb-2 flex items-center gap-2 text-[13px] text-slate-600">Showing only <b className="text-[#0b1f3a]">{label}</b>
      <button type="button" onClick={onClear} className="font-semibold text-[#0f766e] hover:underline">Show all</button></p>
  );
}

function EmptyGroup({ g }: { g: OpsGroup }) {
  const text: Record<OpsGroup, string> = {
    unassigned: "Every job has someone on it. New jobs without a collaborator show up here.", assigned: "Nothing waiting to start.", in_progress: "Nobody is working right now.",
    delayed: "Nothing is running late. 🎉", done: "No finished jobs in this period.",
  };
  return (
    <div className="flex flex-col items-center px-3 py-8 text-center">
      <span className="opacity-70"><GroupArt g={g} size={40} /></span>
      <p className="mt-2 text-[12.5px] text-slate-500">{text[g]}</p>
      {g === "unassigned" && <Link prefetch={false} href="/dashboard/jobs/assign" className="mt-1 text-[12.5px] font-semibold text-[#0f766e] hover:underline">Go to Assign jobs</Link>}
    </div>
  );
}

function ViewMenu({ view, setView, mobile = false }: { view: View; setView: (v: View) => void; mobile?: boolean }) {
  const opts: { v: View; label: string; hint: string; d: string }[] = [
    { v: "board", label: "Board", hint: "Jobs in 5 groups", d: "M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v11h-4z" },
    { v: "connections", label: "Connections", hint: "Lines from jobs to people", d: "M6 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 5c5 0 4 7 8 7M8 19c5 0 4-7 8-7" },
  ];
  const cur = opts.find((o) => o.v === view)!;
  return (
    <Menu>
      <MenuButton className={`${btn} ${mobile ? "w-full justify-between" : ""}`} aria-label="View">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 text-[#0f766e]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={cur.d} /></svg>
        <span className={mobile ? "min-w-0 flex-1 truncate text-left" : ""}>{mobile && <span className="font-normal text-slate-400">View · </span>}{cur.label}</span>
        <svg viewBox="0 0 20 20" className="h-4 w-4 text-slate-400" fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
      </MenuButton>
      <MenuItems anchor="bottom end" transition className="z-[100] mt-1 w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_40px_rgba(15,40,60,0.16)] transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0 focus:outline-none">
        {opts.map((o) => (
          <MenuItem key={o.v}>
            <button type="button" onClick={() => setView(o.v)} className={`group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left data-[focus]:bg-[#eef4ff] ${view === o.v ? "bg-[#eef4ff]" : ""}`}>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef8f5] text-[#0f766e] transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-110">
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={o.d} /></svg></span>
              <span><span className="block text-[14px] font-semibold text-[#0b1f3a]">{o.label}</span><span className="block text-[12px] text-slate-500">{o.hint}</span></span>
            </button>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
}

function FiltersMenu({ people, setPeople, list, active, mobile = false }: { people: string[]; setPeople: (v: string[]) => void; list: TeamMember[]; active: number; mobile?: boolean }) {
  const toggle = (id: string) => setPeople(people.includes(id) ? people.filter((x) => x !== id) : [...people, id]);
  return (
    <Popover className="relative">
      <PopoverButton className={`${btn} ${mobile ? "w-full" : ""}`} aria-label="Filters">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] text-[#0f766e]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
        <span>{mobile ? "Filters · people" : "Filters"}</span>
        {active > 0 && <span className="rounded-full bg-[#0f766e] px-1.5 text-[11px] text-white">{active}</span>}
      </PopoverButton>
      <PopoverPanel anchor="bottom end" transition
        className="z-[100] mt-2 max-h-[min(34rem,calc(100dvh-7rem))] w-[min(21rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_48px_rgba(15,40,60,0.2)] transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0">
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-semibold text-[#0b1f3a]">Filters</p>
          {active > 0 && <button type="button" onClick={() => setPeople([])} className="text-[13px] font-semibold text-[#0f766e] hover:underline">Clear all</button>}
        </div>
        <p className="mb-2 mt-4 text-[12.5px] font-semibold text-slate-500">Collaborators</p>
        <div className="space-y-0.5">
          {[...list.map((m) => ({ id: m.user_id, m })), { id: UNASSIGNED, m: null as TeamMember | null }].map(({ id, m }) => {
            const on = people.includes(id);
            return (
              <button key={id} type="button" onClick={() => toggle(id)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[14px] text-slate-700 hover:bg-slate-50">
                <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border ${on ? "border-[#0f766e] bg-[#0f766e] text-white" : "border-slate-300"}`}>
                  {on && <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3"><path d="m5 10.5 3 3 7-7" /></svg>}
                </span>
                {m ? <TechDot t={m} size={22} ring={false} /> : <span className="h-[22px] w-[22px] rounded-full border border-dashed border-slate-400" />}
                <span className="min-w-0 flex-1 truncate">{m ? m.full_name : "Unassigned"}</span>
                {m?.role === "owner" && <span className="rounded-full bg-[#0b1f3a] px-1.5 py-px text-[10px] font-semibold text-white">Owner</span>}
                {m?.worker_type === "subcontractor" && <span className="rounded-full bg-[#fff7ed] px-1.5 py-px text-[10px] font-semibold text-[#c2410c]">Sub</span>}
              </button>
            );
          })}
        </div>
      </PopoverPanel>
    </Popover>
  );
}

// Periodo de la página: ‹ menú › — el menú tiene Hoy, Semana, Mes… y el calendario.
// Las flechas mueven el mismo tamaño: un día, una semana o un mes para atrás/adelante.
function PeriodNav({ when, span, label, setWhen, setSpan, weekStartsOn, compact = false }: {
  when: When; span: Span | null; label: string; setWhen: (v: When) => void; setSpan: (s: Span) => void; weekStartsOn: number; compact?: boolean;
}) {
  const [cal, setCal] = useState(false);
  const today = dayStart(new Date()), wk = startOfWeek(today, weekStartsOn), mo = startOfMonth(today);
  const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
  // El periodo que se ve ahora, como días (para poder moverlo)
  const cur: Span | null = span ?? (() => {
    switch (when) {
      case "today": return { unit: "day", from: isoDay(today), to: isoDay(today) };
      case "week": return { unit: "week", from: isoDay(wk), to: isoDay(addDays(wk, 6)) };
      case "last_week": return { unit: "week", from: isoDay(addDays(wk, -7)), to: isoDay(addDays(wk, -1)) };
      case "month": return { unit: "month", from: isoDay(mo), to: isoDay(endOfMonth(mo)) };
      case "last_month": { const m = new Date(mo.getFullYear(), mo.getMonth() - 1, 1); return { unit: "month", from: isoDay(m), to: isoDay(endOfMonth(m)) }; }
      default: return null; // 3 meses / todo: sin flechas
    }
  })();
  const move = (dir: 1 | -1) => {
    if (!cur) return;
    const a = fromIsoDay(cur.from), b = fromIsoDay(cur.to);
    let next: Span;
    if (cur.unit === "month") { const m = new Date(a.getFullYear(), a.getMonth() + dir, 1); next = { unit: "month", from: isoDay(m), to: isoDay(endOfMonth(m)) }; }
    else {
      const len = cur.unit === "day" ? 1 : cur.unit === "week" ? 7 : Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
      next = { unit: cur.unit, from: isoDay(addDays(a, dir * len)), to: isoDay(addDays(b, dir * len)) };
    }
    // Si cae en hoy / esta semana / este mes, vuelve a la opción normal (así el nombre dice "Today", "This week"…)
    if (next.unit === "day" && next.from === isoDay(today)) return setWhen("today");
    if (next.unit === "week" && next.from === isoDay(wk)) return setWhen("week");
    if (next.unit === "month" && next.from === isoDay(mo)) return setWhen("month");
    setSpan(next);
  };
  const arrow = (dir: 1 | -1) => (
    <button type="button" onClick={() => move(dir)} disabled={!cur} aria-label={dir < 0 ? "Previous period" : "Next period"} title={dir < 0 ? "Previous" : "Next"}
      className={`flex ${compact ? "h-9 w-8" : "h-10 w-9"} items-center justify-center text-slate-500 transition-colors hover:bg-[#eef8f5] hover:text-[#0f766e] disabled:cursor-default disabled:text-slate-300 disabled:hover:bg-transparent ${dir < 0 ? "rounded-l-lg" : "rounded-r-lg"}`}>
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={dir < 0 ? "M12.5 5 7.5 10l5 5" : "M7.5 5 12.5 10l-5 5"} /></svg>
    </button>
  );
  const check = <svg viewBox="0 0 20 20" className="h-4 w-4 text-[#2563eb]" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="m5 10.5 3 3 7-7" /></svg>;
  return (
    <div className="flex shrink-0 items-stretch rounded-lg border border-slate-200 bg-white">
      {arrow(-1)}
      <Menu>
        <MenuButton aria-label="Period" className={`flex ${compact ? "h-9 text-[13.5px]" : "h-10 text-[14px]"} items-center gap-2 border-x border-slate-200 px-3 font-medium text-slate-700 transition-colors hover:text-[#0f766e] data-[open]:text-[#0f766e] focus:outline-none`}>
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" /></svg>
          <span className="whitespace-nowrap">{label}</span>
          <svg viewBox="0 0 20 20" className="h-4 w-4 text-slate-400" fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
        </MenuButton>
        <MenuItems anchor="bottom end" transition className="z-[100] mt-1 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_40px_rgba(15,40,60,0.16)] transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0 focus:outline-none">
          {WHEN.map((w) => (
            <MenuItem key={w.v}>
              <button type="button" onClick={() => setWhen(w.v)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left data-[focus]:bg-[#eef4ff] ${!span && when === w.v ? "bg-[#eef4ff]" : ""}`}>
                <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold text-[#0b1f3a]">{w.label}</span><span className="block text-[12px] text-slate-500">{w.hint}</span></span>
                {!span && when === w.v && check}
              </button>
            </MenuItem>
          ))}
          <div className="my-1 border-t border-slate-100" />
          <MenuItem>
            <button type="button" onClick={() => setCal(true)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left data-[focus]:bg-[#eef4ff] ${span ? "bg-[#eef4ff]" : ""}`}>
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] text-[#0f766e]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h2M12 14h2M8 17h2" /></svg>
              <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold text-[#0f766e]">Pick dates on the calendar…</span><span className="block text-[12px] text-slate-500">{span ? label : "A day or a range of days"}</span></span>
              {span && check}
            </button>
          </MenuItem>
          <p className="px-3 pb-1 pt-2 text-[11.5px] text-slate-400">Use ‹ › to go back or forward one day, week or month. Applies to the whole page and the earnings.</p>
        </MenuItems>
      </Menu>
      {arrow(1)}
      {cal && <RangeModal label="Operations" from={span?.from} to={span?.to} onClose={() => setCal(false)}
        onApply={(a, b) => { setSpan({ unit: a === b ? "day" : "range", from: a, to: b }); setCal(false); }} />}
    </div>
  );
}

type Money = { owner: boolean; jobs_done: number; revenue: number; collected: number; pipeline: number; open_jobs: number;
  labor: number | null; materials: number | null; hours: number | null; missing_rates: number | null; salaried: number | null; profit: number | null };
const money$ = (v: number | null | undefined) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(v) || 0);
// Que el texto chiquito no diga algo que no es: "All collected" con $0, o "no completed jobs" cuando sí hay
const earnedHint = (c: Money) => `${c.jobs_done} completed job${c.jobs_done === 1 ? "" : "s"}${c.jobs_done && !c.revenue ? " · no price yet" : ""}`;
const collectedHint = (c: Money) => c.revenue > c.collected ? `${money$(c.revenue - c.collected)} still to collect`
  : c.revenue > 0 ? "All collected" : c.jobs_done ? "Nothing billed yet" : "Nothing to collect yet";

// Número que se mueve: sube o baja hasta el valor nuevo cada vez que cambia
function useCountUp(value: number, ms = 900) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const a = from.current, b = Number(value) || 0;
    if (a === b) { setV(b); return; }
    let raf = 0; const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      const cur = a + (b - a) * e; setV(cur);
      if (k < 1) raf = requestAnimationFrame(tick); else from.current = b;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); from.current = b; };
  }, [value, ms]);
  return v;
}
function Count({ value, money = false, className = "" }: { value: number; money?: boolean; className?: string }) {
  const v = useCountUp(value);
  const prev = useRef(value);
  const [dir, setDir] = useState<"up" | "down" | null>(null);
  useEffect(() => { if (value !== prev.current) { setDir(value > prev.current ? "up" : "down"); prev.current = value; const t = setTimeout(() => setDir(null), 1100); return () => clearTimeout(t); } }, [value]);
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {money ? money$(Math.round(v)) : Math.round(v)}
      {dir && <svg viewBox="0 0 20 20" className={`h-3.5 w-3.5 animate-[bp-pop-in_0.3s_ease-out] ${dir === "up" ? "text-[#15803d]" : "rotate-180 text-[#be123c]"}`} fill="currentColor"><path d="M10 4 16 12H4z" /></svg>}
    </span>
  );
}

// Anillo del progreso total: el mismo estilo de los anillos del Dashboard de Finanzas (Collection rate / Quote win rate)
function BigRing({ pct, color = "#14b8a6" }: { pct: number; color?: string }) {
  const [p, setP] = useState(0);
  useEffect(() => { const t = setTimeout(() => setP(Math.max(0, Math.min(100, pct)) / 100), 150); return () => clearTimeout(t); }, [pct]);
  const num = useCountUp(pct, 1100);
  const r = 34, c = 2 * Math.PI * r;
  return (
    <span className="relative shrink-0">
      <span className="absolute inset-[10px] rounded-full opacity-0 transition-all duration-300 group-hover/ring:inset-[6px] group-hover/ring:opacity-100" style={{ background: `${color}1f` }} />
      <svg viewBox="0 0 84 84" className="relative h-[84px] w-[84px] -rotate-90 transition-transform duration-300 group-hover/ring:scale-105">
        <circle cx="42" cy="42" r={r} fill="none" stroke="#eef2f6" strokeWidth="9" />
        <circle cx="42" cy="42" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p)}
          className="group-hover/ring:[stroke-width:11]" style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1), stroke-width .3s" }} />
        <text x="42" y="47" textAnchor="middle" fontSize="16" fontWeight="700" fill="#0b1f3a" transform="rotate(90 42 42)">{Math.round(num)}%</text>
      </svg>
    </span>
  );
}

// Cuadrito chiquito al pasar el mouse: blanco con borde menta, aparece ARRIBA (no tapa lo de abajo)
function Tip({ children, tip, wide = false, right = false }: { children: React.ReactNode; tip: React.ReactNode; wide?: boolean; right?: boolean }) {
  return (
    <div className="group/tip relative min-w-0">
      {children}
      <div role="tooltip" className={`pointer-events-none absolute bottom-full hidden lg:block ${right ? "right-0" : "left-0"} z-[60] mb-1.5 translate-y-1 rounded-xl border border-[#9fdccf] bg-white px-3 py-2 text-[12px] leading-snug text-slate-600 opacity-0 shadow-[0_8px_20px_rgba(15,118,110,0.12)] transition-all duration-150 group-hover/tip:translate-y-0 group-hover/tip:opacity-100 ${wide ? "w-64" : "w-52"} max-w-[calc(100vw-2rem)]`}>
        {tip}
      </div>
    </div>
  );
}
const Row = ({ l, v, tone = "text-[#0b1f3a]" }: { l: string; v: string; tone?: string }) => (
  <p className="flex justify-between gap-3"><span className="text-slate-500">{l}</span><b className={`font-semibold tabular-nums ${tone}`}>{v}</b></p>
);

// Arriba de todo: progreso total + ingresos, costos y ganancia del periodo (costos y ganancia SOLO el dueño)
function Overview({ totals, cash, money, period }: {
  totals: { pct: number; openPct: number; total: number; done: number; working: number; late: number; assigned?: number; unassigned?: number };
  cash: Money | null; money: "owner" | "manager" | null; period: string;
}) {
  const margin = cash?.profit != null && cash.revenue > 0 ? Math.round((cash.profit / cash.revenue) * 100) : null;
  const stat = (label: string, value: number, hint: string, tip: React.ReactNode, tone = "text-[#0b1f3a]", art?: React.ReactNode, right = false) => (
    <Tip tip={tip} right={right}>
      <div className="cursor-default rounded-xl px-2 py-1.5 transition-colors duration-150 hover:bg-slate-50 sm:px-3 sm:py-2">
        <p className="flex items-center gap-1.5 truncate text-[12px] font-medium text-slate-500">{art}{label}</p>
        <p className={`mt-0.5 truncate text-[17px] font-semibold tabular-nums tracking-tight sm:text-[20px] ${tone}`}><Count value={value} money /></p>
        <p className="truncate text-[11.5px] text-slate-400">{hint}</p>
      </div>
    </Tip>
  );
  return (
    <>
    <MobileOverview totals={totals} cash={cash} money={money} period={period} />
    <section className="mt-4 hidden rounded-2xl border border-slate-200 bg-white p-3 lg:block lg:p-4">
      <div className="flex flex-wrap items-center gap-3 lg:gap-5">
        <Tip wide tip={<>
          <p className="mb-1 font-semibold text-[#0f766e]">Average progress of {totals.total} jobs</p>
          <Row l="Completed" v={String(totals.done)} tone="text-[#0f766e]" />
          <Row l="In progress" v={String(totals.working)} tone="text-[#b45309]" />
          <Row l="Delayed" v={String(totals.late)} tone="text-[#be123c]" />
          {totals.assigned != null && <Row l="Assigned" v={String(totals.assigned)} />}
          {totals.unassigned != null && <Row l="Unassigned" v={String(totals.unassigned)} />}
        </>}>
          <div className="group/ring flex cursor-default items-center gap-3 rounded-2xl px-1 pr-3 transition-colors hover:bg-slate-50">
            <BigRing pct={totals.pct} />
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Total progress · {period}</p>
              <p className="text-[14px] font-semibold text-[#0b1f3a] sm:text-[15px]"><Count value={totals.done} /> of <Count value={totals.total} /> job{totals.total === 1 ? "" : "s"} completed</p>
              <p className="text-[12.5px] text-slate-500">Open jobs are {totals.openPct}% along · {totals.working} working · <span className={totals.late ? "font-semibold text-[#be123c]" : ""}>{totals.late} delayed</span></p>
            </div>
          </div>
        </Tip>
        {money && cash && (
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-1 border-slate-100 sm:grid-cols-3 lg:border-l lg:pl-4 xl:grid-cols-5">
            {stat("Earned", cash.revenue, earnedHint(cash), <>
              <p>Value of the completed jobs (invoice, services or estimate).</p>
            </>)}
            {stat("Collected", cash.collected, collectedHint(cash), <>
              <p>Money already paid on those jobs&apos; invoices.</p>
            </>, "text-[#0f766e]")}
            {stat("Open jobs", cash.pipeline, `${cash.open_jobs} job${cash.open_jobs === 1 ? "" : "s"} not finished yet`, <>
              <p>Estimated value of jobs not finished yet.</p>
            </>)}
            {money === "owner" && cash.profit != null ? (
              <>
                {stat("Costs", (cash.labor ?? 0) + (cash.materials ?? 0), `Labor ${money$(cash.labor)} · Materials ${money$(cash.materials)}`, <>
                  <Row l="Labor" v={money$(cash.labor)} /><Row l="Hours on site" v={`${Math.round((cash.hours ?? 0) * 10) / 10}h`} /><Row l="Materials" v={money$(cash.materials)} />
                  <p className="mt-1 text-[11px] text-slate-400">Only you see this.</p>
                </>, "text-[#b45309]", undefined, true)}
                {stat("Profit", cash.profit, margin != null ? `${margin}% margin${cash.missing_rates ? ` · ${cash.missing_rates} without pay rate` : ""}` : cash.jobs_done ? "No price on the completed jobs yet" : "No completed jobs yet", <>
                  <Row l="Earned" v={money$(cash.revenue)} /><Row l="− Costs" v={money$((cash.labor ?? 0) + (cash.materials ?? 0))} />
                  <Row l="= Profit" v={money$(cash.profit)} tone={cash.profit >= 0 ? "text-[#15803d]" : "text-[#be123c]"} />
                  <p className="mt-1 text-[11px] text-slate-400">Only you see this.</p>
                </>, cash.profit >= 0 ? "text-[#15803d]" : "text-[#be123c]",
                  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="4.5" y="9" width="11" height="7.5" rx="1.5" /><path d="M7 9V7a3 3 0 0 1 6 0v2" /></svg>, true)}
              </>
            ) : null}
          </div>
        )}
      </div>
      {money === "owner" && cash && ((cash.missing_rates ?? 0) > 0 || (cash.salaried ?? 0) > 0) && (
        <p className="mt-2 rounded-lg bg-[#f6f9fc] px-3 py-1.5 text-[11.5px] text-slate-500 sm:text-[12px]">
          {(cash.missing_rates ?? 0) > 0 && <>Some collaborators don&apos;t have a pay rate yet, so their labor counts as $0. Add it in Team → Edit. </>}
          {(cash.salaried ?? 0) > 0 && <>Salaried people aren&apos;t counted per job.</>}
        </p>
      )}
    </section>
    </>
  );
}

// Periodo de cada columna: menú desplegable + "Pick dates" con calendario (rango de días)
function ColumnTools({ label, f, pageLabel, onChange, wide = false }: { label: string; f: ColFilter; pageLabel: string; onChange: (f: Partial<ColFilter>) => void; wide?: boolean }) {
  const [cal, setCal] = useState(false);
  const cur = f.when === "custom" && f.from && f.to ? (f.from === f.to ? fmtD(f.from) : `${fmtD(f.from)} – ${fmtD(f.to)}`) : f.when ? WHEN.find((w) => w.v === f.when)?.label ?? pageLabel : pageLabel;
  const on = Boolean(f.when);
  const item = "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-slate-700 data-[focus]:bg-[#eef4ff] data-[focus]:text-[#0b1f3a]";
  const check = <svg viewBox="0 0 20 20" className="ml-auto h-3.5 w-3.5 text-[#2563eb]" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="m5 10.5 3 3 7-7" /></svg>;
  return (
    <>
      <Menu>
        <MenuButton aria-label={`Period for ${label}`} title={`Period for ${label}`}
          className={`flex h-7 max-w-[8.5rem] items-center gap-1 rounded-lg px-1.5 text-[11.5px] font-semibold transition-colors focus:outline-none data-[open]:bg-[#eef4ff] data-[open]:text-[#2563eb] ${on ? "bg-[#eef4ff] text-[#2563eb]" : "text-slate-500 hover:bg-white hover:text-[#0b1f3a]"} ${wide ? "h-9 max-w-none border border-slate-200 bg-white px-3 text-[13px]" : ""}`}>
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" /></svg>
          <span className="truncate">{cur}</span>
          <svg viewBox="0 0 20 20" className="h-3 w-3 shrink-0 opacity-60" fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
        </MenuButton>
        <MenuItems anchor="bottom end" transition className="z-[100] mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_40px_rgba(15,40,60,0.16)] transition duration-100 data-[closed]:scale-95 data-[closed]:opacity-0 focus:outline-none">
          <p className="px-2.5 pb-1 pt-0.5 text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          <MenuItem><button type="button" onClick={() => onChange({ when: null })} className={item}>Same as page · {pageLabel}{!f.when && check}</button></MenuItem>
          <div className="my-1 border-t border-slate-100" />
          {WHEN.map((w) => (
            <MenuItem key={w.v}><button type="button" onClick={() => onChange({ when: w.v })} className={item}>{w.label}{f.when === w.v && check}</button></MenuItem>
          ))}
          <div className="my-1 border-t border-slate-100" />
          <MenuItem><button type="button" onClick={() => setCal(true)} className={`${item} font-semibold text-[#0f766e]`}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h2M12 14h2M8 17h2" /></svg>
            Pick dates on the calendar…{f.when === "custom" && check}</button></MenuItem>
        </MenuItems>
      </Menu>
      {cal && <RangeModal label={label} from={f.from} to={f.to} onClose={() => setCal(false)} onApply={(a, b) => { onChange({ when: "custom", from: a, to: b }); setCal(false); }} />}
    </>
  );
}

// Calendario para escoger un día o un rango (toca el primer día y luego el último)
function RangeModal({ label, from, to, onClose, onApply }: { label: string; from?: string; to?: string; onClose: () => void; onApply: (a: string, b: string) => void }) {
  const [a, setA] = useState<string | null>(from ?? null);
  const [b, setB] = useState<string | null>(to ?? null);
  const [month, setMonth] = useState(() => { const d = from ? fromIsoDay(from) : new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(first, i - first.getDay()));
  const today = isoDay(new Date());
  const pick = (iso: string) => {
    if (!a || (a && b)) { setA(iso); setB(null); return; }
    if (iso < a) { setB(a); setA(iso); } else setB(iso);
  };
  const lo = a && b ? (a < b ? a : b) : a, hi = a && b ? (a < b ? b : a) : a;
  const quick: [string, () => [Date, Date]][] = [
    ["Yesterday", () => { const d = addDays(dayStart(new Date()), -1); return [d, d]; }],
    ["Last 7 days", () => [addDays(dayStart(new Date()), -6), dayStart(new Date())]],
    ["Last 30 days", () => [addDays(dayStart(new Date()), -29), dayStart(new Date())]],
    ["Next 7 days", () => [dayStart(new Date()), addDays(dayStart(new Date()), 6)]],
  ];
  return (
    <Modal open onClose={onClose} title={`${label} · pick dates`} width="max-w-md" footer={<>
      <button type="button" disabled={!a} onClick={() => a && onApply(lo!, hi ?? lo!)} className={btnPrimary}>Show these days</button>
      <button type="button" onClick={onClose} className={btnGhost}>Cancel</button></>}>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {quick.map(([l, fn]) => (
          <button key={l} type="button" onClick={() => { const [x, y] = fn(); setA(isoDay(x)); setB(isoDay(y)); setMonth(new Date(x.getFullYear(), x.getMonth(), 1)); }}
            className="rounded-full border border-slate-200 px-3 py-1 text-[12.5px] font-semibold text-slate-600 transition-colors hover:border-[#14a39a] hover:text-[#0f766e]">{l}</button>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.5 5 7.5 10l5 5" /></svg></button>
        <p className="text-[15px] font-semibold text-[#0b1f3a]">{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
        <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.5 5 12.5 10l-5 5" /></svg></button>
      </div>
      <div className="mt-2 grid grid-cols-7 text-center text-[11.5px] font-semibold text-slate-400">{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => <span key={d} className="py-1">{d}</span>)}</div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((d) => {
          const iso = isoDay(d), inMonth = d.getMonth() === month.getMonth();
          const edge = iso === lo || iso === hi, inside = lo && hi && iso > lo && iso < hi;
          return (
            <button key={iso} type="button" onClick={() => pick(iso)}
              className={`mx-auto flex h-9 w-full items-center justify-center text-[13.5px] transition-colors
                ${edge ? "rounded-lg bg-[#0f766e] font-semibold text-white" : inside ? "bg-[#e9f7f4] text-[#0f766e]" : "rounded-lg hover:bg-slate-100"}
                ${!inMonth && !edge ? "text-slate-300" : !edge && !inside ? "text-slate-700" : ""} ${iso === today && !edge ? "font-bold text-[#0f766e]" : ""}`}>
              {d.getDate()}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[13px] text-slate-500">{lo ? (hi && hi !== lo ? `${fmtD(lo)} – ${fmtD(hi)}` : `${fmtD(lo)} · tap another day for a range`) : "Tap a day. Tap a second day to pick a range."}</p>
    </Modal>
  );
}

// Celular: el grupo se escoge en un desplegable (con su número y su color)
function GroupPicker({ groups, value, onChange, counts }: { groups: typeof OPS_GROUPS; value: OpsGroup; onChange: (g: OpsGroup) => void; counts: Record<OpsGroup, OpsJob[]> }) {
  const cur = groups.find((g) => g.id === value)!;
  return (
    <Menu>
      <MenuButton className="flex h-11 w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 text-left focus:outline-none data-[open]:border-[#0f766e] data-[open]:ring-4 data-[open]:ring-[#14a39a]/15">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${cur.dot}`} />
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-[#0b1f3a]">{cur.label}</span>
        <span className={`rounded-full px-2 py-0.5 text-[12px] font-bold ${value === "delayed" && counts[value].length ? "bg-[#ffe4e6] text-[#be123c]" : "bg-slate-100 text-slate-600"}`}>{counts[value].length}</span>
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-400" fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
      </MenuButton>
      <MenuItems anchor="bottom start" transition className="z-[100] mt-1 w-[var(--button-width)] rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_40px_rgba(15,40,60,0.16)] transition duration-100 data-[closed]:scale-95 data-[closed]:opacity-0 focus:outline-none">
        {groups.map((g) => (
          <MenuItem key={g.id}>
            <button type="button" onClick={() => onChange(g.id)} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left data-[focus]:bg-[#eef4ff] ${value === g.id ? "bg-[#eef4ff]" : ""}`}>
              <GroupArt g={g.id} size={30} />
              <span className="min-w-0 flex-1"><span className="block text-[14.5px] font-semibold text-[#0b1f3a]">{g.label}</span><span className="block text-[12px] text-slate-500">{g.hint}</span></span>
              <span className="text-[14px] font-bold tabular-nums text-slate-600">{counts[g.id].length}</span>
            </button>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
}

// Celular: el anillo con espacio para respirar. Al tocarlo se despliega el dinero,
// un dato por línea con su barrita animada (Earned, Collected, Open jobs, y para el dueño Costs y Profit).
function MobileOverview({ totals, cash, money, period }: {
  totals: { pct: number; openPct: number; total: number; done: number; working: number; late: number };
  cash: Money | null; money: "owner" | "manager" | null; period: string;
}) {
  const [open, setOpen] = useState(false);
  const canOpen = Boolean(money && cash);
  const rows = cash ? [
    { label: "Earned", value: cash.revenue, hint: earnedHint(cash), color: "#0b1f3a", text: "text-[#0b1f3a]" },
    { label: "Collected", value: cash.collected, hint: collectedHint(cash), color: "#14b8a6", text: "text-[#0f766e]" },
    { label: "Open jobs", value: cash.pipeline, hint: `${cash.open_jobs} not finished yet`, color: "#2563eb", text: "text-[#2563eb]" },
    ...(money === "owner" && cash.profit != null ? [
      { label: "Costs", value: (cash.labor ?? 0) + (cash.materials ?? 0), hint: `Labor ${money$(cash.labor)} · Materials ${money$(cash.materials)}`, color: "#f59e0b", text: "text-[#b45309]" },
      { label: "Profit", value: cash.profit, hint: cash.revenue > 0 ? `${Math.round((cash.profit / cash.revenue) * 100)}% margin · only you see this` : cash.jobs_done ? "No price on the completed jobs yet · only you see this" : "No completed jobs yet · only you see this", color: cash.profit >= 0 ? "#16a34a" : "#e11d48", text: cash.profit >= 0 ? "text-[#15803d]" : "text-[#be123c]" },
    ] : []),
  ] : [];
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  const [grow, setGrow] = useState(false);
  useEffect(() => { if (!open) { setGrow(false); return; } const t = setTimeout(() => setGrow(true), 60); return () => clearTimeout(t); }, [open, cash]);
  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-5 lg:hidden">
      <button type="button" onClick={() => canOpen && setOpen((o) => !o)} aria-expanded={open} className="group/ring flex w-full items-center gap-4 text-left">
        <BigRing pct={totals.pct} />
        <span className="min-w-0 flex-1">
          <span className="block text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">Total progress · {period}</span>
          <span className="mt-0.5 block text-[16px] font-semibold text-[#0b1f3a]">{totals.done} of {totals.total} job{totals.total === 1 ? "" : "s"} completed</span>
          <span className="mt-0.5 block text-[13px] text-slate-500">{totals.working} working · <span className={totals.late ? "font-semibold text-[#be123c]" : ""}>{totals.late} delayed</span></span>
        </span>
        {canOpen && (
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eef8f5] text-[#0f766e] transition-transform duration-300 ${open ? "rotate-180" : ""}`}>
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
          </span>
        )}
      </button>
      {canOpen && !open && <p className="mt-4 text-center text-[12.5px] font-medium text-[#0f766e]">Tap to see earnings</p>}
      <div className={`grid transition-all duration-300 ease-out ${open ? "mt-7 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="space-y-5 overflow-hidden">
          {rows.map((r, i) => (
            <div key={r.label}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-1.5 text-[13.5px] font-medium text-slate-500">
                  {r.label === "Profit" && <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="4.5" y="9" width="11" height="7.5" rx="1.5" /><path d="M7 9V7a3 3 0 0 1 6 0v2" /></svg>}
                  {r.label}
                </span>
                <span className={`text-[19px] font-semibold tabular-nums tracking-tight ${r.text}`}><Count value={r.value} money /></span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#eef2f6]">
                <div className="h-full rounded-full" style={{ width: grow ? `${Math.max(2, (Math.abs(r.value) / max) * 100)}%` : "0%", background: r.color, transition: `width 900ms cubic-bezier(.2,.8,.2,1) ${i * 90}ms` }} />
              </div>
              <p className="mt-1 text-[12px] text-slate-400">{r.hint}</p>
            </div>
          ))}
          {money === "owner" && cash && (cash.missing_rates ?? 0) > 0 && (
            <p className="rounded-lg bg-[#f6f9fc] px-3 py-2 text-[12px] text-slate-500">Some collaborators don&apos;t have a pay rate yet, so their labor counts as $0. Add it in Team → Edit.</p>
          )}
        </div>
      </div>
    </section>
  );
}
