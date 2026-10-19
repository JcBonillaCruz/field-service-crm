"use client";

import { useEffect, useId, useRef, useState } from "react";

// Gráficas del dashboard de computadora: eje de dinero a la izquierda, fechas abajo, tooltip al pasar el mouse
export type XLabel = { label: string; sub?: string; title: string };
export type Series = { key: string; label: string; color: string; values: number[]; colors?: string[] };

const L = 52, R = 16, T = 16, B = 40; // márgenes del área de dibujo

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setW(Math.round(entries[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceScale(max: number, integer: boolean) {
  if (!(max > 0)) return integer ? { top: 5, step: 1 } : { top: 5000, step: 1000 };
  const raw = max / 5;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  let step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
  if (integer) step = Math.max(1, Math.round(step));
  return { top: Math.ceil(max / step) * step, step };
}

const axisLabel = (v: number) =>
  v >= 1e6 ? `${+(v / 1e6).toFixed(1)} M` : v >= 1000 ? `${+(v / 1000).toFixed(1)} K` : `${+v.toFixed(1)}`;

// Cada cuántas etiquetas de fecha mostrar (para que no se encimen)
export const autoEvery = (n: number, dense = false) => (n <= 7 ? 1 : n <= 13 ? (dense ? 2 : 3) : 5);

const seriesMax = (series: Series[]) =>
  Math.max(0, ...series.map((s) => Math.max(0, ...s.values.filter((v) => v > 0))));

function keyNav(e: React.KeyboardEvent, n: number, set: React.Dispatch<React.SetStateAction<number | null>>) {
  if (e.key === "ArrowRight") { e.preventDefault(); set((h) => (h === null ? 0 : Math.min(n - 1, h + 1))); }
  else if (e.key === "ArrowLeft") { e.preventDefault(); set((h) => (h === null ? n - 1 : Math.max(0, h - 1))); }
  else if (e.key === "Escape") set(null);
}

function Grid({ pw, ph, top, step }: { pw: number; ph: number; top: number; step: number }) {
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 1000; v += step) ticks.push(v);
  return (
    <g>
      {ticks.map((v) => {
        const y = T + ph - (v / top) * ph;
        return (
          <g key={String(v)}>
            <line x1={L} x2={L + pw} y1={y} y2={y} stroke={v === 0 ? "#cbd5e1" : "#e2e8f0"} strokeDasharray={v === 0 ? undefined : "3 4"} />
            <text x={L - 10} y={y} dy="0.32em" textAnchor="end" fontSize="11" fill="#64748b">{axisLabel(v)}</text>
          </g>
        );
      })}
      <line x1={L} x2={L} y1={T} y2={T + ph} stroke="#e2e8f0" />
    </g>
  );
}

function XAxis({ x, pos, ph, every }: { x: XLabel[]; pos: (i: number) => number; ph: number; every: number }) {
  return (
    <g>
      {x.map((b, i) => (i % every === 0 ? (
        <text key={i} x={pos(i)} y={T + ph + 18} textAnchor="middle" fontSize="11" fill="#64748b">
          {b.label}
          {b.sub && <tspan x={pos(i)} dy="13" fontSize="10" fill="#94a3b8">{b.sub}</tspan>}
        </text>
      ) : null))}
    </g>
  );
}

function Tip({ x, w, title, rows }: { x: number; w: number; title: string; rows: { label: string; color: string; value: string }[] }) {
  return (
    <div className="pointer-events-none absolute z-20 min-w-[190px] rounded-lg border border-slate-200 bg-white px-4 py-3 text-[13px] shadow-[0_12px_32px_rgba(15,40,60,0.14)]"
      style={{ top: T + 4, left: x, transform: x > w / 2 ? "translateX(calc(-100% - 14px))" : "translateX(14px)" }}>
      <p className="mb-2 border-b border-slate-100 pb-2 text-[14px] font-semibold text-[#0b1f3a]">{title}</p>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-2 text-slate-600"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />{r.label}</span>
            <span className="font-semibold tabular-nums text-[#0b1f3a]">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const barPath = (x: number, y: number, w: number, h: number) => {
  const r = Math.min(3, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
};

type ChartProps = {
  x: XLabel[];
  series: Series[];
  format: (v: number) => string;
  label: string;
  height?: number;
  every?: number;
  integer?: boolean;
  emptyText?: string | null;
  animKey?: string;
};

export function BarChart({ x, series, format, label, height = 300, every, integer = false, emptyText = "No data found.", animKey, wide = false }: ChartProps & { wide?: boolean }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const n = x.length, k = series.length;
  const max = seriesMax(series);
  const live = max > 0 || !emptyText;
  const { top, step } = niceScale(max, integer);
  const pw = Math.max(0, w - L - R), ph = height - T - B;
  const slot = n ? pw / n : 0, gap = 2;
  const bw = Math.max(2, Math.min(wide ? 34 : 14, (slot * (wide ? 0.42 : 0.6) - gap * (k - 1)) / k));
  const gw = bw * k + gap * (k - 1);
  const yOf = (v: number) => T + ph - (Math.min(v, top) / top) * ph;
  const center = (i: number) => L + (i + 0.5) * slot;

  return (
    <div ref={ref} className="relative rounded-md" style={{ height }} tabIndex={live ? 0 : -1} role="group"
      aria-label={`${label}. Use the arrow keys to read each value.`}
      onKeyDown={(e) => live && keyNav(e, n, setHover)} onBlur={() => setHover(null)}>
      {w > 0 && (
        <svg width={w} height={height} className="block">
          <Grid pw={pw} ph={ph} top={top} step={step} />
          {hover !== null && <rect x={L + hover * slot} y={T} width={slot} height={ph} fill="#f1f5f9" />}
          <g key={animKey}>
            {series.map((s, si) => s.values.map((v, i) => {
              if (!(v > 0)) return null;
              const y = yOf(v);
              return (
                <path key={`${s.key}-${i}`} d={barPath(center(i) - gw / 2 + si * (bw + gap), y, bw, T + ph - y)}
                  fill={s.colors?.[i] ?? s.color} className="bp-bar" style={{ animationDelay: `${i * 30}ms` }} />
              );
            }))}
          </g>
          <XAxis x={x} pos={center} ph={ph} every={every ?? autoEvery(n)} />
          {!live && emptyText && <text x={L + pw / 2} y={T + ph / 2} textAnchor="middle" fontSize="13" fill="#64748b">{emptyText}</text>}
          {live && (
            <rect x={L} y={T} width={pw} height={ph} fill="transparent" onMouseLeave={() => setHover(null)}
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setHover(Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left) / r.width) * n))));
              }} />
          )}
        </svg>
      )}
      {hover !== null && w > 0 && (
        <Tip x={center(hover)} w={w} title={x[hover].title}
          rows={series.map((s) => ({ label: s.label, color: s.colors?.[hover] ?? s.color, value: format(s.values[hover] || 0) }))} />
      )}
    </div>
  );
}

