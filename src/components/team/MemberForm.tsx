"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { confirmDelete } from "@/lib/confirm";
import { Role, formatPhone } from "@/lib/types";
import Avatar from "@/components/Avatar";
import { inputClass } from "@/components/customers/ui";
import { FormHeader, FormRow, SaveBar, SectionTitle } from "@/components/catalog/FormBits";
import RoleCards from "@/components/team/RoleCards";
import { Member, teamError } from "@/lib/team";

// Editar a un miembro: rol, puesto, teléfono, activo. Pantalla completa (menú + formulario).
export default function MemberForm({ companyId, member, myRole, isMe }: { companyId: string; member: Member; myRole: Role; isMe: boolean }) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(member.role);
  const [job, setJob] = useState(member.job_title ?? "");
  const [phone, setPhone] = useState(member.phone ?? "");
  const [active, setActive] = useState(member.is_active);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const locked = myRole === "manager" && (member.role === "owner" || member.role === "manager");
  const roles: Role[] = myRole === "owner" ? ["technician", "office", "manager", "owner"] : ["technician", "office"];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (locked) return setError("Only the owner can change owners and managers.");
    setSaving(true); setError("");
    const { error: err } = await createClient().rpc("team_update_member", { p_company: companyId, p_user: member.user_id, p_role: role, p_active: active, p_job_title: job, p_phone: phone });
    if (err) { setSaving(false); return setError(teamError(err)); }
    router.push("/dashboard/team"); router.refresh();
  }

  async function remove() {
    if (!(await confirmDelete({ title: `Remove ${member.full_name}?`, message: "They lose access to this company right away. Their history stays. If they have a van, it becomes unassigned. If they don't belong to any other company, their login is deleted too." }))) return;
    const res = await fetch("/api/team/remove", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: member.user_id }) }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return setError(data.error || "It couldn't be removed.");
    router.replace("/dashboard/team"); router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate autoComplete="off" className="flex min-h-[calc(100vh-4rem)] flex-col bg-white">
      <FormHeader title="Edit Team Member" closeHref="/dashboard/team" />
      <div className="flex-1">
        <div className="flex items-center gap-4 border-b border-slate-200 bg-[#fafbfc] px-5 py-6 sm:px-8">
          <Avatar name={member.full_name} url={member.avatar_url} seed={member.user_id} size={56} />
          <div className="min-w-0">
            <p className="truncate text-[18px] font-semibold text-[#0b1f3a]">{member.full_name}{isMe && <span className="ml-2 text-[13px] font-normal text-slate-400">(you)</span>}</p>
            <p className="truncate text-[14px] text-slate-500">{member.email}</p>
          </div>
        </div>
        <div className="space-y-5 border-b border-slate-100 px-5 py-6 sm:px-8">
          <FormRow label="Job title" htmlFor="mf-job" width="max-w-[460px]">
            <input id="mf-job" value={job} disabled={locked} onChange={(e) => setJob(e.target.value)} placeholder="e.g. HVAC Technician" className={inputClass} />
          </FormRow>
          <FormRow label="Phone" htmlFor="mf-phone" width="max-w-[300px]">
            <input id="mf-phone" type="tel" value={phone} disabled={locked} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="(214) 555-0123" className={inputClass} />
          </FormRow>
          {!isMe && (
            <FormRow label="Access" hint="Inactive members can't sign in to this company. Their history stays and you can turn them back on anytime.">
              <button type="button" role="switch" aria-checked={active} disabled={locked} onClick={() => setActive((v) => !v)} className="flex items-center gap-3 py-1.5 disabled:opacity-60">
                <span className={`relative h-6 w-11 rounded-full transition-colors ${active ? "bg-[#0f766e]" : "bg-slate-300"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${active ? "left-[22px]" : "left-0.5"}`} />
                </span>
                <span className="text-[15px] text-slate-700">{active ? "Active" : "Inactive"}</span>
              </button>
            </FormRow>
          )}
        </div>
        <div className="px-5 py-7 sm:px-8">
          <SectionTitle>Role</SectionTitle>
          {locked && <p className="mb-3 text-[14px] text-slate-500">Only the owner can change this person.</p>}
          <RoleCards value={role} onChange={setRole} roles={roles.includes(member.role) ? roles : [member.role, ...roles]} disabled={locked} />
        </div>
      </div>
      <SaveBar saving={saving} cancelHref="/dashboard/team" error={error} onDelete={!isMe && !locked ? remove : undefined} deleteLabel="Remove from team" />
    </form>
  );
}
