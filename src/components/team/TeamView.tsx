"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { createClient } from "@/lib/supabase/client";
import { confirmDelete } from "@/lib/confirm";
import { toCsv } from "@/lib/csv";
import { Role } from "@/lib/types";
import Avatar from "@/components/Avatar";
import SelectMenu from "@/components/ui/SelectMenu";
import { Toast } from "@/components/sales/SalesBits";
import { ActiveArt, InviteArt, MembersArt, TechArt } from "@/components/team/TeamArt";
import { Invite, Member, ROLE_INFO, fmtDate, inviteLink, teamError } from "@/lib/team";

type Tab = "members" | "invites";

// Team: quién trabaja en la compañía, con qué rol, y las invitaciones pendientes
export default function TeamView({ companyId, members, invites, vanOf, me, myRole, needsSql, initialTab }: {
  companyId: string; members: Member[]; invites: Invite[]; vanOf: Record<string, string>; me: string; myRole: Role; needsSql: boolean; initialTab: Tab;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [toast, setToast] = useState("");
  const say = (t: string) => { setToast(t); setTimeout(() => setToast(""), 2400); };
  const kpi = {
    total: members.length, active: members.filter((m) => m.is_active).length,
    techs: members.filter((m) => m.role === "technician" && m.is_active).length, pending: invites.length,
  };
  const shown = useMemo(() => members.filter((m) => (role === "all" || m.role === role)
    && `${m.full_name} ${m.email} ${m.job_title ?? ""} ${m.phone ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())), [members, q, role]);
  const shownInv = useMemo(() => invites.filter((i) => (role === "all" || i.role === role)
    && `${i.full_name ?? ""} ${i.email}`.toLowerCase().includes(q.trim().toLowerCase())), [invites, q, role]);
  const canTouch = (m: Member) => m.user_id !== me && !(myRole === "manager" && (m.role === "owner" || m.role === "manager"));

  async function toggle(m: Member) {
    const { error } = await createClient().rpc("team_update_member", { p_company: companyId, p_user: m.user_id, p_role: m.role, p_active: !m.is_active, p_job_title: m.job_title ?? "", p_phone: m.phone ?? "" });
    if (error) return say(teamError(error));
    say(m.is_active ? `${m.full_name} deactivated` : `${m.full_name} is active again`); router.refresh();
  }
  async function removeMember(m: Member) {
    if (!(await confirmDelete({ title: `Remove ${m.full_name} from the team?`, message: "They lose access right away. Their history (invoices, scans, movements) stays. If they don't belong to any other company, their login is deleted too, so you can add them again from zero." }))) return;
    const res = await fetch("/api/team/remove", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: m.user_id }) }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return say(data.error || "It couldn't be removed.");
    say(data.loginDeleted ? `${m.full_name} removed and their login deleted` : `${m.full_name} removed from the team`); router.refresh();
  }
  async function resend(i: Invite) {
    const res = await fetch("/api/team/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resend: i.id }) }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    say(!res?.ok ? data.error || "It couldn't be resent." : data.emailed ? `Invitation emailed to ${i.email}` : data.emailNote || "Link renewed for 14 days");
    router.refresh();
  }
  async function revoke(i: Invite) {
    if (!(await confirmDelete({ title: `Cancel the invitation for ${i.full_name || i.email}?`, message: "The link stops working right away." }))) return;
    const { error } = await createClient().from("company_invites").update({ revoked_at: new Date().toISOString() }).eq("id", i.id);
    if (error) return say(teamError(error));
    say("Invitation cancelled"); router.refresh();
  }
  function exportCsv() {
    const rows = [["Name", "Email", "Role", "Job title", "Phone", "Van", "Status", "Joined"],
      ...members.map((m) => [m.full_name, m.email, ROLE_INFO[m.role].label, m.job_title ?? "", m.phone ?? "", vanOf[m.user_id] ?? "", m.is_active ? "Active" : "Inactive", m.joined_at ?? ""])];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv" }));
    a.download = `team-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  return (
    <div className="px-4 pb-24 pt-5 lg:px-8 lg:pb-10 lg:pt-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[#0b1f3a] lg:text-2xl">Team</h1>
          <p className="mt-0.5 text-[13.5px] text-slate-500 lg:text-sm">Invite your office staff and technicians and choose what each one can do.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={exportCsv} className="hidden h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-[14px] font-medium text-slate-600 transition-colors hover:border-[#14a39a] hover:text-[#0f766e] sm:inline-flex">
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14" /></svg> Export CSV
          </button>
          <Link prefetch={false} href="/dashboard/team/invite" className="group/n inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#0f766e] px-4 text-[15px] font-semibold text-white shadow-sm shadow-[#0f766e]/30 transition-colors hover:bg-[#0c5f59]">
            <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform duration-200 group-hover/n:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>Add member
          </Link>
        </div>
      </div>

      {needsSql && <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Run <b>paso-4.3-team.sql</b> in Supabase → SQL Editor, then reload this page.</p>}

      <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label="Total members" value={kpi.total} Art={MembersArt} hint="Everyone with access" onClick={() => { setTab("members"); setRole("all"); }} />
        <Kpi label="Active" value={kpi.active} Art={ActiveArt} hint={`${kpi.total - kpi.active} inactive`} />
        <Kpi label="Technicians" value={kpi.techs} Art={TechArt} hint="Active in the field" onClick={() => { setTab("members"); setRole("technician"); }} />
        <Kpi label="Pending invites" value={kpi.pending} Art={InviteArt} hint={kpi.pending ? "Waiting to join" : "No pending invites"} onClick={() => setTab("invites")} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <div className="flex rounded-xl bg-slate-100 p-1">
          {([["members", `Members · ${members.length}`], ["invites", `Invitations · ${invites.length}`]] as [Tab, string][]).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)}
              className={`rounded-lg px-3.5 py-2 text-[14px] font-medium transition-colors ${tab === k ? "bg-white text-[#0b1f3a] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{l}</button>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone" aria-label="Search team"
          className="h-11 min-w-0 flex-1 basis-56 rounded-xl border border-slate-200 bg-white px-3.5 text-[15px] focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15" />
        <div className="w-full sm:w-48">
          <SelectMenu ariaLabel="Role" value={role} onChange={setRole} options={[{ value: "all", label: "All roles" }, ...(["owner", "manager", "office", "technician"] as Role[]).map((r) => ({ value: r, label: ROLE_INFO[r].label }))]} />
        </div>
      </div>

      {tab === "members" ? (
        shown.length === 0 ? <Empty text={members.length ? "No one matches." : "Invite your first team member."} /> : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[900px] text-left text-[14px]">
                <thead><tr className="border-b border-slate-200 bg-[#fafbfc] text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Member</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Job title</th><th className="px-3 py-3">Phone</th>
                  <th className="px-3 py-3">Van</th><th className="px-3 py-3">Joined</th><th className="px-3 py-3">Status</th><th className="w-14 px-4 py-3" />
                </tr></thead>
                <tbody>
                  {shown.map((m) => (
                    <tr key={m.user_id} className="group border-b border-slate-100 transition-colors last:border-0 hover:bg-[#f6fbfa]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={m.full_name} url={m.avatar_url} seed={m.user_id} size={38} />
                          <div className="min-w-0"><p className="truncate font-semibold text-[#0b1f3a]">{m.full_name}{m.user_id === me && <span className="ml-1.5 text-[12px] font-normal text-slate-400">(you)</span>}</p><p className="truncate text-[12.5px] text-slate-500">{m.email}</p></div>
                        </div>
                      </td>
                      <td className="px-3 py-3"><RolePill r={m.role} /></td>
                      <td className="px-3 py-3 text-slate-600">{m.job_title || <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-3 text-slate-600">{m.phone ? <a href={`tel:${m.phone}`} className="hover:text-[#0f766e]">{m.phone}</a> : <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-3 text-slate-600">{vanOf[m.user_id] || <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-3 text-slate-600">{fmtDate(m.joined_at)}</td>
                      <td className="px-3 py-3"><StatusPill on={m.is_active} /></td>
                      <td className="px-4 py-3 text-right"><RowMenu m={m} canTouch={canTouch(m)} onToggle={() => toggle(m)} onRemove={() => removeMember(m)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-slate-100 lg:hidden">
              {shown.map((m) => (
                <li key={m.user_id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={m.full_name} url={m.avatar_url} seed={m.user_id} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15.5px] font-semibold text-[#0b1f3a]">{m.full_name}</p>
                    <p className="truncate text-[12.5px] text-slate-500">{[m.job_title, vanOf[m.user_id], m.phone].filter(Boolean).join(" · ") || m.email}</p>
                    <div className="mt-1 flex items-center gap-1.5"><RolePill r={m.role} />{!m.is_active && <StatusPill on={false} />}</div>
                  </div>
                  <RowMenu m={m} canTouch={canTouch(m)} onToggle={() => toggle(m)} onRemove={() => removeMember(m)} />
                </li>
              ))}
            </ul>
          </div>
        )
      ) : (
        shownInv.length === 0 ? <Empty text={invites.length ? "No invitations match." : "No pending invitations."} /> : (
          <ul className="mt-4 space-y-3">
            {shownInv.map((i) => {
              const expired = new Date(i.expires_at).getTime() < Date.now();
              return (
                <li key={i.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={i.full_name || i.email} url={null} seed={i.email} size={40} />
                      <div className="min-w-0"><p className="truncate font-semibold text-[#0b1f3a]">{i.full_name || i.email}</p><p className="truncate text-[12.5px] text-slate-500">{i.email}</p></div>
                    </div>
                    <div className="flex items-center gap-2"><RolePill r={i.role} />
                      <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ring-1 ${expired ? "bg-[#fff1f2] text-[#be123c] ring-[#fecdd3]" : "bg-[#fff7e6] text-[#b45309] ring-[#fcdca4]"}`}>{expired ? "Expired" : "Pending"}</span>
                    </div>
                  </div>
                  <p className="mt-2 text-[12.5px] text-slate-500">Invited {fmtDate(i.created_at)}{i.invited_by_name ? ` by ${i.invited_by_name}` : ""} · {expired ? "expired" : "expires"} {fmtDate(i.expires_at)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => { navigator.clipboard?.writeText(inviteLink(window.location.origin, i.token)); say("Link copied"); }} className="rounded-lg border border-slate-200 px-3 py-2 text-[13.5px] font-medium text-slate-700 hover:border-[#14a39a] hover:text-[#0f766e]">Copy link</button>
                    <a href={`https://wa.me/?text=${encodeURIComponent(`Join us on BrightPro: ${typeof window !== "undefined" ? inviteLink(window.location.origin, i.token) : ""}`)}`} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-3 py-2 text-[13.5px] font-medium text-slate-700 hover:border-[#14a39a] hover:text-[#0f766e]">WhatsApp</a>
                    <button type="button" onClick={() => resend(i)} className="rounded-lg border border-slate-200 px-3 py-2 text-[13.5px] font-medium text-slate-700 hover:border-[#14a39a] hover:text-[#0f766e]">{expired ? "Renew & resend" : "Resend"}</button>
                    <button type="button" onClick={() => revoke(i)} className="ml-auto rounded-lg px-3 py-2 text-[13.5px] font-medium text-red-600 hover:bg-red-50">Cancel</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      )}

      <Link prefetch={false} href="/dashboard/team/invite" aria-label="Invite team member"
        className="fixed bottom-6 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#0f766e] text-white shadow-lg shadow-[#0f766e]/30 active:scale-95 lg:hidden">
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
      </Link>
      <Toast text={toast} />
    </div>
  );
}

function Kpi({ label, value, Art, hint, onClick }: { label: string; value: number; Art: (p: { size?: number }) => JSX.Element; hint: string; onClick?: () => void }) {
  const cls = `group block w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-left transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_28px_rgba(15,40,60,0.09)] lg:p-4 ${onClick ? "cursor-pointer" : "cursor-default"}`;
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><p className="truncate text-[12.5px] font-medium text-slate-500 lg:text-[13px]">{label}</p>
          <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight text-[#0b1f3a] lg:text-[26px]">{value}</p></div>
        <span className="shrink-0"><Art size={44} /></span>
      </div>
      <p className="mt-0.5 truncate text-[12.5px] text-slate-500">{hint}</p>
    </>
  );
  return onClick ? <button type="button" onClick={onClick} className={cls}>{body}</button> : <div className={cls}>{body}</div>;
}

const RolePill = ({ r }: { r: Role }) => <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${ROLE_INFO[r].tone}`}>{ROLE_INFO[r].label}</span>;
const StatusPill = ({ on }: { on: boolean }) => (
  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-semibold ring-1 ${on ? "bg-[#e7f6f1] text-[#0f766e] ring-[#bfe6da]" : "bg-[#fff1f2] text-[#be123c] ring-[#fecdd3]"}`}>{on ? "Active" : "Inactive"}</span>
);
function Empty({ text }: { text: string }) {
  return (
    <div className="mt-4 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <MembersArt size={64} />
      <p className="mt-3 text-[15px] font-medium text-slate-600">{text}</p>
      <Link prefetch={false} href="/dashboard/team/invite" className="mt-4 rounded-lg bg-[#0f766e] px-4 py-2.5 text-[15px] font-semibold text-white hover:bg-[#0c5f59]">+ Add member</Link>
    </div>
  );
}

