import { NextResponse, type NextRequest } from "next/server";
import { addressText, admin, brandOf, emailShell, pushToUsers, sendEmail, timeRange, userEmails } from "@/lib/jobs-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cada tarde (Vercel Cron): a cada técnico le llega "Tus trabajos de mañana" (campana + push + correo)
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  const db = admin();
  if (!db) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is missing" }, { status: 500 });
  const origin = `https://${request.headers.get("host")}`;
  const { data: companies } = await db.from("job_settings").select("company_id, timezone").eq("notify_tech_agenda", true).limit(2000);
  let sent = 0;
  for (const c of companies ?? []) {
    const tz = (c.timezone as string) || "America/Chicago";
    const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString("en-CA", { timeZone: tz });
    const dayOf = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: tz });
    const from = new Date(Date.now() - 86400000).toISOString(), to = new Date(Date.now() + 3 * 86400000).toISOString();
    const { data: visits } = await db.from("job_visits")
      .select("id, visit_no, starts_at, ends_at, arrival_window_min, status, jobs!inner ( id, number, title, customer_name, site_address, cancelled_at ), job_visit_techs ( user_id )")
      .eq("company_id", c.company_id).eq("status", "scheduled").gte("starts_at", from).lt("starts_at", to).order("starts_at");
    type Row = { id: string; visit_no: number; starts_at: string; ends_at: string; arrival_window_min: number; jobs: { id: string; number: string; title: string | null; customer_name: string; site_address: Record<string, string | null> | null; cancelled_at: string | null }; job_visit_techs: { user_id: string }[] };
    const rows = ((visits ?? []) as unknown as Row[]).filter((v) => dayOf(v.starts_at) === tomorrow && !v.jobs.cancelled_at);
    const byTech = new Map<string, Row[]>();
    rows.forEach((v) => v.job_visit_techs.forEach((t) => byTech.set(t.user_id, [...(byTech.get(t.user_id) ?? []), v])));
    if (!byTech.size) continue;
    const key = `agenda-${c.company_id}-${tomorrow}`;
    const { error: dup } = await db.from("push_log").insert({ key, company_id: c.company_id });
    if (dup) continue; // ya se mandó hoy
    const brand = await brandOf(db, c.company_id);
    const people = await userEmails(db, Array.from(byTech.keys()));
    const dayLabel = new Date(rows[0].starts_at).toLocaleDateString("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" });
    for (const [uid, list] of Array.from(byTech.entries())) {
      const title = `Tomorrow: ${list.length} job${list.length === 1 ? "" : "s"}`;
      const first = list[0];
      const body = `${dayLabel} · first at ${new Date(first.starts_at).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" })} (${first.jobs.customer_name})`;
      await db.from("job_notices").insert({ company_id: c.company_id, user_id: uid, kind: "agenda", title, body });
      sent += await pushToUsers(db, c.company_id, [uid], { title, body, url: "/dashboard/jobs/mine", tag: `agenda-${tomorrow}` });
      const p = people.get(uid);
      if (p) {
        await sendEmail({
          brand, to: [p.email], subject: `Your jobs for ${dayLabel}`,
          html: emailShell({
            brand, heading: `Your jobs for ${dayLabel}`, intro: `Hi ${p.name.split(" ")[0]}, here is your schedule for tomorrow.`,
            rows: list.map((v) => [timeRange(v, tz), `${v.jobs.customer_name}${v.jobs.title ? ` · ${v.jobs.title}` : ""}${addressText(v.jobs.site_address) ? ` · ${addressText(v.jobs.site_address)}` : ""}`] as [string, string]),
            button: { label: "Open my jobs", url: `${origin}/dashboard/jobs/mine` },
          }),
          text: list.map((v) => `${timeRange(v, tz)} ${v.jobs.customer_name} ${addressText(v.jobs.site_address)}`).join("\n"),
        });
      }
    }
  }
  return NextResponse.json({ ok: true, sent });
}
