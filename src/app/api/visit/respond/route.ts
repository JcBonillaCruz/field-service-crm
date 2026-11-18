import { NextResponse, type NextRequest } from "next/server";
import { admin } from "@/lib/push";
import { brandOf, emailShell, pushToUsers, sendEmail, userEmails, whenText } from "@/lib/jobs-notify";
import { logNotice } from "@/lib/customer-notices";
import { linkState, visitByToken } from "@/lib/visit-link";
import { appOrigin } from "@/lib/team";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Paso 5.8 · El cliente confirma su cita o pide otro horario desde el enlace del recordatorio (no necesita cuenta).
// Confirmar: queda en la ficha del trabajo, sin ruido. Pedir otro horario: campana + push a la oficina y correo al dueño.
export async function POST(request: NextRequest) {
  const b = await request.json().catch(() => null) as { token?: string; action?: string; note?: string } | null;
  const action = b?.action === "confirm" ? "confirmed" : b?.action === "reschedule" ? "reschedule" : null;
  if (!b?.token || !action) return NextResponse.json({ result: "bad_request" }, { status: 400 });
  const db = admin();
  if (!db) return NextResponse.json({ result: "unavailable" }, { status: 503 });
  const v = await visitByToken(db, b.token);
  if (!v) return NextResponse.json({ result: "not_found" }, { status: 404 });
  const state = linkState(v);
  if (state !== "open") return NextResponse.json({ result: state });

  const note = action === "reschedule" ? (b.note ?? "").trim().slice(0, 500) || null : null;
  const same = v.customer_reply === action && (v.customer_reply_note ?? null) === note;
  if (same) return NextResponse.json({ result: action });
  const { error } = await db.from("job_visits").update({ customer_reply: action, customer_reply_at: new Date().toISOString(), customer_reply_note: note }).eq("id", v.id);
  if (error) return NextResponse.json({ result: "unavailable" }, { status: 503 });

  const job = v.jobs, who = job.customer_name || "The customer";
  await logNotice(db, {
    job, visitId: v.id, kind: "customer_reply", actor: { id: null, name: who },
    message: action === "confirmed" ? "Customer confirmed the appointment" : "Customer asked for another time", detail: note,
  });
  if (action === "reschedule") {
    const brand = await brandOf(db, job.company_id);
    const when = whenText(v, brand.timezone);
    const title = `📅 ${who} asked for another time`;
    const body = `${note ? `"${note}" · ` : ""}${when} · ${job.number}`;
    const { data: office } = await db.from("company_members").select("user_id, role").eq("company_id", job.company_id).in("role", ["owner", "manager", "office"]).eq("is_active", true);
    const ids = (office ?? []).map((o) => o.user_id as string);
    if (ids.length) {
      await db.from("job_notices").insert(ids.map((user_id) => ({ company_id: job.company_id, user_id, job_id: job.id, kind: "customer_reply", title, body })));
      await pushToUsers(db, job.company_id, ids, { title, body, url: `/dashboard/jobs/${job.id}`, tag: `cust-${v.id}` });
      const owners = (office ?? []).filter((o) => o.role === "owner").map((o) => o.user_id as string);
      const people = await userEmails(db, owners);
      const origin = appOrigin(request.headers.get("origin") || `https://${request.headers.get("host")}`);
      await Promise.all(Array.from(people.values()).map((p) => sendEmail({
        brand: { ...brand, companyName: "BrightPro" }, to: [p.email], subject: `${who} asked for another time · ${job.number}`,
        html: emailShell({
          brand: { ...brand, logoUrl: null, companyName: "BrightPro" }, heading: "A customer asked for another time",
          intro: `Hi ${p.name.split(" ")[0]}, ${who} can't make the appointment and asked to move it. Call them to set the new time.`,
          rows: [["Customer", who], ["Phone", job.customer_phone ?? ""], ["Appointment", when], ["Their note", note ?? ""], ["Job", `${job.number}${job.title ? ` · ${job.title}` : ""}`]],
          button: { label: "Open the job", url: `${origin}/dashboard/jobs/${job.id}` }, footer: `BrightPro · ${brand.companyName}`,
        }),
        text: `${who} asked for another time (${when}). ${note ?? ""}`,
      })));
    }
  }
  return NextResponse.json({ result: action });
}