function RowMenu({ m, canTouch, onToggle, onRemove }: { m: Member; canTouch: boolean; onToggle: () => void; onRemove: () => void }) {
  const item = "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[14px] text-slate-700 data-[focus]:bg-slate-50";
  return (
    <Menu>
      <MenuButton aria-label={`Actions for ${m.full_name}`} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-[#14a39a] hover:text-[#0f766e]">
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor"><circle cx="10" cy="4.5" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="10" cy="15.5" r="1.6" /></svg>
      </MenuButton>
      <MenuItems anchor="bottom end" transition className="z-[100] mt-1 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-xl transition duration-100 data-[closed]:opacity-0">
        <MenuItem><Link prefetch={false} href={`/dashboard/team/${m.user_id}/edit`} className={item}>Edit role & details</Link></MenuItem>
        {m.phone && <MenuItem><a href={`tel:${m.phone}`} className={item}>Call</a></MenuItem>}
        <MenuItem><a href={`mailto:${m.email}`} className={item}>Email</a></MenuItem>
        {canTouch && <MenuItem><button type="button" onClick={onToggle} className={`${item} ${m.is_active ? "text-amber-700" : "text-[#0f766e]"}`}>{m.is_active ? "Deactivate" : "Activate"}</button></MenuItem>}
        {canTouch && <MenuItem><button type="button" onClick={onRemove} className={`${item} text-red-600`}>Remove from team</button></MenuItem>}
      </MenuItems>
    </Menu>
  );
}
