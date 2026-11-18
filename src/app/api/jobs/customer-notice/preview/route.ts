import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { canManageJobs } from "@/lib/jobs";
import { admin, brandOf } from "@/lib/jobs-notify";
import { cnSettings, noticeHtml } from "@/lib/customer-notices";
import { CnKind, clockText, dayText, noticeCopy } from "@/lib/customer-notice-text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Paso 5.8 · Vista previa del correo (con datos de ejemplo) para Jobs → Settings → Customer notices
export async function GET(request: NextRequest) {
  const { current } = await getSession();
  if (!current || !canManageJobs(current.role)) return new NextResponse("Not allowed", { status: 403 });
  const db = admin();
  if (!db) return new NextResponse("Not available", { status: 503 });
  const q = request.nextUrl.searchParams;
  const kind = (["on_my_way", "reminder", "review"].includes(q.get("kind") ?? "") ? q.get("kind") : "reminder") as CnKind;
  const lang = q.get("lang") === "es" ? "es" : "en";
  const [brand, cn, { data: prefs }] = await Promise.all([brandOf(db, current.id), cnSettings(db, current.id), db.from("sales_prefs").select("org_info").eq("company_id", current.id).maybeSingle()]);
  const days = cn?.cn_reminder_days === 2 ? 2 : 1;
  const visit = new Date(Date.now() + days * 86400000); visit.setUTCMinutes(0, 0, 0);
  const tz = brand.timezone;
  const copy = noticeCopy(kind, lang, {
    company: brand.companyName, customer: lang === "es" ? "María" : "Mary", tech: "Luis", service: "AC Tune-Up", address: "1234 Main St, Dallas, TX 75201", number: "JOB-000123",
    day: dayText(visit.toISOString(), tz, lang), arrival: `${clockText(visit, tz, lang)} – ${clockText(new Date(visit.getTime() + 3600000), tz, lang)}`, daysAway: days,
    eta: clockText(new Date(Date.now() + 30 * 60000), tz, lang), companyPhone: ((prefs?.org_info as { phone?: string } | null)?.phone ?? "").trim() || null,
    confirmUrl: "#", changeUrl: "#", reviewUrl: cn?.review_url || "#", customReview: lang === "es" ? cn?.review_msg_es : cn?.review_msg_en,
  });
  return new NextResponse(noticeHtml(brand, copy), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Subject": encodeURIComponent(copy.subject) } });
}
