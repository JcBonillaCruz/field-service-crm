"use client";

import type { AutoFlags } from "@/lib/financing-server";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { createClient } from "@/lib/supabase/client";
import { askConfirm, confirmDelete } from "@/lib/confirm";
import { useTranslations } from "next-intl";
import { r2 } from "@/lib/finance-period";
import { useFinTx } from "@/i18n/useFinTx";
import { DueTone, FinPayment, Financed, dueOf, financingTotals, needsFinancingSql, nextAmount, progressOf } from "@/lib/financing";
import { CATEGORIES } from "@/components/expenses/ExpensesWorkspace";
import SelectMenu from "@/components/ui/SelectMenu";
import DatePicker from "@/components/ui/DatePicker";
import { Kpi, card, ghostBtn, tealBtn } from "@/components/finances/FinBits";

const inputClass = "w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-[15px] placeholder:text-slate-400 focus:border-[#0f766e] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15";
const num = (v: string) => r2(Number(String(v).replace(/[^0-9.]/g, "")));
const DUE_PILL: Record<DueTone, string> = {
  done: "bg-[#e7f8ee] text-[#15803d]", overdue: "bg-[#ffe8ee] text-[#be123c]", today: "bg-[#fff0e6] text-[#c2410c]", soon: "bg-[#fff6e0] text-[#b45309]", ok: "bg-slate-100 text-slate-600",
};
const catOf = (name: string) => CATEGORIES.find((c) => c.name === name) ?? CATEGORIES[CATEGORIES.length - 1];

// Paso 6.2b: Financing en el idioma de quien lo ve
function useFinanceTx() {
  const t = useTranslations("financing");
  const fx = useFinTx();
  const dayLong = (iso: string | null) => {
    if (!iso) return "—";
    const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(fx.tag, { month: "short", day: "numeric", year: "numeric" }).replace(".", "");
  };
  const dueLabel = (f: Financed, today: string) => {
    const d = dueOf(f, today);
    return d.tone === "done" ? t("paidOff") : d.tone === "overdue" ? t("pastDueBy", { n: -(d.days ?? 0) }) : d.tone === "today" ? t("dueToday") : t("dueIn", { n: d.days ?? 0 });
  };
  const payDay = (firstDue: string) => t("payDay", { d: Number(firstDue.slice(8, 10)) });
  const err = (e: { message?: string; code?: string; hint?: string } | string | null | undefined) => {
    if (!e) return "";
    if (typeof e === "string") return /financing\.sql/.test(e) ? t("eSql") : /permission/.test(e) ? t("eNoAccess") : /went wrong/.test(e) ? t("eGeneric") : e;
    if (needsFinancingSql(e)) return t("eSql");
    if ((e.message ?? "").includes("NO_ACCESS")) return t("eNoAccess");
    return e.hint && fx.locale === "en" ? e.hint : t("eGeneric");
  };
  return { t, fx, money: fx.money, dayLong, dueLabel, payDay, err };
}

