"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, MenuButton, MenuItem, MenuItems, Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { createClient } from "@/lib/supabase/client";
import { JobSettings, TeamMember, addDays, addressLine, afterHoursOf, dayStart, jobError, receivesJobs, startOfMonth, startOfWeek } from "@/lib/jobs";
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
type ColFilter = { when: When | null; q: string };
const NO_FILTER: ColFilter = { when: null, q: "" };
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
  const [when, setWhenState] = useState<When>("week");
  const [ask, setAsk] = useState<OpsAsk | null>(null);
  const [colF, setColF] = useState<Record<OpsGroup, ColFilter>>({ unassigned: NO_FILTER, assigned: NO_FILTER, in_progress: NO_FILTER, delayed: NO_FILTER, done: NO_FILTER });
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
  const [mobileGroup, setMobileGroup] = useState<OpsGroup>("unassigned");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    try {
      const v = localStorage.getItem("bp-ops-view"); if (v === "board" || v === "connections") setView(v);
      const w = localStorage.getItem("bp-ops-when") as When | null; if (w && WHEN.some((x) => x.v === w)) setWhenState(w);
      const c = JSON.parse(localStorage.getItem(`bp-ops-cols-${companyId}`) || "null") as OpsGroup[] | null;
      if (c && c.length === OPS_GROUPS.length && OPS_GROUPS.every((g) => c.includes(g.id))) setColOrder(c);
      setCardOrder(JSON.parse(localStorage.getItem(`bp-ops-cards-${companyId}`) || "{}"));
    } catch { /* */ }
  }, [companyId]);
  const setWhen = (w: When) => { setWhenState(w); try { localStorage.setItem("bp-ops-when", w); } catch { /* */ } };
  const saveCols = (c: OpsGroup[]) => { setColOrder(c); try { localStorage.setItem(`bp-ops-cols-${companyId}`, JSON.stringify(c)); } catch { /* */ } };
  const saveCards = (o: Record<string, string[]>) => { setCardOrder(o); try { localStorage.setItem(`bp-ops-cards-${companyId}`, JSON.stringify(o)); } catch { /* */ } };
  const pickView = (v: View) => { setView(v); try { localStorage.setItem("bp-ops-view", v); } catch { /* */ } };

  const load = useCallback(async () => {
    const id = ++reqId.current;
    const since = when === "all" || colF.done.when === "all" ? new Date(2000, 0, 1) : addDays(dayStart(new Date()), -100);
    const { data, error: err } = await createClient().rpc("ops_board", { p_company: companyId, p_done_since: since.toISOString() });
    if (id !== reqId.current) return;
    if (err) { setError(jobError(err)); setLoading(false); return; }
    setError(""); setJobs((data ?? []) as OpsJob[]); setLoading(false); setUpdatedAt(Date.now());
  }, [companyId, when, colF.done.when]);

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
  const inPeriod = useCallback((j: OpsJob, g: OpsGroup, w: When, own: boolean) => {
    const r = rangeOf(w, now, weekStartsOn, g === "done"); if (!r) return true;
    const [from, to] = r;
    const s = j.visit?.starts_at ? new Date(j.visit.starts_at) : null;
    const d = g === "done" ? (j.completed_at ? new Date(j.completed_at) : s) : s;
    if (!d) return g !== "done"; // sin fecha: siempre a la vista (necesita atención)
    if (!own && (g === "in_progress" || g === "delayed")) return true;
    return d >= from && d < to;
  }, [now, weekStartsOn]);

  const shown = useMemo(() => jobs.filter((j) => {
    if (!matches(j, q)) return false;
    if (people.length && !(people.includes(UNASSIGNED) && !j.techs.length) && !j.techs.some((t) => people.includes(t.user_id))) return false;
    return true;
  }), [jobs, q, people, matches]);

  const byGroup = useMemo(() => {
    const m = Object.fromEntries(OPS_GROUPS.map((g) => [g.id, [] as OpsJob[]])) as Record<OpsGroup, OpsJob[]>;
    shown.forEach((j) => {
      const g = groupOf(j), f = colF[g];
      if (!inPeriod(j, g, f.when ?? when, Boolean(f.when)) || !matches(j, f.q)) return;
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
  }, [shown, groupOf, now, cardOrder, colF, when, inPeriod, matches]);

  const connJobs = useMemo(() => (focus ? byGroup[focus] : OPS_GROUPS.flatMap((g) => byGroup[g.id])), [byGroup, focus]);

  // ---------- Progreso total y dinero del periodo ----------
  const totals = useMemo(() => {
    const all = OPS_GROUPS.flatMap((g) => byGroup[g.id]);
    const pct = all.length ? Math.round(all.reduce((a, j) => a + progressOf(j), 0) / all.length) : 0;
    const open = all.filter((j) => j.status !== "completed");
    const openPct = open.length ? Math.round(open.reduce((a, j) => a + progressOf(j), 0) / open.length) : 0;
    return { pct, openPct, total: all.length, done: byGroup.done.length, working: byGroup.in_progress.length, late: byGroup.delayed.length };
  }, [byGroup]);
  const [cash, setCash] = useState<Money | null>(null);
  useEffect(() => {
    if (!money) return;
    const r = rangeOf(when, Date.now(), weekStartsOn, true);
    createClient().rpc("ops_money", { p_company: companyId, p_from: r?.[0].toISOString() ?? null, p_to: r?.[1].toISOString() ?? null })
      .then(({ data, error: e }) => setCash(e ? null : (data as Money)), () => setCash(null));
  }, [companyId, when, weekStartsOn, money, updatedAt]);
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
  const tabStrip = useRef<HTMLDivElement>(null);
  useEffect(() => { tabStrip.current?.querySelector(`[data-g="${mobileGroup}"]`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }); }, [mobileGroup]);

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
  const afterAction = (msg: string, notify?: Record<string, unknown>) => {
    setAsk(null); flash(msg); load();
    if (notify && ((notify.assigned as string[] | undefined)?.length || (notify.unassigned as string[] | undefined)?.length || notify.moved)) {
      fetch("/api/jobs/notify", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify(notify) }).catch(() => null);
    }
  };

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[#f4f6f8] px-3 pb-24 pt-4 lg:px-6 lg:pb-8 lg:pt-5">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto min-w-0">
          <h1 className="flex items-center gap-2.5 text-[22px] font-semibold tracking-tight text-[#0b1f3a]">
            Operations
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e7f6f1] px-2.5 py-0.5 text-[12px] font-semibold text-[#0f766e]">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#14a39a] opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#14a39a]" /></span>Live
            </span>
          </h1>
          <p className="text-[13px] text-slate-500">Every job, who&apos;s on it and how far along it is{updatedAt ? ` · updated ${new Date(updatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ""}.</p>
        </div>
        <div className="relative order-last w-full sm:order-none sm:w-72">
          <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.9"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search job, customer, phone, address" aria-label="Search jobs"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-[14px] focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15" />
          {q && <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition-all hover:rotate-90 hover:bg-red-50 hover:text-red-600">
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 5l10 10M15 5 5 15" /></svg></button>}
        </div>
        <WhenMenu when={when} setWhen={setWhen} />
        <ViewMenu view={view} setView={pickView} />
        <FiltersMenu people={people} setPeople={setPeople} list={peopleList} active={filtersOn} />
        <Link prefetch={false} href="/dashboard/jobs/new" className="group/n inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#0f766e] px-4 text-[14.5px] font-semibold text-white shadow-sm shadow-[#0f766e]/30 transition-colors hover:bg-[#0c5f59]">
          <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform duration-200 group-hover/n:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>
          <span className="hidden sm:inline">New job</span>
        </Link>
      </div>

      {error && <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-800">{error}</p>}

      <Overview totals={totals} cash={cash} money={money} period={WHEN.find((w) => w.v === when)!.label} />

      {/* Resumen de los 5 grupos (tocar = ver solo ese grupo) */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
        {ordered.map((g) => {
          const n = byGroup[g.id].length, on = focus === g.id;
          return (
            <button key={g.id} type="button" onClick={() => { setFocus(on ? null : g.id); setMobileGroup(g.id); }}
              className={`group rounded-2xl border bg-white p-3 text-left transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,40,60,0.09)] lg:p-3.5 ${on ? "border-[#0f766e] ring-4 ring-[#14a39a]/10" : "border-slate-200 hover:border-slate-300"} ${g.id === "done" ? "col-span-2 sm:col-span-1" : ""}`}>
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

      {view === "connections" ? (
        <div className="mt-4">
          {focus && <FocusNote label={OPS_GROUPS.find((g) => g.id === focus)!.label} onClear={() => setFocus(null)} />}
          {loading ? <div className="h-80 animate-pulse rounded-2xl bg-white" /> : <OpsConnections jobs={connJobs} groupOf={groupOf} team={team} now={now} menuFor={menuFor} isAfter={isAfter} hrefFor={hrefFor} />}
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
                      <ColumnFilter label={g.label} f={colF[g.id]} pageWhen={when} onChange={(f) => setCol(g.id, f)} />
                    </span>
                  </div>
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

          {/* Celular: pestañas que se deslizan */}
          <div className="mt-4 lg:hidden">
            <div ref={tabStrip} className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
              {ordered.map((g) => (
                <button key={g.id} data-g={g.id} type="button" onClick={() => setMobileGroup(g.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[14px] font-semibold transition-colors ${mobileGroup === g.id ? "bg-[#0b1f3a] text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
                  <span className={`h-2 w-2 rounded-full ${g.dot}`} />{g.label}<span className={mobileGroup === g.id ? "text-white/70" : "text-slate-400"}>{byGroup[g.id].length}</span>
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-end">
              <ColumnFilter label={OPS_GROUPS.find((x) => x.id === mobileGroup)!.label} f={colF[mobileGroup]} pageWhen={when} onChange={(f) => setCol(mobileGroup, f)} wide />
            </div>
            <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="mt-2 min-h-[50vh] space-y-2">
              <div key={mobileGroup} className="space-y-2 animate-[bp-fade_0.2s_ease-out]">
                {loading ? [0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-white" />)
                  : byGroup[mobileGroup].length === 0 ? <EmptyGroup g={mobileGroup} />
                  : byGroup[mobileGroup].map((j) => <OpsCard key={j.id} job={j} group={mobileGroup} now={now} afterHours={isAfter(j)} href={hrefFor(j, mobileGroup)} menu={menuFor(j, mobileGroup)} />)}
              </div>
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

function ViewMenu({ view, setView }: { view: View; setView: (v: View) => void }) {
  const opts: { v: View; label: string; hint: string; d: string }[] = [
    { v: "board", label: "Board", hint: "Jobs in 5 groups", d: "M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v11h-4z" },
    { v: "connections", label: "Connections", hint: "Lines from jobs to people", d: "M6 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 5c5 0 4 7 8 7M8 19c5 0 4-7 8-7" },
  ];
  const cur = opts.find((o) => o.v === view)!;
  return (
    <Menu>
      <MenuButton className={btn} aria-label="View">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={cur.d} /></svg>
        <span className="hidden sm:inline">{cur.label}</span>
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

function FiltersMenu({ people, setPeople, list, active }: { people: string[]; setPeople: (v: string[]) => void; list: TeamMember[]; active: number }) {
  const toggle = (id: string) => setPeople(people.includes(id) ? people.filter((x) => x !== id) : [...people, id]);
  return (
    <Popover className="relative">
      <PopoverButton className={btn} aria-label="Filters">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
        <span className="hidden sm:inline">Filters</span>
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

// Periodo: Hoy · Esta semana · Este mes · 3 meses · Todo (lo que está pasando ahora y lo atrasado siempre se ve)
function WhenMenu({ when, setWhen }: { when: When; setWhen: (v: When) => void }) {
  const cur = WHEN.find((w) => w.v === when)!;
  return (
    <Menu>
      <MenuButton className={btn} aria-label="Period">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" /></svg>
        <span>{cur.label}</span>
        <svg viewBox="0 0 20 20" className="h-4 w-4 text-slate-400" fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
      </MenuButton>
      <MenuItems anchor="bottom end" transition className="z-[100] mt-1 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_40px_rgba(15,40,60,0.16)] transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0 focus:outline-none">
        {WHEN.map((w) => (
          <MenuItem key={w.v}>
            <button type="button" onClick={() => setWhen(w.v)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left data-[focus]:bg-[#eef4ff] ${when === w.v ? "bg-[#eef4ff]" : ""}`}>
              <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold text-[#0b1f3a]">{w.label}</span><span className="block text-[12px] text-slate-500">{w.hint}</span></span>
              {when === w.v && <svg viewBox="0 0 20 20" className="h-4 w-4 text-[#2563eb]" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="m5 10.5 3 3 7-7" /></svg>}
            </button>
          </MenuItem>
        ))}
        <p className="px-3 pb-1 pt-2 text-[11.5px] text-slate-400">For the whole page and the earnings. Each column can have its own filter (funnel icon).</p>
      </MenuItems>
    </Menu>
  );
}

