"use client";

import { confirmDelete } from "@/lib/confirm";
import { useMemo, useRef, useState, useTransition } from "react";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions, Menu, MenuButton, MenuItem, MenuItems, Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { parseCsv } from "@/lib/csv";
import { usePathname, useRouter } from "next/navigation";
import { RANGES, RangeKey, short } from "@/lib/expense-range";
import { createClient } from "@/lib/supabase/client";
import { PAYMENT_MODES, fmtD, money, round2, today } from "@/lib/sales";
import { inputClass } from "@/components/customers/ui";
import DatePicker from "@/components/ui/DatePicker";
import SelectMenu from "@/components/ui/SelectMenu";
import { Modal, Toast, btnGhost, btnPrimary } from "@/components/sales/SalesBits";

// =====================================================================
// Libro de Finanzas: el mismo diseño sirve para Gastos (rojo) y Entradas de dinero (verde).
// =====================================================================
export type Entry = {
  id: string; company_id: string; date: string; category: string; party: string | null; amount: number; payment_mode: string | null;
  reference: string | null; notes: string | null; receipt_path: string | null; receipt_name: string | null; created_by_name: string | null; created_at: string;
};
export type Expense = Entry; // compatibilidad
export type LedgerKind = "expense" | "income";
type Cat = { name: string; icon: string; color: string };

