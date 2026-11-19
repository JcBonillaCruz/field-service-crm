"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PAYMENT_MODES } from "@/lib/sales";
import { askConfirm } from "@/lib/confirm";
import { FinPeriod, FinRange, PAYROLL_PERIODS, money, r2, spanLabel } from "@/lib/finance-period";
import { PayGroup, PayRow, Payroll, PayrollPayment, hoursOf, hoursText, payrollError, rateText } from "@/lib/payroll";
import { WORKER_LABEL } from "@/lib/operations";
import SelectMenu from "@/components/ui/SelectMenu";
import DatePicker from "@/components/ui/DatePicker";
import ExportModal from "@/components/customers/ExportModal";
import { TechDot } from "@/components/jobs/EventBar";
import { Chevron, ExportIcon, Kpi, PeriodBar, card, ghostBtn, tealBtn } from "@/components/finances/FinBits";

const COLS = "lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_1.25rem]";
const inputClass = "w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-[15px] placeholder:text-slate-400 focus:border-[#0f766e] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15";
const dayText = (key: string) => { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); };
const shortDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—");

// Finances → Payroll (Paso 5.10c): una fila por persona con lo que ganó en el periodo y lo que ya se le pagó.
// "Mark as paid" guarda el pago y crea solo el gasto en Expenses. Dueño y manager.
export default function PayrollWorkspace({ companyId, isOwner, range, today, payroll, needsSql, error, timeReady }: {
  companyId: string; isOwner: boolean; range: FinRange; today: string; payroll: Payroll | null; needsSql: boolean; error: string; timeReady: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [pay, setPay] = useState<PayRow | "all" | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [note, setNote] = useState("");
  const [fail, setFail] = useState("");

  const go = (p: FinPeriod, d: string) => start(() => router.push(`/dashboard/payroll?p=${p}&d=${d}`));
  const refresh = (msg: string) => { setPay(null); setNote(msg); setFail(""); start(() => router.refresh()); };
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(""), 4000); return () => clearTimeout(t); }, [note]);
  const toggle = (id: string) => setOpenIds((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));

  const t = payroll?.totals;
  const rows = payroll?.rows ?? [];
  const unpaid = rows.filter((r) => r.balance > 0.005);

  async function undo(p: PayrollPayment) {
    if (!(await askConfirm({ title: `Undo the payment of ${money(p.amount)} to ${p.person_name}?`, message: "It also removes that expense from Expenses.", confirmLabel: "Undo payment", tone: "danger" }))) return;
    const { error: e } = await createClient().rpc("payroll_unpay", { p_payment: p.id });
    if (e) return setFail(payrollError(e));
    refresh("Payment removed.");
  }

  const cell = (label: string, value: React.ReactNode, cls = "") => (
    <span className={`min-w-0 ${cls}`}>
      <span className="block text-[11px] font-medium text-slate-400 lg:hidden">{label}</span>
      <span className="block truncate text-[13.5px] font-semibold tabular-nums text-[#0b1f3a]">{value}</span>
    </span>
  );
  const pill = (r: PayRow) =>
    r.status === "paid" ? <span className="inline-flex items-center gap-1 rounded-full bg-[#e7f8ee] px-2.5 py-1 text-[12px] font-semibold text-[#15803d]"><svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 10.5 8.5 14 15 6.5" /></svg>Paid</span>
      : r.status === "none" && !r.payType ? <span className="rounded-full bg-[#fff6e6] px-2.5 py-1 text-[12px] font-semibold text-[#b45309]">No pay rate</span>
        : r.status === "none" ? <span className="text-[12.5px] text-slate-400">Nothing to pay</span> : null;

  const line = (r: PayRow) => {
    const open = openIds.includes(r.user_id);
    return (
      <li key={r.user_id}>
        <div onClick={() => toggle(r.user_id)}
          className={`grid cursor-pointer grid-cols-3 items-center gap-x-3 gap-y-2.5 px-3.5 py-3 transition-colors hover:bg-[#f6fbfa] lg:px-5 ${COLS}`}>
          <span className="col-span-3 flex min-w-0 items-center gap-2.5 lg:col-span-1">
            {r.member ? <TechDot t={{ initials: r.member.initials, color: r.member.color, avatar_url: r.member.avatar_url, name: r.member.full_name }} size={32} ring={false} />
              : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-500">—</span>}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold text-[#0b1f3a]">{r.name}</span>
              <span className="block truncate text-[12px] text-slate-400">{r.member?.job_title || WORKER_LABEL[r.workerType]}{r.flags.length ? <span className="text-[#b45309]"> · {r.flags.length} note{r.flags.length === 1 ? "" : "s"}</span> : null}</span>
            </span>
            <span className="lg:hidden"><Chevron open={open} /></span>
          </span>
          {cell("Pay rate", <span className={r.payType ? "font-medium text-slate-600" : "font-medium text-[#b45309]"}>{rateText(r)}</span>, "col-span-3 lg:col-span-1")}
          {cell("Hours", r.minutes > 0 ? hoursOf(r.minutes) : "—")}
          {cell("Jobs", r.jobCount || "—")}
          {cell("Earned", money(r.calculated))}
          {cell("Paid", <span className={r.paid > 0 ? "text-[#15803d]" : "text-slate-400"}>{money(r.paid)}</span>)}
          <span className="col-span-2 flex min-w-0 items-center gap-2 lg:col-span-1">
            {pill(r)}
            {(r.status === "unpaid" || r.status === "partial") && (
              <button type="button" onClick={(e) => { e.stopPropagation(); setPay(r); }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0f766e] px-3 text-[13px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:bg-[#0b5f59] hover:shadow-md">
                {r.status === "partial" ? `Pay ${money(r.balance)}` : "Mark as paid"}
              </button>
            )}
          </span>
          <button type="button" aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} details for ${r.name}`} onClick={(e) => { e.stopPropagation(); toggle(r.user_id); }}
            className="hidden h-7 w-7 items-center justify-center justify-self-end rounded-md hover:bg-slate-100 lg:flex"><Chevron open={open} /></button>
        </div>

        {open && (
          <div className="animate-[bp-fade_0.2s_ease-out] bg-[#f8fafb] px-3.5 py-3.5 lg:px-5">
            <p className="text-[13px] text-slate-600"><span className="font-semibold text-[#0b1f3a]">How it&apos;s calculated:</span> {r.basis}{r.calculated > 0 ? ` = ${money(r.calculated)}` : ""}</p>
            {r.flags.map((f) => <p key={f} className="mt-1.5 rounded-lg border border-[#fcd38d] bg-[#fffbf3] px-3 py-1.5 text-[12.5px] text-[#92400e]">{f}</p>)}
            {!r.payType && (isOwner
              ? <Link prefetch={false} href={`/dashboard/team/${r.user_id}/edit`} className="mt-2 inline-block text-[13px] font-semibold text-[#0f766e] hover:underline">Set the pay rate in Team →</Link>
              : <p className="mt-2 text-[12.5px] text-slate-500">Only the owner can save pay rates (Team → Edit).</p>)}

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {r.days.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white">
                  <p className="flex items-center justify-between border-b border-slate-100 px-3.5 py-2 text-[12.5px] font-semibold text-[#0b1f3a]">Hours by day
                    <Link prefetch={false} href="/dashboard/jobs/timesheets" className="font-semibold text-[#0f766e] hover:underline">Timesheets</Link></p>
                  <ul className="divide-y divide-slate-100">
                    {r.days.map((d) => <li key={d.key} className="flex items-center justify-between px-3.5 py-1.5 text-[13px]"><span className="text-slate-600">{dayText(d.key)}</span><span className="font-semibold tabular-nums text-[#0b1f3a]">{hoursText(d.minutes)}</span></li>)}
                  </ul>
                </div>
              )}
              {r.jobs.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white">
                  <p className="border-b border-slate-100 px-3.5 py-2 text-[12.5px] font-semibold text-[#0b1f3a]">Jobs finished in this period</p>
                  <ul className="divide-y divide-slate-100">
                    {r.jobs.map((j) => (
                      <li key={j.job_id}>
                        <Link prefetch={false} href={`/dashboard/jobs/${j.job_id}`} className="flex items-center justify-between gap-3 px-3.5 py-1.5 text-[13px] hover:bg-[#f6fbfa]">
                          <span className="min-w-0 truncate text-slate-600">{shortDate(j.when)} · {j.number} · {j.customer || "No customer"}{j.estimated ? " · no invoice yet" : ""}</span>
                          {(r.payType === "per_job" || r.payType === "percent") && <span className="shrink-0 font-semibold tabular-nums text-[#0b1f3a]">{money(j.cost)}</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {r.payments.length > 0 && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-white">
                <p className="border-b border-slate-100 px-3.5 py-2 text-[12.5px] font-semibold text-[#0b1f3a]">Payments for this period</p>
                <ul className="divide-y divide-slate-100">
                  {r.payments.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2 text-[13px]">
                      <span className="font-semibold tabular-nums text-[#15803d]">{money(p.amount)}</span>
                      <span className="min-w-0 flex-1 truncate text-slate-500">{dayText(String(p.paid_on).slice(0, 10))}{p.payment_mode ? ` · ${p.payment_mode}` : ""}{p.reference ? ` · ${p.reference}` : ""}{p.created_by_name ? ` · by ${p.created_by_name}` : ""}{p.period_from !== range.from || p.period_to !== range.to ? ` · for ${spanLabel(p.period_from, p.period_to)}` : ""}</span>
                      <button type="button" onClick={() => undo(p)} className="rounded-lg px-2 py-1 text-[12.5px] font-semibold text-[#be123c] hover:bg-[#fff1f2]">Undo</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {r.status === "paid" && r.payType && <button type="button" onClick={() => setPay(r)} className="mt-2.5 text-[12.5px] font-semibold text-[#0f766e] hover:underline">Add another payment</button>}
            {r.status === "none" && <button type="button" onClick={() => setPay(r)} className="mt-2.5 text-[12.5px] font-semibold text-[#0f766e] hover:underline">Record a payment by hand</button>}
          </div>
        )}
      </li>
    );
  };

  const section = (title: string, hint: string, list: PayRow[], g: PayGroup | undefined) => list.length > 0 && (
    <section className={`${card} mt-4 overflow-hidden`}>
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-100 px-3.5 py-3 lg:px-5">
        <div><p className="text-[15px] font-semibold text-[#0b1f3a]">{title} <span className="font-normal text-slate-400">· {list.length}</span></p><p className="text-[12.5px] text-slate-500">{hint}</p></div>
        {g && <p className="text-[13px] tabular-nums text-slate-500">Earned <b className="text-[#0b1f3a]">{money(g.calculated)}</b> · Paid <b className="text-[#15803d]">{money(g.paid)}</b>{g.balance > 0.005 ? <> · Owed <b className="text-[#be123c]">{money(g.balance)}</b></> : null}</p>}
      </div>
      <div className={`hidden items-center gap-x-3 px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 lg:grid ${COLS}`}>
        <span>Person</span><span>Pay rate</span><span>Hours</span><span>Jobs</span><span>Earned</span><span>Paid</span><span>Status</span><span />
      </div>
      <ul className="divide-y divide-slate-100">{list.map(line)}</ul>
    </section>
  );

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[#f4f6f8] px-3 pb-24 pt-4 lg:px-6 lg:pb-8 lg:pt-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight text-[#0b1f3a]">Payroll</h1>
          <p className="text-[13px] text-slate-500">What each person earned in the period and what you already paid. Marking it as paid adds the expense for you.</p>
        </div>
        <button type="button" onClick={() => setExportOpen(true)} className={ghostBtn}><ExportIcon />Export</button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <PeriodBar periods={PAYROLL_PERIODS} range={range} today={today} onGo={go} />
        {unpaid.length > 1 && <button type="button" onClick={() => setPay("all")} className={`${tealBtn} sm:ml-auto`}>Mark all as paid · {money(t?.balance)}</button>}
      </div>
      {note && <p role="status" className="mt-3 animate-[bp-fade_0.2s_ease-out] rounded-xl border border-[#b7e4c7] bg-[#f0fbf4] px-4 py-2.5 text-[13.5px] font-medium text-[#15803d]">{note}</p>}
      {fail && <p role="alert" className="mt-3 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-2.5 text-[13.5px] text-[#be123c]">{fail}</p>}

      {needsSql ? (
        <div className={`${card} mt-5 px-5 py-10 text-center`}>
          <p className="text-[15px] font-semibold text-[#0b1f3a]">One step left</p>
          <p className="mx-auto mt-1 max-w-md text-[13.5px] text-slate-500">Run <b>paso-5.10c-payroll.sql</b> in Supabase → SQL Editor, then reload this page.</p>
        </div>
      ) : error || !payroll || !t ? (
        <div className={`${card} mt-5 px-5 py-8 text-center`}><p role="alert" className="text-[14px] text-[#be123c]">{error || "Payroll couldn't load. Try again."}</p></div>
      ) : (
        <div className={`transition-opacity duration-200 ${pending ? "opacity-60" : ""}`}>
          <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Kpi art="revenue" title="Earned in this period" value={money(t.calculated)} hint={`${t.people} ${t.people === 1 ? "person" : "people"} in this period`} />
            <Kpi art="done" title="Already paid" value={money(t.paid)} hint="Each payment is in Expenses" tone="text-[#15803d]" />
            <Kpi art={t.balance > 0.005 ? "value" : "profit"} title="Still to pay" value={money(t.balance)} hint={t.balance > 0.005 ? `${t.unpaidPeople} ${t.unpaidPeople === 1 ? "person" : "people"} not fully paid` : "Everyone is paid"} tone={t.balance > 0.005 ? "text-[#be123c]" : "text-[#0b1f3a]"} />
            <Kpi art="site" title="Hours clocked" value={`${hoursOf(t.minutes)} h`} hint={`${t.employees.people} direct · ${t.subs.people} subcontractor${t.subs.people === 1 ? "" : "s"}`} />
          </div>
          {!timeReady && <p className="mt-4 rounded-xl border border-[#fcd38d] bg-[#fffbf3] px-4 py-3 text-[13px] text-[#92400e]">The hours couldn&apos;t be read from Timesheets, so hourly pay shows $0. Run <b>paso-5.7-timesheets.sql</b> in Supabase.</p>}
          {!payroll.jobsReady && <p className="mt-4 rounded-xl border border-[#fcd38d] bg-[#fffbf3] px-4 py-3 text-[13px] text-[#92400e]">The finished jobs couldn&apos;t be read, so pay per job shows $0. Run <b>paso-5.10b-reports-manager.sql</b> in Supabase.</p>}
          {t.noRate > 0 && <p className="mt-4 rounded-xl border border-[#fcd38d] bg-[#fffbf3] px-4 py-3 text-[13px] text-[#92400e]">{t.noRate} {t.noRate === 1 ? "person worked but has" : "people worked but have"} no pay rate, so the amount is $0. {isOwner ? "Save the rate in Team → Edit." : "The owner saves pay rates in Team → Edit."}</p>}

          {rows.length === 0 ? (
            <div className={`${card} mt-4 px-5 py-12 text-center`}>
              <p className="text-[15px] font-semibold text-[#0b1f3a]">Nothing to pay in this period</p>
              <p className="mx-auto mt-1 max-w-md text-[13.5px] text-slate-500">People show up here when they have a pay rate saved in Team, hours in Timesheets, or finished jobs.</p>
            </div>
          ) : <>
            {section("Direct employees", "Hours clocked in Timesheets × their hourly rate, or their salary.", rows.filter((r) => r.workerType === "employee"), t.employees)}
            {section("Subcontractors", "Jobs finished in the period × their rate per job, or their % of each job.", rows.filter((r) => r.workerType === "subcontractor"), t.subs)}
          </>}
          <p className="mt-4 text-[12.5px] leading-relaxed text-slate-500">
            Hours come from <Link prefetch={false} href="/dashboard/jobs/timesheets" className="font-semibold text-[#0f766e] hover:underline">Timesheets</Link> (clock in to clock out). Pay rates are saved by the owner in Team → Edit.
            Every payment goes to <Link prefetch={false} href="/dashboard/expenses" className="font-semibold text-[#0f766e] hover:underline">Expenses</Link> as Payroll &amp; Labor or Subcontractors, and from there to <Link prefetch={false} href="/dashboard/reports" className="font-semibold text-[#0f766e] hover:underline">Reports</Link>. Taxes and deductions are not calculated here: change the amount before saving if you need to.
          </p>
        </div>
      )}

      {pay && <PayDialog companyId={companyId} range={range} today={today} target={pay === "all" ? unpaid : [pay]} all={pay === "all"} onClose={() => setPay(null)} onDone={refresh} />}
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} initialModule="Payroll" defaultScope="view"
        view={{ module: "Payroll", label: range.title, ids: rows.map((r) => r.user_id), columns: [], range: { from: range.from, to: range.to } }} />
    </div>
  );
}

// Mark as paid: una persona (se puede cambiar el monto) o todas las que faltan
function PayDialog({ companyId, range, today, target, all, onClose, onDone }: {
  companyId: string; range: FinRange; today: string; target: PayRow[]; all: boolean; onClose: () => void; onDone: (msg: string) => void;
}) {
  const one = target[0];
  const total = r2(target.reduce((a, r) => a + r.balance, 0));
  const [amount, setAmount] = useState(all ? "" : one.balance > 0 ? one.balance.toFixed(2) : "");
  const [date, setDate] = useState(today);
  const [mode, setMode] = useState("Check");
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function save() {
    const a = all ? 0 : r2(Number(amount.replace(/[^0-9.]/g, "")));
    if (!all && (!a || a <= 0)) return setError("Enter the amount you paid.");
    if (!date) return setError("Choose the date you paid.");
    setBusy(true); setError("");
    const sb = createClient();
    let done = 0;
    for (const r of target) {
      const { error: e } = await sb.rpc("payroll_mark_paid", {
        p_company: companyId, p_user: r.user_id, p_name: r.name, p_worker_type: r.workerType, p_from: range.from, p_to: range.to,
        p_pay_type: r.payType ?? "", p_rate: r.rate, p_hours: hoursOf(r.minutes), p_overtime_hours: hoursOf(r.otMinutes), p_jobs: r.jobCount,
        p_calculated: r.calculated, p_amount: all ? r.balance : a, p_paid_on: date, p_mode: mode, p_reference: ref, p_notes: notes,
      });
      if (e) { setBusy(false); if (done) onDone(`${done} of ${target.length} marked as paid. ${payrollError(e)}`); else setError(payrollError(e)); return; }
      done += 1;
    }
    onDone(all ? `${done} people marked as paid. The expenses are in Expenses.` : `${one.name} marked as paid. The expense is in Expenses.`);
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#0b1f3a]/45 p-0 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Mark as paid" className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl animate-[bp-sheet-up_0.22s_ease-out] sm:max-w-md sm:rounded-2xl">
        <p className="text-[17px] font-semibold text-[#0b1f3a]">{all ? `Mark ${target.length} people as paid` : `Pay ${one.name}`}</p>
        <p className="mt-0.5 text-[13px] text-slate-500">{range.label}{all ? ` · ${money(total)} in total, each person gets what is still owed` : ` · ${one.basis}`}</p>

        <div className="mt-4 space-y-3">
          {!all && (
            <div><p className="mb-1 text-[12.5px] font-medium text-slate-500">Amount paid</p>
              <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <input inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" aria-label="Amount paid" className={`${inputClass} pl-7`} /></div>
              {one.calculated > 0 && <p className="mt-1 text-[12px] text-slate-400">Earned {money(one.calculated)}{one.paid > 0 ? ` · already paid ${money(one.paid)}` : ""}. Change it if you paid a different amount.</p>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><p className="mb-1 text-[12.5px] font-medium text-slate-500">Date paid</p><DatePicker value={date} onChange={setDate} /></div>
            <div><p className="mb-1 text-[12.5px] font-medium text-slate-500">Paid with</p><SelectMenu ariaLabel="Paid with" value={mode} onChange={setMode} options={PAYMENT_MODES.map((m) => ({ value: m, label: m }))} /></div>
          </div>
          <div><p className="mb-1 text-[12.5px] font-medium text-slate-500">Reference <span className="font-normal text-slate-400">· optional</span></p>
            <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Check number, Zelle confirmation…" aria-label="Reference" className={inputClass} /></div>
          <div><p className="mb-1 text-[12.5px] font-medium text-slate-500">Note <span className="font-normal text-slate-400">· optional</span></p>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Bonus, advance, deduction…" aria-label="Note" className={inputClass} /></div>
        </div>
        <p className="mt-3 rounded-xl bg-[#e9f7f4] px-3.5 py-2.5 text-[12.5px] text-[#0f5f59]">
          {all ? "One expense per person is added to Expenses" : `This adds the expense to Expenses as ${one.workerType === "subcontractor" ? "Subcontractors" : "Payroll & Labor"}`}, so you don&apos;t write it twice.
        </p>
        {error && <p role="alert" className="mt-3 text-[13px] text-[#be123c]">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={ghostBtn}>Cancel</button>
          <button type="button" onClick={save} disabled={busy} className={tealBtn}>{busy ? "Saving…" : all ? `Mark all as paid · ${money(total)}` : "Mark as paid"}</button>
        </div>
      </div>
    </div>
  );
}
