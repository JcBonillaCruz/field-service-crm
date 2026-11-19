import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { canManageJobs, TeamMember } from "@/lib/jobs";
import { checkExportBody, exportResponse, fileBase } from "@/lib/export-file";
import { hoursDec } from "@/lib/timesheets";
import { NOBODY, RawReport, buildParts, buildTeam, needsReportSql } from "@/lib/job-reports";

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
// La medianoche de ese día en la zona horaria de la persona, como instante exacto
function tzMidnight(day: string, tz: string): Date {
  const guess = new Date(`${day}T00:00:00Z`);
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(guess).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return new Date(guess.getTime() - (asUtc - guess.getTime()));
}
const nextDay = (day: string) => new Date(new Date(`${day}T12:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);

// Exportar Reports (mismo pop-up de siempre). ?kind=team → una fila por colaborador · ?kind=parts → una fila por pieza sin escanear.
// El dinero sale solo para quien lo puede ver: la base de datos no se lo entrega a nadie más.
export async function POST(request: NextRequest) {
  const { supabase, current } = await getSession();
  if (!current || !canManageJobs(current.role)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const kind = request.nextUrl.searchParams.get("kind") === "parts" ? "parts" : "team";
  let body: Body = {};
  try { body = await request.json(); } catch { /* valores por defecto */ }
  const format = body.format === "xlsx" ? "xlsx" : "csv";
  const password = (body.password ?? "").trim();
  const bad = checkExportBody(format, password);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });

  const { data: settings } = await supabase.from("job_settings").select("timezone").eq("company_id", current.id).maybeSingle();
  const tz = safeTz(body.tz, String(settings?.timezone ?? ""));
  const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const dayOf = (iso: string | null) => (iso ? dayKey(new Date(iso)) : "");

  // Periodo: el de la pantalla, el que escribió, o los últimos 12 meses
  const pick = body.scope === "view" ? body.range : body.scope === "period" ? body.period : undefined;
  const fromKey = pick?.from && ISO_DAY.test(pick.from) ? pick.from : dayKey(new Date(Date.now() - 365 * 86400000));
  const toKey = pick?.to && ISO_DAY.test(pick.to) ? pick.to : dayKey(new Date());
  if (fromKey > toKey) return NextResponse.json({ error: "The start date must be before the end date." }, { status: 400 });

  const [rep, team] = await Promise.all([
    supabase.rpc("job_reports", { p_company: current.id, p_from: tzMidnight(fromKey, tz).toISOString(), p_to: tzMidnight(nextDay(toKey), tz).toISOString() }),
    supabase.rpc("job_team", { p_company: current.id }),
  ]);
  if (rep.error) return NextResponse.json({ error: needsReportSql(rep.error) ? "Run paso-5.10-reports.sql in Supabase first." : "The export failed. Please try again." }, { status: 500 });
  const raw = rep.data as RawReport;
  const members = (team.data ?? []) as TeamMember[];
  const only = body.scope === "view" && body.ids?.length ? new Set(body.ids) : null;
  const roleOf = (m: TeamMember | null) => (m ? `${m.job_title || m.role}${m.worker_type === "subcontractor" ? " (subcontractor)" : ""}` : "");
  const base = `${fileBase(kind === "team" ? "team-performance" : "unscanned-parts", current.name)}_${fromKey}_to_${toKey}`;

  if (kind === "team") {
    const rows = buildTeam(raw, members).rows.filter((r) => !only || only.has(r.user_id));
    const matrix: unknown[][] = [[
      "Team Member", "Role", "Jobs Completed", "Visits Worked", "Return Visits", "Need Follow-up", "Visits With A Set Time", "On Time", "Late", "On Time %", "Avg Minutes Late",
      "On-site Hours", "Avg On-site Hours Per Job", "Travel Hours", "Clocked Hours", "Hours Not On A Job", "Time On Jobs %",
      ...(raw.money ? ["Revenue (before tax)"] : []), ...(raw.owner ? ["Labor Cost", "Pay Note"] : []),
    ]];
    for (const r of rows) {
      matrix.push([
        r.name, roleOf(r.member), r.jobsDone, r.visits, r.returns, r.held, r.measured, r.onTime, r.late, r.onTimePct ?? "", r.lateMinAvg,
        hoursDec(r.siteMin), hoursDec(r.avgSiteMin), hoursDec(r.travelMin), hoursDec(r.shiftMin), hoursDec(r.idleMin), r.utilPct ?? "",
        ...(raw.money ? [r.revenue ?? 0] : []), ...(raw.owner ? [r.labor ?? 0, r.noRate ? "No pay rate" : r.salaried ? "Salary" : ""] : []),
      ]);
    }
    return exportResponse(matrix, base, format, password, "Team performance");
  }

  const rows = buildParts(raw, members).rows.filter((r) => !only || only.has(r.user_id));
  const matrix: unknown[][] = [[
    "Team Member", "Role", "Type", "Date", "Job", "Customer", "Part", "SKU", "Charged Qty", "Scanned Qty", "Not Scanned Qty", "On Invoice", "Collaborators On Job",
    ...(raw.money ? ["Value"] : []),
  ]];
  for (const r of rows) {
    const name = r.user_id === NOBODY ? "No collaborator" : r.name, role = roleOf(r.member);
    for (const l of r.lines) {
      matrix.push([name, role, "Not scanned", dayOf(l.when), l.number, l.customer, l.name, l.sku ?? "", l.billed, l.scanned, l.missing, l.onInvoice ? "Yes" : "No", l.shared, ...(raw.money ? [l.value ?? 0] : [])]);
    }
    for (const j of r.noScan) {
      matrix.push([name, role, "Finished with no part scanned", dayOf(j.when), j.number, j.customer, "", "", "", "", "", "", "", ...(raw.money ? [j.revenue ?? 0] : [])]);
    }
    if (r.countUnits > 0) {
      matrix.push([name, role, "Missing in counts", "", "", "", "", "", "", "", r.countUnits, "", "", ...(raw.money ? [r.countValue ?? 0] : [])]);
    }
  }
  return exportResponse(matrix, base, format, password, "Unscanned parts");
}