export function LineChart({ x, series, format, label, height = 300, every, integer = false, emptyText = "No data found.", animKey, area = false }: ChartProps & { area?: boolean }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId().replace(/:/g, "");
  const n = x.length;
  const max = seriesMax(series);
  const live = max > 0 || !emptyText;
  const { top, step } = niceScale(max, integer);
  const pw = Math.max(0, w - L - R), ph = height - T - B;
  const px = (i: number) => L + (n <= 1 ? pw / 2 : (i / (n - 1)) * pw);
  const py = (v: number) => T + ph - (Math.min(v, top) / top) * ph;
  const segments = (vals: number[]) => {
    const out: [number, number][][] = [];
    let cur: [number, number][] = [];
    vals.forEach((v, i) => {
      if (Number.isFinite(v)) cur.push([px(i), py(v)]);
      else if (cur.length) { out.push(cur); cur = []; }
    });
    if (cur.length) out.push(cur);
    return out;
  };
  const line = (pts: [number, number][]) => pts.map(([a, b], j) => `${j ? "L" : "M"}${a},${b}`).join("");

  return (
    <div ref={ref} className="relative rounded-md" style={{ height }} tabIndex={live ? 0 : -1} role="group"
      aria-label={`${label}. Use the arrow keys to read each value.`}
      onKeyDown={(e) => live && keyNav(e, n, setHover)} onBlur={() => setHover(null)}>
      {w > 0 && (
        <svg width={w} height={height} className="block">
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`${gid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.18" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          <Grid pw={pw} ph={ph} top={top} step={step} />
          {live && (
            <g key={animKey}>
              {series.map((s) => segments(s.values).map((pts, j) => (
                <g key={`${s.key}-${j}`}>
                  {area && pts.length > 1 && (
                    <path d={`${line(pts)}L${pts[pts.length - 1][0]},${T + ph}L${pts[0][0]},${T + ph}Z`} fill={`url(#${gid}-${s.key})`} />
                  )}
                  <path d={line(pts)} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="bp-line" />
                </g>
              )))}
            </g>
          )}
          {hover !== null && (
            <g>
              <line x1={px(hover)} x2={px(hover)} y1={T} y2={T + ph} stroke="#94a3b8" strokeDasharray="3 3" />
              {series.map((s) => Number.isFinite(s.values[hover]) && (
                <circle key={s.key} cx={px(hover)} cy={py(s.values[hover])} r="4.5" fill="#fff" stroke={s.color} strokeWidth="2.2" />
              ))}
            </g>
          )}
          <XAxis x={x} pos={px} ph={ph} every={every ?? autoEvery(n)} />
          {!live && emptyText && <text x={L + pw / 2} y={T + ph / 2} textAnchor="middle" fontSize="13" fill="#64748b">{emptyText}</text>}
          {live && (
            <rect x={L - 8} y={T} width={pw + 16} height={ph} fill="transparent" onMouseLeave={() => setHover(null)}
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const i = n <= 1 ? 0 : Math.round(((e.clientX - r.left - 8) / (r.width - 16)) * (n - 1));
                setHover(Math.max(0, Math.min(n - 1, i)));
              }} />
          )}
        </svg>
      )}
      {hover !== null && w > 0 && (
        <Tip x={px(hover)} w={w} title={x[hover].title}
          rows={series.map((s) => ({ label: s.label, color: s.color, value: Number.isFinite(s.values[hover]) ? format(s.values[hover]) : "—" }))} />
      )}
    </div>
  );
}

