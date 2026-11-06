"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { TeamMember } from "@/lib/jobs";
import { OpsGroup, OpsJob } from "@/lib/operations";
import { TechDot } from "@/components/jobs/EventBar";
import { GROUP_TONE, OpsCard } from "@/components/jobs/ops/OpsBits";

type Line = { key: string; job: string; user: string | null; d: string; ex: number; ey: number; color: string; lead: boolean; flow: "fast" | "slow" | "none"; late: boolean };

// =====================================================================
// Vista "Conexiones": trabajos a la izquierda, colaboradores a la derecha y
// líneas animadas que los unen (como las relaciones de tablas en Supabase).
// La línea "corre" más rápido cuando el trabajo está en curso; roja si va tarde.
// =====================================================================
export default function OpsConnections({ jobs, groupOf, team, now }: {
  jobs: OpsJob[]; groupOf: (j: OpsJob) => OpsGroup; team: TeamMember[]; now: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const jobEls = useRef(new Map<string, HTMLElement>());
  const userEls = useRef(new Map<string, HTMLElement>());
  const [lines, setLines] = useState<Line[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hoverJob, setHoverJob] = useState<string | null>(null);
  const [hoverUser, setHoverUser] = useState<string | null>(null);

  // Personas que aparecen (con trabajos) + el resto de colaboradores al final
  const people = useMemo(() => {
    const ids: string[] = [];
    jobs.forEach((j) => j.techs.forEach((t) => { if (!ids.includes(t.user_id)) ids.push(t.user_id); }));
    const byId = new Map(team.map((m) => [m.user_id, m]));
    const fromJobs = new Map(jobs.flatMap((j) => j.techs).map((t) => [t.user_id, t]));
    const list = ids.map((id) => {
      const m = byId.get(id), t = fromJobs.get(id)!;
      return { id, name: m?.full_name ?? t.name, initials: m?.initials ?? t.initials, color: m?.color ?? t.color, avatar_url: m?.avatar_url ?? t.avatar_url };
    }).sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [jobs, team]);

  // Ordena los trabajos según su persona principal para que las líneas casi no se crucen
  const ordered = useMemo(() => {
    const pos = new Map(people.map((p, i) => [p.id, i]));
    const rank = (j: OpsJob) => (j.techs.length ? Math.min(...j.techs.map((t) => pos.get(t.user_id) ?? 999)) : -1);
    return [...jobs].sort((a, b) => rank(a) - rank(b) || (a.visit?.starts_at ?? "z").localeCompare(b.visit?.starts_at ?? "z"));
  }, [jobs, people]);

  const loadOf = useMemo(() => {
    const m = new Map<string, { total: number; active: number }>();
    jobs.forEach((j) => j.techs.forEach((t) => {
      const x = m.get(t.user_id) ?? { total: 0, active: 0 };
      x.total++; if (groupOf(j) === "in_progress" || groupOf(j) === "delayed") x.active++;
      m.set(t.user_id, x);
    }));
    return m;
  }, [jobs, groupOf]);

  const measure = useCallback(() => {
    const root = wrap.current; if (!root) return;
    const box = root.getBoundingClientRect();
    setSize({ w: root.scrollWidth, h: root.scrollHeight });
    const out: Line[] = [];
    ordered.forEach((j) => {
      const a = jobEls.current.get(j.id); if (!a) return;
      const ra = a.getBoundingClientRect();
      const x1 = ra.right - box.left, y1 = ra.top - box.top + ra.height / 2;
      const g = groupOf(j);
      if (!j.techs.length) {
        out.push({ key: `${j.id}-none`, job: j.id, user: null, d: `M${x1} ${y1} h28`, ex: x1 + 32, ey: y1, color: "#94a3b8", lead: false, flow: "none", late: false });
        return;
      }
      j.techs.forEach((t) => {
        const b = userEls.current.get(t.user_id); if (!b) return;
        const rb = b.getBoundingClientRect();
        const x2 = rb.left - box.left, y2 = rb.top - box.top + rb.height / 2;
        const dx = Math.max(40, (x2 - x1) * 0.45);
        out.push({
          key: `${j.id}-${t.user_id}`, job: j.id, user: t.user_id, d: `M${x1} ${y1} C${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`, ex: x2, ey: y2,
          color: g === "delayed" ? "#e11d48" : t.color, lead: t.is_lead, late: g === "delayed",
          flow: g === "in_progress" || g === "delayed" ? "fast" : g === "done" ? "none" : "slow",
        });
      });
    });
    setLines(out);
  }, [ordered, groupOf]);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(() => measure());
    if (wrap.current) ro.observe(wrap.current);
    window.addEventListener("resize", measure);
    const t = setTimeout(measure, 350); // después de que entren las animaciones
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); clearTimeout(t); };
  }, [measure]);

  const lit = (l: Line) => (hoverJob ? l.job === hoverJob : hoverUser ? l.user === hoverUser : true);
  const jobLit = (id: string) => (hoverJob ? id === hoverJob : hoverUser ? ordered.find((j) => j.id === id)?.techs.some((t) => t.user_id === hoverUser) : true);

  if (!jobs.length) return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <p className="text-[15px] font-semibold text-[#0b1f3a]">No jobs to connect</p>
      <p className="mt-1 text-[13px] text-slate-500">Change the filters or the date to see more jobs.</p>
    </div>
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-100 px-4 py-2.5 text-[12px] text-slate-500">
        <span className="font-semibold text-[#0b1f3a]">Connections</span>
        <span className="inline-flex items-center gap-1.5"><svg width="26" height="6"><path d="M1 3h24" stroke="#2563eb" strokeWidth="2.5" strokeDasharray="5 5" /></svg>Assigned</span>
        <span className="inline-flex items-center gap-1.5"><svg width="26" height="6"><path d="M1 3h24" stroke="#d97706" strokeWidth="3.5" strokeDasharray="5 5" /></svg>Working now (moves faster)</span>
        <span className="inline-flex items-center gap-1.5"><svg width="26" height="6"><path d="M1 3h24" stroke="#e11d48" strokeWidth="2.5" strokeDasharray="5 5" /></svg>Delayed</span>
        <span className="ml-auto hidden sm:inline">Point at a job or a person to light up its lines</span>
      </div>
      <div ref={wrap} className="relative max-h-[calc(100dvh-19rem)] min-h-[20rem] overflow-auto p-3 sm:p-4">
        <svg className="pointer-events-none absolute left-0 top-0" width={size.w} height={size.h} aria-hidden="true">
          {lines.map((l) => {
            const on = lit(l);
            return (
              <g key={l.key} style={{ opacity: on ? 1 : 0.08, transition: "opacity 150ms" }}>
                <path d={l.d} fill="none" stroke={l.color} strokeOpacity={0.18} strokeWidth={l.lead ? 5 : 3.5} strokeLinecap="round" />
                <path d={l.d} fill="none" stroke={l.color} strokeWidth={l.lead ? 2.4 : 1.7} strokeLinecap="round"
                  strokeDasharray={l.flow === "none" ? (l.user ? undefined : "3 4") : "6 9"} strokeOpacity={l.flow === "none" && l.user ? 0.45 : 1}>
                  {l.flow !== "none" && <animate attributeName="stroke-dashoffset" from="30" to="0" dur={l.flow === "fast" ? "0.7s" : "1.8s"} repeatCount="indefinite" />}
                </path>
                {l.user ? <circle cx={l.ex} cy={l.ey} r={3.2} fill={l.color} />
                  : <circle cx={l.ex} cy={l.ey} r={4} fill="#fff" stroke="#94a3b8" strokeWidth="1.5" />}
              </g>
            );
          })}
        </svg>
        <div className="relative grid grid-cols-[minmax(0,1fr)_3.5rem_8.5rem] sm:grid-cols-[minmax(0,1fr)_9rem_15rem] xl:grid-cols-[minmax(0,1fr)_14rem_17rem]">
          <div className="space-y-2">
            {ordered.map((j) => (
              <div key={j.id} className="animate-[bp-fade_0.25s_ease-out]">
                <OpsCard job={j} group={groupOf(j)} now={now} compact dim={!jobLit(j.id)}
                  innerRef={(el) => { if (el) jobEls.current.set(j.id, el); else jobEls.current.delete(j.id); }}
                  onHover={(on) => setHoverJob(on ? j.id : null)} />
              </div>
            ))}
          </div>
          <div />
          <div className="space-y-2.5 self-start sm:sticky sm:top-0">
            {people.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center text-[12.5px] text-slate-400">Nobody assigned yet</p>}
            {people.map((p) => {
              const ld = loadOf.get(p.id) ?? { total: 0, active: 0 };
              const dim = hoverJob ? !ordered.find((j) => j.id === hoverJob)?.techs.some((t) => t.user_id === p.id) : hoverUser ? hoverUser !== p.id : false;
              return (
                <div key={p.id} ref={(el) => { if (el) userEls.current.set(p.id, el); else userEls.current.delete(p.id); }}
                  onMouseEnter={() => setHoverUser(p.id)} onMouseLeave={() => setHoverUser(null)}
                  className={`group flex cursor-default items-center gap-2.5 rounded-xl border bg-white px-2.5 py-2 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(15,40,60,0.10)] ${dim ? "opacity-35" : ""}`}
                  style={{ borderColor: `${p.color}55`, borderLeft: `3px solid ${p.color}` }}>
                  <span className="relative">
                    <TechDot t={p} size={30} ring={false} />
                    {ld.active > 0 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#f59e0b] ring-2 ring-white animate-pulse" title="Working now" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-[#0b1f3a]">{p.name}</span>
                    <span className="hidden truncate text-[11.5px] text-slate-500 sm:block">{ld.total} job{ld.total === 1 ? "" : "s"}{ld.active ? ` · ${ld.active} active` : ""}</span>
                  </span>
                  <span className="hidden rounded-full px-1.5 text-[11.5px] font-bold text-white sm:inline-block" style={{ background: GROUP_TONE.assigned }}>{ld.total}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
