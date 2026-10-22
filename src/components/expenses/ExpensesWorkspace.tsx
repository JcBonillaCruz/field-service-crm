"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PAYMENT_MODES, fmtD, money, round2, today } from "@/lib/sales";
import { inputClass } from "@/components/customers/ui";
import DatePicker from "@/components/ui/DatePicker";
import SelectMenu from "@/components/ui/SelectMenu";
import { Modal, Toast, btnGhost, btnPrimary } from "@/components/sales/SalesBits";

export type Expense = {
  id: string; company_id: string; expense_date: string; category: string; vendor: string | null; amount: number; payment_mode: string | null;
  reference: string | null; notes: string | null; receipt_path: string | null; receipt_name: string | null; created_by_name: string | null; created_at: string;
};

// Categorías comunes para negocios de servicio (HVAC, limpieza, restauración…)
export const CATEGORIES: { name: string; icon: string; color: string }[] = [
  { name: "Materials & Supplies", icon: "M12 3 20 7.5v9L12 21l-8-4.5v-9zM4 7.5 12 12l8-4.5M12 12v9", color: "#0f766e" },
  { name: "Payroll & Labor", icon: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4", color: "#2563eb" },
  { name: "Subcontractors", icon: "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5z", color: "#7c3aed" },
  { name: "Fuel & Vehicle", icon: "M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 19a1.8 1.8 0 1 0 0-3.6A1.8 1.8 0 0 0 7 19zM17 19a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z", color: "#ea580c" },
  { name: "Equipment & Tools", icon: "M14 6l4 4-9 9H5v-4zM12 8l4 4", color: "#0369a1" },
  { name: "Rent & Utilities", icon: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z", color: "#b45309" },
  { name: "Insurance & Licenses", icon: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z", color: "#15803d" },
  { name: "Marketing & Ads", icon: "M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15 9a3 3 0 0 1 0 6M18 6a7 7 0 0 1 0 12", color: "#e8713a" },
  { name: "Software & Phone", icon: "M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2", color: "#475569" },
  { name: "Meals & Travel", icon: "M4 3v8a3 3 0 0 0 6 0V3M7 3v18M17 3c-2 0-3 2-3 5s1 4 3 4v9", color: "#be123c" },
  { name: "Other", icon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12h.01M12 12h.01M16 12h.01", color: "#64748b" },
];
const catOf = (n: string) => CATEGORIES.find((c) => c.name === n) ?? CATEGORIES[CATEGORIES.length - 1];
const PERIODS = ["This Month", "Last Month", "This Year", "All"] as const;
type Period = (typeof PERIODS)[number];

function inPeriod(d: string, p: Period) {
  const now = new Date(); const y = now.getFullYear(), m = now.getMonth();
  const ym = (yy: number, mm: number) => `${yy}-${String(mm + 1).padStart(2, "0")}`;
  if (p === "This Month") return d.startsWith(ym(y, m));
  if (p === "Last Month") { const lm = new Date(y, m - 1, 1); return d.startsWith(ym(lm.getFullYear(), lm.getMonth())); }
  if (p === "This Year") return d.startsWith(String(y));
  return true;
}

function CatIcon({ name, size = 36 }: { name: string; size?: number }) {
  const c = catOf(name);
  return (
    <span className="flex shrink-0 items-center justify-center rounded-xl" style={{ width: size, height: size, background: `${c.color}14`, color: c.color }}>
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={c.icon} /></svg>
    </span>
  );
}

export default function ExpensesWorkspace({ companyId, actor, rows, needsSql }: { companyId: string; actor: string; rows: Expense[]; needsSql: boolean }) {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("This Month");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Expense | "new" | null>(null);
  const [toast, setToast] = useState("");
  const list = useMemo(() => rows.filter((r) => inPeriod(r.expense_date, period)
    && (!q.trim() || `${r.vendor ?? ""} ${r.category} ${r.notes ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()))), [rows, period, q]);
  const total = round2(list.reduce((s, r) => s + Number(r.amount), 0));
  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    list.forEach((r) => m.set(r.category, (m.get(r.category) ?? 0) + Number(r.amount)));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [list]);
  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 2600); };

  function exportCsv() {
    const esc = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [["Date", "Category", "Vendor", "Amount", "Payment Mode", "Reference", "Notes"].join(","),
      ...list.map((r) => [r.expense_date, r.category, r.vendor, Number(r.amount).toFixed(2), r.payment_mode, r.reference, r.notes].map(esc).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `expenses-${period.toLowerCase().replace(/\s/g, "-")}.csv`; a.click();
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f6f8f9]">
      <div className="mx-auto max-w-[1100px] px-4 py-5 sm:px-6 sm:py-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#0b1f3a]">Expenses</h1>
            <p className="text-[14px] text-slate-500">Track what you spend so your dashboard shows real profit.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={exportCsv} disabled={!list.length} className="flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <svg viewBox="0 0 20 20" className="h-4 w-4 text-[#0f766e]" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 12V3m0 0L6.5 6.5M10 3l3.5 3.5M4 14v1.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V14" strokeLinecap="round" strokeLinejoin="round" /></svg>Export
            </button>
            <button type="button" onClick={() => setEdit("new")} className="group hidden h-10 items-center gap-1.5 rounded-lg bg-[#0f766e] px-4 text-[15px] font-semibold text-white shadow-sm hover:bg-[#0c5f59] sm:flex">
              <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform group-hover:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>New Expense
            </button>
          </div>
        </div>
        {needsSql && <p className="mt-4 rounded-xl bg-[#fff7ef] px-4 py-3 text-sm text-[#9a3412]">Run the SQL for Paso 3.36 in Supabase to start saving expenses.</p>}

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {PERIODS.map((p) => (
            <button key={p} type="button" onClick={() => setPeriod(p)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm transition-all ${period === p ? "bg-[#0f766e] font-semibold text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:border-[#14a39a]"}`}>{p}</button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="order-2 overflow-hidden rounded-2xl border border-slate-200 bg-white lg:order-1">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
              <svg viewBox="0 0 20 20" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vendor, category or notes" className="w-full bg-transparent py-1.5 text-[15px] focus:outline-none" />
            </div>
            {list.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-lg font-semibold text-[#0b1f3a]">No expenses {period === "All" ? "yet" : `for ${period.toLowerCase()}`}</p>
                <p className="mx-auto mt-1 max-w-sm text-[15px] text-slate-500">Add supplies, payroll, fuel, materials… everything you spend to see your real profit.</p>
                <button type="button" onClick={() => setEdit("new")} className="mt-5 rounded-lg bg-[#0f766e] px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-[#0c5f59]">Add your first expense</button>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {list.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => setEdit(r)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#f6fbfa] active:bg-[#e9f7f4]">
                      <CatIcon name={r.category} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium text-[#0b1f3a]">{r.vendor || r.category}</span>
                        <span className="block truncate text-[13px] text-slate-500">{fmtD(r.expense_date)} · {r.category}{r.notes ? ` · ${r.notes}` : ""}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-semibold tabular-nums text-[#be123c]">-{money(r.amount)}</span>
                        {r.payment_mode && <span className="block text-[12px] text-slate-400">{r.payment_mode}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="order-1 space-y-3 lg:order-2">
            <div className="rounded-2xl bg-gradient-to-br from-[#0b1f3a] via-[#123a5c] to-[#0f766e] p-5 text-white">
              <p className="text-sm text-white/70">Spent · {period}</p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{money(total)}</p>
              <p className="mt-1 text-[13px] text-white/60">{list.length} {list.length === 1 ? "expense" : "expenses"}</p>
            </div>
            {byCat.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-slate-500">By category</p>
                <ul className="space-y-3">
                  {byCat.slice(0, 6).map(([name, v]) => (
                    <li key={name}>
                      <div className="flex items-center gap-2.5 text-[14px]"><CatIcon name={name} size={28} /><span className="flex-1 truncate text-slate-700">{name}</span><span className="font-semibold tabular-nums text-[#0b1f3a]">{money(v)}</span></div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${(v / (byCat[0][1] || 1)) * 100}%`, background: catOf(name).color }} /></div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      <button type="button" onClick={() => setEdit("new")} aria-label="New expense"
        className="fixed bottom-6 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#0f766e] text-white shadow-lg shadow-[#0f766e]/30 transition-transform active:scale-95 sm:hidden">
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
      </button>
      <ExpenseModal open={edit !== null} expense={edit === "new" ? null : edit} onClose={() => setEdit(null)} companyId={companyId} actor={actor}
        onSaved={(m) => { setEdit(null); router.refresh(); flash(m); }} />
      <Toast text={toast} />
    </div>
  );
}

function ExpenseModal({ open, expense, onClose, companyId, actor, onSaved }: {
  open: boolean; expense: Expense | null; onClose: () => void; companyId: string; actor: string; onSaved: (msg: string) => void;
}) {
  const [date, setDate] = useState(today());
  const [cat, setCat] = useState(CATEGORIES[0].name);
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("Credit Card");
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const key = `${open}-${expense?.id ?? "new"}`;
  const [loaded, setLoaded] = useState("");
  if (open && loaded !== key) {
    setLoaded(key);
    setDate(expense?.expense_date ?? today()); setCat(expense?.category ?? CATEGORIES[0].name); setVendor(expense?.vendor ?? "");
    setAmount(expense ? String(expense.amount) : ""); setMode(expense?.payment_mode ?? "Credit Card"); setRef(expense?.reference ?? "");
    setNotes(expense?.notes ?? ""); setFile(null); setError("");
  }
  if (!open && loaded) setLoaded("");

  async function save() {
    const a = round2(Number(amount.replace(/[^0-9.]/g, "")));
    if (!a || a <= 0) return setError("Enter the amount.");
    setBusy(true); setError("");
    const s = createClient();
    let receipt: { receipt_path?: string; receipt_name?: string } = {};
    if (file) {
      if (file.size > 10 * 1024 * 1024) { setBusy(false); return setError("The receipt must be 10 MB or smaller."); }
      const path = `${companyId}/expenses/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const up = await s.storage.from("sales-attachments").upload(path, file);
      if (!up.error) receipt = { receipt_path: path, receipt_name: file.name };
    }
    const row = { expense_date: date, category: cat, vendor: vendor.trim() || null, amount: a, payment_mode: mode, reference: ref.trim() || null, notes: notes.trim() || null, ...receipt, updated_at: new Date().toISOString() };
    const { error: e } = expense
      ? await s.from("expenses").update(row).eq("id", expense.id)
      : await s.from("expenses").insert({ ...row, company_id: companyId, created_by_name: actor });
    setBusy(false);
    if (e) return setError("It couldn't be saved. Did you run the SQL for Paso 3.36?");
    onSaved(expense ? "Expense updated." : "Expense added.");
  }
  async function remove() {
    if (!expense || !window.confirm("Delete this expense?")) return;
    const s = createClient();
    if (expense.receipt_path) await s.storage.from("sales-attachments").remove([expense.receipt_path]);
    await s.from("expenses").delete().eq("id", expense.id);
    onSaved("Expense deleted.");
  }
  async function openReceipt() {
    if (!expense?.receipt_path) return;
    const { data } = await createClient().storage.from("sales-attachments").createSignedUrl(expense.receipt_path, 120);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  return (
    <Modal open={open} onClose={onClose} title={expense ? "Edit Expense" : "New Expense"} width="max-w-xl"
      footer={<>
        <button type="button" onClick={save} disabled={busy} className={btnPrimary}>{busy ? "Saving..." : "Save"}</button>
        <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
        {expense && <button type="button" onClick={remove} className="ml-auto text-sm font-medium text-red-600 hover:underline">Delete</button>}
        {error && <p role="alert" className="w-full text-sm text-red-600">{error}</p>}
      </>}>
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Category</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CATEGORIES.map((c) => (
              <button key={c.name} type="button" onClick={() => setCat(c.name)}
                className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-[13px] transition-all active:scale-[0.97] ${cat === c.name ? "border-[#0f766e] bg-[#f3fbf8] font-semibold text-[#0b1f3a]" : "border-slate-200 text-slate-600 hover:border-[#14a39a]"}`}>
                <CatIcon name={c.name} size={26} /><span className="min-w-0 leading-tight">{c.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-red-600">Amount*</span>
            <div className="flex"><span className="flex items-center rounded-l-lg border border-r-0 border-slate-200 bg-slate-100 px-3 text-sm text-slate-600">USD</span>
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.00" className={`${inputClass} rounded-l-none`} /></div></label>
          <div><span className="mb-1.5 block text-sm font-medium text-slate-700">Date</span><DatePicker value={date} onChange={setDate} /></div>
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Vendor / Paid to</span>
            <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="e.g. Home Depot, John (helper)" className={inputClass} /></label>
          <div><span className="mb-1.5 block text-sm font-medium text-slate-700">Paid with</span>
            <SelectMenu value={mode} options={PAYMENT_MODES.map((m) => ({ value: m, label: m }))} onChange={setMode} ariaLabel="Payment mode" /></div>
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Reference#</span>
            <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Receipt or check #" className={inputClass} /></label>
          <div><span className="mb-1.5 block text-sm font-medium text-slate-700">Receipt</span>
            <input ref={input} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
            <button type="button" onClick={() => input.current?.click()} className="flex w-full items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-left text-sm text-slate-600 hover:border-[#14a39a]">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#0f766e]" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h3l2-3h6l2 3h3v13H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" strokeLinejoin="round" /></svg>
              <span className="truncate">{file ? file.name : expense?.receipt_name ? "Replace photo / PDF" : "Take photo or upload"}</span>
            </button>
            {expense?.receipt_path && !file && <button type="button" onClick={openReceipt} className="mt-1 text-[13px] font-medium text-[#0f766e] hover:underline">View receipt ({expense.receipt_name})</button>}
          </div>
        </div>
        <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Notes</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was it for?" className={inputClass} /></label>
      </div>
    </Modal>
  );
}