export function Donut({ items, colors, format, label }: { items: { label: string; value: number }[]; colors: string[]; format: (v: number) => string; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const sum = items.reduce((a, b) => a + b.value, 0) || 1;
  const size = 210, sw = 28, rad = (size - sw - 10) / 2, circ = 2 * Math.PI * rad;
  const active = hover !== null ? items[hover] : null;
  let acc = 0;
  return (
    <div className="flex w-full items-center gap-8" role="group" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke="#f1f5f9" strokeWidth={sw} />
          {items.map((it, i) => {
            const len = (it.value / sum) * circ;
            const seg = (
              <circle key={it.label} cx={size / 2} cy={size / 2} r={rad} fill="none" stroke={colors[i % colors.length]}
                strokeWidth={hover === i ? sw + 8 : sw} strokeDasharray={`${Math.max(0, len - 2)} ${circ}`} strokeDashoffset={-acc}
                opacity={hover === null || hover === i ? 1 : 0.4} className="cursor-pointer transition-all duration-150"
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
            );
            acc += len;
            return seg;
          })}
        </g>
        <text x="50%" y="45%" textAnchor="middle" fontSize="12" fill="#64748b">{active ? active.label : "Total"}</text>
        <text x="50%" y="57%" textAnchor="middle" fontSize="18" fontWeight="600" fill="#0b1f3a">{format(active ? active.value : sum)}</text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-0.5">
        {items.map((it, i) => (
          <li key={it.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${hover === i ? "bg-slate-50" : ""}`}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: colors[i % colors.length] }} />
            <span className="min-w-0 flex-1 truncate text-slate-600">{it.label}</span>
            <span className="font-semibold tabular-nums text-[#0b1f3a]">{format(it.value)}</span>
            <span className="w-10 text-right text-xs tabular-nums text-slate-400">{Math.round((it.value / sum) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
