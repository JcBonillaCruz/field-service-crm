"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TeamMember, jobError, receivesJobs } from "@/lib/jobs";
import { OpsGroup, OpsJob } from "@/lib/operations";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { StatusArt, TechDot } from "@/components/jobs/EventBar";
import { CardMenu, OpsCard, liveStatus } from "@/components/jobs/ops/OpsBits";

type Line = { key: string; job: string; user: string; d: string; color: string; lead: boolean; flow: "fast" | "slow" | "none"; ex: number; ey: number };
type Show = "in_progress" | "assigned" | "delayed" | "unassigned" | "done";
const SHOW: { v: Show; label: string; dot: string }[] = [
  { v: "in_progress", label: "In progress", dot: "bg-[#f59e0b]" },
  { v: "assigned", label: "Assigned", dot: "bg-[#2563eb]" },
  { v: "delayed", label: "Delayed", dot: "bg-[#e11d48]" },
  { v: "unassigned", label: "Unassigned", dot: "bg-slate-400" },
  { v: "done", label: "Completed", dot: "bg-[#16a34a]" },
];

// =====================================================================
// Conexiones: colaboradores a la izquierda y sus trabajos (tarjetas chiquitas) en columnas
// que se llenan de arriba abajo y siguen en la de al lado, como una ramificación:
// primero los compartidos (2+ personas), luego los de cada persona en el orden de la lista.
// Las líneas curvas pasan SIEMPRE por detrás de las tarjetas (se asoman en los huecos).
// Si no caben todas las columnas, se pasa de pantalla con ‹ › (nunca scroll de lado).
//   · Filtros: qué estados ver (en progreso, asignados, atrasados, sin asignar, terminados) y una persona.
//   · Arrastra un trabajo a una persona (asignar · pasarlo · agregar ayudante), entre tarjetas (ordenar)
//     o a "Unassigned" (quitarlo, pide nota). Arrastra a una persona para cambiar el orden.
// =====================================================================
export default function OpsConnections({ companyId, jobs, groupOf, team, now, menuFor, isAfter, hrefFor, onChanged, onUnassign, period }: {
  companyId: string; period?: React.ReactNode; jobs: OpsJob[]; groupOf: (j: OpsJob) => OpsGroup; team: TeamMember[]; now: number;
  menuFor?: (j: OpsJob, g: OpsGroup) => CardMenu; isAfter?: (j: OpsJob) => boolean; hrefFor?: (j: OpsJob, g: OpsGroup) => string | undefined;
  onChanged: (msg: string, notify?: Record<string, unknown>, error?: boolean) => void;
  onUnassign: (j: OpsJob) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const jobEls = useRef(new Map<string, HTMLElement>());
  const userEls = useRef(new Map<string, HTMLElement>());
  const [lines, setLines] = useState<Line[]>([]);
  const [h, setH] = useState(0);
  const [hoverJob, setHoverJob] = useState<string | null>(null);
  const [hoverUser, setHoverUser] = useState<string | null>(null);
  const [onlyUser, setOnlyUser] = useState<string | null>(null);
  const [show, setShow] = useState<Show[]>(["in_progress", "assigned", "delayed", "unassigned"]);
  const [drag, setDrag] = useState<{ kind: "job"; id: string } | { kind: "person"; id: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [pOrder, setPOrder] = useState<string[]>([]);
  const [jOrder, setJOrder] = useState<string[]>([]);
  const PK = `bp-ops-people-${companyId}`, JK = `bp-ops-conn-jobs-${companyId}`, SK = `bp-ops-conn-show-${companyId}`;
  useEffect(() => {
    try {
      setPOrder(JSON.parse(localStorage.getItem(PK) || "[]")); setJOrder(JSON.parse(localStorage.getItem(JK) || "[]"));
      const sv = JSON.parse(localStorage.getItem(SK) || "null") as Show[] | null; if (Array.isArray(sv) && sv.length) setShow(sv);
    } catch { /* */ }
  }, [PK, JK, SK]);
  const toggleShow = (v: Show) => setShow((cur) => {
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    const out = next.length ? next : cur;
    try { localStorage.setItem(SK, JSON.stringify(out)); } catch { /* */ }
    return out;
  });
  const showAll = () => { const all = SHOW.map((x) => x.v); setShow(all); try { localStorage.setItem(SK, JSON.stringify(all)); } catch { /* */ } };

  const counts = useMemo(() => { const m = new Map<string, number>(); jobs.forEach((j) => m.set(groupOf(j), (m.get(groupOf(j)) ?? 0) + 1)); return m; }, [jobs, groupOf]);
  const visible = useMemo(() => jobs.filter((j) => show.includes(groupOf(j) as Show) && (!onlyUser || j.techs.some((t) => t.user_id === onlyUser))), [jobs, show, onlyUser, groupOf]);

  // Personas: quien recibe trabajos + quien aparece en los trabajos
  const people = useMemo(() => {
    const byId = new Map(team.map((m) => [m.user_id, m]));
    const ids = new Set(team.filter(receivesJobs).map((m) => m.user_id));
    jobs.forEach((j) => j.techs.forEach((t) => ids.add(t.user_id)));
    const fromJobs = new Map(jobs.flatMap((j) => j.techs).map((t) => [t.user_id, t]));
    const list = Array.from(ids).map((id) => {
      const m = byId.get(id), t = fromJobs.get(id);
      return { id, name: m?.full_name ?? t?.name ?? "Team member", initials: m?.initials ?? t?.initials ?? "?", color: m?.color ?? t?.color ?? "#94a3b8", avatar_url: m?.avatar_url ?? t?.avatar_url ?? null };
    });
    const pos = new Map(pOrder.map((id, i) => [id, i]));
    return list.sort((a, b) => (pos.get(a.id) ?? 9999) - (pos.get(b.id) ?? 9999) || a.name.localeCompare(b.name));
  }, [team, jobs, pOrder]);

  // Orden de las tarjetas: el que acomodaste a mano; si no, por persona (casi no se cruzan las líneas) y por hora
  const ordered = useMemo(() => {
    const pp = new Map(people.map((p, i) => [p.id, i]));
    const jp = new Map(jOrder.map((id, i) => [id, i]));
    // Compartidos (2+ personas) arriba de todo; luego por persona; sin asignar al final
    const rank = (j: OpsJob) => (!j.techs.length ? 100000 : (j.techs.length > 1 ? 0 : 1000) + Math.min(...j.techs.map((t) => pp.get(t.user_id) ?? 999)));
    return [...visible].sort((a, b) => (jp.get(a.id) ?? 9999) - (jp.get(b.id) ?? 9999) || rank(a) - rank(b) || (a.visit?.starts_at ?? "z").localeCompare(b.visit?.starts_at ?? "z"));
  }, [visible, people, jOrder]);

  // ---------- Columnas que fluyen + pantallas ----------
  // Alto de columna ≈ una pantalla; columnas que caben a lo ancho; el resto en la pantalla siguiente.
  const [fit, setFit] = useState({ rows: 8, cols: 4 });
  const [page, setPage] = useState(0);
  const CARD_W = 248, COL_GAP = 20, PEOPLE_W = 192, LINES_W = 96, ROW_GAP = 8;
  const fitNow = useCallback(() => {
    const root = wrap.current; if (!root) return;
    const first = jobEls.current.values().next().value as HTMLElement | undefined;
    const cardH = (first?.offsetHeight || 74) + ROW_GAP;
    const rows = Math.max(5, Math.floor((window.innerHeight - 150) / cardH));
    const free = root.clientWidth - 32 - PEOPLE_W - LINES_W;
    const cols = Math.max(1, Math.floor((free + COL_GAP) / (CARD_W + COL_GAP)));
    setFit((f) => (f.rows === rows && f.cols === cols ? f : { rows, cols }));
  }, []);
  // Columnas: primero las de trabajo pendiente (pegadas a las personas) y los terminados
  // siempre en sus propias columnas, hasta el fondo a la derecha.
  const allCols = useMemo(() => {
    const chunk = (list: OpsJob[], done: boolean) => {
      const out: { jobs: OpsJob[]; done: boolean; first: boolean }[] = [];
      for (let i = 0; i < list.length; i += fit.rows) out.push({ jobs: list.slice(i, i + fit.rows), done, first: i === 0 });
      return out;
    };
    return [...chunk(ordered.filter((j) => groupOf(j) !== "done"), false), ...chunk(ordered.filter((j) => groupOf(j) === "done"), true)];
  }, [ordered, groupOf, fit.rows]);
  const doneCount = useMemo(() => ordered.filter((j) => groupOf(j) === "done").length, [ordered, groupOf]);
  const pages = Math.max(1, Math.ceil(allCols.length / fit.cols));
  const pg = Math.min(page, pages - 1);
  useEffect(() => { if (page !== pg) setPage(pg); }, [page, pg]);
  const pageCols = useMemo(() => allCols.slice(pg * fit.cols, (pg + 1) * fit.cols), [allCols, pg, fit.cols]);
  const pageJobs = useMemo(() => pageCols.flatMap((c) => c.jobs), [pageCols]);

  const stats = useMemo(() => {
    const m = new Map<string, { total: number; done: number; live: ReturnType<typeof liveStatus> }>();
    jobs.forEach((j) => j.techs.forEach((t) => {
      const x = m.get(t.user_id) ?? { total: 0, done: 0, live: null };
      x.total++; if (groupOf(j) === "done") x.done++;
      const l = liveStatus(j);
      if (l === "in_progress" || (l && !x.live)) x.live = l === "on_hold" ? x.live : l;
      m.set(t.user_id, x);
    }));
    return m;
  }, [jobs, groupOf]);

  // ---------- Líneas curvas: de la persona al borde izquierdo de cada tarjeta ----------
  const measure = useCallback(() => {
    const root = wrap.current; if (!root) return;
    const box = root.getBoundingClientRect();
    setH(root.scrollHeight);
    const out: Line[] = [];
    pageJobs.forEach((j) => {
      const c = jobEls.current.get(j.id); if (!c) return;
      const rc = c.getBoundingClientRect();
      const x2 = rc.left - box.left, y2 = rc.top - box.top + rc.height / 2;
      const g = groupOf(j);
      j.techs.forEach((t) => {
        const u = userEls.current.get(t.user_id); if (!u) return;
        const ru = u.getBoundingClientRect();
        const x1 = ru.right - box.left, y1 = ru.top - box.top + ru.height / 2;
        // Curva suave: sale horizontal de la persona y llega horizontal al borde de la tarjeta
        const dx = Math.max(50, Math.min(220, (x2 - x1) * 0.45));
        out.push({ key: `${j.id}-${t.user_id}`, job: j.id, user: t.user_id, d: `M${x1} ${y1} C${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`, ex: x2, ey: y2,
          color: g === "delayed" ? "#e11d48" : t.color, lead: t.is_lead,
          flow: g === "in_progress" || g === "delayed" ? "fast" : g === "done" ? "none" : "slow" });
      });
    });
    setLines(out);
  }, [pageJobs, groupOf]);

  useLayoutEffect(() => {
    fitNow(); measure();
    const ro = new ResizeObserver(() => { fitNow(); measure(); });
    if (wrap.current) ro.observe(wrap.current);
    const onResize = () => { fitNow(); measure(); };
    window.addEventListener("resize", onResize);
    const t = setTimeout(onResize, 300);
    return () => { ro.disconnect(); window.removeEventListener("resize", onResize); clearTimeout(t); };
  }, [measure, fitNow]);

  const focus = hoverJob || hoverUser;
  const lit = (l: Line) => (hoverJob ? l.job === hoverJob : hoverUser ? l.user === hoverUser : true);
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "this person";

  // ---------- Arrastrar y soltar ----------
  async function setPeople(j: OpsJob, next: string[], msg: string) {
    if (!j.visit) return onChanged("This job has no visit to assign.", undefined, true);
    const before = j.techs.map((t) => t.user_id);
    const lead = j.techs.find((t) => t.is_lead)?.user_id ?? null;
    const { error } = await createClient().rpc("visit_set_collaborators", { p_visit: j.visit.id, p_users: next, p_lead: lead && next.includes(lead) ? lead : next[0] ?? null });
    if (error) return onChanged(error.hint || jobError(error), undefined, true);
    onChanged(msg, { visitId: j.visit.id, assigned: next.filter((x) => !before.includes(x)), unassigned: before.filter((x) => !next.includes(x)) });
  }
  function dropOnPerson(pid: string, e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation();
    const d = drag; setDrag(null); setOver(null); if (!d) return;
    if (d.kind === "person") {
      if (d.id === pid) return;
      const ids = people.map((p) => p.id).filter((x) => x !== d.id);
      ids.splice(Math.max(0, ids.indexOf(pid)), 0, d.id);
      setPOrder(ids); try { localStorage.setItem(PK, JSON.stringify(ids)); } catch { /* */ }
      return;
    }
    const j = jobs.find((x) => x.id === d.id); if (!j || groupOf(j) === "done") return;
    const ids = j.techs.map((t) => t.user_id), label = j.customer_name || `#${j.number}`;
    if (ids.includes(pid)) return onChanged(`${nameOf(pid)} is already on ${label}`);
    // Sin nadie → se asigna · con 1 persona → se le pasa (Ctrl/⌥ = ayudante) · con varias → se agrega como ayudante
    if (!ids.length) return setPeople(j, [pid], `${label} → ${nameOf(pid)}`);
    if (ids.length === 1 && !(e.ctrlKey || e.altKey || e.metaKey)) return setPeople(j, [pid], `${label} moved from ${nameOf(ids[0])} to ${nameOf(pid)}`);
    setPeople(j, [...ids, pid], `${nameOf(pid)} added to ${label}`);
  }
  function dropOnJob(targetId: string, e: React.DragEvent) {
    if (drag?.kind !== "job") return;
    e.preventDefault(); e.stopPropagation();
    const id = drag.id; setDrag(null); setOver(null);
    if (id === targetId) return;
    const ids = ordered.map((x) => x.id).filter((x) => x !== id);
    ids.splice(Math.max(0, ids.indexOf(targetId)), 0, id);
    setJOrder(ids); try { localStorage.setItem(JK, JSON.stringify(ids)); } catch { /* */ }
  }
  function dropOnUnassigned(e: React.DragEvent) {
    e.preventDefault(); const d = drag; setDrag(null); setOver(null);
    if (d?.kind !== "job") return;
    const j = jobs.find((x) => x.id === d.id);
    if (j && j.techs.length && groupOf(j) !== "done") onUnassign(j);
  }
  const target = (key: string, onDrop: (e: React.DragEvent) => void) => ({
    onDragOver: (e: React.DragEvent) => { if (drag) { e.preventDefault(); e.stopPropagation(); if (over !== key) setOver(key); } },
    onDragLeave: (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o === key ? null : o)); },
    onDrop,
  });


  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      {/* Qué ver */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2.5 lg:px-4">
        <ShowPicker show={show} counts={counts} onToggle={toggleShow} onAll={showAll} />
        {period && <div className="hidden lg:block">{period}</div>}
        {onlyUser && (
          <button type="button" onClick={() => setOnlyUser(null)} className="ml-1 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#0b1f3a] py-1 pl-1 pr-2.5 text-[12px] font-semibold text-white">
            {(() => { const p = people.find((x) => x.id === onlyUser); return p ? <TechDot t={p} size={18} ring={false} /> : null; })()}
            Only {nameOf(onlyUser).split(" ")[0]}<span className="opacity-70">✕</span>
          </button>
        )}
        <span className="ml-auto hidden text-[11.5px] text-slate-400 2xl:inline">Tap a person to see only their jobs · drag a job onto a person to assign it (Ctrl/⌥ adds a helper)</span>
        {pages > 1 && (
          <div className="ml-auto hidden items-center gap-1 lg:flex 2xl:ml-3">
            <button type="button" onClick={() => setPage(Math.max(0, pg - 1))} disabled={pg === 0} aria-label="Previous screen"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-[#14a39a] hover:text-[#0f766e] disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-slate-500">
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.5 5 7.5 10l5 5" /></svg></button>
            <span className="min-w-[4.5rem] text-center text-[12.5px] font-semibold tabular-nums text-slate-600">{pg + 1} / {pages}<span className="block text-[10.5px] font-normal text-slate-400">{pageJobs.length} of {ordered.length} jobs</span></span>
            <button type="button" onClick={() => setPage(Math.min(pages - 1, pg + 1))} disabled={pg >= pages - 1} aria-label="Next screen"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-[#14a39a] hover:text-[#0f766e] disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-slate-500">
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.5 5 12.5 10l-5 5" /></svg></button>
          </div>
        )}
      </div>

      {/* Celular: por persona, sus trabajos en 2 columnas (tocar la persona = solo sus trabajos) */}
      <div className="space-y-4 p-3 lg:hidden">
        {[...people.map((p) => ({ id: p.id, p })), { id: "__none", p: null }].map(({ id, p }) => {
          const list = ordered.filter((j) => (p ? j.techs.some((t) => t.user_id === p.id) : !j.techs.length));
          if (!list.length) return null;
          const st = p ? stats.get(p.id) ?? { total: 0, done: 0, live: null } : null;
          const color = p?.color ?? "#94a3b8";
          return (
            <div key={id}>
              <button type="button" onClick={() => p && setOnlyUser((u) => (u === p.id ? null : p.id))}
                className={`flex w-full items-center gap-2.5 rounded-xl border bg-white px-2.5 py-2 text-left ${onlyUser === id ? "ring-2 ring-[#0b1f3a]" : ""}`}
                style={{ borderColor: `${color}55`, borderLeft: `3px solid ${color}` }}>
                {p ? <TechDot t={p} size={28} ring={false} /> : <span className="h-7 w-7 rounded-full border border-dashed border-slate-400" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-[#0b1f3a]">{p ? p.name : "Unassigned"}</span>
                  <span className="block text-[12px] text-slate-500">{list.length} job{list.length === 1 ? "" : "s"} here{st?.done ? ` · ${st.done} done` : ""}</span>
                </span>
                {st?.live && st.live !== "on_hold" && <StatusArt s={st.live} size={24} />}
              </button>
              <div className="ml-3 mt-2 grid grid-cols-2 gap-2 border-l-2 pl-3" style={{ borderColor: `${color}66` }}>
                {list.map((j) => {
                  const g = groupOf(j);
                  return <OpsCard key={j.id} job={j} group={g} now={now} tiny afterHours={isAfter?.(j)} href={hrefFor?.(j, g)} menu={menuFor?.(j, g)} />;
                })}
              </div>
            </div>
          );
        })}
        {ordered.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-[13px] text-slate-500">No jobs with these filters.</p>}
      </div>

      <div ref={wrap} className="relative hidden overflow-hidden p-4 lg:block">
        {/* Líneas: UNA capa, siempre por detrás de las tarjetas. Las de quien señalas se ven más fuertes, pero siguen detrás. */}
        <svg className="pointer-events-none absolute left-0 top-0 z-0 w-full" height={h} aria-hidden="true">
          {lines.map((l) => {
            const on = !focus || lit(l);
            return (
              <g key={l.key} style={{ opacity: on ? 1 : 0.1, transition: "opacity 120ms" }}>
                <path d={l.d} fill="none" stroke={l.color} strokeOpacity={focus && on ? 0.22 : 0.12} strokeWidth={l.lead ? 5 : 3.5} strokeLinecap="round" />
                <path d={l.d} fill="none" stroke={l.color} strokeWidth={(l.lead ? 2 : 1.5) + (focus && on ? 0.4 : 0)} strokeLinecap="round"
                  strokeDasharray={l.flow === "none" ? undefined : "6 9"} strokeOpacity={l.flow === "none" ? (focus && on ? 0.7 : 0.4) : focus && on ? 1 : 0.75}>
                  {l.flow !== "none" && <animate attributeName="stroke-dashoffset" from="30" to="0" dur={l.flow === "fast" ? "0.7s" : "1.8s"} repeatCount="indefinite" />}
                </path>
              </g>
            );
          })}
        </svg>

        <div className="relative grid grid-cols-[12rem_6rem_minmax(0,1fr)] justify-start">
          {/* Colaboradores */}
          <div className="relative z-10 space-y-2 self-start">
            {people.map((p) => {
              const st = stats.get(p.id) ?? { total: 0, done: 0, live: null };
              const dim = hoverJob ? !ordered.find((j) => j.id === hoverJob)?.techs.some((t) => t.user_id === p.id) : hoverUser ? hoverUser !== p.id : false;
              const isOver = over === `p-${p.id}` && drag?.kind === "job";
              return (
                <div key={p.id} ref={(el) => { if (el) userEls.current.set(p.id, el); else userEls.current.delete(p.id); }}
                  draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", `person:${p.id}`); e.dataTransfer.effectAllowed = "move"; setDrag({ kind: "person", id: p.id }); }}
                  onDragEnd={() => { setDrag(null); setOver(null); }}
                  {...target(`p-${p.id}`, (e) => dropOnPerson(p.id, e))}
                  onClick={() => setOnlyUser((u) => (u === p.id ? null : p.id))}
                  onMouseEnter={() => setHoverUser(p.id)} onMouseLeave={() => setHoverUser(null)}
                  title="Tap to see only their jobs · drag to reorder"
                  className={`group flex cursor-pointer items-center gap-2 rounded-xl border bg-white px-2 py-1.5 transition-all duration-100 hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(15,40,60,0.09)] active:cursor-grabbing
                    ${dim ? "opacity-35" : ""} ${isOver ? "scale-[1.03] ring-2 ring-[#14a39a]" : ""} ${onlyUser === p.id ? "ring-2 ring-[#0b1f3a]" : ""} ${drag?.kind === "person" && drag.id === p.id ? "opacity-40" : ""}`}
                  style={{ borderColor: `${p.color}55`, borderLeft: `3px solid ${p.color}` }}>
                  <span className="relative"><TechDot t={p} size={26} ring={false} />
                    {st.live === "in_progress" && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-[#f59e0b] ring-2 ring-white" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold text-[#0b1f3a]">{p.name}</span>
                    <span className="block truncate text-[11px] text-slate-500">{isOver ? "Drop to assign" : `${st.total} job${st.total === 1 ? "" : "s"}${st.done ? ` · ${st.done} done` : ""}`}</span>
                  </span>
                  {st.live && st.live !== "on_hold" && <span className="hidden sm:inline-flex"><StatusArt s={st.live} size={20} /></span>}
                </div>
              );
            })}
            {drag?.kind === "job" && (
              <div {...target("unassigned", dropOnUnassigned)}
                className={`flex items-center gap-2 rounded-xl border-2 border-dashed px-2 py-2 text-[12px] font-semibold transition-colors ${over === "unassigned" ? "border-[#f59e0b] bg-[#fffaf0] text-[#b45309]" : "border-slate-300 text-slate-500"}`}>
                <span className="h-[22px] w-[22px] shrink-0 rounded-full border border-dashed border-current" />Drop to unassign
              </div>
            )}
          </div>
          <div />
          {/* Trabajos: columnas que se llenan de arriba abajo y siguen en la de al lado.
              Los terminados van en sus propias columnas, empujados hasta el fondo a la derecha. */}
          <div className="relative z-10 flex min-w-0 items-start" style={{ columnGap: COL_GAP }}>
            {ordered.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-[13px] text-slate-500">No jobs with these filters.</p>}
            {pageCols.map((col, ci) => (
              <div key={`${pg}-${ci}`} className={`flex shrink-0 flex-col ${col.done && (ci === 0 || !pageCols[ci - 1].done) ? "ml-auto" : ""}`} style={{ width: CARD_W, rowGap: ROW_GAP }}>
                {col.done && col.first && (
                  <p className="flex items-center gap-1.5 px-1 text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">
                    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-[#16a34a]" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="m5 10.5 3 3 7-7" /></svg>
                    Completed · {doneCount}
                  </p>
                )}
                {col.jobs.map((j) => {
                  const g = groupOf(j);
                  const dim = hoverJob ? hoverJob !== j.id : hoverUser ? !j.techs.some((t) => t.user_id === hoverUser) : false;
                  return (
                    <div key={j.id} {...target(`j-${j.id}`, (e) => dropOnJob(j.id, e))}
                      className={`relative rounded-xl bg-white transition-shadow ${over === `j-${j.id}` && drag?.kind === "job" && drag.id !== j.id ? "shadow-[-4px_0_0_0_#14a39a]" : ""}`}>
                      <OpsCard job={j} group={g} now={now} tiny afterHours={isAfter?.(j)} href={hrefFor?.(j, g)} menu={menuFor?.(j, g)} dim={dim}
                        ports={j.techs.map((t) => (g === "delayed" ? "#e11d48" : t.color))}
                        dragging={drag?.kind === "job" && drag.id === j.id}
                        innerRef={(el) => { if (el) jobEls.current.set(j.id, el); else jobEls.current.delete(j.id); }}
                        onHover={(on) => setHoverJob(on ? j.id : null)}
                        drag={{
                          draggable: true,
                          onDragStart: (e: React.DragEvent<HTMLDivElement>) => { e.stopPropagation(); e.dataTransfer.setData("text/plain", `job:${j.id}`); e.dataTransfer.effectAllowed = "move"; setDrag({ kind: "job", id: j.id }); },
                          onDragEnd: () => { setDrag(null); setOver(null); },
                        }} />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// "Show": un selector (se pueden marcar varios). El botón dice qué se está viendo.
function ShowPicker({ show, counts, onToggle, onAll }: { show: Show[]; counts: Map<string, number>; onToggle: (v: Show) => void; onAll: () => void }) {
  const all = show.length === SHOW.length;
  const picked = SHOW.filter((x) => show.includes(x.v));
  const label = all ? "All jobs" : picked.length <= 2 ? picked.map((x) => x.label).join(" · ") : `${picked[0].label} +${picked.length - 1}`;
  const total = picked.reduce((a, x) => a + (counts.get(x.v) ?? 0), 0);
  const box = (on: boolean) => (
    <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-colors ${on ? "border-[#0f766e] bg-[#0f766e] text-white" : "border-slate-300 bg-white"}`}>
      {on && <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="m5 10.5 3 3 7-7" /></svg>}
    </span>
  );
  return (
    <Popover className="relative">
      <PopoverButton className="flex h-9 min-w-[13rem] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-[13.5px] transition-colors hover:border-[#14a39a] focus:outline-none data-[open]:border-[#0f766e] data-[open]:ring-4 data-[open]:ring-[#14a39a]/15">
        <span className="text-slate-400">Show</span>
        <span className="flex shrink-0 -space-x-0.5">{picked.slice(0, 4).map((x) => <span key={x.v} className={`h-2.5 w-2.5 rounded-full ring-2 ring-white ${x.dot}`} />)}</span>
        <span className="min-w-0 flex-1 truncate font-semibold text-[#0b1f3a]">{label}</span>
        <span className="rounded-full bg-slate-100 px-1.5 text-[11.5px] font-semibold text-slate-500">{total}</span>
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-400" fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
      </PopoverButton>
      <PopoverPanel anchor="bottom start" transition
        className="z-[100] mt-1 w-[max(var(--button-width),15rem)] rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_40px_rgba(15,40,60,0.16)] transition duration-100 data-[closed]:scale-95 data-[closed]:opacity-0 focus:outline-none">
        <button type="button" onClick={onAll} className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] font-semibold text-[#0b1f3a] hover:bg-[#eef4ff] ${all ? "bg-[#eef4ff]" : ""}`}>
          {box(all)}<span className="flex-1">All jobs</span><span className="text-[12px] font-normal text-slate-400">{SHOW.reduce((a, x) => a + (counts.get(x.v) ?? 0), 0)}</span>
        </button>
        <div className="my-1 border-t border-slate-100" />
        {SHOW.map((x) => {
          const on = show.includes(x.v);
          return (
            <button key={x.v} type="button" onClick={() => onToggle(x.v)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] text-slate-700 hover:bg-[#eef4ff]">
              {box(on)}<span className={`h-2 w-2 shrink-0 rounded-full ${x.dot}`} /><span className="flex-1">{x.label}</span>
              <span className="text-[12px] tabular-nums text-slate-400">{counts.get(x.v) ?? 0}</span>
            </button>
          );
        })}
      </PopoverPanel>
    </Popover>
  );
}
