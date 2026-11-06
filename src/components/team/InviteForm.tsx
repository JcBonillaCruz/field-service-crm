"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { confirmDelete } from "@/lib/confirm";
import { ROLE_INFO } from "@/lib/team";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTeamBase } from "@/components/team/useTeamBase";
import { Role, formatPhone } from "@/lib/types";
import { inputClass } from "@/components/customers/ui";
import { FormHeader, FormRow, SaveBar, SectionTitle } from "@/components/catalog/FormBits";
import RoleCards from "@/components/team/RoleCards";
import ShareInvite from "@/components/team/ShareInvite";
import { tempPassword } from "@/lib/team";

// Invitar a alguien: pantalla completa (menú + formulario). Al terminar: enlace para WhatsApp / mensaje y correo.
type Existing = { id: string; email: string; name: string; role: string };
type PendingInv = { id: string; email: string; full_name: string | null; created_at: string };

export default function InviteForm({ myRole, companyName, initialRole, members: initialMembers = [], invites: initialInvites = [] }: {
  myRole: Role; companyName: string; initialRole: Exclude<Role, "owner">; members?: Existing[]; invites?: PendingInv[];
}) {
  const router = useRouter();
  const base = useTeamBase();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(initialRole);
  const [job, setJob] = useState("");
  const [phone, setPhone] = useState("");
  const [send, setSend] = useState(true);
  // Dos formas: invitación (la persona crea su contraseña) o crear su login ya (contraseña temporal que cambia al entrar)
  const [mode, setMode] = useState<"invite" | "create">("invite");
  const [note, setNote] = useState("");
  const [pass, setPass] = useState(() => tempPassword());
  const [creds, setCreds] = useState<{ loginUrl: string; email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  // Antes de enviar: pantalla para revisar los datos. Y aviso si ese correo ya está en el equipo o ya tiene invitación.
  const [review, setReview] = useState(false);
  const [members, setMembers] = useState(initialMembers);
  const [pending, setPending] = useState(initialInvites);
  const emailKey = email.trim().toLowerCase();
  const dupMember = emailKey ? members.find((m) => m.email?.toLowerCase() === emailKey) : undefined;
  const dupInvite = emailKey ? pending.find((i) => i.email.toLowerCase() === emailKey) : undefined;
  async function cancelInvite(id: string) {
    const { error: err } = await createClient().from("company_invites").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    if (err) return setError("The invitation couldn't be cancelled.");
    setPending((l) => l.filter((i) => i.id !== id)); setError("");
  }
  async function removeExisting(m: Existing) {
    if (!(await confirmDelete({ title: `Remove ${m.name} from the team?`, message: "If they don't belong to any other company, their login is deleted too, so you can add them again from zero." }))) return;
    const res = await fetch("/api/team/remove", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: m.id }) }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return setError(data.error || "It couldn't be removed.");
    setMembers((l) => l.filter((x) => x.id !== m.id)); setError("");
  }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ link: string; emailed: boolean; emailNote: string } | null>(null);
  const roles: Role[] = myRole === "owner" ? ["technician", "office", "manager"] : ["technician", "office"];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Enter the person's name.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address.");
    if (dupMember) return setError("This email is already on your team.");
    if (dupInvite) return setError("This email already has a pending invitation. Cancel it first to send a new one.");
    if (!review) { if (mode === "create" && pass.trim().length < 8) return setError("The temporary password needs at least 8 characters."); setError(""); setReview(true); return; }
    if (mode === "create" && pass.trim().length < 8) return setError("The temporary password needs at least 8 characters.");
    setSaving(true); setError("");
    const body = { full_name: name.trim(), email: email.trim(), role, job_title: job.trim(), phone: phone.trim() };
    const res = await fetch(mode === "invite" ? "/api/team/invite" : "/api/team/create-account", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mode === "invite" ? { ...body, send, note } : { ...body, password: pass.trim() }) }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setSaving(false);
    if (!res?.ok) { setReview(false); return setError(data.error || "It couldn't be saved. Try again."); }
    if (mode === "invite") setDone({ link: data.link, emailed: data.emailed, emailNote: data.emailNote });
    else setCreds({ loginUrl: data.loginUrl, email: data.email, password: data.password });
  }

  if (creds) {
    const msg = `Hi ${name.split(" ")[0]}! This is your BrightPro login for ${companyName}:\n${creds.loginUrl}\nEmail: ${creds.email}\nTemporary password: ${creds.password}\nThe first time you sign in you'll create your own password.`;
    const btn = "flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-[14.5px] font-medium text-slate-700 transition-colors hover:border-[#14a39a] hover:text-[#0f766e]";
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-white">
        <FormHeader title="Login created" closeHref={base} />
        <div className="mx-auto w-full max-w-lg px-5 py-10">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e7f6f1] text-[#0f766e]">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5zM12 15v2" /></svg>
          </span>
          <h2 className="mt-4 text-center text-xl font-semibold text-[#0b1f3a]">{name.split(" ")[0]} can sign in now</h2>
          <p className="mt-1 text-center text-[14.5px] text-slate-500">Send these details. The first time {name.split(" ")[0]} signs in, BrightPro asks for a new password, so only they will know it.</p>
          <dl className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200 text-[14.5px]">
            {[["Sign in at", creds.loginUrl], ["Email", creds.email], ["Temporary password", creds.password]].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 px-4 py-3"><dt className="text-slate-500">{k}</dt><dd className="truncate font-mono font-semibold text-[#0b1f3a]">{v}</dd></div>
            ))}
          </dl>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => { navigator.clipboard?.writeText(msg); setCopied(true); setTimeout(() => setCopied(false), 1600); }} className={btn}>{copied ? "Copied ✓" : "Copy details"}</button>
            <a href={`https://wa.me/${phone.replace(/\D/g, "") ? `1${phone.replace(/\D/g, "")}` : ""}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" className={btn}>WhatsApp</a>
            <a href={`sms:${phone.replace(/\D/g, "")}?&body=${encodeURIComponent(msg)}`} className={btn}>Text</a>
          </div>
          <div className="mt-8 flex justify-center gap-3">
            <Link prefetch={false} href={base} className="rounded-lg bg-[#0f766e] px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-[#0c5f59]">Done</Link>
            <button type="button" onClick={() => { setCreds(null); setName(""); setEmail(""); setJob(""); setPhone(""); setPass(tempPassword()); }} className="rounded-lg border border-slate-200 px-5 py-2.5 text-[15px] font-medium text-slate-700 hover:bg-slate-50">Add another</button>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-white">
        <FormHeader title="Invitation ready" closeHref={`${base}?tab=invites`} />
        <div className="mx-auto w-full max-w-lg px-5 py-10">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e7f6f1] text-[#0f766e]">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16v12H4zM4 7l8 6 8-6" /></svg>
          </span>
          <h2 className="mt-4 text-center text-xl font-semibold text-[#0b1f3a]">{name.split(" ")[0]} is invited</h2>
          <p className="mt-1 text-center text-[14.5px] text-slate-500">
            {done.emailed ? <>We emailed the invitation to <b>{email}</b>. You can also send the link by WhatsApp or text.</> : done.emailNote || "Send this link by WhatsApp or text."}
          </p>
          <div className="mt-6"><ShareInvite link={done.link} name={name} company={companyName} /></div>
          <p className="mt-4 text-center text-[13px] text-slate-500">They open the link, create their account (or sign in) and join as <b>{role}</b>. The link works for 14 days.</p>
          <div className="mt-8 flex justify-center gap-3">
            <Link prefetch={false} href={`${base}?tab=invites`} className="rounded-lg bg-[#0f766e] px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-[#0c5f59]">Done</Link>
            <button type="button" onClick={() => { setDone(null); setName(""); setEmail(""); setJob(""); setPhone(""); }} className="rounded-lg border border-slate-200 px-5 py-2.5 text-[15px] font-medium text-slate-700 hover:bg-slate-50">Invite another</button>
          </div>
        </div>
      </div>
    );
  }

  if (review) {
    const rows: [string, string][] = [["Name", name.trim()], ["Email", email.trim()], ["Role", ROLE_INFO[role].label], ...(job.trim() ? [["Job title", job.trim()] as [string, string]] : []), ...(phone.trim() ? [["Phone", phone.trim()] as [string, string]] : []),
      ["How", mode === "invite" ? (send ? "Invitation by email + link for WhatsApp/text" : "Invitation link (no email)") : "Login with temporary password"], ...(mode === "create" ? [["Temporary password", pass.trim()] as [string, string]] : [])];
    return (
      <form onSubmit={submit} className="flex min-h-[calc(100vh-4rem)] flex-col bg-white">
        <FormHeader title="Check before sending" closeHref={base} />
        <div className="mx-auto w-full max-w-lg px-5 py-10">
          <p className="text-[15px] text-slate-600">Make sure everything is right. {mode === "invite" ? `${name.split(" ")[0]} will get the invitation as soon as you send it.` : `${name.split(" ")[0]}'s login will be created right away.`}</p>
          <dl className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200 text-[14.5px]">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-4 px-4 py-3"><dt className="shrink-0 text-slate-500">{k}</dt><dd className="min-w-0 break-words text-right font-semibold text-[#0b1f3a]">{v}</dd></div>
            ))}
          </dl>
          {mode === "invite" && note.trim() && <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-[14px] italic text-slate-600">&ldquo;{note.trim()}&rdquo;</p>}
          {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
          <div className="mt-8 flex gap-3">
            <button type="button" onClick={() => setReview(false)} disabled={saving} className="rounded-lg border border-slate-200 px-5 py-3 text-[15px] font-medium text-slate-700 hover:bg-slate-50">Edit</button>
            <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-[#0f766e] py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#0c5f59] disabled:opacity-60">
              {saving ? "Working..." : mode === "invite" ? "Send invitation" : "Create login"}
            </button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={submit} noValidate autoComplete="off" className="flex min-h-[calc(100vh-4rem)] flex-col bg-white">
      <FormHeader title="Add Team Member" closeHref={base} />
      <div className="flex-1">
        <div className="space-y-5 border-b border-slate-200 bg-[#fafbfc] px-5 py-6 sm:px-8">
          <FormRow label="How to add" hint="Invitation: they get a link and create their own password (most secure). Create login: you give them a temporary password; they must change it the first time they sign in.">
            <div className="grid max-w-[640px] gap-2 sm:grid-cols-2">
              {([["invite", "Send invitation", "They open a link and set their password"], ["create", "Create login now", "You give them email + temporary password"]] as const).map(([k, t, d]) => (
                <button key={k} type="button" onClick={() => { setMode(k); setError(""); }} aria-pressed={mode === k}
                  className={`rounded-xl border p-3 text-left transition-colors ${mode === k ? "border-[#0f766e] bg-[#f3fbf8] ring-1 ring-[#0f766e]" : "border-slate-200 bg-white hover:border-[#14a39a]"}`}>
                  <span className="block text-[15px] font-semibold text-[#0b1f3a]">{t}</span><span className="block text-[12.5px] text-slate-500">{d}</span>
                </button>
              ))}
            </div>
          </FormRow>
          <FormRow label="Full name" htmlFor="tm-name" required width="max-w-[460px]">
            <input id="tm-name" autoFocus value={name} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder="e.g. Hector Ramirez" className={inputClass} />
          </FormRow>
          <FormRow label="Email" htmlFor="tm-email" required width="max-w-[460px]" hint="They sign in with this email. The invitation also goes here.">
            <input id="tm-email" type="email" inputMode="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} placeholder="name@example.com" className={inputClass} />
            {dupMember && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13.5px] text-amber-900">
                <span><b>{dupMember.name}</b> is already on your team ({ROLE_INFO[dupMember.role as Role]?.label ?? dupMember.role}).</span>
                <span className="flex gap-2">
                  <Link prefetch={false} href={`${base}/${dupMember.id}/edit`} className="font-semibold text-[#0f766e] hover:underline">Edit</Link>
                  {dupMember.role !== "owner" && <button type="button" onClick={() => removeExisting(dupMember)} className="font-semibold text-red-600 hover:underline">Remove</button>}
                </span>
              </div>
            )}
            {!dupMember && dupInvite && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13.5px] text-amber-900">
                <span>Already invited on {new Date(dupInvite.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.</span>
                <button type="button" onClick={() => cancelInvite(dupInvite.id)} className="font-semibold text-red-600 hover:underline">Cancel that invitation</button>
              </div>
            )}
          </FormRow>
          <FormRow label="Job title" htmlFor="tm-job" width="max-w-[460px]">
            <input id="tm-job" value={job} onChange={(e) => setJob(e.target.value)} placeholder="e.g. HVAC Technician, Dispatcher" className={inputClass} />
          </FormRow>
          <FormRow label="Phone" htmlFor="tm-phone" width="max-w-[300px]">
            <input id="tm-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="(214) 555-0123" className={inputClass} />
          </FormRow>
        </div>
        <div className="px-5 py-7 sm:px-8">
          <SectionTitle>Role</SectionTitle>
          <RoleCards value={role} onChange={setRole} roles={roles} />
          {mode === "invite" ? (
            <div className="mt-6 max-w-[640px] space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Personal message <span className="font-normal text-slate-400">(optional — personal emails land in Primary more often)</span></span>
                <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={`e.g. Hi ${name.split(" ")[0] || "Hector"}, this is the app we'll use for jobs and the van. Create your password with the link below.`} className={inputClass} />
              </label>
              <label className="flex cursor-pointer items-center gap-3">
                <input type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-[#0f766e]" />
                <span className="text-[14.5px] text-slate-700">Email the invitation too <span className="text-slate-400">(you&apos;ll also get a link for WhatsApp or text)</span></span>
              </label>
            </div>
          ) : (
            <div className="mt-6 max-w-[460px]">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Temporary password</span>
              <div className="flex gap-2">
                <input value={pass} onChange={(e) => setPass(e.target.value)} className={`${inputClass} font-mono`} />
                <button type="button" onClick={() => setPass(tempPassword())} className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-[14px] font-medium text-slate-700 hover:border-[#14a39a] hover:text-[#0f766e]">New</button>
              </div>
              <p className="mt-1.5 text-[13px] text-slate-500">They sign in with their email and this password, then BrightPro makes them choose their own.</p>
            </div>
          )}
        </div>
      </div>
      <SaveBar saving={saving} cancelHref={base} error={error} saveLabel="Review" />
    </form>
  );
}
