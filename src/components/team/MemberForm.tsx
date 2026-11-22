"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTeamBase } from "@/components/team/useTeamBase";
import { createClient } from "@/lib/supabase/client";
import { confirmDelete } from "@/lib/confirm";
import { Role, formatPhone } from "@/lib/types";
import Avatar from "@/components/Avatar";
import { inputClass } from "@/components/customers/ui";
import { FormHeader, FormRow, SaveBar, SectionTitle } from "@/components/catalog/FormBits";
import RoleCards from "@/components/team/RoleCards";
import { Member } from "@/lib/team";
import { useLocale, useTranslations } from "next-intl";
import { useTeamTx } from "@/i18n/useTeamTx";
import { intlTag } from "@/i18n/config";
import SelectMenu from "@/components/ui/SelectMenu";
import { PAY_TYPES, PayType, WorkerType, defaultReceives } from "@/lib/operations";
import { TYPE_BASES, TYPE_KINDS, TypeBase, TypeKind } from "@/lib/type-pay";

export type WorkProfile = { worker_type: WorkerType; can_receive_jobs: boolean | null; business_name: string | null } | null;
export type MemberTypeRate = { job_type_id: string; pay_kind: TypeKind; amount: number; percent_base: TypeBase };
type TypeRow = { kind: "general" | TypeKind; amount: string; base: TypeBase };
export type PayRate = { pay_type: PayType; rate: number; overtime_rate: number | null; notes: string | null; updated_at?: string; updated_by_name?: string | null } | null;