type Money = { owner: boolean; jobs_done: number; revenue: number; collected: number; pipeline: number; open_jobs: number;
  labor: number | null; materials: number | null; hours: number | null; missing_rates: number | null; salaried: number | null; profit: number | null };
const money$ = (v: number | null | undefined) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(v) || 0);

// Arriba de todo: progreso total + ingresos, costos y ganancia del periodo (costos y ganancia SOLO el dueño)
function Overview({ totals, cash, money, period }: {
  totals: { pct: number; openPct: number; total: number; done: number; working: number; late: number };
  cash: Money | null; money: "owner" | "manager" | null; period: string;
}) {
  const margin = cash?.profit != null && cash.revenue > 0 ? Math.round((cash.profit / cash.revenue) * 100) : null;
  const stat = (label: string, value: string, hint: string, tone = "text-[#0b1f3a]", art?: React.ReactNode) => (
    <div className="group min-w-0 rounded-xl px-3 py-2 transition-colors hover:bg-[#f6f9fc]">
      <p className="flex items-center gap-1.5 truncate text-[12px] font-medium text-slate-500">{art}{label}</p>
      <p className={`mt-0.5 truncate text-[20px] font-semibold tabular-nums tracking-tight ${tone}`}>{value}</p>
      <p className="truncate text-[11.5px] text-slate-400">{hint}</p>
    </div>
  );
  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 lg:p-4">
      <div className="flex flex-wrap items-center gap-3 lg:gap-5">
        <div className="flex items-center gap-3 pr-2">
          <ProgressRing pct={totals.pct} size={64} stroke={6} color="#0f766e" />
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Total progress · {period}</p>
            <p className="text-[15px] font-semibold text-[#0b1f3a]">{totals.done} of {totals.total} job{totals.total === 1 ? "" : "s"} completed</p>
            <p className="text-[12.5px] text-slate-500">Open jobs are {totals.openPct}% along · {totals.working} working · <span className={totals.late ? "font-semibold text-[#be123c]" : ""}>{totals.late} delayed</span></p>
          </div>
        </div>
        {money && cash && (
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-1 border-slate-100 sm:grid-cols-3 lg:border-l lg:pl-4 xl:grid-cols-5">
            {stat("Earned", money$(cash.revenue), `${cash.jobs_done} completed job${cash.jobs_done === 1 ? "" : "s"}`)}
            {stat("Collected", money$(cash.collected), cash.revenue > cash.collected ? `${money$(cash.revenue - cash.collected)} still to collect` : "All collected", "text-[#0f766e]")}
            {stat("Open jobs", money$(cash.pipeline), `${cash.open_jobs} job${cash.open_jobs === 1 ? "" : "s"} not finished yet`)}
            {money === "owner" && cash.profit != null ? (
              <>
                {stat("Costs", money$((cash.labor ?? 0) + (cash.materials ?? 0)), `Labor ${money$(cash.labor)} · Materials ${money$(cash.materials)}`, "text-[#b45309]")}
                {stat("Profit", money$(cash.profit), margin != null ? `${margin}% margin${cash.missing_rates ? ` · ${cash.missing_rates} without pay rate` : ""}` : "No completed jobs yet",
                  cash.profit >= 0 ? "text-[#15803d]" : "text-[#be123c]",
                  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="4.5" y="9" width="11" height="7.5" rx="1.5" /><path d="M7 9V7a3 3 0 0 1 6 0v2" /></svg>)}
              </>
            ) : null}
          </div>
        )}
      </div>
      {money === "owner" && cash && ((cash.missing_rates ?? 0) > 0 || (cash.salaried ?? 0) > 0) && (
        <p className="mt-2 rounded-lg bg-[#f6f9fc] px-3 py-1.5 text-[12px] text-slate-500">
          {(cash.missing_rates ?? 0) > 0 && <>Some collaborators don&apos;t have a pay rate yet, so their labor counts as $0. Add it in Team → Edit. </>}
          {(cash.salaried ?? 0) > 0 && <>Salaried people aren&apos;t counted per job.</>}
        </p>
      )}
    </section>
  );
}

