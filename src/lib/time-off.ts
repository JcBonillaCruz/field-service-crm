// Paso 6.5: días libres del equipo (vacaciones, enfermedad, personal…). Tabla `team_time_off`.
import { addDays, dayStart, sameDay } from "@/lib/jobs";

export const OFF_KINDS = ["vacation", "sick", "personal", "training", "holiday", "other"] as const;
export type OffKind = (typeof OFF_KINDS)[number];

export type TimeOff = {
  id: string; company_id: string; user_id: string; kind: OffKind; all_day: boolean;
  starts_at: string; ends_at: string; note: string | null;
};

export const OFF_SELECT = "id, company_id, user_id, kind, all_day, starts_at, ends_at, note";

// Un color suave por motivo (solo para el puntito y el ícono; el bloque del calendario siempre es gris rayado)
export const OFF_COLOR: Record<OffKind, string> = {
  vacation: "#0ea5e9", sick: "#e11d48", personal: "#8b5cf6", training: "#f59e0b", holiday: "#10b981", other: "#64748b",
};

// Fondo rayado del bloque "de descanso"
export const OFF_HATCH = "repeating-linear-gradient(135deg, rgba(100,116,139,.10) 0, rgba(100,116,139,.10) 6px, rgba(248,250,252,.85) 6px, rgba(248,250,252,.85) 12px)";

export const overlaps = (o: Pick<TimeOff, "starts_at" | "ends_at">, a: Date, b: Date) => new Date(o.starts_at) < b && new Date(o.ends_at) > a;

// Días libres de una persona que tocan ese día
export function offsOn(offs: TimeOff[], day: Date, userId?: string | null) {
  const a = dayStart(day), b = addDays(a, 1);
  return offs.filter((o) => (!userId || o.user_id === userId) && overlaps(o, a, b));
}

// Último día que cubre (un día libre de todo el día termina a las 00:00 del día siguiente)
export function lastDay(o: Pick<TimeOff, "ends_at" | "all_day">) {
  const e = new Date(o.ends_at);
  return o.all_day || (e.getHours() === 0 && e.getMinutes() === 0) ? addDays(dayStart(e), -1) : dayStart(e);
}
export const isSingleDay = (o: Pick<TimeOff, "starts_at" | "ends_at" | "all_day">) => sameDay(new Date(o.starts_at), lastDay(o));
