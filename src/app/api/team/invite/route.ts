import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { canManageTeam, inviteLink, teamError, ROLE_INFO } from "@/lib/team";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { email?: string; full_name?: string; role?: string; job_title?: string; phone?: string; send?: boolean; resend?: string; note?: string };
const okEmail = (e: string) => /^\S+@\S+\.\S+$/.test(e);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

// Crear (o reenviar) una invitación. Devuelve el enlace para compartir por WhatsApp/mensaje y, si se puede, la manda por correo.
export async function POST(request: NextRequest) {
  const { supabase, current, user } = await getSession();
  if (!current || !canManageTeam(current.role)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  let b: Body = {};
  try { b = await request.json(); } catch { /* */ }
  const origin = request.headers.get("origin") || new URL(request.url).origin;

  let invite: { id: string; email: string; full_name: string | null; role: string; token: string } | null = null;
  if (b.resend) {
    const { data, error } = await supabase.from("company_invites")
      .update({ expires_at: new Date(Date.now() + 14 * 86400000).toISOString() })
      .eq("id", b.resend).eq("company_id", current.id).is("accepted_at", null).is("revoked_at", null)
      .select("id, email, full_name, role, token").single();
    if (error || !data) return NextResponse.json({ error: teamError(error) }, { status: 400 });
    invite = data;
  } else {
    const email = (b.email ?? "").trim().toLowerCase();
    if (!okEmail(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    if (!b.full_name?.trim()) return NextResponse.json({ error: "Enter the person's name." }, { status: 400 });
    if (!["manager", "office", "technician"].includes(b.role ?? "")) return NextResponse.json({ error: "Choose a role." }, { status: 400 });
    if (b.role === "manager" && current.role !== "owner") return NextResponse.json({ error: "Only the owner can invite managers." }, { status: 403 });
    // ¿Ya es miembro?
    const { data: members } = await supabase.rpc("team_members", { p_company: current.id });
    if (((members ?? []) as { email: string }[]).some((m) => m.email?.toLowerCase() === email)) {
      return NextResponse.json({ error: "This person is already on your team." }, { status: 400 });
    }
    const { data, error } = await supabase.from("company_invites").insert({
      company_id: current.id, email, full_name: b.full_name.trim(), role: b.role, job_title: b.job_title?.trim() || null,
      phone: b.phone?.trim() || null, invited_by: user.id, invited_by_name: user.fullName || user.email,
    }).select("id, email, full_name, role, token").single();
    if (error || !data) return NextResponse.json({ error: teamError(error) }, { status: 400 });
    invite = data;
  }

  const link = inviteLink(origin, invite.token);
  let emailed = false, emailNote = "";
  if (b.send !== false) {
    const key = process.env.RESEND_API_KEY, from = process.env.SALES_FROM_EMAIL;
    if (!key || !from) emailNote = "Email isn't set up yet (RESEND_API_KEY / SALES_FROM_EMAIL). Share the link instead.";
    else {
      const company = esc(current.name), who = esc(user.fullName || "Your team"), first = esc((invite.full_name ?? "").split(" ")[0] || "there");
      const role = ROLE_INFO[invite.role as keyof typeof ROLE_INFO]?.label ?? invite.role;
      // Correo con la marca de la compañía (logo + nombre), limpio y personal: sin colores de anuncio, una sola acción,
      // versión de solo texto y "Responder" va al dueño. Así Gmail lo trata como correo normal y no como promoción.
      const note = (b.note ?? "").trim().slice(0, 600);
      const roleLine = invite.role === "technician" ? "your jobs and the parts in your van" : "our customers, quotes and invoices";
      const logo = current.logoUrl ? `<img src="${esc(current.logoUrl)}" alt="${company}" style="max-height:52px;max-width:200px;display:block;margin:0 0 18px">` : `<p style="margin:0 0 18px;font-size:18px;font-weight:bold;color:#0b1f3a">${company}</p>`;
      const html = `<div style="background:#f6f7f9;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
        <div style="max-width:540px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px 30px;color:#1f2937;font-size:15px;line-height:1.6">
          ${logo}
          <p style="margin:0 0 14px">Hi ${first},</p>
          ${note ? `<p style="margin:0 0 14px">${esc(note).replace(/\n/g, "<br>")}</p>` : `<p style="margin:0 0 14px">You've been added to the <b>${company}</b> team as <b>${esc(role)}</b>. We use BrightPro to manage ${roleLine}.</p>`}
          <p style="margin:0 0 22px">Create your account to get started:</p>
          <p style="margin:0 0 22px"><a href="${link}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:8px">Create my account</a></p>
          <p style="margin:0 0 6px;font-size:13px;color:#6b7280">Or open this link: <a href="${link}" style="color:#0f766e;word-break:break-all">${link}</a></p>
          <p style="margin:0 0 22px;font-size:13px;color:#6b7280">It works for 14 days. Questions? Just reply to this email.</p>
          <p style="margin:0">${who}<br><span style="color:#6b7280">${company}</span></p>
        </div>
        <p style="max-width:540px;margin:12px auto 0;text-align:center;font-size:11.5px;color:#9ca3af">Sent by ${company} with BrightPro</p></div>`;
      const text = `Hi ${(invite.full_name ?? "").split(" ")[0] || "there"},\n\n${note || `You've been added to the ${current.name} team as ${role}. We use BrightPro to manage ${roleLine}.`}\n\nCreate your account to get started:\n${link}\n\nIt works for 14 days. Questions? Just reply to this email.\n\n${user.fullName || ""}\n${current.name}`;
      const sender = (process.env.TEAM_FROM_EMAIL || from);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${current.name.replace(/[<>"]/g, "")} <${sender}>`, to: [invite.email],
          reply_to: user.email ? [user.email] : undefined,
          subject: `${current.name} invited you to join the team`,
          html, text, headers: { "X-Entity-Ref-ID": invite.id },
        }),
      }).catch(() => null);
      emailed = Boolean(res?.ok);
      if (!emailed) emailNote = "The email couldn't be sent. Share the link instead.";
    }
  }
  return NextResponse.json({ ok: true, link, emailed, emailNote, id: invite.id });
}
