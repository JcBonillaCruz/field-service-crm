"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Role, formatPhone } from "@/lib/types";
import { inputClass } from "@/components/customers/ui";
import { FormHeader, FormRow, SaveBar, SectionTitle } from "@/components/catalog/FormBits";
import RoleCards from "@/components/team/RoleCards";
import ShareInvite from "@/components/team/ShareInvite";

// Invitar a alguien: pantalla completa (menú + formulario). Al terminar: enlace para WhatsApp / mensaje y correo.
export default function InviteForm({ myRole, companyName, initialRole }: { myRole: Role; companyName: string; initialRole: Exclude<Role, "owner"> }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(initialRole);
  const [job, setJob] = useState("");
  const [phone, setPhone] = useState("");
  const [send, setSend] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ link: string; emailed: boolean; emailNote: string } | null>(null);
  const roles: Role[] = myRole === "owner" ? ["technician", "office", "manager"] : ["technician", "office"];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Enter the person's name.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address.");
    setSaving(true); setError("");
    const res = await fetch("/api/team/invite", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: name.trim(), email: email.trim(), role, job_title: job.trim(), phone: phone.trim(), send }) }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setSaving(false);
    if (!res?.ok) return setError(data.error || "The invitation couldn't be created. Try again.");
    setDone({ link: data.link, emailed: data.emailed, emailNote: data.emailNote });
    router.refresh();
  }

  if (done) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-white">
        <FormHeader title="Invitation ready" closeHref="/dashboard/team?tab=invites" />
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
            <Link prefetch={false} href="/dashboard/team?tab=invites" className="rounded-lg bg-[#0f766e] px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-[#0c5f59]">Done</Link>
            <button type="button" onClick={() => { setDone(null); setName(""); setEmail(""); setJob(""); setPhone(""); }} className="rounded-lg border border-slate-200 px-5 py-2.5 text-[15px] font-medium text-slate-700 hover:bg-slate-50">Invite another</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate autoComplete="off" className="flex min-h-[calc(100vh-4rem)] flex-col bg-white">
      <FormHeader title="Invite Team Member" closeHref="/dashboard/team" />
      <div className="flex-1">
        <div className="space-y-5 border-b border-slate-200 bg-[#fafbfc] px-5 py-6 sm:px-8">
          <FormRow label="Full name" htmlFor="tm-name" required width="max-w-[460px]">
            <input id="tm-name" autoFocus value={name} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder="e.g. Hector Ramirez" className={inputClass} />
          </FormRow>
          <FormRow label="Email" htmlFor="tm-email" required width="max-w-[460px]" hint="They sign in with this email. The invitation also goes here.">
            <input id="tm-email" type="email" inputMode="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} placeholder="name@example.com" className={inputClass} />
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
          <label className="mt-6 flex max-w-[640px] cursor-pointer items-center gap-3">
            <input type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-[#0f766e]" />
            <span className="text-[14.5px] text-slate-700">Email the invitation too <span className="text-slate-400">(you&apos;ll also get a link for WhatsApp or text)</span></span>
          </label>
        </div>
      </div>
      <SaveBar saving={saving} cancelHref="/dashboard/team" error={error} />
    </form>
  );
}
