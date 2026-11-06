import { JobStatus, Priority, SiteAddress, TechChip, VisitStatus } from "@/lib/jobs";

// =====================================================================
// Centro de Operaciones (Paso 5.3)
// Un trabajo cae en uno de 5 grupos. El % de avance y "Retrasado" se calculan
// aquí con el reloj del navegador, así cambian solos sin recargar.
// =====================================================================
export type OpsVisit = {
  id: string; visit_no: number; status: VisitStatus; starts_at: string | null; ends_at: string | null; arrival_window_min: number;
  on_my_way_at: string | null; started_at: string | null; finished_at: string | null;
};
export type OpsJob = {
  id: string; number: string; title: string | null; status: JobStatus; priority: Priority;
  customer_id: string | null; customer_name: string; customer_phone: string | null; site_address: SiteAddress;
  type_name: string | null; type_color: string | null; hold_reason: string | null; needs_followup: boolean;
  estimated_total: number; created_at: string; completed_at: string | null; invoiced_at: string | null; paid_at: string | null;
  visit: OpsVisit | null; techs: TechChip[];
  checklist_total: number; checklist_done: number; photos: number; visits_total: number; visits_done: number;
};

export type OpsGroup = "unassigned" | "assigned" | "in_progress" | "delayed" | "done";
export const OPS_GROUPS: { id: OpsGroup; label: string; hint: string; tone: string; dot: string }[] = [
  { id: "unassigned", label: "Unassigned", hint: "No collaborator yet", tone: "#64748b", dot: "bg-slate-400" },
  { id: "assigned", label: "Assigned", hint: "Ready to go", tone: "#2563eb", dot: "bg-[#2563eb]" },
  { id: "in_progress", label: "In progress", hint: "On the way or working", tone: "#d97706", dot: "bg-[#f59e0b]" },
  { id: "delayed", label: "Delayed", hint: "Late start or over time", tone: "#e11d48", dot: "bg-[#e11d48]" },
  { id: "done", label: "Completed", hint: "Finished jobs", tone: "#0f766e", dot: "bg-[#14a39a]" },
];

const MIN = 60000;
const GRACE_MIN = 10; // minutos de gracia antes de marcar "retrasado"
const fmtLate = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ""}`);

// ¿Va tarde? · no llegó a tiempo (ya pasó la ventana de llegada) · se pasó de la hora de terminar
export function delayOf(j: OpsJob, now = Date.now()): { label: string; detail: string; minutes: number } | null {
  const v = j.visit;
  if (!v || j.status === "completed" || j.status === "cancelled") return null;
  if ((v.status === "scheduled" || v.status === "on_my_way") && v.starts_at) {
    const due = new Date(v.starts_at).getTime() + (v.arrival_window_min || 0) * MIN;
    const late = Math.floor((now - due) / MIN);
    if (late >= GRACE_MIN) return { label: `Late ${fmtLate(late)}`, detail: v.status === "on_my_way" ? "On the way, past the arrival window" : "Hasn't started — past the arrival window", minutes: late };
  }
  if ((v.status === "in_progress" || v.status === "paused") && v.ends_at) {
    const over = Math.floor((now - new Date(v.ends_at).getTime()) / MIN);
    if (over >= GRACE_MIN) return { label: `Over ${fmtLate(over)}`, detail: "Still working past the scheduled end", minutes: over };
  }
  return null;
}

// % de avance ponderado (mientras llegan las fases por industria del Paso 5.4):
// asignado 10 · agendado 20 · en camino 30 · empezó 45 · checklist hasta +40 · terminado 100
export function progressOf(j: OpsJob): number {
  if (j.status === "completed") return 100;
  const v = j.visit;
  const checklist = j.checklist_total ? j.checklist_done / j.checklist_total : 0;
  let p = 0;
  if (j.techs.length) p = 10;
  if (v?.starts_at) p = Math.max(p, 20);
  if (v?.status === "on_my_way") p = 30;
  if (v?.status === "in_progress" || v?.status === "paused") p = 45 + Math.round(checklist * 40);
  if (j.status === "on_hold") p = Math.max(p, 45 + Math.round(checklist * 35));
  // Varias visitas: cuenta lo que ya se terminó
  if (j.visits_total > 1) p = Math.max(p, Math.round((j.visits_done / j.visits_total) * 90));
  return Math.min(p, 95);
}

export function groupOf(j: OpsJob, now = Date.now()): OpsGroup {
  if (j.status === "completed") return "done";
  const s = j.visit?.status;
  const working = s === "on_my_way" || s === "in_progress" || s === "paused";
  // Sin nadie asignado SIEMPRE va a "Sin asignar" (aunque ya vaya tarde: ahí se ve la etiqueta roja)
  if (!j.techs.length && !working) return "unassigned";
  if (delayOf(j, now)) return "delayed";
  if (working || j.status === "on_hold") return "in_progress";
  return "assigned";
}

export const STAGE_LABEL = (j: OpsJob): string => {
  if (j.status === "completed") return j.paid_at ? "Paid" : j.invoiced_at ? "Invoiced" : "Completed";
  const s = j.visit?.status;
  if (j.status === "on_hold" && s !== "scheduled") return "On hold";
  if (s === "on_my_way") return "On my way";
  if (s === "in_progress") return "Working";
  if (s === "paused") return "Paused";
  if (s === "scheduled") return "Scheduled";
  return j.techs.length ? "Not scheduled" : "Needs a collaborator";
};

export const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Tipo de trabajador y tarifas (Team)
export type WorkerType = "employee" | "subcontractor";
export type PayType = "hourly" | "per_job" | "percent" | "salary";
export const PAY_TYPES: { value: PayType; label: string; unit: string }[] = [
  { value: "hourly", label: "Hourly", unit: "per hour" },
  { value: "per_job", label: "Per job", unit: "per job" },
  { value: "percent", label: "% of the job", unit: "% of job total" },
  { value: "salary", label: "Salary", unit: "per year" },
];
export const WORKER_LABEL: Record<WorkerType, string> = { employee: "Employee", subcontractor: "Subcontractor" };
// Si no hay ajuste guardado: técnicos y dueño reciben trabajos; manager y oficina no
export const defaultReceives = (role: string) => role === "technician" || role === "owner";
