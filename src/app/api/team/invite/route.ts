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
      // Correo personal y sencillo (como si lo escribiera el dueño): ayuda a que Gmail lo ponga en "Principal" y no en "Promociones".
      // Sin imágenes ni diseño de anuncio, con versión de solo texto y "Responder" va directo al dueño.
      const note = (b.note ?? "").trim().slice(0, 600);
      const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;max-width:560px">
        <p>Hi ${first},</p>
        ${note ? `<p>${esc(note).replace(/\n/g, "<br>")}</p>` : `<p>I added you to ${company} on BrightPro as ${esc(role)}. This is where we'll handle our work${invite.role === "technician" ? ", jobs and the parts in your van" : ""}.</p>`}
        <p>To get started, open this link and create your password:<br><a href="${link}">${link}</a></p>
        <p>The link works for 14 days. If you have any question, just reply to this email.</p>
        <p>Thanks,<br>${who}<br>${company}</p></div>`;
      const text = `Hi ${(invite.full_name ?? "").split(" ")[0] || "there"},\n\n${note || `I added you to ${current.name} on BrightPro as ${role}.`}\n\nTo get started, open this link and create your password:\n${link}\n\nThe link works for 14 days. If you have any question, just reply to this email.\n\nThanks,\n${user.fullName || ""}\n${current.name}`;
      const sender = (process.env.TEAM_FROM_EMAIL || from);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${(user.fullName || current.name).replace(/[<>"]/g, "")} via BrightPro <${sender}>`, to: [invite.email],
          reply_to: user.email ? [user.email] : undefined,
          subject: `${user.fullName ? user.fullName.split(" ")[0] : current.name} added you to ${current.name}`,
          html, text, headers: { "X-Entity-Ref-ID": invite.id },
        }),
      }).catch(() => null);
      emailed = Boolean(res?.ok);
      if (!emailed) emailNote = "The email couldn't be sent. Share the link instead.";
    }
  }
  return NextResponse.json({ ok: true, link, emailed, emailNote, id: invite.id });
}