// Categorías comunes para negocios de servicio (HVAC, limpieza, restauración…)
export const CATEGORIES: Cat[] = [
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
  { name: "Repairs & Maintenance", icon: "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5z", color: "#0d9488" },
  { name: "Permits & Fees", icon: "M6 3h9l4 4v14H6zM15 3v4h4M9 12h6M9 16h4", color: "#4f46e5" },
  { name: "Office Supplies", icon: "M4 7h16v13H4zM9 7V4h6v3M4 12h16", color: "#0891b2" },
  { name: "Uniforms & Safety", icon: "M8 3 4 6v4h3v11h10V10h3V6l-4-3a4 4 0 0 1-8 0z", color: "#9333ea" },
  { name: "Disposal & Dump Fees", icon: "M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13", color: "#57534e" },
  { name: "Bank & Card Fees", icon: "M3 6.5h18v11H3zM3 10h18M7 14.5h3", color: "#ca8a04" },
  { name: "Training & Education", icon: "M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5", color: "#db2777" },
  { name: "Other", icon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12h.01M12 12h.01M16 12h.01", color: "#64748b" },
];
// Entradas de dinero que no vienen de una factura (tratos de palabra, cobros directos…)
export const INCOME_CATEGORIES: Cat[] = [
  { name: "Cash job", icon: "M3 7h18v10H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 10v.01M18 14v.01", color: "#059669" },
  { name: "Verbal agreement", icon: "M7 11V7a5 5 0 0 1 10 0v4M5 11h14v9H5zM12 15v2", color: "#0f766e" },
  { name: "Direct payment", icon: "M3 6.5h18v11H3zM3 10h18M7 14.5h3", color: "#2563eb" },
  { name: "Deposit / Advance", icon: "M12 3v12M7 10l5 5 5-5M5 21h14", color: "#7c3aed" },
  { name: "Tips", icon: "M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z", color: "#db2777" },
  { name: "Refund received", icon: "M4 12a8 8 0 1 0 3-6.2M4 4v4h4", color: "#0369a1" },
  { name: "Equipment sale", icon: "M14 6l4 4-9 9H5v-4zM12 8l4 4", color: "#b45309" },
  { name: "Rental income", icon: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z", color: "#ca8a04" },
  { name: "Interest", icon: "M5 19 19 5M7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", color: "#15803d" },
  { name: "Other", icon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12h.01M12 12h.01M16 12h.01", color: "#64748b" },
];

export const LEDGER = {
  expense: {
    table: "expenses", dateCol: "expense_date", partyCol: "vendor", folder: "expenses", cats: CATEGORIES,
    title: "Expenses", subtitle: "Track what you spend so your dashboard shows real profit.", newLabel: "New Expense", editLabel: "Edit Expense",
    one: "expense", many: "expenses", verb: "Spent", color: "#e11d48", sign: "-", dot: "#e11d48",
    partyLabel: "Vendor / Paid to", partyPh: "e.g. Home Depot, John (helper)", modeLabel: "Paid with", partyCsv: "Vendor",
    empty: "Add supplies, payroll, fuel, materials… everything you spend to see your real profit.", sql: "Run the SQL for Paso 3.36 in Supabase to start saving expenses.",
  },
  income: {
    table: "other_income", dateCol: "income_date", partyCol: "payer", folder: "income", cats: INCOME_CATEGORIES,
    title: "Money In", subtitle: "Record money you receive outside of invoices: cash jobs, verbal deals, direct payments.", newLabel: "New Money In", editLabel: "Edit Money In",
    one: "entry", many: "entries", verb: "Received", color: "#059669", sign: "+", dot: "#10b981",
    partyLabel: "Received from", partyPh: "e.g. Mr. Lopez, neighbor job", modeLabel: "Received by", partyCsv: "From",
    empty: "Add cash jobs, verbal deals and direct payments so your dashboard shows all the money that comes in.", sql: "Run the SQL for Money In (paso-finanzas-money-in.sql) in Supabase to start saving entries.",
  },
} as const;
type Cfg = (typeof LEDGER)[LedgerKind];

function catOf(cats: readonly Cat[], n: string) { return cats.find((c) => c.name === n) ?? cats[cats.length - 1]; }

function CatIcon({ cats, name, size = 36 }: { cats: readonly Cat[]; name: string; size?: number }) {
  const c = catOf(cats, name);
  return (
    <span className="flex shrink-0 items-center justify-center rounded-xl" style={{ width: size, height: size, background: `${c.color}14`, color: c.color }}>
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={c.icon} /></svg>
    </span>
  );
}

// Selector de periodo: un solo botón desplegable (no choca con la búsqueda)
function PeriodPicker({ range, onPick }: { range: { key: RangeKey; from: string; to: string; label: string }; onPick: (k: RangeKey, from?: string, to?: string) => void }) {
  const [month, setMonth] = useState(range.from.slice(0, 7));
  const [day, setDay] = useState("");
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const pickMonth = (mm: string) => {
    if (!/^\d{4}-\d{2}$/.test(mm)) return;
    const [y, m] = mm.split("-").map(Number);
    onPick("custom", `${mm}-01`, `${mm}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`);
  };
  const sub = "mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400";
  return (
    <Popover className="min-w-0 flex-1 sm:max-w-xs">
      <PopoverButton className="group flex h-10 w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-[14px] font-semibold text-[#0b1f3a] hover:border-[#14a39a] focus:outline-none data-[open]:border-[#0f766e]">
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-[#0f766e]" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4.5" width="14" height="12" rx="2" /><path d="M3 8h14M7 3v3M13 3v3" strokeLinecap="round" /></svg>
        <span className="min-w-0 flex-1 truncate">{range.label}</span>
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-data-[open]:rotate-180" fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
      </PopoverButton>
      <PopoverPanel anchor="bottom start" transition className="z-[80] mt-1 max-h-[75vh] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_16px_44px_rgba(15,40,60,0.18)] transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0">
        {({ close }) => (
          <>
            {RANGES.filter((x) => x.key !== "custom").map((x) => (
              <button key={x.key} type="button" onClick={() => { onPick(x.key); close(); }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[14px] hover:bg-[#eef8f5] ${range.key === x.key ? "bg-[#d7f1eb] font-semibold text-[#0b3f3b]" : "text-slate-700"}`}>
                {x.label}
                {range.key === x.key && <svg viewBox="0 0 20 20" className="h-4 w-4 text-[#0f766e]" fill="currentColor"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" /></svg>}
              </button>
            ))}
            <div className="mt-2 space-y-3 border-t border-slate-100 px-2 pb-2 pt-3">
              <div>
                <p className={sub}>A specific month</p>
                <div className="flex gap-2">
                  <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={`${inputClass} min-w-0 flex-1`} />
                  <button type="button" onClick={() => { pickMonth(month); close(); }} className="shrink-0 rounded-lg border border-[#0f766e] px-3 text-[13px] font-semibold text-[#0f766e] hover:bg-[#f0faf7]">Show</button>
                </div>
              </div>
              <div>
                <p className={sub}>A specific date</p>
                <div className="flex gap-2">
                  <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={`${inputClass} min-w-0 flex-1`} />
                  <button type="button" disabled={!day} onClick={() => { onPick("custom", day, day); close(); }} className="shrink-0 rounded-lg border border-[#0f766e] px-3 text-[13px] font-semibold text-[#0f766e] hover:bg-[#f0faf7] disabled:opacity-40">Show</button>
                </div>
              </div>
              <div>
                <p className={sub}>Date range</p>
                {/* Calendario nativo del celular/computadora (no se cierra el menú al elegir) */}
                <div className="grid grid-cols-2 gap-2">
                  <label className="block"><span className="mb-1 block text-[12px] text-slate-500">From</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputClass} w-full px-2`} /></label>
                  <label className="block"><span className="mb-1 block text-[12px] text-slate-500">To</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputClass} w-full px-2`} /></label>
                </div>
                <button type="button" disabled={!from || !to} onClick={() => { onPick("custom", from, to); close(); }}
                  className="mt-2 w-full rounded-lg bg-[#0f766e] py-2.5 text-[14px] font-semibold text-white hover:bg-[#0c5f59] disabled:opacity-50">Apply range</button>
              </div>
            </div>
          </>
        )}
      </PopoverPanel>
    </Popover>
  );
}

export default function ExpensesWorkspace({ kind = "expense", companyId, actor, rows, needsSql, range }: {
  kind?: LedgerKind; companyId: string; actor: string; rows: Entry[]; needsSql: boolean; range: { key: RangeKey; from: string; to: string; label: string };
}) {
  const cfg = LEDGER[kind];
  const cats = cfg.cats;
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Entry | "new" | null>(null);
  const [toast, setToast] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  // El rango ya viene filtrado desde la base de datos; aquí solo se aplica la búsqueda
  const list = useMemo(() => rows.filter((r) => !q.trim() || `${r.party ?? ""} ${r.category} ${r.notes ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())), [rows, q]);
  const total = round2(list.reduce((s, r) => s + Number(r.amount), 0));
  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    list.forEach((r) => m.set(r.category, (m.get(r.category) ?? 0) + Number(r.amount)));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [list]);
  const byDay = useMemo(() => {
    const m = new Map<string, Entry[]>();
    list.forEach((r) => m.set(r.date, [...(m.get(r.date) ?? []), r]));
    return Array.from(m.entries());
  }, [list]);
  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 2600); };
  const amt = (v: number) => `${cfg.sign}${money(v)}`;

  function go(key: RangeKey, from?: string, to?: string) {
    const sp = new URLSearchParams({ range: key });
    if (key === "custom" && from && to) { sp.set("from", from); sp.set("to", to); }
    startTransition(() => router.replace(`${pathname}?${sp.toString()}`, { scroll: false }));
  }

  function exportCsv() {
    const esc = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [["Date", "Category", cfg.partyCsv, "Amount", "Payment Mode", "Reference", "Notes"].join(","),
      ...list.map((r) => [r.date, r.category, r.party, Number(r.amount).toFixed(2), r.payment_mode, r.reference, r.notes].map(esc).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${cfg.folder}-${range.from}-to-${range.to}.csv`; a.click();
  }
  function templateCsv() {
    const a = document.createElement("a");
    const sample = kind === "income" ? `${today()},Cash job,Mr. Lopez,350.00,Cash,,AC tune-up paid in cash` : `${today()},Materials & Supplies,Home Depot,125.40,Credit Card,,Copper fittings`;
    a.href = URL.createObjectURL(new Blob([`Date,Category,${cfg.partyCsv},Amount,Payment Mode,Reference,Notes\n${sample}\n`], { type: "text/csv" }));
    a.download = `${cfg.folder}-template.csv`; a.click();
  }
  async function importCsv(file?: File) {
    if (!file) return;
    const data0 = parseCsv(await file.text());
    if (data0.length < 2) return flash("The file is empty.");
    const head = data0[0].map((h) => h.trim().toLowerCase());
    const col = (...names: string[]) => head.findIndex((h) => names.includes(h));
    const ci = { date: col("date", "expense date", "income date"), cat: col("category"), party: col("vendor", "paid to", "payee", "from", "received from", "payer"), amount: col("amount", "total"), mode: col("payment mode", "paid with", "received by"), ref: col("reference", "reference#"), notes: col("notes", "description") };
    if (ci.amount < 0) return flash("The file needs an Amount column.");
    const toISO = (v: string) => { const t = v.trim(); if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10); const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(t); if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`; return today(); };
    const data = data0.slice(1).filter((r) => r.some((c) => c.trim())).map((r) => ({
      company_id: companyId, created_by_name: actor, [cfg.dateCol]: ci.date >= 0 ? toISO(r[ci.date] ?? "") : today(),
      category: (ci.cat >= 0 && r[ci.cat]?.trim()) || "Other", [cfg.partyCol]: ci.party >= 0 ? r[ci.party]?.trim() || null : null,
      amount: round2(Number(String(r[ci.amount] ?? "").replace(/[^0-9.]/g, ""))), payment_mode: ci.mode >= 0 ? r[ci.mode]?.trim() || null : null,
      reference: ci.ref >= 0 ? r[ci.ref]?.trim() || null : null, notes: ci.notes >= 0 ? r[ci.notes]?.trim() || null : null,
    })).filter((x) => Number(x.amount) > 0);
    if (!data.length) return flash("No rows with an amount were found.");
    if (!window.confirm(`Import ${data.length} ${data.length === 1 ? cfg.one : cfg.many}?`)) return;
    const { error } = await createClient().from(cfg.table).insert(data);
    if (error) return flash(`The import failed. ${cfg.sql}`);
    router.refresh(); flash(`${data.length} ${cfg.many} imported.`);
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f6f8f9]">
      <div className="mx-auto max-w-[1100px] px-4 py-5 sm:px-6 sm:py-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#0b1f3a]">{cfg.title}</h1>
            <p className="text-[14px] text-slate-500">{cfg.subtitle}</p>
          </div>
          <button type="button" onClick={() => setEdit("new")} className="group flex h-10 items-center gap-1.5 rounded-lg bg-[#0f766e] px-4 text-[15px] font-semibold text-white shadow-sm transition-transform hover:bg-[#0c5f59] active:scale-95">
            <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform group-hover:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>{cfg.newLabel}
          </button>
        </div>
        {needsSql && <p className="mt-4 rounded-xl bg-[#fff7ef] px-4 py-3 text-sm text-[#9a3412]">{cfg.sql}</p>}

        {/* Barra: periodo ▾ · buscar · ⋯ */}
        <div className="mt-5 flex items-center gap-2">
          <PeriodPicker key={`${range.key}-${range.from}-${range.to}`} range={range} onPick={go} />
          <button type="button" aria-label="Search" onClick={() => setSearchOpen((v) => !v)}
            className={`ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-white ${searchOpen || q ? "border-[#0f766e] text-[#0f766e]" : "border-slate-200 text-slate-500"}`}>
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg>
          </button>
          <Menu>
            <MenuButton aria-label="More" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 focus:outline-none data-[open]:border-[#14a39a]">
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor"><circle cx="4.5" cy="10" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="15.5" cy="10" r="1.6" /></svg>
            </MenuButton>
            <MenuItems anchor="bottom end" transition className="z-[80] mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_40px_rgba(15,40,60,0.16)] transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0 focus:outline-none">
              <MenuItem><button type="button" onClick={exportCsv} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 data-[focus]:bg-[#e3f4ef]">Export this period (CSV)</button></MenuItem>
              <MenuItem><button type="button" onClick={() => importRef.current?.click()} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 data-[focus]:bg-[#e3f4ef]">Import from CSV</button></MenuItem>
              <MenuItem><button type="button" onClick={templateCsv} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-500 data-[focus]:bg-[#e3f4ef]">Download import template</button></MenuItem>
            </MenuItems>
          </Menu>
          <input ref={importRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { importCsv(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
        {(searchOpen || q) && (
          <div className="mt-2 flex h-10 items-center gap-2 rounded-lg border border-[#0f766e] bg-white px-3 animate-[bp-fade_0.2s_ease-out]">
            <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.9"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${cfg.partyLabel.toLowerCase()}, category or notes`} className="min-w-0 flex-1 bg-transparent text-[15px] focus:outline-none" />
            {q && <button type="button" onClick={() => setQ("")} className="text-[13px] font-medium text-slate-400">Clear</button>}
          </div>
        )}

        <div className={`transition-opacity duration-200 ${pending ? "opacity-50" : "opacity-100"}`}>
          {/* Tarjeta blanca (igual que el Home): rojo para gastos, verde para entradas */}
          <div className="mt-4 rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-[0_6px_20px_rgba(15,40,60,0.05)]">
            <p className="flex items-center gap-2 text-[14px] font-medium text-slate-500">
              <span className="inline-flex h-2 w-2 rounded-full" style={{ background: cfg.dot }} />{cfg.verb} · {range.label}
            </p>
            <p className="mt-1 text-[40px] font-bold leading-none tracking-tight tabular-nums sm:text-[44px]" style={{ color: cfg.color }}>{amt(total)}</p>
            <p className="mt-2 text-[13px] text-slate-500">{list.length} {list.length === 1 ? cfg.one : cfg.many} · {short(range.from)} – {short(range.to)}</p>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {list.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <p className="text-lg font-semibold text-[#0b1f3a]">{q ? `No ${cfg.many} match your search` : `No ${cfg.many} for ${range.label.toLowerCase()}`}</p>
                  <p className="mx-auto mt-1 max-w-sm text-[15px] text-slate-500">{cfg.empty}</p>
                  <button type="button" onClick={() => setEdit("new")} className="mt-5 rounded-lg bg-[#0f766e] px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-[#0c5f59]">{cfg.newLabel}</button>
                </div>
              ) : (
                <div>
                  {byDay.map(([day, items]) => (
                    <section key={day}>
                      {/* Encabezado de fecha (normal, no pegajoso: así nunca tapa los montos) */}
                      <div className="flex items-center justify-between border-y border-slate-100 bg-slate-50 px-4 py-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500 first:border-t-0">
                        <span>{fmtD(day)}</span>
                        <span className="tabular-nums" style={{ color: cfg.color }}>{amt(items.reduce((a, r) => a + Number(r.amount), 0))}</span>
                      </div>
                      <ul className="divide-y divide-slate-100">
                        {items.map((r) => (
                          <li key={r.id}>
                            <button type="button" onClick={() => setEdit(r)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#f6fbfa] active:bg-[#e9f7f4]">
                              <CatIcon cats={cats} name={r.category} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[15px] font-medium text-[#0b1f3a]">{r.category}</span>
                                <span className="block truncate text-[13px] text-slate-500">{[r.party, r.payment_mode, r.notes].filter(Boolean).join(" · ") || "—"}</span>
                              </span>
                              <span className="shrink-0 pl-2 font-semibold tabular-nums" style={{ color: cfg.color }}>{amt(r.amount)}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </div>
            {byCat.length > 0 && (
              <div className="h-fit rounded-2xl border border-slate-200 bg-white p-4">
                <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-slate-500">By category</p>
                <ul className="space-y-3">
                  {byCat.slice(0, 8).map(([name, v]) => (
                    <li key={name}>
                      <div className="flex items-center gap-2.5 text-[14px]"><CatIcon cats={cats} name={name} size={28} /><span className="flex-1 truncate text-slate-700">{name}</span><span className="font-semibold tabular-nums" style={{ color: cfg.color }}>{amt(v)}</span></div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${(v / (byCat[0][1] || 1)) * 100}%`, background: catOf(cats, name).color }} /></div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      <ExpenseModal cfg={cfg} open={edit !== null} expense={edit === "new" ? null : edit} onClose={() => setEdit(null)} companyId={companyId} actor={actor}
        onSaved={(m) => { setEdit(null); router.refresh(); flash(m); }} />
      <Toast text={toast} />
    </div>
  );
}

function ExpenseModal({ cfg, open, expense, onClose, companyId, actor, onSaved }: {
  cfg: Cfg; open: boolean; expense: Entry | null; onClose: () => void; companyId: string; actor: string; onSaved: (msg: string) => void;
}) {
  const [date, setDate] = useState(today());
  const cats = cfg.cats;
  const [cat, setCat] = useState<string>(cats[0].name);
  const [custom, setCustom] = useState("");
  const isCustom = !cats.some((c) => c.name === cat);
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<string>(cfg.table === "expenses" ? "Credit Card" : "Cash");
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
    setDate(expense?.date ?? today()); setCat(expense?.category ?? cats[0].name);
    setCustom(expense && !cats.some((c) => c.name === expense.category) ? expense.category : ""); setVendor(expense?.party ?? "");
    setAmount(expense ? String(expense.amount) : ""); setMode(expense?.payment_mode ?? (cfg.table === "expenses" ? "Credit Card" : "Cash")); setRef(expense?.reference ?? "");
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
      const path = `${companyId}/${cfg.folder}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const up = await s.storage.from("sales-attachments").upload(path, file);
      if (!up.error) receipt = { receipt_path: path, receipt_name: file.name };
    }
    const category = (isCustom || cat === "Other") ? (custom.trim() || "Other") : cat;
    const row = { [cfg.dateCol]: date, category, [cfg.partyCol]: vendor.trim() || null, amount: a, payment_mode: mode, reference: ref.trim() || null, notes: notes.trim() || null, ...receipt, updated_at: new Date().toISOString() };
    const { error: e } = expense
      ? await s.from(cfg.table).update(row).eq("id", expense.id)
      : await s.from(cfg.table).insert({ ...row, company_id: companyId, created_by_name: actor });
    setBusy(false);
    if (e) return setError(`It couldn't be saved. ${cfg.sql}`);
    onSaved(expense ? "Saved." : `${cfg.one[0].toUpperCase()}${cfg.one.slice(1)} added.`);
  }
  async function remove() {
    if (!expense || !(await confirmDelete({ title: `Delete this ${cfg.one}?`, download: { filename: `${cfg.folder}-${expense.date}`, data: expense } }))) return;
    const s = createClient();
    if (expense.receipt_path) await s.storage.from("sales-attachments").remove([expense.receipt_path]);
    await s.from(cfg.table).delete().eq("id", expense.id);
    onSaved("Deleted.");
  }
  async function openReceipt() {
    if (!expense?.receipt_path) return;
    const { data } = await createClient().storage.from("sales-attachments").createSignedUrl(expense.receipt_path, 120);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  return (
    <Modal open={open} onClose={onClose} title={expense ? cfg.editLabel : cfg.newLabel} width="max-w-xl"
      footer={<>
        <button type="button" onClick={save} disabled={busy} className={btnPrimary}>{busy ? "Saving..." : "Save"}</button>
        <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
        {expense && <button type="button" onClick={remove} className="ml-auto text-sm font-medium text-red-600 hover:underline">Delete</button>}
        {error && <p role="alert" className="w-full text-sm text-red-600">{error}</p>}
      </>}>
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">Category</p>
          <Listbox value={isCustom ? "Other" : cat} onChange={(v: string) => { setCat(v); if (v !== "Other") setCustom(""); }}>
            <ListboxButton className="group flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-[15px] hover:border-[#14a39a] focus:outline-none data-[open]:border-[#0f766e] data-[open]:bg-white">
              <CatIcon cats={cats} name={isCustom ? "Other" : cat} size={30} /><span className="flex-1 text-[#0b1f3a]">{isCustom ? "Other" : cat}</span>
              <svg viewBox="0 0 20 20" className="h-4 w-4 text-slate-400 transition-transform group-data-[open]:rotate-180" fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
            </ListboxButton>
            <ListboxOptions anchor="bottom start" transition className="z-[100] mt-1 max-h-72 w-[var(--button-width)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_16px_44px_rgba(15,40,60,0.16)] transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0 focus:outline-none">
              {cats.map((c) => (
                <ListboxOption key={c.name} value={c.name} className="group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-[14px] text-slate-700 data-[focus]:bg-[#eef8f5] data-[selected]:bg-[#d7f1eb] data-[selected]:font-semibold data-[selected]:text-[#0b3f3b]">
                  <CatIcon cats={cats} name={c.name} size={28} />{c.name}
                </ListboxOption>
              ))}
            </ListboxOptions>
          </Listbox>
          {(isCustom || cat === "Other") && (
            <input autoFocus value={custom} onChange={(e) => setCustom(e.target.value.slice(0, 40))} placeholder="What was it? e.g. Storage unit, Parking"
              className={`${inputClass} mt-2 animate-[bp-fade_0.2s_ease-out]`} />
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-red-600">Amount*</span>
            <div className="flex"><span className="flex items-center rounded-l-lg border border-r-0 border-slate-200 bg-slate-100 px-3 text-sm text-slate-600">USD</span>
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.00" className={`${inputClass} rounded-l-none`} /></div></label>
          <div><span className="mb-1.5 block text-sm font-medium text-slate-700">Date</span><DatePicker value={date} onChange={setDate} /></div>
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">{cfg.partyLabel}</span>
            <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder={cfg.partyPh} className={inputClass} /></label>
          <div><span className="mb-1.5 block text-sm font-medium text-slate-700">{cfg.modeLabel}</span>
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