// Finances → Financing (Paso 5.10d): compras a pagos. Siempre a la vista: total, pagado, lo que se debe, cuotas que faltan y la próxima fecha.
// Cada pago registrado entra solo a Expenses. Dueño y manager.
export default function FinancingWorkspace({ companyId, today, list, needsSql, error, auto = null }: {
  companyId: string; today: string; list: Financed[]; needsSql: boolean; error: string;
  auto?: AutoFlags | null; // Paso 5.12: qué compras anotan sola su cuota (null = falta el SQL)
}) {
  const { t: tt, fx, money, dayLong, dueLabel, payDay, err } = useFinanceTx();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState<Financed | "new" | null>(null);
  const [pay, setPay] = useState<Financed | null>(null);
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [fail, setFail] = useState("");
  const refresh = (msg: string) => { setForm(null); setPay(null); setNote(msg); setFail(""); start(() => router.refresh()); };
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(""), 4000); return () => clearTimeout(t); }, [note]);
  const t = financingTotals(list, today);

  async function undo(f: Financed, p: FinPayment) {
    if (!(await askConfirm({ title: tt("undoTitle", { amt: money(p.amount), name: f.name }), message: tt("undoMsg"), confirmLabel: tt("undoPayment"), tone: "danger" }))) return;
    const { error: e } = await createClient().rpc("financing_unpay", { p_payment: p.id });
    if (e) return setFail(err(e));
    refresh(tt("removed"));
  }
  async function setAuto(f: Financed, on: boolean) {
    const { error: e } = await createClient().rpc("financing_set_auto", { p_purchase: f.id, p_on: on });
    if (e) return setFail(err(e));
    refresh(on ? tt("autoOn") : tt("autoOff"));
  }
  async function remove(f: Financed) {
    if (!(await confirmDelete({ title: tt("delTitle", { name: f.name }), message: tt("delMsg"), download: { filename: `financing-${f.name}`, data: f } }))) return;
    const { error: e } = await createClient().rpc("financing_delete", { p_purchase: f.id });
    if (e) return setFail(err(e));
    refresh(tt("deleted"));
  }

  if (form) return <PurchaseForm companyId={companyId} today={today} purchase={form === "new" ? null : form} onCancel={() => setForm(null)} onDone={refresh} />;

  const stat = (label: string, value: React.ReactNode, cls = "text-[#0b1f3a]") => (
    <div className="min-w-0"><p className="text-[11.5px] font-medium text-slate-400">{label}</p><p className={`truncate text-[15px] font-semibold tabular-nums ${cls}`}>{value}</p></div>
  );
  const one = (f: Financed) => {
    const due = { ...dueOf(f, today), label: dueLabel(f, today) }, c = catOf(f.category), pct = progressOf(f), open = openIds.includes(f.id);
    const paidCount = f.installments_total - f.installments_left;
    return (
      <li key={f.id} className={`${card} group/card overflow-hidden transition-shadow duration-200 hover:shadow-[0_8px_24px_rgba(15,40,60,0.08)]`}>
        <div className="px-4 pb-3.5 pt-4 lg:px-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover/card:-rotate-6 group-hover/card:scale-110" style={{ background: `${c.color}18`, color: c.color }}>
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={c.icon} /></svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-semibold text-[#0b1f3a]">{f.name}</p>
              <p className="truncate text-[12.5px] text-slate-500">{[f.vendor, fx.cat(f.category)].filter(Boolean).join(" · ")}</p>
              <span className={`mt-1.5 inline-block rounded-full px-2.5 py-1 text-[12px] font-semibold sm:hidden ${DUE_PILL[due.tone]}`}>{due.label}</span>
            </div>
            <span className={`hidden shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold sm:inline-block ${DUE_PILL[due.tone]}`}>{due.label}</span>
            <Menu>
              <MenuButton aria-label={tt("moreFor", { name: f.name })} className="-mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none">
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor"><circle cx="4.5" cy="10" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="15.5" cy="10" r="1.6" /></svg>
              </MenuButton>
              <MenuItems anchor="bottom end" transition className="z-[80] mt-1 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_40px_rgba(15,40,60,0.16)] transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0 focus:outline-none">
                <MenuItem><button type="button" onClick={() => setForm(f)} className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 data-[focus]:bg-[#e3f4ef]">{tt("edit")}</button></MenuItem>
                <MenuItem><button type="button" onClick={() => remove(f)} className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-[#be123c] data-[focus]:bg-[#fff1f2]">{tt("delete")}</button></MenuItem>
              </MenuItems>
            </Menu>
          </div>

          {/* Barra de avance: lo pagado contra el total */}
          <div className="mt-4">
            <div className="flex items-baseline justify-between text-[12.5px]"><span className="font-semibold text-[#0f766e]">{tt("pctPaid", { n: Math.round(pct) })}</span><span className="tabular-nums text-slate-500">{tt("of", { a: money(f.paid), b: money(f.total) })}</span></div>
            <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full origin-left animate-[bp-grow-x_0.7s_ease-out] rounded-full bg-[linear-gradient(90deg,#14a39a,#0f766e)]" style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }} /></div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {stat(tt("total"), money(f.total))}
            {stat(tt("paid"), money(f.paid), "text-[#15803d]")}
            {stat(tt("stillOwed"), money(f.owed), f.owed > 0.004 ? "text-[#be123c]" : "text-[#0b1f3a]")}
            {stat(tt("monthly"), money(f.monthly_payment))}
            {stat(tt("left"), f.owed > 0.004 ? tt("of", { a: f.installments_left, b: f.installments_total }) : tt("none"))}
            {stat(tt("nextPayment"), f.next_due ? dayLong(f.next_due) : "—", due.tone === "overdue" ? "text-[#be123c]" : "text-[#0b1f3a]")}
          </div>
          {f.notes && <p className="mt-3 text-[12.5px] text-slate-500">{f.notes}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {f.owed > 0.004 && <button type="button" onClick={() => setPay(f)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0f766e] px-3.5 text-[13px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:bg-[#0b5f59] hover:shadow-md">{tt("recordAmt", { amt: money(nextAmount(f)) })}</button>}
            <button type="button" aria-expanded={open} onClick={() => setOpenIds((o) => (open ? o.filter((x) => x !== f.id) : [...o, f.id]))} className="inline-flex h-9 items-center rounded-lg px-2.5 text-[13px] font-semibold text-[#0f766e] hover:bg-[#e9f7f4]">
              {open ? tt("hidePayments") : tt("payments", { n: f.payments.length })}
            </button>
            {f.owed > 0.004 && <span className="ml-auto hidden text-[12px] text-slate-400 sm:inline">{tt("paidOn", { day: payDay(f.first_due) })}</span>}
          </div>
          {/* Paso 5.12: la cuota entra sola a Expenses en su fecha */}
          {auto && f.owed > 0.004 && (
            <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl bg-slate-50 px-3 py-2.5">
              <input type="checkbox" checked={Boolean(auto[f.id]?.on)} onChange={(e) => setAuto(f, e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0f766e]" />
              <span className="min-w-0 text-[13px] text-slate-600">{tt.rich("autoLabel", { b: (c) => <b className="font-semibold text-[#0b1f3a]">{c}</b> })}
                {auto[f.id]?.on && f.next_due && f.next_due < (auto[f.id]?.since ?? "") && f.next_due <= today ? <span className="block font-medium text-[#be123c]">{tt("autoBefore", { date: dayLong(f.next_due) })}</span>
                  : <span className="block text-[12px] text-slate-400">{auto[f.id]?.on ? tt("autoOnHint") : tt("autoOffHint")}</span>}
              </span>
            </label>
          )}
        </div>

        {open && (
          <div className="animate-[bp-fade_0.2s_ease-out] border-t border-slate-100 bg-[#f8fafb] px-4 py-3 lg:px-5">
            <ul className="space-y-1.5 text-[13px]">
              {f.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
                  <span className="font-semibold tabular-nums text-[#15803d]">{money(p.amount)}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-500">{dayLong(p.paid_on)}{p.kind === "down" ? ` · ${tt("downPayment")}` : ""}{p.payment_mode ? ` · ${fx.pay(p.payment_mode)}` : ""}{p.reference ? ` · ${p.reference}` : ""}{p.notes && p.kind !== "down" ? ` · ${p.notes}` : ""}{p.created_by_name ? ` · ${tt("by", { name: p.created_by_name })}` : ""}</span>
                  {p.kind === "installment" && <button type="button" onClick={() => undo(f, p)} className="rounded-lg px-2 py-1 text-[12.5px] font-semibold text-[#be123c] hover:bg-[#fff1f2]">{tt("undo")}</button>}
                </li>
              ))}
              {f.down_payment > 0 && !f.payments.some((p) => p.kind === "down") && <li className="rounded-lg bg-white px-3 py-2 text-slate-500 ring-1 ring-slate-200"><b className="tabular-nums text-[#0b1f3a]">{money(f.down_payment)}</b> · {tt("downPayment")}{f.purchased_on ? ` · ${dayLong(f.purchased_on)}` : ""} · {tt("notInExpenses")}</li>}
              {f.opening_paid > 0 && <li className="rounded-lg bg-white px-3 py-2 text-slate-500 ring-1 ring-slate-200"><b className="tabular-nums text-[#0b1f3a]">{money(f.opening_paid)}</b> · {tt("openingPaid")} · {tt("notInExpenses")}</li>}
              {!f.payments.length && !f.down_payment && !f.opening_paid && <li className="text-slate-500">{tt("noPayments")}</li>}
            </ul>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[#f4f6f8] px-3 pb-24 pt-4 lg:px-6 lg:pb-8 lg:pt-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight text-[#0b1f3a]">{tt("title")}</h1>
          <p className="text-[13px] text-slate-500">{tt("subtitle")}</p>
        </div>
        {!needsSql && !error && <button type="button" onClick={() => setForm("new")} className={tealBtn}>
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>{tt("newPurchase")}
        </button>}
      </div>
      {note && <p role="status" className="mt-3 animate-[bp-fade_0.2s_ease-out] rounded-xl border border-[#b7e4c7] bg-[#f0fbf4] px-4 py-2.5 text-[13.5px] font-medium text-[#15803d]">{note}</p>}
      {fail && <p role="alert" className="mt-3 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-2.5 text-[13.5px] text-[#be123c]">{fail}</p>}

      {needsSql ? (
        <div className={`${card} mt-5 px-5 py-10 text-center`}>
          <p className="text-[15px] font-semibold text-[#0b1f3a]">{tt("oneStep")}</p>
          <p className="mx-auto mt-1 max-w-md text-[13.5px] text-slate-500">{tt.rich("runSql", { b: (c) => <b>{c}</b> })}</p>
        </div>
      ) : error ? (
        <div className={`${card} mt-5 px-5 py-8 text-center`}><p role="alert" className="text-[14px] text-[#be123c]">{err(error)}</p></div>
      ) : (
        <div className={`transition-opacity duration-200 ${pending ? "opacity-60" : ""}`}>
          <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Kpi art="value" title={tt("stillOwed")} value={money(t.owed)} hint={tt("kBeingPaid", { n: t.open })} tone={t.owed > 0 ? "text-[#be123c]" : "text-[#0b1f3a]"} />
            <Kpi art="done" title={tt("paidSoFar")} value={money(t.paid)} hint={tt("kOfTotal", { amt: money(t.total) })} tone="text-[#15803d]" />
            <Kpi art="revenue" title={tt("perMonth")} value={money(t.monthly)} hint={tt("kAdding")} />
            <Kpi art={t.overdue ? "held" : "ontime"} title={tt("dueNow")} value={t.overdue ? tt("kPastDue", { n: t.overdue }) : t.dueSoon ? tt("kDueSoon", { n: t.dueSoon }) : tt("kUpToDate")} hint={tt("kBell")} tone={t.overdue ? "text-[#be123c]" : "text-[#0b1f3a]"} />
          </div>
          {list.length === 0 ? (
            <div className={`${card} mt-4 px-5 py-12 text-center`}>
              <p className="text-[15px] font-semibold text-[#0b1f3a]">{tt("emptyTitle")}</p>
              <p className="mx-auto mt-1 max-w-md text-[13.5px] text-slate-500">{tt("emptyText")}</p>
              <button type="button" onClick={() => setForm("new")} className={`${tealBtn} mt-4`}>{tt("addFirst")}</button>
            </div>
          ) : <ul className="mt-4 grid items-start gap-4 lg:grid-cols-2">{list.map(one)}</ul>}
          <p className="mt-4 text-[12.5px] leading-relaxed text-slate-500">
            {tt.rich("footer", {
              ex: (c) => <Link prefetch={false} href="/dashboard/expenses" className="font-semibold text-[#0f766e] hover:underline">{c}</Link>,
              rp: (c) => <Link prefetch={false} href="/dashboard/reports" className="font-semibold text-[#0f766e] hover:underline">{c}</Link>,
            })}
          </p>
        </div>
      )}
      {pay && <PayDialog purchase={pay} today={today} onClose={() => setPay(null)} onDone={refresh} />}
    </div>
  );
}

// Crear o editar: pantalla completa (solo el menú de la izquierda y el formulario)
function PurchaseForm({ companyId, today, purchase, onCancel, onDone }: { companyId: string; today: string; purchase: Financed | null; onCancel: () => void; onDone: (msg: string) => void }) {
  const { t: tt, fx, money, payDay, err } = useFinanceTx();
  const [name, setName] = useState(purchase?.name ?? "");
  const [vendor, setVendor] = useState(purchase?.vendor ?? "");
  const [category, setCategory] = useState(purchase?.category ?? "Equipment & Tools");
  const [bought, setBought] = useState(purchase?.purchased_on ?? today);
  const [total, setTotal] = useState(purchase ? String(purchase.total) : "");
  const [down, setDown] = useState(purchase ? String(purchase.down_payment || "") : "");
  const [downExpense, setDownExpense] = useState(true);
  const [monthly, setMonthly] = useState(purchase ? String(purchase.monthly_payment) : "");
  const [opening, setOpening] = useState(purchase ? String(purchase.opening_paid || "") : "");
  const [firstDue, setFirstDue] = useState(purchase?.first_due ?? "");
  const [notes, setNotes] = useState(purchase?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const T = num(total), D = num(down), O = num(opening), Mo = num(monthly), tracked = purchase?.tracked ?? 0;
  const owed = r2(Math.max(0, T - D - O - tracked)), left = Mo > 0 ? Math.ceil(owed / Mo - 0.0001) : 0;

  async function save() {
    if (!name.trim()) return setError(tt("eName"));
    if (!T) return setError(tt("eTotal"));
    if (!Mo) return setError(tt("eMonthly"));
    if (!firstDue) return setError(tt("eFirstDue"));
    if (D + O + tracked > T + 0.004) return setError(tt("eTooMuch"));
    setBusy(true); setError("");
    const { error: e } = await createClient().rpc("financing_save", {
      p_id: purchase?.id ?? null, p_company: companyId, p_name: name, p_vendor: vendor, p_category: category, p_purchased_on: bought || null,
      p_total: T, p_down: D, p_opening_paid: O, p_monthly: Mo, p_first_due: firstDue, p_notes: notes, p_down_expense: !purchase && downExpense && D > 0,
    });
    if (e) { setBusy(false); return setError(err(e)); }
    onDone(purchase ? tt("updated") : tt("added"));
  }
  const field = (label: string, hint: string | null, child: React.ReactNode, wide = false) => (
    <div className={wide ? "sm:col-span-2" : ""}><p className="mb-1 text-[12.5px] font-medium text-slate-600">{label}{hint && <span className="font-normal text-slate-400"> · {hint}</span>}</p>{child}</div>
  );
  const moneyInput = (value: string, set: (v: string) => void, label: string) => (
    <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
      <input inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} placeholder="0.00" aria-label={label} className={`${inputClass} pl-7`} /></div>
  );

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col bg-white">
      <div className="border-b border-slate-200 px-4 py-4 lg:px-8">
        <h1 className="text-[20px] font-semibold text-[#0b1f3a]">{purchase ? tt("editName", { name: purchase.name }) : tt("newTitle")}</h1>
        <p className="text-[13px] text-slate-500">{tt("formSub")}</p>
      </div>
      <div className="grid w-full max-w-5xl flex-1 content-start gap-6 px-4 py-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2">
          {field(tt("fWhat"), null, <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tt("fWhatPh")} aria-label={tt("fWhat")} autoFocus={!purchase} className={inputClass} />, true)}
          {field(tt("fWho"), tt("optional"), <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder={tt("fWhoPh")} aria-label={tt("fWho")} className={inputClass} />)}
          {field(tt("fCategory"), tt("fCategoryHint"), <SelectMenu ariaLabel={tt("fCategory")} value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c.name, label: fx.cat(c.name) }))} />)}
          {field(tt("fTotal"), tt("fTotalHint"), moneyInput(total, setTotal, tt("fTotal")))}
          {field(tt("fDate"), tt("optional"), <DatePicker value={bought} onChange={setBought} />)}
          {field(tt("downPaymentCap"), tt("optional"), <>
            {moneyInput(down, setDown, tt("downPaymentCap"))}
            {!purchase && D > 0 && <label className="mt-2 flex items-start gap-2 text-[12.5px] text-slate-600"><input type="checkbox" checked={downExpense} onChange={(e) => setDownExpense(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0f766e]" />{tt("fDownExpense")}</label>}
          </>)}
          {field(tt("monthly"), null, moneyInput(monthly, setMonthly, tt("monthly")))}
          {field(tt("fNext"), tt("fNextHint"), <DatePicker value={firstDue} onChange={setFirstDue} />)}
          {field(tt("fOpening"), tt("optional"), <>
            {moneyInput(opening, setOpening, tt("fOpening"))}
            <p className="mt-1 text-[12px] text-slate-400">{tt("fOpeningHint")}</p>
          </>)}
          {field(tt("notes"), tt("optional"), <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={tt("notesPh")} aria-label={tt("notes")} className={inputClass} />, true)}
        </div>
        <aside className="h-fit rounded-2xl border border-slate-200 bg-[#f8fafb] p-4">
          <p className="text-[13px] font-semibold text-[#0b1f3a]">{tt("howLook")}</p>
          <dl className="mt-2 space-y-1.5 text-[13.5px]">
            {[[tt("total"), money(T)], [tt("downPaymentCap"), money(D)], [tt("paidBefore"), money(O)], ...(tracked > 0 ? [[tt("recordedHere"), money(tracked)]] : [])].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3"><dt className="text-slate-500">{k}</dt><dd className="font-medium tabular-nums text-[#0b1f3a]">{v}</dd></div>
            ))}
            <div className="flex justify-between gap-3 border-t border-slate-200 pt-2"><dt className="font-semibold text-[#0b1f3a]">{tt("stillOwed")}</dt><dd className="font-semibold tabular-nums text-[#be123c]">{money(owed)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">{tt("left")}</dt><dd className="font-medium tabular-nums text-[#0b1f3a]">{Mo > 0 ? left : "—"}</dd></div>
            {firstDue && <div className="flex justify-between gap-3"><dt className="text-slate-500">{tt("paidOnLabel")}</dt><dd className="text-right font-medium text-[#0b1f3a]">{payDay(firstDue)}</dd></div>}
          </dl>
        </aside>
      </div>
      <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:px-8">
        <div className="flex items-center gap-2">
          <button type="button" onClick={save} disabled={busy} className={tealBtn}>{busy ? tt("saving") : tt("save")}</button>
          <button type="button" onClick={onCancel} disabled={busy} className={ghostBtn}>{tt("cancel")}</button>
          {error && <p role="alert" className="min-w-0 text-[13px] text-[#be123c]">{error}</p>}
        </div>
      </div>
    </div>
  );
}

function PayDialog({ purchase: f, today, onClose, onDone }: { purchase: Financed; today: string; onClose: () => void; onDone: (msg: string) => void }) {
  const { t: tt, fx, money, dayLong, err } = useFinanceTx();
  const [amount, setAmount] = useState(nextAmount(f).toFixed(2));
  const [date, setDate] = useState(today);
  const [mode, setMode] = useState("Bank Transfer");
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
    const a = num(amount);
    if (!a) return setError(tt("eAmount"));
    if (a > f.owed + 0.004) return setError(tt("eOverOwed", { amt: money(f.owed) }));
    if (!date) return setError(tt("eDate"));
    setBusy(true); setError("");
    const { error: e } = await createClient().rpc("financing_pay", { p_purchase: f.id, p_amount: a, p_paid_on: date, p_mode: mode, p_reference: ref, p_notes: notes });
    if (e) { setBusy(false); return setError(err(e)); }
    onDone(a >= f.owed - 0.004 ? tt("paidOffName", { name: f.name }) : tt("recorded", { amt: money(a) }));
  }
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#0b1f3a]/45 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={tt("recordPayment")} className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl animate-[bp-sheet-up_0.22s_ease-out] sm:max-w-md sm:rounded-2xl">
        <p className="text-[17px] font-semibold text-[#0b1f3a]">{tt("recordA")}</p>
        <p className="mt-0.5 text-[13px] text-slate-500">{f.name} · {tt("owedShort", { amt: money(f.owed) })}{f.next_due ? ` · ${tt("nextOne", { date: dayLong(f.next_due) })}` : ""}</p>
        <div className="mt-4 space-y-3">
          <div><p className="mb-1 text-[12.5px] font-medium text-slate-500">{tt("amountPaid")}</p>
            <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} aria-label={tt("amountPaid")} className={`${inputClass} pl-7`} /></div>
            <p className="mt-1 text-[12px] text-slate-400">{tt("payMoreHint", { amt: money(f.owed) })}</p></div>
          <div className="grid grid-cols-2 gap-3">
            <div><p className="mb-1 text-[12.5px] font-medium text-slate-500">{tt("datePaid")}</p><DatePicker value={date} onChange={setDate} /></div>
            <div><p className="mb-1 text-[12.5px] font-medium text-slate-500">{tt("paidWith")}</p><SelectMenu ariaLabel={tt("paidWith")} value={mode} onChange={setMode} options={fx.payModes} /></div>
          </div>
          <div><p className="mb-1 text-[12.5px] font-medium text-slate-500">{tt("reference")} <span className="font-normal text-slate-400">· {tt("optional")}</span></p>
            <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder={tt("confNumber")} aria-label={tt("reference")} className={inputClass} /></div>
          <div><p className="mb-1 text-[12.5px] font-medium text-slate-500">{tt("note")} <span className="font-normal text-slate-400">· {tt("optional")}</span></p>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} aria-label={tt("note")} className={inputClass} /></div>
        </div>
        <p className="mt-3 rounded-xl bg-[#e9f7f4] px-3.5 py-2.5 text-[12.5px] text-[#0f5f59]">{tt("addsAs", { cat: fx.cat(f.category) })}</p>
        {error && <p role="alert" className="mt-3 text-[13px] text-[#be123c]">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={ghostBtn}>{tt("cancel")}</button>
          <button type="button" onClick={save} disabled={busy} className={tealBtn}>{busy ? tt("saving") : tt("recordPayment")}</button>
        </div>
      </div>
    </div>
  );
}
