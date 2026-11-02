import { Role } from "@/lib/types";

// =====================================================================
// Team (Paso 4.3): miembros de la compañía, roles e invitaciones
// =====================================================================
export type Member = {
  user_id: string; full_name: string; email: string; avatar_url: string | null; role: Role;
  is_active: boolean; job_title: string | null; phone: string | null; joined_at: string | null;
  last_seen_at?: string | null; last_active_at?: string | null; last_sign_in_at?: string | null;
};

// Conexión: verde = usando la app ahora · naranja = la app abierta pero sin moverse · rojo = desconectado
export type Presence = { tone: "on" | "idle" | "off"; label: string; detail: string };
const ago = (ms: number) => {
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
};
export function presenceOf(m: Pick<Member, "last_seen_at" | "last_active_at" | "last_sign_in_at">, now = Date.now()): Presence {
  const seen = m.last_seen_at ? now - new Date(m.last_seen_at).getTime() : Infinity;
  const active = m.last_active_at ? now - new Date(m.last_active_at).getTime() : Infinity;
  if (seen < 3 * 60000 && active < 3 * 60000) return { tone: "on", label: "Active now", detail: "Using BrightPro right now" };
  if (seen < 3 * 60000) return { tone: "idle", label: `Idle · ${ago(active)}`, detail: active === Infinity ? "App open, not active" : `App open · last activity ${ago(active)}` };
  if (seen !== Infinity) return { tone: "off", label: `Offline · ${ago(seen)}`, detail: `Last seen ${new Date(m.last_seen_at as string).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` };
  return { tone: "off", label: m.last_sign_in_at ? `Offline · ${ago(now - new Date(m.last_sign_in_at).getTime())}` : "Never signed in", detail: m.last_sign_in_at ? "Signed in before presence tracking" : "Hasn't opened the app yet" };
}
export const PRESENCE_DOT: Record<Presence["tone"], string> = { on: "bg-[#22c55e]", idle: "bg-[#f59e0b]", off: "bg-[#e11d48]" };
export type Invite = {
  id: string; email: string; full_name: string | null; role: Exclude<Role, "owner">; job_title: string | null; phone: string | null;
  token: string; invited_by_name: string | null; created_at: string; expires_at: string; accepted_at: string | null; revoked_at: string | null;
};

export const canManageTeam = (role: Role | null | undefined) => role === "owner" || role === "manager";

// Qué puede hacer cada rol (se muestra al invitar y al editar)
export const ROLE_INFO: Record<Role, { label: string; text: string; can: string[]; tone: string }> = {
  owner: { label: "Owner", text: "Full access, including billing and the team.", can: ["Everything in every app", "Billing and subscription", "Add or remove owners"], tone: "bg-[#0b1f3a] text-white" },
  manager: { label: "Manager", text: "Runs the business day to day.", can: ["Customers, quotes, invoices, payments", "Inventory, vans, counts and reports", "Invite office staff and technicians"], tone: "bg-[#eef2ff] text-[#4338ca]" },
  office: { label: "Office", text: "Front desk and dispatch.", can: ["Customers, quotes and invoices", "Inventory: add stock, transfers, counts", "No team, billing or company settings"], tone: "bg-[#eef6ff] text-[#2563eb]" },
  technician: { label: "Technician", text: "Works in the field.", can: ["Only their own van and its parts", "Scan the parts they use on a job", "Only the jobs assigned to them (Jobs app)"], tone: "bg-[#fff4ec] text-[#c2410c]" },
};

// Dirección pública de la app (ej. https://app.brightproapp.com). Se pone en Vercel como NEXT_PUBLIC_APP_URL;
// si no existe, se usa la dirección desde donde se abrió la app.
export const appOrigin = (fallback: string) => (process.env.NEXT_PUBLIC_APP_URL || fallback).replace(/\/+$/, "");
export const inviteLink = (origin: string, token: string) => `${appOrigin(origin)}/join/${token}`;

// Contraseña temporal fácil de dictar por teléfono (ej. Bright-4821-kp)
export function tempPassword() {
  const n = Math.floor(1000 + Math.random() * 9000);
  const a = "abcdefghjkmnpqrstuvwxyz";
  return `Bright-${n}-${a[Math.floor(Math.random() * a.length)]}${a[Math.floor(Math.random() * a.length)]}`;
}

export function teamError(e: { message?: string; code?: string; hint?: string } | null | undefined): string {
  if (!e) return "";
  const m = `${e.message ?? ""} ${e.hint ?? ""}`;
  if (m.includes("LAST_OWNER")) return "The company needs at least one active owner.";
  if (m.includes("SELF")) return e.hint || "You can't do that to yourself.";
  if (m.includes("NO_ACCESS")) return e.hint || "You don't have permission to do this.";
  if (m.includes("company_invites_pending_email") || e.code === "23505") return "This email already has a pending invitation. Resend it from Invitations.";
  if (m.includes("INVITE_EXPIRED")) return "This invitation expired. Ask for a new one.";
  if (m.includes("INVITE_REVOKED")) return "This invitation was cancelled.";
  if (m.includes("INVITE_USED")) return "This invitation was already used by another account.";
  if (m.includes("INVITE_NOT_FOUND")) return "This invitation doesn't exist.";
  if (m.includes("does not exist") || m.includes("Could not find the function")) return "Run the SQL for Paso 4.3 (Team) in Supabase first.";
  return "Something went wrong. Try again.";
}

export const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");
