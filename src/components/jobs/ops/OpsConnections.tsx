"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TeamMember, jobError, receivesJobs } from "@/lib/jobs";
import { OpsGroup, OpsJob } from "@/lib/operations";
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
// Conexiones: colaboradores a la izquierda, trabajos (tarjetas chiquitas) llenando
// de izquierda a derecha, y líneas curvas animadas que los unen.
//   · Filtros: qué estados ver (en progreso, asignados, atrasados, sin asignar, terminados) y una persona.
//   · Arrastra un trabajo a una persona (asignar · pasarlo · agregar ayudante), entre tarjetas (ordenar)
//     o a "Unassigned" (quitarlo, pide nota). Arrastra a una persona para cambiar el orden.
// =====================================================================
export default function OpsConnections({ companyId, jobs, groupOf, team, now, menuFor, isAfter, hrefFor, onChanged, onUnassign }: {
  companyId: string; jobs: OpsJob[]; groupOf: (j: OpsJob) => OpsGroup; team: TeamMember[]; now: number;
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
    const rank = (j: OpsJob) => (j.techs.length ? Math.min(...j.techs.map((t) => pp.get(t.user_id) ?? 999)) : 1000);
    return [...visible].sort((a, b) => (jp.get(a.id) ?? 9999) - (jp.get(b.id) ?? 9999) || rank(a) - rank(b) || (a.visit?.starts_at ?? "z").localeCompare(b.visit?.starts_at ?? "z"));
  }, [visible, people, jOrder]);

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
    ordered.forEach((j) => {
      const c = jobEls.current.get(j.id); if (!c) return;
      const rc = c.getBoundingClientRect();
      const x2 = rc.left - box.left, y2 = rc.top - box.top + rc.height / 2;
      const g = groupOf(j);
      j.techs.forEach((t) => {
        const u = userEls.current.get(t.user_id); if (!u) return;
        const ru = u.getBoundingClientRect();
        const x1 = ru.right - box.left, y1 = ru.top - box.top + ru.height / 2;
        const dx = Math.max(50, (x2 - x1) * 0.45);
        out.push({ key: `${j.id}-${t.user_id}`, job: j.id, user: t.user_id, d: `M${x1} ${y1} C${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`, ex: x2, ey: y2,
          color: g === "delayed" ? "#e11d48" : t.color, lead: t.is_lead,
          flow: g === "in_progress" || g === "delayed" ? "fast" : g === "done" ? "none" : "slow" });
      });
    });
    setLines(out);
  }, [ordered, groupOf]);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(() => measure());
    if (wrap.current) ro.observe(wrap.current);
    window.addEventListener("resize", measure);
    const t = setTimeout(measure, 300);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); clearTimeout(t); };
  }, [measure]);

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

  const chip = (on: boolean) => `inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors ${on ? "border-[#0f766e] bg-[#e9f7f4] text-[#0f766e]" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`;
  const allOn = show.length === SHOW.length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      {/* Qué ver */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-100 px-3 py-2.5 [scrollbar-width:none] lg:flex-wrap lg:px-4">
        <span className="mr-1 shrink-0 text-[13px] font-semibold text-[#0b1f3a]">Show</span>
        <button type="button" onClick={showAll} className={chip(allOn)}>All</button>
        {SHOW.map((x) => (
          <button key={x.v} type="button" onClick={() => toggleShow(x.v)} className={chip(show.includes(x.v))}>
            <span className={`h-2 w-2 rounded-full ${x.dot}`} />{x.label}<span className="font-normal opacity-60">{counts.get(x.v) ?? 0}</span>
          </button>
        ))}
        {onlyUser && (
          <button type="button" onClick={() => setOnlyUser(null)} className="ml-1 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#0b1f3a] py-1 pl-1 pr-2.5 text-[12px] font-semibold text-white">
            {(() => { const p = people.find((x) => x.id === onlyUser); return p ? <TechDot t={p} size={18} ring={false} /> : null; })()}
            Only {nameOf(onlyUser).split(" ")[0]}<span className="opacity-70">✕</span>
          </button>
        )}
        <span className="ml-auto hidden text-[11.5px] text-slate-400 xl:inline">Tap a person to see only their jobs · drag a job onto a person to assign it (Ctrl/⌥ adds a helper)</span>
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
        {/* Líneas detrás de las tarjetas; las de quien señalas pasan al frente */}
        {[false, true].map((front) => (
          <svg key={String(front)} className={`pointer-events-none absolute left-0 top-0 w-full ${front ? "z-20" : "z-0"}`} height={h} aria-hidden="true">
            {lines.filter((l) => (front ? Boolean(focus) && lit(l) : !focus || !lit(l))).map((l) => {
              const on = !focus || lit(l);
              return (
                <g key={l.key} style={{ opacity: on ? 1 : 0.08, transition: "opacity 150ms" }}>
                  <path d={l.d} fill="none" stroke={l.color} strokeOpacity={0.16} strokeWidth={l.lead ? 5 : 3.5} strokeLinecap="round" />
                  <path d={l.d} fill="none" stroke={l.color} strokeWidth={l.lead ? 2.2 : 1.6} strokeLinecap="round"
                    strokeDasharray={l.flow === "none" ? undefined : "6 9"} strokeOpacity={l.flow === "none" ? 0.45 : 1}>
                    {l.flow !== "none" && <animate attributeName="stroke-dashoffset" from="30" to="0" dur={l.flow === "fast" ? "0.7s" : "1.8s"} repeatCount="indefinite" />}
                  </path>
                  <circle cx={l.ex} cy={l.ey} r={3} fill={l.color} />
                </g>
              );
            })}
          </svg>
        ))}

        <div className="relative grid grid-cols-[7.5rem_2.5rem_minmax(0,1fr)] sm:grid-cols-[11.5rem_5rem_minmax(0,1fr)] lg:grid-cols-[12rem_7rem_minmax(0,1fr)]">
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
          {/* Trabajos: tarjetas chiquitas que llenan de izquierda a derecha */}
          <div className="relative z-10 grid content-start gap-x-4 gap-y-2.5 [grid-template-columns:repeat(auto-fill,minmax(10.5rem,1fr))]">
            {ordered.length === 0 && <p className="col-span-full rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-[13px] text-slate-500">No jobs with these filters.</p>}
            {ordered.map((j) => {
              const g = groupOf(j);
              const dim = hoverJob ? hoverJob !== j.id : hoverUser ? !j.techs.some((t) => t.user_id === hoverUser) : false;
              return (
                <div key={j.id} {...target(`j-${j.id}`, (e) => dropOnJob(j.id, e))}
                  className={`rounded-xl transition-shadow ${over === `j-${j.id}` && drag?.kind === "job" && drag.id !== j.id ? "shadow-[-4px_0_0_0_#14a39a]" : ""}`}>
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
        </div>
      </div>
    </div>
  );
}
