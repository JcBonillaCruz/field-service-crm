import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { canManageSales, pdfOf } from "@/lib/sales";
import { loadDoc } from "@/lib/sales-server";
import { buildSalesPdf, pdfFileName } from "@/lib/sales-pdf";
import { emailHtml, ensureToken, pdfInputFrom } from "@/lib/sales-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { id: string; to: string[]; cc?: string[]; bcc?: string[]; subject: string; body: string; attachPdf?: boolean; fileIds?: string[]; reminder?: boolean };
const okEmail = (e: string) => /^\S+@\S+\.\S+$/.test(e);

// Manda el correo de verdad (Resend) con el PDF adjunto y el pixel para saber si lo abrió
export async function POST(request: NextRequest) {
  const { supabase, current, user } = await getSession();
  if (!current || !canManageSales(current.role)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const key = process.env.RESEND_API_KEY;
  const fromAddr = process.env.SALES_FROM_EMAIL;
  if (!key || !fromAddr) return NextResponse.json({ error: "Email sending isn't set up yet. Add RESEND_API_KEY and SALES_FROM_EMAIL in Vercel.", code: "not_configured" }, { status: 501 });

  let b: Body;
  try { b = await request.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const to = (b.to ?? []).map((e) => e.trim()).filter(Boolean);
  const cc = (b.cc ?? []).map((e) => e.trim()).filter(Boolean);
  const bcc = (b.bcc ?? []).map((e) => e.trim()).filter(Boolean);
  if (!to.length || [...to, ...cc, ...bcc].some((e) => !okEmail(e))) return NextResponse.json({ error: "Check the email addresses." }, { status: 400 });
  if (!b.subject?.trim()) return NextResponse.json({ error: "Enter a subject." }, { status: 400 });

  const { data: row } = await supabase.from("sales_docs").select("kind").eq("id", b.id).eq("company_id", current.id).maybeSingle();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const d = await loadDoc(supabase, current.id, row.kind, b.id);
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const token = await ensureToken(supabase, d.doc);
  if (!token) return NextResponse.json({ error: "The link couldn't be created. Did you run the SQL for Paso 3.31?" }, { status: 500 });

  const origin = request.headers.get("origin") || `https://${request.headers.get("host")}`;
  const link = `${origin}/share/${token}`;
  const attachments: { filename: string; content: string }[] = [];
  if (b.attachPdf !== false) {
    const bytes = await buildSalesPdf(pdfInputFrom(d));
    attachments.push({ filename: pdfFileName(d.doc), content: Buffer.from(bytes).toString("base64") });
  }
  for (const f of d.files.filter((x) => (b.fileIds ?? []).includes(x.id))) {
    const { data: blob } = await supabase.storage.from("sales-attachments").download(f.path);
    if (blob) attachments.push({ filename: f.name, content: Buffer.from(await blob.arrayBuffer()).toString("base64") });
  }
  const accent = pdfOf(d.prefs.pdf_settings).accent === "#2f3437" ? "#0f766e" : pdfOf(d.prefs.pdf_settings).accent;
  const html = emailHtml({ body: b.body, link, pixel: `${origin}/api/track/${token}.gif`, doc: d.doc, companyName: d.companyName, logoUrl: d.prefs.logo_url, accent, whiteLabel: d.prefs.white_label });
  // Sale como "BrightPro"; con marca blanca (plan pagado) sale con el nombre de la compañía
  // Como Zoho: sale con el nombre de quien lo manda (ej. "Juan Bonilla Cruz"), desde la dirección de BrightPro
  const senderName = (user.fullName || user.email.split("@")[0] || d.companyName || "BrightPro").replace(/[<>"]/g, "");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${senderName} <${fromAddr}>`, to, cc: cc.length ? cc : undefined, bcc: bcc.length ? bcc : undefined,
      reply_to: d.prefs.org_info?.email || user.email, subject: b.subject.trim(), html,
      text: b.body.replace(/\{link\}/g, link), attachments: attachments.length ? attachments : undefined,
    }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    return NextResponse.json({ error: `The email couldn't be sent: ${(j as { message?: string }).message ?? res.statusText}` }, { status: 502 });
  }
  const now = new Date().toISOString();
  await supabase.from("sales_docs").update({
    emails: to, last_email_at: now, sent_at: d.doc.sent_at ?? now, updated_at: now, ...(d.doc.status === "draft" ? { status: "sent" } : {}),
  }).eq("id", d.doc.id);
  const noun = d.doc.kind === "quote" ? "Quote" : "Invoice";
  await supabase.from("sales_activity").insert({
    company_id: current.id, entity: d.doc.kind, entity_id: d.doc.id, actor_name: user.fullName || user.email,
    message: b.reminder ? `Payment reminder emailed to ${to.join(", ")}` : `${noun} emailed to ${to.join(", ")}`,
    detail: attachments.length ? `Attachments: ${attachments.map((a) => a.filename).join(", ")}` : null,
  });
  return NextResponse.json({ ok: true });
}
