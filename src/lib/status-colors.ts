// =====================================================================
// Paso 6.4: paleta suave por estado (trabajos y cotizaciones)
// Un solo color base por estado; el fondo pastel, el borde y el texto oscuro salen de ese color.
// La compañía puede cambiarlos en Settings → Status colors (job_settings.status_colors).
// =====================================================================
import type { CalVisit } from "@/lib/jobs";
import type { OpsGroup } from "@/lib/operations";

export const JOB_STATUS_KEYS = ["unscheduled", "scheduled", "on_my_way", "in_progress", "paused", "on_hold", "completed", "cancelled"] as const;
export const QUOTE_STATUS_KEYS = ["draft", "sent", "viewed", "accepted", "declined", "expired", "invoiced"] as const;
export type JobColorKey = (typeof JOB_STATUS_KEYS)[number];
export type QuoteColorKey = (typeof QUOTE_STATUS_KEYS)[number];

export type StatusPalette = { job: Record<JobColorKey, string>; quote: Record<QuoteColorKey, string> };
// Lo que se guarda en la base: solo lo que la compañía cambió ({ job: { scheduled: "#..." }, quote: {...} })
export type StoredPalette = { job?: Partial<Record<JobColorKey, string>>; quote?: Partial<Record<QuoteColorKey, string>> } | null;

export const DEFAULT_PALETTE: StatusPalette = {
  job: {
    unscheduled: "#94a3b8", // gris
    scheduled: "#3b82f6",   // azul
    on_my_way: "#8b5cf6",   // morado
    in_progress: "#f59e0b", // ámbar
    paused: "#ec4899",      // rosa
    on_hold: "#e11d48",     // rojo suave
    completed: "#16a34a",   // verde
    cancelled: "#64748b",   // gris oscuro
  },
  quote: {
    draft: "#94a3b8", sent: "#3b82f6", viewed: "#8b5cf6", accepted: "#16a34a", declined: "#e11d48", expired: "#f59e0b", invoiced: "#0d9488",
  },
};

// Colores que se ofrecen en el selector (suaves y que se distinguen entre sí)
export const PALETTE_CHOICES = [
  "#94a3b8", "#64748b", "#3b82f6", "#0ea5e9", "#06b6d4", "#14b8a6",
  "#0d9488", "#10b981", "#16a34a", "#84cc16", "#eab308", "#f59e0b",
  "#f97316", "#e8713a", "#ef4444", "#e11d48", "#ec4899", "#d946ef",
  "#a855f7", "#8b5cf6", "#6366f1", "#1e3a8a", "#78350f", "#1f2937",
];

const HEX = /^#[0-9a-f]{6}$/i;
export function mergePalette(stored: StoredPalette | undefined): StatusPalette {
  const out: StatusPalette = { job: { ...DEFAULT_PALETTE.job }, quote: { ...DEFAULT_PALETTE.quote } };
  if (!stored || typeof stored !== "object") return out;
  for (const k of JOB_STATUS_KEYS) { const c = stored.job?.[k]; if (c && HEX.test(c)) out.job[k] = c.toLowerCase(); }
  for (const k of QUOTE_STATUS_KEYS) { const c = stored.quote?.[k]; if (c && HEX.test(c)) out.quote[k] = c.toLowerCase(); }
  return out;
}
// Para guardar: solo lo que es distinto de los colores de fábrica
export function diffPalette(p: StatusPalette): NonNullable<StoredPalette> {
  const job: Partial<Record<JobColorKey, string>> = {}, quote: Partial<Record<QuoteColorKey, string>> = {};
  for (const k of JOB_STATUS_KEYS) if (p.job[k] !== DEFAULT_PALETTE.job[k]) job[k] = p.job[k];
  for (const k of QUOTE_STATUS_KEYS) if (p.quote[k] !== DEFAULT_PALETTE.quote[k]) quote[k] = p.quote[k];
  return { job, quote };
}

// ---------- Tonos derivados del color base ----------
function rgb(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "")?.[1] ?? "94a3b8";
  const n = parseInt(m, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
}
export const soft = (hex: string, a: number) => { const [r, g, b] = rgb(hex); return `rgba(${r}, ${g}, ${b}, ${a})`; };
// Texto oscuro del mismo color (se lee bien sobre el fondo pastel)
export function deep(hex: string, k = 0.58) {
  const [r, g, b] = rgb(hex);
  const c = (v: number) => Math.round(v * k + 15 * (1 - k));
  return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
}
// Píldora / etiqueta: fondo pastel + texto oscuro + aro suave
export const pillStyle = (hex: string): React.CSSProperties => ({ background: soft(hex, 0.13), color: deep(hex), boxShadow: `inset 0 0 0 1px ${soft(hex, 0.28)}` });

// ¿Qué color le toca a una visita del calendario?
export function visitColorKey(v: Pick<CalVisit, "visit_status" | "job_status">): JobColorKey {
  if (v.job_status === "cancelled" || v.visit_status === "cancelled") return "cancelled";
  return (JOB_STATUS_KEYS as readonly string[]).includes(v.visit_status) ? (v.visit_status as JobColorKey) : "scheduled";
}

// Grupos de Operations ↔ estados (Por facturar se queda en el naranja de la marca)
export function groupTones(p: StatusPalette): Record<OpsGroup, string> {
  return {
    unassigned: p.job.unscheduled, assigned: p.job.scheduled, in_progress: p.job.in_progress,
    delayed: p.job.on_hold, to_invoice: "#e8713a", done: p.job.completed,
  };
}