// Editar a un miembro: rol, puesto, teléfono, activo. Pantalla completa (menú + formulario).
export default function MemberForm({ companyId, member, myRole, isMe, work = null, pay = null, workReady = true, typeReady = false, jobTypes = [], typeRates = [] }: {
  companyId: string; member: Member; myRole: Role; isMe: boolean; work?: WorkProfile; pay?: PayRate; workReady?: boolean;
  typeReady?: boolean;                                        // ya se corrió el SQL 5.10f
  jobTypes?: { id: string; name: string; active: boolean }[]; // tipos de trabajo de la compañía
  typeRates?: MemberTypeRate[];                               // lo que ya tiene guardado por tipo
}) {
  const tm = useTranslations("teamMember");
  const teamError = useTeamTx().err;
  const tag = intlTag(useLocale());
  const KIND_OPTS = [{ value: "general", label: tm("general") }, ...TYPE_KINDS.map((k) => ({ value: k.value, label: tm(`kind.${k.value}`) }))];
  const BASE_OPTS = TYPE_BASES.map((b) => ({ value: b.value, label: tm(`base.${b.value}`) }));
  const router = useRouter();
  const base = useTeamBase();
  // Paso 5.3: empleado directo o subcontratista · puede recibir trabajos · tarifa (solo el dueño la ve)
  const [wType, setWType] = useState<WorkerType>(work?.worker_type ?? "employee");
  const [gets, setGets] = useState<boolean>(work?.can_receive_jobs ?? defaultReceives(member.role));
  const [business, setBusiness] = useState(work?.business_name ?? "");
  const isOwner = myRole === "owner";
  // Paso 5.10f: las tarifas las ven y guardan dueño y manager (el manager no la suya ni la de otro manager o del dueño)
  const canPay = isOwner || (typeReady && myRole === "manager" && !isMe && member.role !== "owner" && member.role !== "manager");
  const [typeRows, setTypeRows] = useState<Record<string, TypeRow>>(() =>
    Object.fromEntries(typeRates.map((t) => [t.job_type_id, { kind: t.pay_kind, amount: String(Number(t.amount)), base: t.percent_base }])));
  const setType = (id: string, patch: Partial<TypeRow>) => setTypeRows((m) => ({ ...m, [id]: { ...(m[id] ?? { kind: "general", amount: "", base: "job" }), ...patch } }));
  // Se muestran los tipos activos y cualquiera que ya tenga un pago guardado
  const shownTypes = jobTypes.filter((t) => t.active || typeRows[t.id]);
  const [payType, setPayType] = useState<PayType>(pay?.pay_type ?? "hourly");
  const [rate, setRate] = useState(pay ? String(pay.rate) : "");
  const [ot, setOt] = useState(pay?.overtime_rate != null ? String(pay.overtime_rate) : "");
  const [payNotes, setPayNotes] = useState(pay?.notes ?? "");
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
    if (locked) return setError(tm("eLocked"));
    setSaving(true); setError("");
    const sb = createClient();
    const { error: err } = await sb.rpc("team_update_member", { p_company: companyId, p_user: member.user_id, p_role: role, p_active: active, p_job_title: job, p_phone: phone });
    if (err) { setSaving(false); return setError(teamError(err)); }
    if (workReady) {
      const w = await sb.rpc("team_save_work_profile", { p_company: companyId, p_user: member.user_id, p_type: wType, p_can_receive: gets, p_business: wType === "subcontractor" ? business : null });
      if (w.error) { setSaving(false); return setError(w.error.hint || teamError(w.error)); }
      const byType = payType === "per_job" || payType === "percent";
      const types = !byType ? [] : shownTypes.map((t) => ({ t, row: typeRows[t.id] })).filter((x) => x.row && x.row.kind !== "general" && x.row.amount.trim() !== "")
        .map((x) => ({ job_type_id: x.t.id, name: x.t.name, pay_kind: x.row.kind as TypeKind, amount: Number(x.row.amount), percent_base: x.row.kind === "percent" ? x.row.base : "job" }));
      if (canPay && (rate.trim() || pay || types.length)) {
        const r = Number(rate || 0), o = ot.trim() ? Number(ot) : null;
        if (!Number.isFinite(r) || r < 0 || (o !== null && (!Number.isFinite(o) || o < 0))) { setSaving(false); return setError(tm("eRates")); }
        const bad = types.find((x) => !Number.isFinite(x.amount) || x.amount < 0 || (x.pay_kind === "percent" && x.amount > 100));
        if (bad) { setSaving(false); return setError(bad.pay_kind === "percent" ? tm("eBadPct", { name: bad.name }) : tm("eBad", { name: bad.name })); }
        const base = { p_company: companyId, p_user: member.user_id, p_pay_type: payType, p_rate: r, p_overtime: payType === "hourly" ? o : null, p_notes: payNotes };
        // Sin el SQL 5.10f se guarda solo la tarifa general, como antes
        const pr = typeReady
          ? await sb.rpc("team_save_pay_rates", { ...base, p_types: types.map(({ job_type_id, pay_kind, amount, percent_base }) => ({ job_type_id, pay_kind, amount, percent_base })) })
          : await sb.rpc("team_save_pay", base);
        if (pr.error) { setSaving(false); return setError(pr.error.hint || teamError(pr.error)); }
      }
    }
    router.push(base); router.refresh();
  }

  async function remove() {
    if (!(await confirmDelete({ title: tm("removeQ", { name: member.full_name }), message: tm("removeMsg") }))) return;
    const res = await fetch("/api/team/remove", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: member.user_id }) }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return setError(data.error || tm("eRemove"));
    router.replace(base); router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate autoComplete="off" className="flex min-h-[calc(100vh-4rem)] flex-col bg-white">
      <FormHeader title={tm("title")} closeHref={base} />
      <div className="flex-1">
        <div className="flex items-center gap-4 border-b border-slate-200 bg-[#fafbfc] px-5 py-6 sm:px-8">
          <Avatar name={member.full_name} url={member.avatar_url} seed={member.user_id} size={56} />
          <div className="min-w-0">
            <p className="truncate text-[18px] font-semibold text-[#0b1f3a]">{member.full_name}{isMe && <span className="ml-2 text-[13px] font-normal text-slate-400">{tm("you")}</span>}</p>
            <p className="truncate text-[14px] text-slate-500">{member.email}</p>
          </div>
        </div>
        <div className="space-y-5 border-b border-slate-100 px-5 py-6 sm:px-8">
          <FormRow label={tm("job")} htmlFor="mf-job" width="max-w-[460px]">
            <input id="mf-job" value={job} disabled={locked} onChange={(e) => setJob(e.target.value)} placeholder={tm("jobPh")} className={inputClass} />
          </FormRow>
          <FormRow label={tm("phone")} htmlFor="mf-phone" width="max-w-[300px]">
            <input id="mf-phone" type="tel" value={phone} disabled={locked} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="(214) 555-0123" className={inputClass} />
          </FormRow>
          {!isMe && (
            <FormRow label={tm("access")} hint={tm("accessHint")}>
              <button type="button" role="switch" aria-checked={active} disabled={locked} onClick={() => setActive((v) => !v)} className="flex items-center gap-3 py-1.5 disabled:opacity-60">
                <span className={`relative h-6 w-11 rounded-full transition-colors ${active ? "bg-[#0f766e]" : "bg-slate-300"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${active ? "left-[22px]" : "left-0.5"}`} />
                </span>
                <span className="text-[15px] text-slate-700">{active ? tm("active") : tm("inactive")}</span>
              </button>
            </FormRow>
          )}
        </div>
        <div className="space-y-5 border-b border-slate-100 px-5 py-7 sm:px-8">
          <SectionTitle>{tm("work")}</SectionTitle>
          {!workReady && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13.5px] text-amber-800">{tm.rich("needs53", { b: (c) => <b>{c}</b> })}</p>}
          <FormRow label={tm("wType")} hint={tm("wTypeHint")}>
            <div className="grid max-w-[560px] gap-2.5 sm:grid-cols-2">
              {([["employee", tm("wEmp"), tm("wEmpD"), "M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 20a7 7 0 0 1 14 0"],
                ["subcontractor", tm("wSub"), tm("wSubD"), "M4 20V9l8-5 8 5v11M9 20v-6h6v6M4 20h16"]] as [WorkerType, string, string, string][]).map(([v, l, h, d]) => (
                <button key={v} type="button" disabled={locked} onClick={() => setWType(v)}
                  className={`group flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all duration-150 disabled:opacity-60 ${wType === v ? "border-[#0f766e] bg-[#f3fbf8] ring-4 ring-[#14a39a]/10" : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-[#14a39a] hover:shadow-[0_8px_18px_rgba(15,40,60,0.07)]"}`}>
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-110 ${wType === v ? "bg-[#0f766e] text-white" : "bg-[#eef8f5] text-[#0f766e]"}`}>
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
                  </span>
                  <span className="min-w-0"><span className="block text-[14.5px] font-semibold text-[#0b1f3a]">{l}</span><span className="block text-[12.5px] text-slate-500">{h}</span></span>
                </button>
              ))}
            </div>
          </FormRow>
          {wType === "subcontractor" && (
            <FormRow label={tm("biz")} htmlFor="mf-biz" width="max-w-[460px]" hint={tm("bizHint")}>
              <input id="mf-biz" value={business} disabled={locked} onChange={(e) => setBusiness(e.target.value)} placeholder={tm("bizPh")} className={inputClass} />
            </FormRow>
          )}
          <FormRow label={tm("gets")} hint={tm("getsHint")}>
            <button type="button" role="switch" aria-checked={gets} disabled={locked} onClick={() => setGets((v) => !v)} className="flex items-center gap-3 py-1.5 disabled:opacity-60">
              <span className={`relative h-6 w-11 rounded-full transition-colors ${gets ? "bg-[#0f766e]" : "bg-slate-300"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${gets ? "left-[22px]" : "left-0.5"}`} />
              </span>
              <span className="text-[15px] text-slate-700">{gets ? tm("getsYes") : tm("no")}</span>
            </button>
          </FormRow>
          {canPay && workReady && (
            <div className="max-w-[640px] rounded-2xl border border-slate-200 bg-[#fafbfc] p-4">
              <div className="mb-3 flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0b1f3a] text-white">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                </span>
                <div><p className="text-[14.5px] font-semibold text-[#0b1f3a]">{tm("payRate")}</p><p className="text-[12.5px] text-slate-500">{typeReady ? tm("payWho2") : tm("payWho1")}</p></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
                <div><p className="mb-1 text-[12.5px] font-medium text-slate-500">{tm("howPaid")}</p>
                  <SelectMenu ariaLabel={tm("payType")} value={payType} onChange={(v) => setPayType(v as PayType)} options={PAY_TYPES.map((p) => ({ value: p.value, label: tm(`pt.${p.value}`) }))} /></div>
                <div><p className="mb-1 text-[12.5px] font-medium text-slate-500">{payType === "percent" ? tm("percent") : tm("amount")} <span className="font-normal text-slate-400">· {tm(`unit.${payType}`)}</span></p>
                  <div className="relative">
                    {payType !== "percent" && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>}
                    <input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.00" aria-label={tm("rate")}
                      className={`${inputClass} ${payType !== "percent" ? "pl-7" : "pr-8"}`} />
                    {payType === "percent" && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>}
                  </div></div>
                {payType === "hourly" && (
                  <div className="sm:col-start-2"><p className="mb-1 text-[12.5px] font-medium text-slate-500">{tm("ot")} <span className="font-normal text-slate-400">· {tm("optional")}</span></p>
                    <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                      <input inputMode="decimal" value={ot} onChange={(e) => setOt(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.00" aria-label={tm("otRate")} className={`${inputClass} pl-7`} /></div></div>
                )}
                <div className="sm:col-span-2"><p className="mb-1 text-[12.5px] font-medium text-slate-500">{tm("privNote")} <span className="font-normal text-slate-400">· {tm("optional")}</span></p>
                  <input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder={tm("notePh")} className={inputClass} /></div>
              </div>

              {/* Paso 5.10f: un pago distinto para cada tipo de trabajo (instalación, llamada de servicio…) */}
              {(payType === "per_job" || payType === "percent") && (
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <p className="text-[14px] font-semibold text-[#0b1f3a]">{tm("byType")}</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500">{payType === "percent" ? tm("byTypeHintPct") : tm("byTypeHintAmt")}</p>
                  {!typeReady ? <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-800">{tm.rich("needs510f", { b: (c) => <b>{c}</b> })}</p>
                    : !shownTypes.length ? <p className="mt-3 text-[13px] text-slate-500">{tm("noTypes")}</p>
                    : (
                      <ul className="mt-3 space-y-2.5">
                        {shownTypes.map((t) => {
                          const row = typeRows[t.id] ?? { kind: "general" as const, amount: "", base: "job" as TypeBase };
                          return (
                            <li key={t.id} className="rounded-xl border border-slate-200 bg-white p-3">
                              <div className="grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-2.5 sm:grid-cols-[minmax(0,1fr)_10.5rem_7.5rem]">
                                <p className="col-span-2 min-w-0 truncate text-[14px] font-medium text-[#0b1f3a] sm:col-span-1">{t.name}{!t.active && <span className="ml-1.5 text-[12px] font-normal text-slate-400">{tm("inactiveP")}</span>}</p>
                                <SelectMenu ariaLabel={tm("howIsPaid", { name: t.name })} value={row.kind} onChange={(v) => setType(t.id, { kind: v as TypeRow["kind"] })} options={KIND_OPTS} />
                                {row.kind === "general"
                                  ? <p className="text-right text-[13px] text-slate-400">{rate.trim() ? (payType === "percent" ? `${rate}%` : `$${rate}`) : tm("notSet")}</p>
                                  : (
                                    <div className="relative">
                                      {row.kind === "fixed" && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>}
                                      <input inputMode="decimal" value={row.amount} onChange={(e) => setType(t.id, { amount: e.target.value.replace(/[^\d.]/g, "") })} placeholder="0.00"
                                        aria-label={row.kind === "percent" ? tm("pctFor", { name: t.name }) : tm("amtFor", { name: t.name })} className={`${inputClass} ${row.kind === "fixed" ? "pl-7" : "pr-8"}`} />
                                      {row.kind === "percent" && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>}
                                    </div>
                                  )}
                              </div>
                              {row.kind === "percent" && (
                                <div className="mt-2.5 grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_18.5rem]">
                                  <p className="text-[12.5px] text-slate-500">{row.base === "no_parts" ? tm("baseNoParts") : tm("baseJob")}</p>
                                  <SelectMenu ariaLabel={tm("baseFor", { name: t.name })} value={row.base} onChange={(v) => setType(t.id, { base: v as TypeBase })} options={BASE_OPTS} />
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                </div>
              )}
              {pay?.updated_at && <p className="mt-2.5 text-[12px] text-slate-400">{(() => { const d = new Date(pay.updated_at).toLocaleDateString(tag, { month: "short", day: "numeric", year: "numeric" }); return pay.updated_by_name ? tm("changedBy", { d, by: pay.updated_by_name }) : tm("changed", { d }); })()}</p>}
            </div>
          )}
        </div>
        <div className="px-5 py-7 sm:px-8">
          <SectionTitle>{tm("role")}</SectionTitle>
          {locked && <p className="mb-3 text-[14px] text-slate-500">{tm("onlyOwner")}</p>}
          <RoleCards value={role} onChange={setRole} roles={roles.includes(member.role) ? roles : [member.role, ...roles]} disabled={locked} />
        </div>
      </div>
      <SaveBar saving={saving} cancelHref={base} error={error} onDelete={!isMe && !locked ? remove : undefined} deleteLabel={tm("remove")} />
    </form>
  );
}
