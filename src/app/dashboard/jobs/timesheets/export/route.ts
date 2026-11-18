import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { canManageJobs, TeamMember } from "@/lib/jobs";
import { checkExportBody, exportResponse, fileBase } from "@/lib/export-file";
import { TimeEntry, byDay, hoursDec, needsTimeSql } from "@/lib/timesheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  scope?: "all" | "view" | "period"; ids?: string[]; period?: { from?: string; to?: string }; range?: { from?: string; to?: string };
  format?: "csv" | "xlsx"; password?: string; tz?: string;
};
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const safeTz = (tz: string | undefined, fallback: string) => {
  for (const z of [tz, fallback, "America/Chicago"]) { try { if (z) { new Intl.DateTimeFormat("en-US", { timeZone: z }); return z; } } catch { /* siguiente */ } }
  return "UTC";
};

// Exportar Timesheets (mismo pop-up de siempre): una fila por persona y día + un total por persona.
// Horas en decimal (7.75) para que la nómina las pueda sumar.
export async function POST(request: NextRequest) {
  const { supabase, current } = await getSession();
  if (!current || !canManageJobs(current.role)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  let body: Body = {};
  try { body = await request.json(); } catch { /* valores por defecto */ }
  const format = body.format === "xlsx" ? "xlsx" : "csv";
  const password = (body.password ?? "").trim();
  const bad = checkExportBody(format, password);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });

  const { data: settings } = await supabase.from("job_settings").select("timezone").eq("company_id", current.id).maybeSingle();
  const tz = safeTz(body.tz, String(settings?.timezone ?? ""));
  const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  const clock = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(iso)) : "");

  // Periodo: el de la pantalla, el que escribió, o los últimos 12 meses
  const pick = body.scope === "view" ? body.range : body.scope === "period" ? body.period : undefined;
  const todayKey = dayKey(new Date().toISOString());
  const yearAgo = dayKey(new Date(Date.now() - 365 * 86400000).toISOString());
  const fromKey = pick?.from && ISO_DAY.test(pick.from) ? pick.from : yearAgo;
  const toKey = pick?.to && ISO_DAY.test(pick.to) ? pick.to : todayKey;
  if (fromKey > toKey) return NextResponse.json({ error: "The start date must be before the end date." }, { status: 400 });
  // Un día de margen a cada lado (zona horaria); luego se filtra por el día exacto
  const qFrom = new Date(new Date(`${fromKey}T00:00:00Z`).getTime() - 86400000).toISOString();
  const qTo = new Date(new Date(`${toKey}T00:00:00Z`).getTime() + 2 * 86400000).toISOString();

  const [rows, team] = await Promise.all([
    supabase.rpc("timesheet_entries", { p_company: current.id, p_from: qFrom, p_to: qTo }),
    supabase.rpc("job_team", { p_company: current.id }),
  ]);
  if (rows.error) return NextResponse.json({ error: needsTimeSql(rows.error) ? "Run paso-5.7-timesheets.sql in Supabase first." : "The export failed. Please try again." }, { status: 500 });
  const members = new Map(((team.data ?? []) as TeamMember[]).map((m) => [m.user_id, m]));
  const only = body.scope === "view" && body.ids?.length ? new Set(body.ids) : null;
  const now = Date.now();

  const byUser = new Map<string, TimeEntry[]>();
  for (const e of (rows.data ?? []) as TimeEntry[]) {
    if (only && !only.has(e.user_id)) continue;
    const k = dayKey(e.started_at);
    if (k < fromKey || k > toKey) continue;
    byUser.set(e.user_id, [...(byUser.get(e.user_id) ?? []), e]);
  }
  const people = Array.from(byUser.keys()).sort((a, b) => (members.get(a)?.full_name ?? "").localeCompare(members.get(b)?.full_name ?? ""));

  const matrix: unknown[][] = [[
    "Team Member", "Role", "Date", "Day", "Clock In", "Clock Out", "Hours Worked", "On-site Hours", "Travel Hours", "Other Hours", "Jobs", "Job Numbers", "Corrected", "Correction Notes",
  ]];
  for (const uid of people) {
    const m = members.get(uid);
    const name = m?.full_name ?? "Former team member";
    const role = m ? `${m.job_title || m.role}${m.worker_type === "subcontractor" ? " (subcontractor)" : ""}` : "";
    const days = Array.from(byDay(byUser.get(uid) ?? [], now, dayKey).values()).sort((a, b) => a.key.localeCompare(b.key));
    const t = { worked: 0, site: 0, travel: 0, other: 0, jobs: 0 };
    for (const d of days) {
      const date = new Date(`${d.key}T12:00:00Z`);
      const numbers = Array.from(new Set(d.entries.map((e) => e.job_number).filter(Boolean))).join(", ");
      const notes = Array.from(new Set(d.entries.filter((e) => e.edited_at || e.is_manual)
        .map((e) => `${e.is_manual ? "Added" : "Corrected"} by ${e.edited_by_name ?? "office"}${e.fix_reason ? `: ${e.fix_reason}` : ""}`))).join(" | ");
      matrix.push([
        name, role, d.key, date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }),
        clock(d.firstIn), d.stale ? "MISSED CLOCK-OUT" : d.open ? "Still clocked in" : clock(d.lastOut),
        hoursDec(d.worked), hoursDec(d.site), hoursDec(d.travel), hoursDec(d.other), d.jobs, numbers, d.edited ? "Yes" : "", notes,
      ]);
      t.worked += d.worked; t.site += d.site; t.travel += d.travel; t.other += d.other; t.jobs += d.jobs;
    }
    matrix.push([name, role, "TOTAL", `${days.length} day${days.length === 1 ? "" : "s"}`, "", "", hoursDec(t.worked), hoursDec(t.site), hoursDec(t.travel), hoursDec(t.other), t.jobs, "", "", ""]);
  }
  return exportResponse(matrix, `${fileBase("timesheets", current.name)}_${fromKey}_to_${toKey}`, format, password, "Timesheets");
}
