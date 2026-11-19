"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { createClient } from "@/lib/supabase/client";
import { PAYMENT_MODES } from "@/lib/sales";
import { askConfirm, confirmDelete } from "@/lib/confirm";
import { money, r2 } from "@/lib/finance-period";
import { DueTone, FinPayment, Financed, dayLong, dueOf, financingError, financingTotals, nextAmount, payDayText, progressOf } from "@/lib/financing";
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

// Finances → Financing (Paso 5.10d): compras a pagos. Siempre a la vista: total, pagado, lo que se debe, cuotas que faltan y la próxima fecha.
// Cada pago registrado entra solo a Expenses. Dueño y manager.
export default function FinancingWorkspace({ companyId, today, list, needsSql, error }: {
  companyId: string; today: string; list: Financed[]; needsSql: boolean; error: string;
}) {
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
    if (!(await askConfirm({ title: `Undo the payment of ${money(p.amount)} on ${f.name}?`, message: "It also removes that expense from Expenses.", confirmLabel: "Undo payment", tone: "danger" }))) return;
    const { error: e } = await createClient().rpc("financing_unpay", { p_payment: p.id });
    if (e) return setFail(financingError(e));
    refresh("Payment removed.");
  }
  async function remove(f: Financed) {
    if (!(await confirmDelete({ title: `Delete "${f.name}" from Financing?`, message: "The payments already recorded stay in Expenses, because that money was really spent.", download: { filename: `financing-${f.name}`, data: f } }))) return;
    const { error: e } = await createClient().rpc("financing_delete", { p_purchase: f.id });
    if (e) return setFail(financingError(e));
    refresh("Purchase deleted.");
  }

  if (form) return <PurchaseForm companyId={companyId} today={today} purchase={form === "new" ? null : form} onCancel={() => setForm(null)} onDone={refresh} />;

  const stat = (label: string, value: React.ReactNode, cls = "text-[#0b1f3a]") => (
    <div className="min-w-0"><p className="text-[11.5px] font-medium text-slate-400">{label}</p><p className={`truncate text-[15px] font-semibold tabular-nums ${cls}`}>{value}</p></div>
  );
  const one = (f: Financed) => {
    const due = dueOf(f, today), c = catOf(f.category), pct = progressOf(f), open = openIds.includes(f.id);
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
              <p className="truncate text-[12.5px] text-slate-500">{[f.vendor, f.category].filter(Boolean).join(" · ")}</p>
              <span className={`mt-1.5 inline-block rounded-full px-2.5 py-1 text-[12px] font-semibold sm:hidden ${DUE_PILL[due.tone]}`}>{due.label}</span>
            </div>
            <span className={`hidden shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold sm:inline-block ${DUE_PILL[due.tone]}`}>{due.label}</span>
            <Menu>
              <MenuButton aria-label={`More for ${f.name}`} className="-mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none">
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor"><circle cx="4.5" cy="10" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="15.5" cy="10" r="1.6" /></svg>
              </MenuButton>
              <MenuItems anchor="bottom end" transition className="z-[80] mt-1 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_40px_rgba(15,40,60,0.16)] transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0 focus:outline-none">
                <MenuItem><button type="button" onClick={() => setForm(f)} className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 data-[focus]:bg-[#e3f4ef]">Edit</button></MenuItem>
                <MenuItem><button type="button" onClick={() => remove(f)} className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-[#be123c] data-[focus]:bg-[#fff1f2]">Delete</button></MenuItem>
              </MenuItems>
            </Menu>
          </div>

          {/* Barra de avance: lo pagado contra el total */}
          <div className="mt-4">
            <div className="flex items-baseline justify-between text-[12.5px]"><span className="font-semibold text-[#0f766e]">{Math.round(pct)}% paid</span><span className="tabular-nums text-slate-500">{money(f.paid)} of {money(f.total)}</span></div>
            <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full origin-left animate-[bp-grow-x_0.7s_ease-out] rounded-full bg-[linear-gradient(90deg,#14a39a,#0f766e)]" style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }} /></div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {stat("Total", money(f.total))}
            {stat("Paid", money(f.paid), "text-[#15803d]")}
            {stat("Still owed", money(f.owed), f.owed > 0.004 ? "text-[#be123c]" : "text-[#0b1f3a]")}
            {stat("Monthly payment", money(f.monthly_payment))}
            {stat("Payments left", f.owed > 0.004 ? `${f.installments_left} of ${f.installments_total}` : "None")}
            {stat("Next payment", f.next_due ? dayLong(f.next_due) : "—", due.tone === "overdue" ? "text-[#be123c]" : "text-[#0b1f3a]")}
          </div>
          {f.notes && <p className="mt-3 text-[12.5px] text-slate-500">{f.notes}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {f.owed > 0.004 && <button type="button" onClick={() => setPay(f)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0f766e] px-3.5 text-[13px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:bg-[#0b5f59] hover:shadow-md">Record payment · {money(nextAmount(f))}</button>}
            <button type="button" aria-expanded={open} onClick={() => setOpenIds((o) => (open ? o.filter((x) => x !== f.id) : [...o, f.id]))} className="inline-flex h-9 items-center rounded-lg px-2.5 text-[13px] font-semibold text-[#0f766e] hover:bg-[#e9f7f4]">
              {open ? "Hide payments" : `Payments (${f.payments.length})`}
            </button>
            {f.owed > 0.004 && <span className="ml-auto hidden text-[12px] text-slate-400 sm:inline">Paid on {payDayText(f.first_due)}</span>}
          </div>
        </div>

        {open && (
          <div className="animate-[bp-fade_0.2s_ease-out] border-t border-slate-100 bg-[#f8fafb] px-4 py-3 lg:px-5">
            <ul className="space-y-1.5 text-[13px]">
              {f.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
                  <span className="font-semibold tabular-nums text-[#15803d]">{money(p.amount)}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-500">{dayLong(p.paid_on)}{p.kind === "down" ? " · down payment" : ""}{p.payment_mode ? ` · ${p.payment_mode}` : ""}{p.reference ? ` · ${p.reference}` : ""}{p.notes && p.kind !== "down" ? ` · ${p.notes}` : ""}{p.created_by_name ? ` · by ${p.created_by_name}` : ""}</span>
                  {p.kind === "installment" && <button type="button" onClick={() => undo(f, p)} className="rounded-lg px-2 py-1 text-[12.5px] font-semibold text-[#be123c] hover:bg-[#fff1f2]">Undo</button>}
                </li>
              ))}
              {f.down_payment > 0 && !f.payments.some((p) => p.kind === "down") && <li className="rounded-lg bg-white px-3 py-2 text-slate-500 ring-1 ring-slate-200"><b className="tabular-nums text-[#0b1f3a]">{money(f.down_payment)}</b> · down payment{f.purchased_on ? ` · ${dayLong(f.purchased_on)}` : ""} · not in Expenses</li>}
              {f.opening_paid > 0 && <li className="rounded-lg bg-white px-3 py-2 text-slate-500 ring-1 ring-slate-200"><b className="tabular-nums text-[#0b1f3a]">{money(f.opening_paid)}</b> · paid in installments before it was added here · not in Expenses</li>}
              {!f.payments.length && !f.down_payment && !f.opening_paid && <li className="text-slate-500">No payments yet.</li>}
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
          <h1 className="text-[22px] font-semibold tracking-tight text-[#0b1f3a]">Financing</h1>
          <p className="text-[13px] text-slate-500">What you bought on payments: a truck, tools, a big order of material. What you paid and what you still owe.</p>
        </div>
        {!needsSql && !error && <button type="button" onClick={() => setForm("new")} className={tealBtn}>
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>New purchase
        </button>}
      </div>
      {note && <p role="status" className="mt-3 animate-[bp-fade_0.2s_ease-out] rounded-xl border border-[#b7e4c7] bg-[#f0fbf4] px-4 py-2.5 text-[13.5px] font-medium text-[#15803d]">{note}</p>}
      {fail && <p role="alert" className="mt-3 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-2.5 text-[13.5px] text-[#be123c]">{fail}</p>}

      {needsSql ? (
        <div className={`${card} mt-5 px-5 py-10 text-center`}>
          <p className="text-[15px] font-semibold text-[#0b1f3a]">One step left</p>
          <p className="mx-auto mt-1 max-w-md text-[13.5px] text-slate-500">Run <b>paso-5.10d-financing.sql</b> in Supabase → SQL Editor, then reload this page.</p>
        </div>
      ) : error ? (
        <div className={`${card} mt-5 px-5 py-8 text-center`}><p role="alert" className="text-[14px] text-[#be123c]">{error}</p></div>
      ) : (
        <div className={`transition-opacity duration-200 ${pending ? "opacity-60" : ""}`}>
          <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Kpi art="value" title="Still owed" value={money(t.owed)} hint={`${t.open} purchase${t.open === 1 ? "" : "s"} being paid`} tone={t.owed > 0 ? "text-[#be123c]" : "text-[#0b1f3a]"} />
            <Kpi art="done" title="Paid so far" value={money(t.paid)} hint={`of ${money(t.total)} bought on payments`} tone="text-[#15803d]" />
            <Kpi art="revenue" title="Payments per month" value={money(t.monthly)} hint="Adding up every open purchase" />
            <Kpi art={t.overdue ? "held" : "ontime"} title="Due now" value={t.overdue ? `${t.overdue} past due` : t.dueSoon ? `${t.dueSoon} due soon` : "Up to date"} hint="The bell warns you 3 days before" tone={t.overdue ? "text-[#be123c]" : "text-[#0b1f3a]"} />
          </div>
          {list.length === 0 ? (
            <div className={`${card} mt-4 px-5 py-12 text-center`}>
              <p className="text-[15px] font-semibold text-[#0b1f3a]">Nothing on payments yet</p>
              <p className="mx-auto mt-1 max-w-md text-[13.5px] text-slate-500">Add the work truck, a new machine or a material order you are paying month by month. You will always see how much is paid and how much is left.</p>
              <button type="button" onClick={() => setForm("new")} className={`${tealBtn} mt-4`}>Add the first one</button>
            </div>
          ) : <ul className="mt-4 grid items-start gap-4 lg:grid-cols-2">{list.map(one)}</ul>}
          <p className="mt-4 text-[12.5px] leading-relaxed text-slate-500">
            Every payment you record goes to <Link prefetch={false} href="/dashboard/expenses" className="font-semibold text-[#0f766e] hover:underline">Expenses</Link> in the category of the purchase, and shows on its own line in <Link prefetch={false} href="/dashboard/reports" className="font-semibold text-[#0f766e] hover:underline">Reports</Link>. Interest is not tracked apart: the total is everything you will end up paying.
          </p>
        </div>
      )}
      {pay && <PayDialog purchase={pay} today={today} onClose={() => setPay(null)} onDone={refresh} />}
    </div>
  );
}

// Crear o editar: pantalla completa (solo el menú de la izquierda y el formulario)
function PurchaseForm({ companyId, today, purchase, onCancel, onDone }: { companyId: string; today: string; purchase: Financed | null; onCancel: () => void; onDone: (msg: string) => void }) {
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
    if (!name.trim()) return setError("Write what you bought.");
    if (!T) return setError("Enter the total of the purchase.");
    if (!Mo) return setError("Enter the monthly payment.");
    if (!firstDue) return setError("Choose the date of the next payment.");
    if (D + O + tracked > T + 0.004) return setError("The down payment plus what is already paid can't be more than the total.");
    setBusy(true); setError("");
    const { error: e } = await createClient().rpc("financing_save", {
      p_id: purchase?.id ?? null, p_company: companyId, p_name: name, p_vendor: vendor, p_category: category, p_purchased_on: bought || null,
      p_total: T, p_down: D, p_opening_paid: O, p_monthly: Mo, p_first_due: firstDue, p_notes: notes, p_down_expense: !purchase && downExpense && D > 0,
    });
    if (e) { setBusy(false); return setError(financingError(e)); }
    onDone(purchase ? "Purchase updated." : "Purchase added.");
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
        <h1 className="text-[20px] font-semibold text-[#0b1f3a]">{purchase ? `Edit ${purchase.name}` : "New purchase on payments"}</h1>
        <p className="text-[13px] text-slate-500">Only the total and the monthly payment. BrightPro keeps count of what is paid and what is left.</p>
      </div>
      <div className="grid w-full max-w-5xl flex-1 content-start gap-6 px-4 py-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2">
          {field("What did you buy?", null, <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ford F-150 work truck" aria-label="What did you buy" autoFocus={!purchase} className={inputClass} />, true)}
          {field("Who do you pay?", "optional", <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Dealer, bank or supplier" aria-label="Who do you pay" className={inputClass} />)}
          {field("Expense category", "where each payment goes", <SelectMenu ariaLabel="Expense category" value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c.name, label: c.name }))} />)}
          {field("Total of the purchase", "everything you will pay", moneyInput(total, setTotal, "Total of the purchase"))}
          {field("Date of the purchase", "optional", <DatePicker value={bought} onChange={setBought} />)}
          {field("Down payment", "optional", <>
            {moneyInput(down, setDown, "Down payment")}
            {!purchase && D > 0 && <label className="mt-2 flex items-start gap-2 text-[12.5px] text-slate-600"><input type="checkbox" checked={downExpense} onChange={(e) => setDownExpense(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0f766e]" />Add the down payment to Expenses on the date of the purchase</label>}
          </>)}
          {field("Monthly payment", null, moneyInput(monthly, setMonthly, "Monthly payment"))}
          {field("Next payment date", "repeats each month", <DatePicker value={firstDue} onChange={setFirstDue} />)}
          {field("Paid in installments so far", "optional", <>
            {moneyInput(opening, setOpening, "Already paid in installments")}
            <p className="mt-1 text-[12px] text-slate-400">Only if you have been paying it for a while. These past payments don&apos;t go to Expenses.</p>
          </>)}
          {field("Notes", "optional", <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Contract number, VIN, serial…" aria-label="Notes" className={inputClass} />, true)}
        </div>
        <aside className="h-fit rounded-2xl border border-slate-200 bg-[#f8fafb] p-4">
          <p className="text-[13px] font-semibold text-[#0b1f3a]">How it will look</p>
          <dl className="mt-2 space-y-1.5 text-[13.5px]">
            {[["Total", money(T)], ["Down payment", money(D)], ["Paid in installments before", money(O)], ...(tracked > 0 ? [["Payments recorded here", money(tracked)]] : [])].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3"><dt className="text-slate-500">{k}</dt><dd className="font-medium tabular-nums text-[#0b1f3a]">{v}</dd></div>
            ))}
            <div className="flex justify-between gap-3 border-t border-slate-200 pt-2"><dt className="font-semibold text-[#0b1f3a]">Still owed</dt><dd className="font-semibold tabular-nums text-[#be123c]">{money(owed)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Payments left</dt><dd className="font-medium tabular-nums text-[#0b1f3a]">{Mo > 0 ? left : "—"}</dd></div>
            {firstDue && <div className="flex justify-between gap-3"><dt className="text-slate-500">Paid on</dt><dd className="text-right font-medium text-[#0b1f3a]">{payDayText(firstDue)}</dd></div>}
          </dl>
        </aside>
      </div>
      <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:px-8">
        <div className="flex items-center gap-2">
          <button type="button" onClick={save} disabled={busy} className={tealBtn}>{busy ? "Saving…" : "Save"}</button>
          <button type="button" onClick={onCancel} disabled={busy} className={ghostBtn}>Cancel</button>
          {error && <p role="alert" className="min-w-0 text-[13px] text-[#be123c]">{error}</p>}
        </div>
      </div>
    </div>
  );
}

function PayDialog({ purchase: f, today, onClose, onDone }: { purchase: Financed; today: string; onClose: () => void; onDone: (msg: string) => void }) {
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
    if (!a) return setError("Enter the amount you paid.");
    if (a > f.owed + 0.004) return setError(`The amount can't be more than what is still owed (${money(f.owed)}).`);
    if (!date) return setError("Choose the date you paid.");
    setBusy(true); setError("");
    const { error: e } = await createClient().rpc("financing_pay", { p_purchase: f.id, p_amount: a, p_paid_on: date, p_mode: mode, p_reference: ref, p_notes: notes });
    if (e) { setBusy(false); return setError(financingError(e)); }
    onDone(a >= f.owed - 0.004 ? `${f.name} is paid off.` : `Payment of ${money(a)} recorded. The expense is in Expenses.`);
  }
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#0b1f3a]/45 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Record payment" className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl animate-[bp-sheet-up_0.22s_ease-out] sm:max-w-md sm:rounded-2xl">
        <p className="text-[17px] font-semibold text-[#0b1f3a]">Record a payment</p>
        <p className="mt-0.5 text-[13px] text-slate-500">{f.name} · {money(f.owed)} still owed{f.next_due ? ` · next one ${dayLong(f.next_due)}` : ""}</p>
        <div className="mt-4 space-y-3">
          <div><p className="mb-1 text-[12.5px] font-medium text-slate-500">Amount paid</p>
            <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount paid" className={`${inputClass} pl-7`} /></div>
            <p className="mt-1 text-[12px] text-slate-400">Pay more to finish sooner, or the full {money(f.owed)} to pay it off.</p></div>
          <div className="grid grid-cols-2 gap-3">
            <div><p className="mb-1 text-[12.5px] font-medium text-slate-500">Date paid</p><DatePicker value={date} onChange={setDate} /></div>
            <div><p className="mb-1 text-[12.5px] font-medium text-slate-500">Paid with</p><SelectMenu ariaLabel="Paid with" value={mode} onChange={setMode} options={PAYMENT_MODES.map((m) => ({ value: m, label: m }))} /></div>
          </div>
          <div><p className="mb-1 text-[12.5px] font-medium text-slate-500">Reference <span className="font-normal text-slate-400">· optional</span></p>
            <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Confirmation number" aria-label="Reference" className={inputClass} /></div>
          <div><p className="mb-1 text-[12.5px] font-medium text-slate-500">Note <span className="font-normal text-slate-400">· optional</span></p>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Note" className={inputClass} /></div>
        </div>
        <p className="mt-3 rounded-xl bg-[#e9f7f4] px-3.5 py-2.5 text-[12.5px] text-[#0f5f59]">This adds the expense to Expenses as {f.category}, so you don&apos;t write it twice.</p>
        {error && <p role="alert" className="mt-3 text-[13px] text-[#be123c]">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={ghostBtn}>Cancel</button>
          <button type="button" onClick={save} disabled={busy} className={tealBtn}>{busy ? "Saving…" : "Record payment"}</button>
        </div>
      </div>
    </div>
  );
}