// Filtro de cada columna (embudo): su propio periodo + buscar dentro de esa columna
function ColumnFilter({ label, f, pageWhen, onChange, wide = false }: { label: string; f: ColFilter; pageWhen: When; onChange: (f: Partial<ColFilter>) => void; wide?: boolean }) {
  const on = Boolean(f.when || f.q);
  const cur = f.when ? WHEN.find((w) => w.v === f.when)!.label : null;
  const chip = (sel: boolean) => `rounded-full border px-2.5 py-1 text-[12.5px] font-semibold transition-colors ${sel ? "border-[#2563eb] bg-[#eef4ff] text-[#2563eb]" : "border-slate-200 text-slate-600 hover:border-slate-300"}`;
  return (
    <Popover className="relative">
      <PopoverButton aria-label={`Filter ${label}`} title={`Filter ${label}`}
        className={`flex h-7 items-center gap-1 rounded-lg px-1.5 text-[12px] font-semibold transition-colors focus:outline-none data-[open]:bg-[#eef4ff] ${on ? "bg-[#eef4ff] text-[#2563eb]" : "text-slate-400 hover:bg-white hover:text-[#0b1f3a]"} ${wide ? "border border-slate-200 bg-white px-3 text-[13px]" : ""}`}>
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 5h13l-5 6v4.5l-3 1.5v-6z" /></svg>
        {(wide || on) && <span className="max-w-[6rem] truncate">{cur ?? (f.q ? "Search" : `Filter ${label}`)}</span>}
      </PopoverButton>
      <PopoverPanel anchor="bottom end" transition
        className="z-[100] mt-2 w-[min(19rem,calc(100vw-1.5rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_48px_rgba(15,40,60,0.2)] transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0">
        <div className="flex items-center justify-between">
          <p className="text-[14.5px] font-semibold text-[#0b1f3a]">{label}</p>
          {on && <button type="button" onClick={() => onChange({ when: null, q: "" })} className="text-[12.5px] font-semibold text-[#0f766e] hover:underline">Clear</button>}
        </div>
        <div className="relative mt-3">
          <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.9"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg>
          <input value={f.q} onChange={(e) => onChange({ q: e.target.value })} placeholder={`Search in ${label}`}
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-[13.5px] focus:border-[#0f766e] focus:bg-white focus:outline-none" />
        </div>
        <p className="mb-1.5 mt-3 text-[12px] font-semibold text-slate-500">Period</p>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => onChange({ when: null })} className={chip(!f.when)}>Same as page · {WHEN.find((w) => w.v === pageWhen)!.label}</button>
          {WHEN.map((w) => <button key={w.v} type="button" onClick={() => onChange({ when: w.v })} className={chip(f.when === w.v)}>{w.label}</button>)}
        </div>
        <p className="mt-3 text-[11.5px] text-slate-400">{label === "Completed" ? "By the day the job was finished." : "By the scheduled day. Jobs without a date always show."}</p>
      </PopoverPanel>
    </Popover>
  );
}
