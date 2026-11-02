import { Role } from "@/lib/types";

// =====================================================================
// Jobs & Schedule (Paso 5.2)
// JOB = el trabajo completo · VISIT = cada cita en el calendario (un job puede tener varias)
// =====================================================================
export type JobStatus = "unscheduled" | "scheduled" | "on_my_way" | "in_progress" | "on_hold" | "completed" | "cancelled";
export type VisitStatus = "unscheduled" | "scheduled" | "on_my_way" | "in_progress" | "paused" | "on_hold" | "completed" | "cancelled";
export type CalView = "day" | "week" | "workweek" | "month" | "dispatch";
export type Priority = "low" | "normal" | "high" | "urgent";

export type SiteAddress = { label?: string | null; street?: string | null; unit?: string | null; city?: string | null; state?: string | null; zip?: string | null; country?: string | null } | null;
export type TechChip = { user_id: string; name: string; initials: string; color: string; avatar_url: string | null; is_lead: boolean };
export type TagChip = { id: string; name: string; color: string };

export type CalVisit = {
  visit_id: string; job_id: string; company_id: string; visit_no: number; starts_at: string; ends_at: string; arrival_window_min: number;
  visit_status: VisitStatus; job_status: JobStatus; number: string; title: string | null; description: string | null;
  customer_id: string | null; customer_name: string; customer_phone: string | null; address_id: string | null; site_address: SiteAddress;
  estimated_total: number; priority: Priority; job_type_id: string | null; type_name: string | null; type_color: string | null; form_kind: string | null;
  visit_count: number; hold_reason: string | null; techs: TechChip[]; tech_ids: string[]; tags: TagChip[];
};

// Fila de la bandeja "Unscheduled / On hold" (y de la lista de Jobs)
export type JobRow = {
  id: string; company_id: string; number: string; customer_id: string | null; customer_name: string; customer_phone: string | null;
  address_id: string | null; site_address: SiteAddress; job_type_id: string | null; title: string | null; description: string | null;
  office_notes: string | null; tech_notes: string | null; priority: Priority; status: JobStatus; estimated_total: number;
  source: string; quote_id: string | null; invoice_id: string | null; visit_count: number;
  hold_reason: string | null; hold_note: string | null; hold_at: string | null; hold_by_name: string | null; needs_followup: boolean;
  cancelled_at: string | null; cancelled_by_name: string | null; cancel_reason: string | null; created_at: string; created_by_name: string | null;
  type_name: string | null; type_color: string | null; form_kind: string | null;
  next_visit_id: string | null; next_start: string | null; next_end: string | null; last_start: string | null; job_date: string;
  techs: TechChip[]; tech_ids: string[]; tags: TagChip[]; invoice_status: string | null; invoice_number: string | null;
};

export type JobSettings = {
  company_id: string; job_prefix: string; job_next: number; tech_can_see_prices: boolean; default_duration_min: number;
  default_arrival_window_min: number; day_start: string; day_end: string; week_starts_on: number; slot_minutes: 15 | 30 | 60;
  auto_clock_in: boolean; require_gps_on_start: boolean;
};
export type JobType = { id: string; name: string; color: string; default_duration_min: number; form_kind: "work" | "tune_up"; position: number; is_active: boolean };
export type JobTag = { id: string; name: string; color: string };
export type TeamMember = { user_id: string; full_name: string; initials: string; avatar_url: string | null; role: Role; color: string; has_van: boolean };
export type ChecklistTemplate = { id: string; name: string; job_type_id: string | null; items: { label: string; required: boolean }[] };

export const DEFAULT_SETTINGS: Omit<JobSettings, "company_id"> = {
  job_prefix: "JOB-", job_next: 1, tech_can_see_prices: true, default_duration_min: 120, default_arrival_window_min: 60,
  day_start: "07:00", day_end: "19:00", week_starts_on: 0, slot_minutes: 30, auto_clock_in: true, require_gps_on_start: true,
};

