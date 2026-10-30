"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { MobileStats } from "@/lib/dashboard-server";
import { Insight, buildInsights, tipOfTheDay } from "@/lib/insights";
import { useCountUp } from "@/components/dashboard/MobileWidgets";

// =====================================================================
// Money insights — SOLO escritorio (el celular sigue con su tarjeta de siempre).
// Izquierda: lista compacta. Derecha: un panel tipo "notificación" que se abre
// con el consejo completo al pasar el mouse (y rota solo cada 7 s si no lo tocas).
// =====================================================================
type Tone = Insight["tone"] | "tip";
type Row = Omit<Insight, "tone"> & { tone: Tone };

const TONE: Record<Tone, { label: string; fg: string; soft: string; ring: string; grad: string; icon: string }> = {
  good: { label: "Good news", fg: "#047857", soft: "#ecfdf5", ring: "#a7f3d0", grad: "from-[#ecfdf5] via-white to-white", icon: "M5 12.5 9.5 17 19 7" },
  warn: { label: "Heads up", fg: "#c2410c", soft: "#fff7ed", ring: "#fed7aa", grad: "from-[#fff7ed] via-white to-white", icon: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" },
  bad: { label: "Action needed", fg: "#e11d48", soft: "#fff1f2", ring: "#fecdd3", grad: "from-[#fff1f2] via-white to-white", icon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9 9l6 6M15 9l-6 6" },
  info: { label: "Good to know", fg: "#2563eb", soft: "#eef6ff", ring: "#bfdbfe", grad: "from-[#eef6ff] via-white to-white", icon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01" },
  tip: { label: "Tip of the day", fg: "#0f766e", soft: "#e9f7f4", ring: "#99e2d4", grad: "from-[#e9f7f4] via-white to-white", icon: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" },
};
const $ = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v || 0);
const ROTATE_MS = 7000;

function Ico({ d, className = "h-[18px] w-[18px]" }: { d: string; className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

function Stat({ x }: { x: Row }) {
  const v = useCountUp(Math.abs(x.stat ?? 0), 800);
  if (x.stat === undefined) return null;
  const t = TONE[x.tone];
  const text = x.statKind === "pct" ? `${Math.round(v * 100)}%` : `${(x.stat ?? 0) < 0 ? "-" : ""}${$(v)}`;
  return (
    <div className="mt-4 inline-flex items-end gap-3 rounded-2xl border bg-white/80 px-4 py-3 shadow-sm backdrop-blur" style={{ borderColor: t.ring }}>
      <span className="text-[30px] font-bold leading-none tracking-tight tabular-nums" style={{ color: t.fg }}>{text}</span>
      {x.statLabel && <span className="pb-0.5 text-[12px] font-medium text-slate-500">{x.statLabel}</span>}
    </div>
  );
}

export default function DesktopInsights({ st }: { st: MobileStats }) {
  const rows: Row[] = useMemo(() => [
    ...buildInsights(st),
    { tone: "tip" as const, title: "Tip of the day", body: tipOfTheDay(), more: "A new tip shows up every day, based on what works for service businesses." },
  ], [st]);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [cycle, setCycle] = useState(0); // reinicia la barrita de progreso
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // Rota solita mientras no estés encima
  useEffect(() => {
    if (paused || rows.length < 2) return;
    timer.current = setTimeout(() => { setActive((a) => (a + 1) % rows.length); setCycle((c) => c + 1); }, ROTATE_MS);
    return () => clearTimeout(timer.current);
  }, [paused, active, rows.length, cycle]);

  const pick = (i: number) => { if (i !== active) { setActive(i); setCycle((c) => c + 1); } };
  const x = rows[Math.min(active, rows.length - 1)];
  const t = TONE[x.tone];

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="mb-4 flex items-center gap-3">
        <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#fff3e8] to-[#e9f7f4] text-[#e8713a]">
          <Ico d={TONE.tip.icon} className="h-5 w-5" />
          <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#e8713a] opacity-50" /><span className="relative inline-flex h-3 w-3 rounded-full border-2 border-white bg-[#e8713a]" /></span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold text-[#0b1f3a]">Money insights</p>
          <p className="text-[12px] text-slate-400">Updated with your numbers every day · hover one to read it</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[12px] font-semibold text-slate-600">{rows.length} {rows.length === 1 ? "insight" : "insights"}</span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* Lista compacta */}
        <ul className="space-y-1.5">
          {rows.map((r, i) => {
            const tt = TONE[r.tone]; const on = i === active;
            return (
              <li key={i}>
                <button type="button" onMouseEnter={() => pick(i)} onFocus={() => pick(i)} onClick={() => pick(i)}
                  className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border px-3 py-2.5 text-left transition-all duration-150 ${on ? "translate-x-1 bg-white shadow-[0_8px_22px_rgba(15,40,60,0.08)]" : "border-transparent bg-slate-50/80 hover:bg-white"}`}
                  style={on ? { borderColor: tt.ring } : undefined}>
                  <span className="absolute inset-y-2 left-0 w-1 rounded-r-full transition-all duration-200" style={{ background: tt.fg, opacity: on ? 1 : 0 }} />
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110" style={{ background: tt.soft, color: tt.fg }}><Ico d={tt.icon} className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-[#0b1f3a]">{r.title}</span>
                    <span className="block truncate text-[11.5px] font-medium" style={{ color: tt.fg }}>{tt.label}</span>
                  </span>
                  <svg viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 transition-all duration-200 ${on ? "translate-x-0 text-slate-500" : "-translate-x-1 text-slate-300 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"}`} fill="currentColor"><path d="M7.3 5.3a1 1 0 0 1 1.4 0l4 4a1 1 0 0 1 0 1.4l-4 4a1 1 0 0 1-1.4-1.4L10.6 10 7.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
                  {/* barrita que avanza mientras rota solo */}
                  {on && !paused && rows.length > 1 && <span key={cycle} className="absolute bottom-0 left-0 h-[2px] origin-left animate-[bp-progress_7s_linear_forwards]" style={{ background: tt.fg, width: "100%" }} />}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Panel grande (tipo notificación) */}
        <div className="relative min-h-[260px] overflow-hidden rounded-3xl border" style={{ borderColor: t.ring }}>
          <div className={`absolute inset-0 bg-gradient-to-br ${t.grad}`} />
          <span className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-60 blur-2xl animate-[bp-float_9s_ease-in-out_infinite]" style={{ background: t.soft }} />
          <span className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full opacity-40 blur-2xl animate-[bp-float_12s_ease-in-out_infinite_reverse]" style={{ background: t.ring }} />
          <div key={`${active}-${x.title}`} className="relative flex h-full flex-col p-6 animate-[bp-in-left_0.35s_cubic-bezier(.2,.8,.2,1)]">
            <div className="flex items-start gap-4">
              <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-[0_6px_18px_rgba(15,40,60,0.10)]" style={{ color: t.fg }}>
                <span className="absolute inset-0 rounded-2xl animate-[bp-share-ring_1.6s_ease-out_infinite]" style={{ boxShadow: `0 0 0 2px ${t.ring}` }} />
                <Ico d={t.icon} className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] font-bold uppercase tracking-[0.08em]" style={{ color: t.fg }}>{t.label}</p>
                <p className="mt-0.5 text-[20px] font-bold leading-snug text-[#0b1f3a]">{x.title}</p>
              </div>
            </div>
            <Stat x={x} />
            <p className="mt-4 max-w-2xl text-[14.5px] leading-relaxed text-slate-600">{x.body}</p>
            {x.more && (
              <p className="mt-3 flex max-w-2xl items-start gap-2 rounded-xl bg-white/70 px-3 py-2.5 text-[13.5px] leading-relaxed text-slate-600 backdrop-blur">
                <span className="mt-0.5 shrink-0" style={{ color: t.fg }}><Ico d={TONE.tip.icon} className="h-4 w-4" /></span>{x.more}
              </p>
            )}
            <div className="mt-auto flex items-center gap-3 pt-5">
              {x.href && (
                <Link prefetch={false} href={x.href}
                  className="group inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-semibold text-white shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md active:scale-95"
                  style={{ background: t.fg }}>
                  {x.cta}
                  <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1" fill="currentColor"><path d="M7.3 5.3a1 1 0 0 1 1.4 0l4 4a1 1 0 0 1 0 1.4l-4 4a1 1 0 0 1-1.4-1.4L10.6 10 7.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
                </Link>
              )}
              <span className="ml-auto flex gap-1.5">
                {rows.map((r, i) => (
                  <button key={i} type="button" aria-label={`Insight ${i + 1}`} onClick={() => pick(i)}
                    className="h-2 rounded-full transition-all duration-200" style={{ width: i === active ? 20 : 8, background: i === active ? t.fg : "#cbd5e1" }} />
                ))}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
