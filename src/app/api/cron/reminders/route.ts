import { NextResponse, type NextRequest } from "next/server";
import { admin, pushToCompany } from "@/lib/push";
import { SalesDoc, balanceOf, daysBetween, money, today } from "@/lib/sales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Corre solo todos los días (Vercel Cron): facturas que vencen en 2 días, 1 día, hoy o ya vencidas
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  const db = admin();
  if (!db) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is missing" }, { status: 500 });
  const t = today();
  const { data } = await db.from("sales_docs").select("*").eq("kind", "invoice").not("status", "in", "(draft,void,paid,written_off)").not("due_date", "is", null).limit(5000);
  let sent = 0;
  for (const d of ((data ?? []) as SalesDoc[]).filter((x) => balanceOf(x) > 0 && !x.reminders_stopped)) {
    const days = daysBetween(t, d.due_date!);
    const when = days === 2 ? "is due in 2 days" : days === 1 ? "is due tomorrow" : days === 0 ? "is due today" : [-1, -3, -7, -14, -30].includes(days) ? `is overdue by ${-days} ${days === -1 ? "day" : "days"}` : null;
    if (!when) continue;
    const key = `due-${d.id}-${t}`;
    const { error } = await db.from("push_log").insert({ key, company_id: d.company_id });
    if (error) continue; // ya se avisó hoy
    sent += await pushToCompany(d.company_id, {
      title: days < 0 ? `⚠️ Invoice ${d.number} ${when}` : `⏰ Invoice ${d.number} ${when}`,
      body: `${d.customer_name} · ${money(balanceOf(d))} due`, url: `/dashboard/invoices/${d.id}`, tag: `due-${d.id}`,
    });
  }
  await db.from("push_log").delete().lt("created_at", new Date(Date.now() - 30 * 86400000).toISOString());
  return NextResponse.json({ ok: true, sent });
}