export const canManageJobs = (role: Role | null | undefined) => role === "owner" || role === "manager" || role === "office";

// Estados: nombre, colores suaves (fondo/texto/punto) y el ícono del paso
export const STATUS_META: Record<JobStatus, { label: string; badge: string; dot: string }> = {
  unscheduled: { label: "Unscheduled", badge: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400" },
  scheduled: { label: "Scheduled", badge: "bg-[#eef4ff] text-[#2563eb] ring-[#d6e4ff]", dot: "bg-[#2563eb]" },
  on_my_way: { label: "On My Way", badge: "bg-[#f3efff] text-[#6d28d9] ring-[#e2d9ff]", dot: "bg-[#7c3aed]" },
  in_progress: { label: "In Progress", badge: "bg-[#fff6e6] text-[#b45309] ring-[#fde3b4]", dot: "bg-[#f59e0b]" },
  on_hold: { label: "On Hold", badge: "bg-[#fff1f2] text-[#be123c] ring-[#fecdd3]", dot: "bg-[#e11d48]" },
  completed: { label: "Completed", badge: "bg-[#e7f6f1] text-[#0f766e] ring-[#bfe6da]", dot: "bg-[#14a39a]" },
  cancelled: { label: "Cancelled", badge: "bg-slate-100 text-slate-500 ring-slate-200 line-through", dot: "bg-slate-300" },
};
export const VISIT_LABEL: Record<VisitStatus, string> = {
  unscheduled: "Unscheduled", scheduled: "Scheduled", on_my_way: "On My Way", in_progress: "In Progress", paused: "Paused",
  on_hold: "Left for follow-up", completed: "Completed", cancelled: "Cancelled",
};
export const STATUS_ORDER: JobStatus[] = ["unscheduled", "scheduled", "on_my_way", "in_progress", "on_hold", "completed", "cancelled"];

export const HOLD_REASONS: { value: string; label: string }[] = [
  { value: "waiting_part", label: "Waiting for a part" },
  { value: "out_of_time", label: "Ran out of time" },
  { value: "customer_request", label: "Customer asked to come back" },
  { value: "needs_approval", label: "Needs customer approval" },
  { value: "weather", label: "Weather" },
  { value: "other", label: "Other" },
];
export const holdLabel = (v: string | null | undefined) => HOLD_REASONS.find((r) => r.value === v)?.label ?? "On hold";

export const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "#94a3b8" },
  { value: "normal", label: "Normal", color: "#14a39a" },
  { value: "high", label: "High", color: "#f59e0b" },
  { value: "urgent", label: "Urgent", color: "#e11d48" },
];

export const ARRIVAL_WINDOWS = [0, 30, 60, 120, 180, 240];
export const arrivalLabel = (m: number) => (m === 0 ? "Exact time" : m < 60 ? `${m} min` : `${m / 60} hour${m === 60 ? "" : "s"}`);

export const TECH_COLORS = ["#2563eb", "#e11d48", "#0f766e", "#7c3aed", "#f59e0b", "#0891b2", "#db2777", "#65a30d", "#ea580c", "#4f46e5", "#475569", "#92400e"];
export const UNASSIGNED_COLOR = "#94a3b8";

