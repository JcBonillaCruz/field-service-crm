"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TeamMember, jobError, receivesJobs } from "@/lib/jobs";
import { OpsGroup, OpsJob } from "@/lib/operations";
import { StatusArt, TechDot } from "@/components/jobs/EventBar";
import { CardMenu, OpsCard, liveStatus } from "@/components/jobs/ops/OpsBits";

type Seg = { key: string; job: string; user: string; d: string; color: string; flow: "fast" | "slow" | "none"; ex: number; ey: number };
const NONE = "__none";

// =====================================================================
// Vista "Conexiones" por persona: cada colaborador tiene su carril con SUS trabajos
// (de izquierda a derecha y luego hacia abajo, usando toda la pantalla).
// Las líneas salen de la persona y corren por los espacios entre tarjetas (no por encima).
// Arrastra una tarjeta a otra persona para pasársela (Ctrl/⌥ = agregarla como ayudante),
// al carril "Sin asignar" para quitarla, o arrastra a la persona para cambiar el orden.
// =====================================================================
export default function OpsConnections({ companyId, jobs, groupOf, team, now, menuFor, isAfter, hrefFor, onChanged, onUnassign }: {
  companyId: string; jobs: OpsJob[]; groupOf: (j: OpsJob) => OpsGroup; team: TeamMember[]; now: number;
  menuFor?: (j: OpsJob, g: OpsGroup) => CardMenu; isAfter?: (j: OpsJob) => boolean; hrefFor?: (j: OpsJob, g: OpsGroup) => string | undefined;
  onChanged: (msg: string, notify?: Record<string, unknown>, error?: boolean) => void;
  onUnassign: (j: OpsJob) => void; // último colaborador → pide la nota (Sin asignar)
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const cardEls = useRef(new Map<string, HTMLElement>());   // clave: persona|trabajo
  const userEls = useRef(new Map<string, HTMLElement>());
  const gridEls = useRef(new Map<string, HTMLElement>());
  const [segs, setSegs] = useState<Seg[]>([]);
  const [h, setH] = useState(0);
  const [hoverJob, setHoverJob] = useState<string | null>(null);
  const [hoverUser, setHoverUser] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ kind: "job"; job: string; from: string } | { kind: "person"; id: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const KEY = `bp-ops-lanes-${companyId}`;
  useEffect(() => { try { setOrder(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { /* */ } }, [KEY]);

  // Personas: los que reciben trabajos + cualquiera que tenga uno en pantalla
  const people = useMemo(() => {
    const byId = new Map(team.map((m) => [m.user_id, m]));
    const ids = new Set(team.filter(receivesJobs).map((m) => m.user_id));
    jobs.forEach((j) => j.techs.forEach((t) => ids.add(t.user_id)));
    const fromJobs = new Map(jobs.flatMap((j) => j.techs).map((t) => [t.user_id, t]));
    const list = Array.from(ids).map((id) => {
      const m = byId.get(id), t = fromJobs.get(id);
      return { id, name: m?.full_name ?? t?.name ?? "Team member", initials: m?.initials ?? t?.initials ?? "?", color: m?.color ?? t?.color ?? "#94a3b8", avatar_url: m?.avatar_url ?? t?.avatar_url ?? null };
    });
    const pos = new Map(order.map((id, i) => [id, i]));
    const count = (id: string) => jobs.filter((j) => j.techs.some((t) => t.user_id === id)).length;
    return list.sort((a, b) => (pos.get(a.id) ?? 9999) - (pos.get(b.id) ?? 9999) || count(b.id) - count(a.id) || a.name.localeCompare(b.name));
  }, [team, jobs, order]);

  const byTime = (a: OpsJob, b: OpsJob) => (a.visit?.starts_at ?? "z").localeCompare(b.visit?.starts_at ?? "z");
  const laneJobs = useMemo(() => {
    const m = new Map<string, OpsJob[]>();
    people.forEach((p) => m.set(p.id, jobs.filter((j) => j.techs.some((t) => t.user_id === p.id)).sort(byTime)));
    m.set(NONE, jobs.filter((j) => !j.techs.length).sort(byTime));
    return m;
  }, [people, jobs]);

  // ---------- Líneas: persona → espacio de arriba de la fila → espacio a la izquierda de la tarjeta → tarjeta ----------
  const measure = useCallback(() => {
    const root = wrap.current; if (!root) return;
    const box = root.getBoundingClientRect();
    setH(root.scrollHeight);
    const out: Seg[] = [];
    people.forEach((p) => {
      const u = userEls.current.get(p.id), grid = gridEls.current.get(p.id); if (!u || !grid) return;
      const ru = u.getBoundingClientRect(), rg = grid.getBoundingClientRect();
      const px = ru.right - box.left, py = ru.top - box.top + ru.height / 2;
      const gx = rg.left - box.left - 7;
      (laneJobs.get(p.id) ?? []).forEach((j) => {
        const c = cardEls.current.get(`${p.id}|${j.id}`); if (!c) return;
        const rc = c.getBoundingClientRect();
        const cx = rc.left - box.left, cy = rc.top - box.top + Math.min(26, rc.height / 2), rowY = rc.top - box.top - 7;
        const lx = cx - 7;
        const g = groupOf(j);
        const tech = j.techs.find((t) => t.user_id === p.id);
        const d = Math.abs(lx - gx) < 2
          ? `M${px} ${py} H${gx} V${cy} H${cx}`
          : `M${px} ${py} H${gx} V${rowY} H${lx} V${cy} H${cx}`;
        out.push({ key: `${p.id}-${j.id}`, job: j.id, user: p.id, d, ex: cx, ey: cy,
          color: g === "delayed" ? "#e11d48" : g === "done" ? "#94a3b8" : tech?.color ?? p.color,
          flow: g === "in_progress" || g === "delayed" ? "fast" : g === "done" ? "none" : "slow" });
      });
    });
    setSegs(out);
  }, [people, laneJobs, groupOf]);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(() => measure());
    if (wrap.current) ro.observe(wrap.current);
    window.addEventListener("resize", measure);
    const t = setTimeout(measure, 300);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); clearTimeout(t); };
  }, [measure]);

  const lit = (s: Seg) => (hoverJob ? s.job === hoverJob : hoverUser ? s.user === hoverUser : true);
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "this person";

  // ---------- Mover / agregar / quitar ----------
  async function setPeople(j: OpsJob, next: string[], msg: string) {
    if (!j.visit) return onChanged("This job has no visit to assign.", undefined, true);
    const before = j.techs.map((t) => t.user_id);
    const lead = j.techs.find((t) => t.is_lead)?.user_id ?? null;
    const { error } = await createClient().rpc("visit_set_collaborators", { p_visit: j.visit.id, p_users: next, p_lead: lead && next.includes(lead) ? lead : next[0] ?? null });
    if (error) return onChanged(error.hint || jobError(error), undefined, true);
    onChanged(msg, { visitId: j.visit.id, assigned: next.filter((x) => !before.includes(x)), unassigned: before.filter((x) => !next.includes(x)) });
  }
  function dropOnLane(to: string, e: React.DragEvent) {
    e.preventDefault();
    const d = drag; setDrag(null); setOver(null);
    if (!d) return;
    if (d.kind === "person") {
      if (to === NONE || d.id === to) return;
      const ids = people.map((p) => p.id).filter((x) => x !== d.id);
      ids.splice(Math.max(0, ids.indexOf(to)), 0, d.id);
      setOrder(ids); try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* */ }
      return;
    }
    const j = jobs.find((x) => x.id === d.job); if (!j || d.from === to) return;
    const ids = j.techs.map((t) => t.user_id);
    const label = j.customer_name || `#${j.number}`;
    if (to === NONE) {
      if (d.from === NONE) return;
      if (ids.length <= 1) return onUnassign(j); // sin nadie: pide la nota
      return setPeople(j, ids.filter((x) => x !== d.from), `${nameOf(d.from)} removed from ${label}`);
    }
    if (ids.includes(to)) return onChanged(`${nameOf(to)} is already on ${label}`);
    const add = d.from === NONE || e.ctrlKey || e.altKey || e.metaKey;
    const next = add ? [...ids, to] : ids.map((x) => (x === d.from ? to : x));
    setPeople(j, next, add ? `${nameOf(to)} added to ${label}` : `${label} moved from ${nameOf(d.from)} to ${nameOf(to)}`);
  }
  const laneProps = (id: string) => ({
    onDragOver: (e: React.DragEvent) => { if (drag) { e.preventDefault(); if (over !== id) setOver(id); } },
    onDragLeave: (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o === id ? null : o)); },
    onDrop: (e: React.DragEvent) => dropOnLane(id, e),
  });

  if (!jobs.length && !people.length) return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <p className="text-[15px] font-semibold text-[#0b1f3a]">No jobs to connect</p>
      <p className="mt-1 text-[13px] text-slate-500">Change the filters or the date to see more jobs.</p>
    </div>
  );

  const lanes: { id: string; person: (typeof people)[number] | null }[] = [...people.map((p) => ({ id: p.id, person: p })), { id: NONE, person: null }];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-100 px-4 py-2.5 text-[12px] text-slate-500">
        <span className="font-semibold text-[#0b1f3a]">Connections</span>
        <span className="inline-flex items-center gap-1.5"><svg width="26" height="6"><path d="M1 3h24" stroke="#2563eb" strokeWidth="2.5" strokeDasharray="5 5" /></svg>Assigned</span>
        <span className="inline-flex items-center gap-1.5"><svg width="26" height="6"><path d="M1 3h24" stroke="#d97706" strokeWidth="2.5" strokeDasharray="5 5" /></svg>Working now</span>
        <span className="inline-flex items-center gap-1.5"><svg width="26" height="6"><path d="M1 3h24" stroke="#e11d48" strokeWidth="2.5" strokeDasharray="5 5" /></svg>Delayed</span>
        <span className="inline-flex items-center gap-1.5"><svg width="26" height="6"><path d="M1 3h24" stroke="#94a3b8" strokeWidth="2" /></svg>Done</span>
        <span className="ml-auto hidden lg:inline">Drag a job to another person to hand it over · hold Ctrl (⌥) to add a helper · drag a person to reorder</span>
      </div>
      <div ref={wrap} className="relative overflow-hidden p-3 sm:p-4">
        <svg className="pointer-events-none absolute left-0 top-0 w-full" height={h} aria-hidden="true">
          {segs.map((s) => (
            <g key={s.key} style={{ opacity: lit(s) ? 1 : 0.07, transition: "opacity 150ms" }}>
              <path d={s.d} fill="none" stroke={s.color} strokeOpacity={0.16} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
              <path d={s.d} fill="none" stroke={s.color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round"
                strokeDasharray={s.flow === "none" ? undefined : "5 7"} strokeOpacity={s.flow === "none" ? 0.5 : 1}>
                {s.flow !== "none" && <animate attributeName="stroke-dashoffset" from="24" to="0" dur={s.flow === "fast" ? "0.6s" : "1.6s"} repeatCount="indefinite" />}
              </path>
              <circle cx={s.ex} cy={s.ey} r={2.6} fill={s.color} />
            </g>
          ))}
        </svg>

        <div className="relative space-y-3">
          {lanes.map(({ id, person: p }) => {
            const list = laneJobs.get(id) ?? [];
            const live = list.map(liveStatus).find((x) => x === "in_progress") ?? list.map(liveStatus).find((x) => x === "on_my_way" || x === "paused") ?? null;
            const done = list.filter((j) => groupOf(j) === "done").length;
            const isOver = over === id && drag?.kind === "job" && drag.from !== id;
            if (!p && !list.length && !(drag?.kind === "job")) return null;
            return (
              <div key={id} {...laneProps(id)}
                className={`grid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-[14px] rounded-xl transition-colors sm:grid-cols-[11rem_minmax(0,1fr)] ${isOver ? "bg-[#eef9f6] ring-2 ring-[#14a39a]/40" : ""}`}>
                {/* Persona */}
                <div className="pt-[10px]">
                  {p ? (
                    <div ref={(el) => { if (el) userEls.current.set(p.id, el); else userEls.current.delete(p.id); }}
                      draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", `person:${p.id}`); e.dataTransfer.effectAllowed = "move"; setDrag({ kind: "person", id: p.id }); }}
                      onDragEnd={() => { setDrag(null); setOver(null); }}
                      onMouseEnter={() => setHoverUser(p.id)} onMouseLeave={() => setHoverUser(null)}
                      title="Drag to reorder"
                      className={`group sticky top-20 flex cursor-grab items-center gap-2 rounded-xl border bg-white px-2 py-1.5 transition-all duration-100 hover:shadow-[0_8px_18px_rgba(15,40,60,0.09)] active:cursor-grabbing ${hoverJob && !list.some((j) => j.id === hoverJob) ? "opacity-40" : ""} ${drag?.kind === "person" && drag.id === p.id ? "opacity-40" : ""}`}
                      style={{ borderColor: `${p.color}55`, borderLeft: `3px solid ${p.color}` }}>
                      <span className="relative"><TechDot t={p} size={26} ring={false} />
                        {live === "in_progress" && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-[#f59e0b] ring-2 ring-white" />}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-semibold text-[#0b1f3a]">{p.name}</span>
                        <span className="block truncate text-[11px] text-slate-500">{list.length} job{list.length === 1 ? "" : "s"}{done ? ` · ${done} done` : ""}</span>
                      </span>
                      {live && <StatusArt s={live} size={20} />}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-2 py-1.5">
                      <span className="h-[26px] w-[26px] shrink-0 rounded-full border border-dashed border-slate-400" />
                      <span className="min-w-0"><span className="block text-[12.5px] font-semibold text-slate-600">Unassigned</span><span className="block text-[11px] text-slate-400">{list.length ? `${list.length} job${list.length === 1 ? "" : "s"}` : "Drop to take off"}</span></span>
                    </div>
                  )}
                </div>
                {/* Sus trabajos: llenan de izquierda a derecha y luego hacia abajo */}
                <div ref={(el) => { if (p) { if (el) gridEls.current.set(p.id, el); else gridEls.current.delete(p.id); } }}
                  className="grid grid-cols-[repeat(auto-fill,minmax(12.5rem,1fr))] gap-[14px] pt-[10px]">
                  {list.length === 0 && <p className={`rounded-xl border border-dashed px-3 py-3 text-center text-[12px] ${isOver ? "border-[#14a39a] text-[#0f766e]" : "border-slate-200 text-slate-400"}`}>{isOver ? "Drop to hand it over" : "No jobs · drop one here"}</p>}
                  {list.map((j) => {
                    const g = groupOf(j);
                    const canDrag = g !== "done";
                    return (
                      <OpsCard key={j.id} job={j} group={g} now={now} afterHours={isAfter?.(j)} href={hrefFor?.(j, g)} menu={menuFor?.(j, g)}
                        dim={Boolean(hoverJob && hoverJob !== j.id) || Boolean(hoverUser && hoverUser !== id)}
                        dragging={drag?.kind === "job" && drag.job === j.id && drag.from === id}
                        innerRef={(el) => { const k = `${id}|${j.id}`; if (el) cardEls.current.set(k, el); else cardEls.current.delete(k); }}
                        onHover={(on) => setHoverJob(on ? j.id : null)}
                        drag={canDrag ? {
                          draggable: true,
                          onDragStart: (e: React.DragEvent<HTMLDivElement>) => { e.stopPropagation(); e.dataTransfer.setData("text/plain", `job:${j.id}`); e.dataTransfer.effectAllowed = "move"; setDrag({ kind: "job", job: j.id, from: id }); },
                          onDragEnd: () => { setDrag(null); setOver(null); },
                        } : undefined} />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