// ---------- Fechas (hora local del navegador) ----------
const pad = (n: number) => String(n).padStart(2, "0");
export const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
export const addMinutes = (d: Date, n: number) => new Date(d.getTime() + n * 60000);
export const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromIsoDay = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
export const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();
export const timeToMin = (t: string) => { const [h, m] = (t || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
export const minToTime = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
export const atMinute = (day: Date, min: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, min);
export const startOfWeek = (d: Date, weekStartsOn = 0) => { const s = dayStart(d); return addDays(s, -((s.getDay() - weekStartsOn + 7) % 7)); };
export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

export const fmtTime = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
export const fmtHour = (min: number) => { const h = Math.floor(min / 60) % 24; return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`; };
export const fmtRange = (a: Date, b: Date) => `${fmtTime(a)} – ${fmtTime(b)}`;
export const fmtDayLong = (d: Date) => d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
export const fmtDayShort = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
export const durationLabel = (min: number) => { const h = Math.floor(min / 60), m = min % 60; return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`; };

// Días visibles de cada vista
export function viewDays(view: CalView, anchor: Date, weekStartsOn: number): Date[] {
  if (view === "day" || view === "dispatch") return [dayStart(anchor)];
  if (view === "workweek") { const mon = startOfWeek(anchor, 1); return [0, 1, 2, 3, 4].map((i) => addDays(mon, i)); }
  if (view === "week") { const s = startOfWeek(anchor, weekStartsOn); return [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(s, i)); }
  const first = startOfWeek(startOfMonth(anchor), weekStartsOn);
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}
export function shiftAnchor(view: CalView, anchor: Date, dir: -1 | 1): Date {
  if (view === "month") return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
  if (view === "week" || view === "workweek") return addDays(anchor, 7 * dir);
  return addDays(anchor, dir);
}
export function rangeLabel(view: CalView, anchor: Date, weekStartsOn: number): string {
  if (view === "month") return anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  if (view === "day" || view === "dispatch") return anchor.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" });
  const days = viewDays(view, anchor, weekStartsOn);
  const a = days[0], b = days[days.length - 1];
  const sameMonth = a.getMonth() === b.getMonth();
  return `${a.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${b.toLocaleDateString("en-US", sameMonth ? { day: "numeric", year: "numeric" } : { month: "short", day: "numeric", year: "numeric" })}`;
}

export const addressLine = (a: SiteAddress) => (a ? [a.street, a.unit, a.city, [a.state, a.zip].filter(Boolean).join(" ")].filter((x) => x && String(x).trim()).join(", ") : "");
export const mapsLink = (a: SiteAddress) => { const q = addressLine(a); return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null; };
export const usd = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(v) || 0);

// Color con transparencia (para el fondo suave de la barra)
export function tint(hex: string, alpha: number) {
  const h = /^#?([0-9a-f]{6})$/i.exec(hex || "")?.[1] ?? "94a3b8";
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${alpha})`;
}
export const leadOf = (techs: TechChip[]) => techs.find((t) => t.is_lead) ?? techs[0] ?? null;
export const barColor = (v: { techs: TechChip[] }) => leadOf(v.techs)?.color ?? UNASSIGNED_COLOR;

// Mensajes claros para los errores de la base de datos
export function jobError(e: { message?: string; code?: string; hint?: string } | null | undefined): string {
  if (!e) return "";
  const m = `${e.message ?? ""} ${e.hint ?? ""}`;
  const hinted = ["VISIT_CLOSED", "BAD_TIME", "JOB_CANCELLED", "VISIT_STARTED", "BAD_TECH", "BAD_ADDRESS", "REASON_REQUIRED", "NOTE_REQUIRED", "QUOTE_NOT_ACCEPTED", "CHECKLIST_REQUIRED", "GPS_REQUIRED", "OTHER_JOB_OPEN", "NO_VAN", "BAD_STEP"];
  if (hinted.some((k) => m.includes(k)) && e.hint) return e.hint;
  if (m.includes("NO_ACCESS")) return e.hint || "You don't have permission to do this.";
  if (m.includes("NOT_FOUND")) return "This job no longer exists. Refresh the page.";
  if (m.includes("BAD_CUSTOMER")) return "Choose a customer from your list.";
  if (m.includes("BAD_COLOR")) return "Pick a valid color.";
  if (m.includes("job_types_name_uniq") || m.includes("job_tags_name_uniq") || e.code === "23505") return "That name is already in use.";
  if (m.includes("does not exist") || m.includes("Could not find the function")) return "Run the SQL for Paso 5.1 (Jobs) in Supabase first.";
  return "Something went wrong. Try again.";
}
