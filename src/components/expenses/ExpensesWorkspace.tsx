"use client";

import type { FinBrief } from "@/lib/financing-server";
import { confirmDelete, askConfirm } from "@/lib/confirm";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions, Menu, MenuButton, MenuItem, MenuItems, Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { parseCsv } from "@/lib/csv";
import { usePathname, useRouter } from "next/navigation";
import { RangeKey } from "@/lib/expense-range";
import { createClient } from "@/lib/supabase/client";
import { round2, today } from "@/lib/sales";
import { inputClass } from "@/components/customers/ui";
import DatePicker from "@/components/ui/DatePicker";
import SelectMenu from "@/components/ui/SelectMenu";
import { Modal, Toast, btnGhost, btnPrimary } from "@/components/sales/SalesBits";
import { useCountUp } from "@/components/dashboard/MobileWidgets";
import { LedgerTracker, LedgerGlance, LedgerMobileHero } from "@/components/expenses/LedgerCharts";
import PayerPicker from "@/components/expenses/PayerPicker";
import { ProfitSummary } from "@/components/expenses/ProfitPanels";
import CustomerFilter from "@/components/expenses/CustomerFilter";
import { COST_TYPES, CostType, Profit, costTypeOf } from "@/lib/job-costing";
import { useTranslations } from "next-intl";
import { useFinTx } from "@/i18n/useFinTx";

// =====================================================================
// Libro de Finanzas: el mismo diseño sirve para Gastos (rojo) y Entradas de dinero (verde).
// =====================================================================
export type Entry = {
  id: string; company_id: string; date: string; category: string; party: string | null; amount: number; payment_mode: string | null;
  reference: string | null; notes: string | null; receipt_path: string | null; receipt_name: string | null; created_by_name: string | null; created_at: string;
  customer_id?: string | null; // cliente ligado (de la tabla customers)
  doc_id?: string | null;      // Gastos: invoice / trabajo ligado
  cost_type?: string | null;   // Gastos: material | labor | other
};
export type PayerOption = { id: string; display_name: string; company_name: string | null; email: string | null; phone: string | null };
// Barras de categorías: colores MUY distintos entre sí (por puesto, no por categoría), con degradado
export const BAR_COLORS: [string, string][] = [
  ["#0d9488", "#2dd4bf"], ["#f97316", "#fdba74"], ["#7c3aed", "#c4b5fd"], ["#2563eb", "#93c5fd"],
  ["#db2777", "#f9a8d4"], ["#ca8a04", "#fde047"], ["#0891b2", "#67e8f9"], ["#65a30d", "#bef264"],
];
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

// Paso 6.2b: los textos de cada libro (Gastos / Entradas de dinero) en el idioma de quien lo ve
function useLedgerTx(kind: LedgerKind) {
  const t = useTranslations("ledger");
  const fx = useFinTx();
  const k = { kind };
  return {
    t, fx, k,
    title: t("title", k), subtitle: t("subtitle", k), newLabel: t("newLabel", k), editLabel: t("editLabel", k), verb: t("verb", k),
    partyLabel: t("partyLabel", k), partyPh: t("partyPh", k), modeLabel: t("modeLabel", k), empty: t("empty", k), sql: t("sql", k),
  };
}

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
  const t = useTranslations("ledger");
  const fx = useFinTx();
  return (
    <Popover className="min-w-0 flex-1 sm:max-w-xs">
      <PopoverButton className="group flex h-10 w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-[14px] font-semibold text-[#0b1f3a] hover:border-[#14a39a] focus:outline-none data-[open]:border-[#0f766e]">
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-[#0f766e]" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4.5" width="14" height="12" rx="2" /><path d="M3 8h14M7 3v3M13 3v3" strokeLinecap="round" /></svg>
        <span className="min-w-0 flex-1 truncate">{fx.rangeLabel(range)}</span>
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-data-[open]:rotate-180" fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
      </PopoverButton>
      <PopoverPanel anchor="bottom start" transition className="z-[80] mt-1 max-h-[75vh] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_16px_44px_rgba(15,40,60,0.18)] transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0">
        {({ close }) => (
          <>
            {fx.ranges.filter((x) => x.key !== "custom").map((x) => (
              <button key={x.key} type="button" onClick={() => { onPick(x.key); close(); }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[14px] hover:bg-[#eef8f5] ${range.key === x.key ? "bg-[#d7f1eb] font-semibold text-[#0b3f3b]" : "text-slate-700"}`}>
                {x.label}
                {range.key === x.key && <svg viewBox="0 0 20 20" className="h-4 w-4 text-[#0f766e]" fill="currentColor"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" /></svg>}
              </button>
            ))}
            <div className="mt-2 space-y-3 border-t border-slate-100 px-2 pb-2 pt-3">
              <div>
                <p className={sub}>{t("aMonth")}</p>
                <div className="flex gap-2">
                  <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={`${inputClass} min-w-0 flex-1`} />
                  <button type="button" onClick={() => { pickMonth(month); close(); }} className="shrink-0 rounded-lg border border-[#0f766e] px-3 text-[13px] font-semibold text-[#0f766e] hover:bg-[#f0faf7]">{t("show")}</button>
                </div>
              </div>
              <div>
                <p className={sub}>{t("aDate")}</p>
                <div className="flex gap-2">
                  <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={`${inputClass} min-w-0 flex-1`} />
                  <button type="button" disabled={!day} onClick={() => { onPick("custom", day, day); close(); }} className="shrink-0 rounded-lg border border-[#0f766e] px-3 text-[13px] font-semibold text-[#0f766e] hover:bg-[#f0faf7] disabled:opacity-40">{t("show")}</button>
                </div>
              </div>
              <div>
                <p className={sub}>{t("dateRange")}</p>
                {/* Calendario nativo del celular/computadora (no se cierra el menú al elegir) */}
                <div className="grid grid-cols-2 gap-2">
                  <label className="block"><span className="mb-1 block text-[12px] text-slate-500">{t("from")}</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputClass} w-full px-2`} /></label>
                  <label className="block"><span className="mb-1 block text-[12px] text-slate-500">{t("to")}</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputClass} w-full px-2`} /></label>
                </div>
                <button type="button" disabled={!from || !to} onClick={() => { onPick("custom", from, to); close(); }}
                  className="mt-2 w-full rounded-lg bg-[#0f766e] py-2.5 text-[14px] font-semibold text-white hover:bg-[#0c5f59] disabled:opacity-50">{t("applyRange")}</button>
              </div>
            </div>
          </>
        )}
      </PopoverPanel>
    </Popover>
  );
}

export default function ExpensesWorkspace({ kind = "expense", companyId, actor, rows, needsSql, range, customers = [], linkReady = false, filterCustomer = null, profit = null, financing = [], today: todayIso = "" }: {
  kind?: LedgerKind; companyId: string; actor: string; rows: Entry[]; needsSql: boolean; range: { key: RangeKey; from: string; to: string; label: string };
  customers?: PayerOption[]; linkReady?: boolean; filterCustomer?: PayerOption | null; profit?: Profit | null;
  financing?: FinBrief[]; today?: string; // Paso 5.12: compras a pagos abiertas (solo en Expenses, dueño y manager)
}) {
  const cfg = LEDGER[kind];
  const L = useLedgerTx(kind);
  const { t, fx, k } = L;
  const money = fx.money, fmtD = fx.fmtD;
  const rangeLabel = fx.rangeLabel(range);
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
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2600); };
  const [removing, setRemoving] = useState<string | null>(null);
  // Borrar directo desde la lista (con la advertencia de siempre)
  async function removeEntry(r: Entry) {
    if (!(await confirmDelete({ title: t("delRow", { ...k, amt: money(r.amount) }), message: t("delRowMsg", { what: `${fx.cat(r.category)}${r.party ? ` · ${r.party}` : ""} · ${fmtD(r.date)}` }),
      download: { filename: `${cfg.folder}-${r.date}`, data: r } }))) return;
    setRemoving(r.id);
    const s = createClient();
    if (r.receipt_path) await s.storage.from("sales-attachments").remove([r.receipt_path]);
    const { error } = await s.from(cfg.table).delete().eq("id", r.id);
    setRemoving(null);
    if (error) return flash(t("cantDelete"));
    router.refresh(); flash(t("deleted"));
  }
  const amt = (v: number) => `${cfg.sign}${money(v)}`;
  const shownTotal = useCountUp(total, 1000); // el número grande sube hasta el total
  const [people, setPeople] = useState<PayerOption[]>(customers);

  // El periodo y el cliente viven en la dirección (así se pueden compartir y el servidor filtra)
  function nav(key: RangeKey, from?: string, to?: string, customer?: string | null) {
    const sp = new URLSearchParams({ range: key });
    if (key === "custom" && from && to) { sp.set("from", from); sp.set("to", to); }
    if (customer) sp.set("customer", customer);
    startTransition(() => router.replace(`${pathname}?${sp.toString()}`, { scroll: false }));
  }
  const go = (key: RangeKey, from?: string, to?: string) => nav(key, from, to, filterCustomer?.id);
  const pickCustomer = (id: string | null) => nav(range.key, range.from, range.to, id);
  const nameOf = useMemo(() => new Map(people.map((p) => [p.id, p.display_name])), [people]);

  function exportCsv() {
    const esc = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const job = kind === "expense" && linkReady;
    // Paso 6.2b: encabezados y valores en el idioma (la plantilla para importar sigue en inglés para que siempre se pueda leer)
    const csv = [[t("cDate"), t("cCategory"), t("partyCsv", k), t("cAmount"), t("cMode"), t("cRef"), t("cNotes"), ...(linkReady ? [t("cCustomer")] : []), ...(job ? [t("cCostType")] : [])].map(esc).join(","),
      ...list.map((r) => [r.date, fx.cat(r.category), r.party, Number(r.amount).toFixed(2), r.payment_mode ? fx.pay(r.payment_mode) : "", r.reference, r.notes,
        ...(linkReady ? [r.customer_id ? nameOf.get(r.customer_id) ?? "" : ""] : []), ...(job ? [fx.costShort(r.cost_type)] : [])].map(esc).join(","))].join("\n");
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
    if (data0.length < 2) return flash(t("fileEmpty"));
    const head = data0[0].map((h) => h.trim().toLowerCase());
    const col = (...names: string[]) => head.findIndex((h) => names.includes(h));
    // También acepta los encabezados en español (los de "Exportar")
    const ci = { date: col("date", "expense date", "income date", "fecha"), cat: col("category", "categoría", "categoria"), party: col("vendor", "paid to", "payee", "from", "received from", "payer", "proveedor / pagado a", "recibido de", "proveedor", "de"), amount: col("amount", "total", "monto"), mode: col("payment mode", "paid with", "received by", "forma de pago"), ref: col("reference", "reference#", "referencia"), notes: col("notes", "description", "notas") };
    if (ci.amount < 0) return flash(t("needsAmount"));
    const toISO = (v: string) => { const t = v.trim(); if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10); const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(t); if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`; return today(); };
    const data = data0.slice(1).filter((r) => r.some((c) => c.trim())).map((r) => ({
      company_id: companyId, created_by_name: actor, [cfg.dateCol]: ci.date >= 0 ? toISO(r[ci.date] ?? "") : today(),
      category: (ci.cat >= 0 && r[ci.cat]?.trim()) || "Other", [cfg.partyCol]: ci.party >= 0 ? r[ci.party]?.trim() || null : null,
      amount: round2(Number(String(r[ci.amount] ?? "").replace(/[^0-9.]/g, ""))), payment_mode: ci.mode >= 0 ? r[ci.mode]?.trim() || null : null,
      reference: ci.ref >= 0 ? r[ci.ref]?.trim() || null : null, notes: ci.notes >= 0 ? r[ci.notes]?.trim() || null : null,
    })).filter((x) => Number(x.amount) > 0);
    if (!data.length) return flash(t("noRows"));
    if (!(await askConfirm({ title: t("importQ", { ...k, n: data.length }), confirmLabel: t("import") }))) return;
    const { error } = await createClient().from(cfg.table).insert(data);
    if (error) return flash(`${t("importFailed")} ${L.sql}`);
    router.refresh(); flash(t("imported", { ...k, n: data.length }));
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f6f8f9]">
      <div className="px-3 pb-10 pt-4 lg:px-6 lg:pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-[#0b1f3a]">{L.title}</h1>
            <p className="text-[14px] text-slate-500">{L.subtitle}</p>
          </div>
          <NewButton label={L.newLabel} kind={kind} onClick={() => setEdit("new")} />
        </div>
        {needsSql && <p className="mt-4 rounded-xl bg-[#fff7ef] px-4 py-3 text-sm text-[#9a3412]">{L.sql}</p>}

        {/* Barra: periodo ▾ · buscar · ⋯ */}
        <div className="mt-5 flex items-center gap-2">
          <PeriodPicker key={`${range.key}-${range.from}-${range.to}`} range={range} onPick={go} />
          {linkReady && <CustomerFilter people={people} value={filterCustomer?.id ?? null} onChange={pickCustomer} />}
          <button type="button" aria-label={t("search")} onClick={() => setSearchOpen((v) => !v)}
            className={`ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-white ${searchOpen || q ? "border-[#0f766e] text-[#0f766e]" : "border-slate-200 text-slate-500"}`}>
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg>
          </button>
          <Menu>
            <MenuButton aria-label={t("more")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 focus:outline-none data-[open]:border-[#14a39a]">
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor"><circle cx="4.5" cy="10" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="15.5" cy="10" r="1.6" /></svg>
            </MenuButton>
            <MenuItems anchor="bottom end" transition className="z-[80] mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_40px_rgba(15,40,60,0.16)] transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0 focus:outline-none">
              <MenuItem><button type="button" onClick={exportCsv} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 data-[focus]:bg-[#e3f4ef]">{t("exportCsv")}</button></MenuItem>
              <MenuItem><button type="button" onClick={() => importRef.current?.click()} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 data-[focus]:bg-[#e3f4ef]">{t("importCsv")}</button></MenuItem>
              <MenuItem><button type="button" onClick={templateCsv} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-500 data-[focus]:bg-[#e3f4ef]">{t("template")}</button></MenuItem>
            </MenuItems>
          </Menu>
          <input ref={importRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { importCsv(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
        {(searchOpen || q) && (
          <div className="mt-2 flex h-10 items-center gap-2 rounded-lg border border-[#0f766e] bg-white px-3 animate-[bp-fade_0.2s_ease-out]">
            <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.9"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPh", k)} className="min-w-0 flex-1 bg-transparent text-[15px] focus:outline-none" />
            {q && <button type="button" onClick={() => setQ("")} className="text-[13px] font-medium text-slate-400">{t("clear")}</button>}
          </div>
        )}

        <div className={`transition-opacity duration-200 ${pending ? "opacity-50" : "opacity-100"}`}>
          {/* Filtrado por un cliente: resumen de rentabilidad arriba */}
          {filterCustomer && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_6px_20px_rgba(15,40,60,0.04)] animate-[bp-pop-in_0.35s_ease-out] sm:p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <p className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">{t("profitability")}</p>
                <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-[#e9f7f4] py-1 pl-3 pr-1 text-[13.5px] font-semibold text-[#0b1f3a]">
                  <span className="truncate">{filterCustomer.display_name}</span>
                  <button type="button" onClick={() => pickCustomer(null)} aria-label={t("allCustomers")} title={t("allCustomers")}
                    className="group flex h-6 w-6 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white hover:text-[#e11d48]">
                    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 5l10 10M15 5 5 15" /></svg>
                  </button>
                </span>
                <span className="text-[12.5px] text-slate-400">{rangeLabel}</span>
                <Link prefetch={false} href={`/dashboard/customers/${filterCustomer.id}`} className="ml-auto text-[13px] font-semibold text-[#0f766e] hover:underline">{t("customerProfile")}</Link>
              </div>
              {profit && <ProfitSummary p={profit} period={rangeLabel.toLowerCase()} />}
            </div>
          )}

          {/* Celular: tarjeta interactiva (número que sube + paletas que se tocan + resumen) */}
          <div className="lg:hidden">
            <LedgerMobileHero kind={kind} rows={list} range={{ ...range, label: rangeLabel }} total={shownTotal} realTotal={total} color={cfg.color} sign={cfg.sign} verb={L.verb} />
          </div>

          {/* Escritorio: tracker con barritas + resumen rápido */}
          <div className="mt-4 hidden gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
            <LedgerTracker kind={kind} rows={list} range={{ ...range, label: rangeLabel }} total={shownTotal} realTotal={total} color={cfg.color} sign={cfg.sign} verb={L.verb} title={t("tracker", k)} />
            <LedgerGlance kind={kind} rows={list} />
          </div>

          <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {list.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <p className="text-lg font-semibold text-[#0b1f3a]">{q ? t("noMatch", k) : t("noneFor", { ...k, range: rangeLabel.toLowerCase() })}</p>
                  <p className="mx-auto mt-1 max-w-sm text-[15px] text-slate-500">{L.empty}</p>
                  <button type="button" onClick={() => setEdit("new")} className="mt-5 rounded-lg bg-[#0f766e] px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-[#0c5f59]">{L.newLabel}</button>
                </div>
              ) : (
                <div>
                  {byDay.map(([day, items], di) => (
                    <section key={day} className="animate-[bp-fade_0.4s_ease-out_both]" style={{ animationDelay: `${Math.min(di, 8) * 60}ms` }}>
                      {/* Encabezado de fecha (normal, no pegajoso: así nunca tapa los montos) */}
                      <div className="flex items-center justify-between border-y border-slate-100 bg-slate-50 px-4 py-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500 first:border-t-0">
                        <span>{fmtD(day)}</span>
                        <span className="tabular-nums text-[#0b1f3a]">{amt(items.reduce((a, r) => a + Number(r.amount), 0))}</span>
                      </div>
                      <ul className="divide-y divide-slate-100">
                        {items.map((r) => (
                          <li key={r.id} className={`group/row flex items-center transition-colors hover:bg-[#f6fbfa] ${removing === r.id ? "pointer-events-none opacity-40" : ""}`}>
                            <button type="button" onClick={() => setEdit(r)} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left active:bg-[#e9f7f4]">
                              <CatIcon cats={cats} name={r.category} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[15px] font-medium text-[#0b1f3a]">{fx.cat(r.category)}</span>
                                <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-slate-500">
                                  {kind === "expense" && r.cost_type && r.cost_type !== "other" && (
                                    <span className="shrink-0 rounded-md px-1.5 py-px text-[10.5px] font-bold uppercase tracking-wide" style={{ background: costTypeOf(r.cost_type).soft, color: costTypeOf(r.cost_type).color }}>{fx.costShort(r.cost_type)}</span>
                                  )}
                                  {kind === "expense" && r.customer_id && nameOf.get(r.customer_id) && !filterCustomer && (
                                    <span className="max-w-[45%] shrink-0 truncate rounded-md bg-[#e9f7f4] px-1.5 py-px text-[11.5px] font-semibold text-[#0f766e]">{nameOf.get(r.customer_id)}</span>
                                  )}
                                  <span className="truncate">{[r.party, r.payment_mode ? fx.pay(r.payment_mode) : null, r.notes].filter(Boolean).join(" · ") || "—"}</span>
                                </span>
                              </span>
                              <span className="shrink-0 pl-2 font-semibold tabular-nums text-[#0b1f3a]">{amt(r.amount)}</span>
                            </button>
                            {/* Borrar directo (papelera roja con la tapa que se levanta) */}
                            <button type="button" onClick={() => removeEntry(r)} aria-label={t("delThis", k)} title={t("delete")}
                              className="group/trash mx-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#fff1f2] hover:text-[#e11d48] active:scale-90">
                              <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path className="origin-[18px_6px] transition-transform duration-300 group-hover/trash:-translate-y-[1.5px] group-hover/trash:-rotate-[20deg]" d="M4 6.5h16M9.5 6.5V4.8c0-.7.6-1.3 1.3-1.3h2.4c.7 0 1.3.6 1.3 1.3v1.7" />
                                <path className="transition-transform duration-300 group-hover/trash:translate-y-[0.5px]" d="M6 6.5l.9 12.4c.1 1 .9 1.6 1.8 1.6h6.6c.9 0 1.7-.7 1.8-1.6L18 6.5M10 10.5v6M14 10.5v6" />
                              </svg>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </div>
            <div className="grid h-fit min-w-0 gap-4">
            {kind === "expense" && financing.length > 0 && <FinancingPanel list={financing} today={todayIso} />}
            {byCat.length > 0 && (
              <div className="h-fit rounded-2xl border border-slate-200 bg-white p-4 lg:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">{t("byCategory")}</p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{byCat.length}</span>
                </div>
                <ul className="space-y-3.5">
                  {byCat.slice(0, 8).map(([name, v], k) => {
                    const [c1, c2] = BAR_COLORS[k % BAR_COLORS.length];
                    const share = total > 0 ? v / total : 0;
                    return (
                      <li key={name} className="group animate-[bp-fade_0.4s_ease-out_both]" style={{ animationDelay: `${120 + k * 70}ms` }}>
                        <div className="flex items-center gap-2.5 text-[14px]">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6" style={{ background: `${c1}18`, color: c1 }}>
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={catOf(cats, name).icon} /></svg>
                          </span>
                          <span className="flex-1 truncate text-slate-700">{fx.cat(name)}</span>
                          <span className="text-[11.5px] font-semibold tabular-nums" style={{ color: c1 }}>{Math.round(share * 100)}%</span>
                          <span className="font-semibold tabular-nums text-[#0b1f3a]">{amt(v)}</span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="bp-shimmer h-full origin-left rounded-full animate-[bp-bar-in_0.9s_cubic-bezier(.2,.8,.2,1)_both] transition-[width] duration-700"
                            style={{ width: `${Math.max(4, (v / (byCat[0][1] || 1)) * 100)}%`, background: `linear-gradient(90deg, ${c1}, ${c2})`, boxShadow: `0 0 10px ${c1}55`, animationDelay: `${150 + k * 90}ms`, ["--bp-delay" as string]: `${1 + k * 0.35}s` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      <ExpenseModal cfg={cfg} kind={kind} open={edit !== null} expense={edit === "new" ? null : edit} onClose={() => setEdit(null)} companyId={companyId} actor={actor}
        people={people} onPersonCreated={(c) => setPeople((p) => [...p, c].sort((a, b) => a.display_name.localeCompare(b.display_name)))} linkReady={linkReady}
        defaultCustomer={filterCustomer?.id ?? null}
        onSaved={(m) => { setEdit(null); router.refresh(); flash(m); }} />
      <Toast text={toast} />
    </div>
  );
}

// Botón "New Money In / New Expense": degradado, brillo que lo recorre, el "+" gira y late
// Botón "New": ícono ilustrado redondo con su nombre abajo (igual en computadora y celular)
function NewButton({ label, kind, onClick }: { label: string; kind: LedgerKind; onClick: () => void }) {
  const income = kind === "income";
  return (
    <button type="button" onClick={onClick} aria-label={label} className="group flex shrink-0 flex-col items-center gap-1 rounded-2xl px-1 transition-transform duration-150 active:scale-95 focus:outline-none">
      <span className="relative flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white shadow-[0_6px_16px_rgba(15,118,110,0.22)] ring-1 ring-[#bfe7de] transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_10px_22px_rgba(15,118,110,0.3)] group-focus-visible:ring-2 group-focus-visible:ring-[#0f766e]">
        <svg viewBox="0 0 48 48" className="h-9 w-9 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" aria-hidden="true">
          {income ? (<>
            {/* monedas apiladas */}
            <ellipse cx="20" cy="34" rx="12" ry="5" fill="#f4b740" /><path d="M8 29v5c0 2.8 5.4 5 12 5s12-2.2 12-5v-5" fill="#e09a1f" />
            <ellipse cx="20" cy="29" rx="12" ry="5" fill="#fcd669" /><path d="M8 23v6c0 2.8 5.4 5 12 5s12-2.2 12-5v-6" fill="#f4b740" />
            <ellipse cx="20" cy="23" rx="12" ry="5" fill="#ffe08a" stroke="#e09a1f" strokeWidth="1" />
            <path d="M20 20.5v5M17.8 24.6c.5.6 1.3.9 2.2.9 1.3 0 2.2-.6 2.2-1.4 0-1.9-4.3-.9-4.3-2.7 0-.8.9-1.4 2.1-1.4.8 0 1.5.3 2 .8" fill="none" stroke="#b7791f" strokeWidth="1.2" strokeLinecap="round" />
          </>) : (<>
            {/* recibo */}
            <path d="M10 7h20a2 2 0 0 1 2 2v30l-4-2.6-4 2.6-4-2.6-4 2.6-4-2.600L8 39V9a2 2 0 0 1 2-2z" fill="#fff" stroke="#0f766e" strokeWidth="2" strokeLinejoin="round" />
            <path d="M13 14h14M13 20h14M13 26h8" stroke="#9fd8cf" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M24.5 26h2.5" stroke="#f43f5e" strokeWidth="2.4" strokeLinecap="round" />
          </>)}
          <circle cx="35" cy="14" r="9.5" fill={income ? "#0f9f6e" : "#0f766e"} stroke="#fff" strokeWidth="2.5" />
          <path d="M35 10v8M31 14h8" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </span>
      <span className="whitespace-nowrap text-[11.5px] font-semibold leading-none text-[#0f766e]">{label}</span>
    </button>
  );
}

// Paso 5.12 · Compras a pagos dentro de Expenses: qué cuota viene y si entra sola
function FinancingPanel({ list, today }: { list: FinBrief[]; today: string }) {
  const t = useTranslations("ledger");
  const fx = useFinTx();
  const money = fx.money;
  const d = (iso: string | null) => (iso ? fx.fmtD(iso) : "—");
  return (
    <div className="h-fit rounded-2xl border border-slate-200 bg-white p-4 lg:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">{t("financed")}</p>
        <Link prefetch={false} href="/dashboard/financing" className="text-[12.5px] font-semibold text-[#0f766e] hover:underline">{t("openFinancing")}</Link>
      </div>
      <ul className="space-y-3">
        {list.map((f) => (
          <li key={f.id} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eef4ff] text-[#2563eb]">
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" /></svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2"><span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[#0b1f3a]">{f.name}</span><span className="shrink-0 text-[14px] font-semibold tabular-nums text-[#0b1f3a]">{money(f.monthly)}</span></span>
              {f.needsManual ? (
                <Link prefetch={false} href="/dashboard/financing" className="mt-0.5 block text-[12.5px] font-semibold text-[#be123c] hover:underline">{f.next_due && f.next_due < today ? t("notRecorded", { date: d(f.next_due) }) : t("dueToday")} · {t("recordIt")}</Link>
              ) : (
                <span className="mt-0.5 block text-[12.5px] text-slate-500">{t("nextPay", { date: d(f.next_due) })} · {f.auto ? t("addedItself") : t("recordInFin")}</span>
              )}
              <span className="block text-[12px] text-slate-400">{t("stillOwed", { amt: money(f.owed) })}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-slate-100 pt-3 text-[12px] leading-relaxed text-slate-500">{t("finNote")}</p>
    </div>
  );
}

// Tipo de costo sugerido por la categoría (se puede cambiar con un toque)
const guessType = (cat: string): CostType => (/material|supplies|equipment|tools/i.test(cat) ? "material" : /payroll|labor|subcontract/i.test(cat) ? "labor" : "other");

function ExpenseModal({ cfg, kind, open, expense, onClose, companyId, actor, onSaved, people, onPersonCreated, linkReady, defaultCustomer }: {
  cfg: Cfg; kind: LedgerKind; open: boolean; expense: Entry | null; onClose: () => void; companyId: string; actor: string; onSaved: (msg: string) => void;
  people: PayerOption[]; onPersonCreated: (c: PayerOption) => void; linkReady: boolean; defaultCustomer: string | null;
}) {
  const L = useLedgerTx(kind);
  const { t, fx, k } = L;
  const isIncome = cfg.table === "other_income";
  const jobCosting = !isIncome && linkReady; // gastos ligados a cliente / trabajo (SQL paso-job-costing)
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [custName, setCustName] = useState("");
  const [docId, setDocId] = useState<string | null>(null);
  const [costType, setCostType] = useState<CostType>("other");
  const [typeTouched, setTypeTouched] = useState(false);
  const [jobs, setJobs] = useState<{ id: string; number: string; doc_date: string; total: number; status: string }[]>([]);
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
    const cid = expense ? expense.customer_id ?? null : (jobCosting ? defaultCustomer : null);
    setCustomerId(cid); setCustName(cid ? people.find((p) => p.id === cid)?.display_name ?? "" : "");
    setDocId(expense?.doc_id ?? null);
    setCostType((expense ? (["material", "labor"].includes(expense.cost_type ?? "") ? expense.cost_type : "other") : guessType(cats[0].name)) as CostType);
    setTypeTouched(Boolean(expense));
  }
  if (!open && loaded) setLoaded("");

  // Invoices (trabajos) del cliente elegido, para ligar el gasto a uno
  useEffect(() => {
    if (!open || !jobCosting || !customerId) { setJobs([]); return; }
    let alive = true;
    createClient().from("sales_docs").select("id, number, doc_date, total, status").eq("company_id", companyId).eq("customer_id", customerId)
      .eq("kind", "invoice").neq("status", "void").order("doc_date", { ascending: false }).limit(100)
      .then(({ data }) => { if (alive) setJobs((data ?? []) as typeof jobs); });
    return () => { alive = false; };
  }, [open, jobCosting, customerId, companyId]);
  // El tipo se sugiere solo según la categoría (mientras no lo cambies tú)
  function onCategory(v: string) {
    setCat(v); if (v !== "Other") setCustom("");
    if (!typeTouched && jobCosting) setCostType(guessType(v));
  }

  async function save() {
    const a = round2(Number(amount.replace(/[^0-9.]/g, "")));
    if (!a || a <= 0) return setError(t("eAmount"));
    setBusy(true); setError("");
    const s = createClient();
    let receipt: { receipt_path?: string; receipt_name?: string } = {};
    if (file) {
      if (file.size > 10 * 1024 * 1024) { setBusy(false); return setError(t("eReceipt")); }
      const path = `${companyId}/${cfg.folder}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const up = await s.storage.from("sales-attachments").upload(path, file);
      if (!up.error) receipt = { receipt_path: path, receipt_name: file.name };
    }
    const category = (isCustom || cat === "Other") ? (custom.trim() || "Other") : cat;
    const row: Record<string, unknown> = { [cfg.dateCol]: date, category, [cfg.partyCol]: vendor.trim() || null, amount: a, payment_mode: mode, reference: ref.trim() || null, notes: notes.trim() || null, ...receipt, updated_at: new Date().toISOString() };
    const write = (r: Record<string, unknown>) => expense
      ? s.from(cfg.table).update(r).eq("id", expense.id)
      : s.from(cfg.table).insert({ ...r, company_id: companyId, created_by_name: actor });
    // Money In: se guarda el cliente ligado (si ya se corrió el SQL); si no, solo el nombre
    const link = isIncome && linkReady ? { customer_id: customerId }
      : jobCosting ? { customer_id: customerId, doc_id: customerId ? docId : null, cost_type: costType } : null;
    let { error: e } = await write(link ? { ...row, ...link } : row);
    if (e && link && /customer_id|doc_id|cost_type/i.test(e.message)) ({ error: e } = await write(row));
    setBusy(false);
    if (e) return setError(`${t("cantSave")} ${L.sql}`);
    onSaved(expense ? t("saved") : t("added", k));
  }
  async function remove() {
    if (!expense || !(await confirmDelete({ title: t("delThisQ", k), download: { filename: `${cfg.folder}-${expense.date}`, data: expense } }))) return;
    const s = createClient();
    if (expense.receipt_path) await s.storage.from("sales-attachments").remove([expense.receipt_path]);
    await s.from(cfg.table).delete().eq("id", expense.id);
    onSaved(t("deleted"));
  }
  async function openReceipt() {
    if (!expense?.receipt_path) return;
    const { data } = await createClient().storage.from("sales-attachments").createSignedUrl(expense.receipt_path, 120);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  return (
    <Modal open={open} onClose={onClose} title={expense ? L.editLabel : L.newLabel} width="max-w-xl"
      footer={<>
        <button type="button" onClick={save} disabled={busy} className={btnPrimary}>{busy ? t("saving") : t("save")}</button>
        <button type="button" onClick={onClose} className={btnGhost}>{t("cancel")}</button>
        {expense && <button type="button" onClick={remove} className="ml-auto text-sm font-medium text-red-600 hover:underline">{t("delete")}</button>}
        {error && <p role="alert" className="w-full text-sm text-red-600">{error}</p>}
      </>}>
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">{t("category")}</p>
          <Listbox value={isCustom ? "Other" : cat} onChange={onCategory}>
            <ListboxButton className="group flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-[15px] hover:border-[#14a39a] focus:outline-none data-[open]:border-[#0f766e] data-[open]:bg-white">
              <CatIcon cats={cats} name={isCustom ? "Other" : cat} size={30} /><span className="flex-1 text-[#0b1f3a]">{fx.cat(isCustom ? "Other" : cat)}</span>
              <svg viewBox="0 0 20 20" className="h-4 w-4 text-slate-400 transition-transform group-data-[open]:rotate-180" fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
            </ListboxButton>
            <ListboxOptions anchor="bottom start" transition className="z-[100] mt-1 max-h-72 w-[var(--button-width)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_16px_44px_rgba(15,40,60,0.16)] transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0 focus:outline-none">
              {cats.map((c) => (
                <ListboxOption key={c.name} value={c.name} className="group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-[14px] text-slate-700 data-[focus]:bg-[#eef8f5] data-[selected]:bg-[#d7f1eb] data-[selected]:font-semibold data-[selected]:text-[#0b3f3b]">
                  <CatIcon cats={cats} name={c.name} size={28} />{fx.cat(c.name)}
                </ListboxOption>
              ))}
            </ListboxOptions>
          </Listbox>
          {(isCustom || cat === "Other") && (
            <input autoFocus value={custom} onChange={(e) => setCustom(e.target.value.slice(0, 40))} placeholder={t("customPh")}
              className={`${inputClass} mt-2 animate-[bp-fade_0.2s_ease-out]`} />
          )}
        </div>
        {jobCosting && (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-[#fbfcfd] p-3.5">
            <div>
              <p className="mb-1.5 text-sm font-medium text-slate-700">{t("costType")}</p>
              <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-slate-100 p-1">
                {COST_TYPES.map((ct) => {
                  const on = costType === ct.value;
                  return (
                    <button key={ct.value} type="button" onClick={() => { setCostType(ct.value); setTypeTouched(true); }} aria-pressed={on}
                      className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-1.5 text-[12.5px] font-semibold transition-all duration-150 active:scale-95 sm:flex-row sm:gap-1.5 sm:px-2 sm:py-2 sm:text-[13.5px] ${on ? "bg-white shadow-[0_2px_8px_rgba(15,40,60,0.10)]" : "text-slate-500 hover:text-slate-700"}`}
                      style={on ? { color: ct.color } : undefined}>
                      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={ct.icon} /></svg>
                      <span className="truncate">{ct.value === "labor" ? <><span className="sm:hidden">{fx.costShort("labor")}</span><span className="hidden sm:inline">{fx.cost("labor")}</span></> : fx.cost(ct.value)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="min-w-0">
              <p className="mb-1.5 text-sm font-medium text-slate-700">{t("customerJob")} <span className="font-normal text-slate-400">({t("optional")})</span></p>
              <PayerPicker companyId={companyId} people={people} customerId={customerId} name={custName}
                hint={t("customerHint")}
                onPick={(c) => { setCustomerId(c?.id ?? null); setCustName(c?.display_name ?? ""); setDocId(null); }}
                onType={(v) => { setCustName(v); setCustomerId(null); setDocId(null); }}
                onCreated={(c) => { onPersonCreated(c); setCustomerId(c.id); setCustName(c.display_name); setDocId(null); }} />
            </div>
            {customerId && (
              <div className="animate-[bp-fade_0.2s_ease-out]">
                <p className="mb-1.5 text-sm font-medium text-slate-700">{t("invoiceJob")} <span className="font-normal text-slate-400">({t("optional")})</span></p>
                <SelectMenu value={docId ?? ""} ariaLabel={t("invoiceJob")} onChange={(v) => setDocId(v || null)}
                  options={[{ value: "", label: jobs.length ? t("notTied") : t("noInvoices") },
                    ...jobs.map((j) => ({ value: j.id, label: `${j.number} · ${fx.fmtD(j.doc_date)} · ${fx.money(j.total)}` }))]} />
              </div>
            )}
          </div>
        )}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 [&>*]:min-w-0">
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-red-600">{t("amountReq")}</span>
            <div className="flex"><span className="flex items-center rounded-l-lg border border-r-0 border-slate-200 bg-slate-100 px-3 text-sm text-slate-600">USD</span>
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.00" className={`${inputClass} rounded-l-none`} /></div></label>
          <div><span className="mb-1.5 block text-sm font-medium text-slate-700">{t("date")}</span><DatePicker value={date} onChange={setDate} /></div>
          {isIncome ? (
            <div className="sm:col-span-2"><span className="mb-1.5 block text-sm font-medium text-slate-700">{L.partyLabel}</span>
              <PayerPicker companyId={companyId} people={people} customerId={customerId} name={vendor}
                onPick={(c) => { setCustomerId(c?.id ?? null); setVendor(c?.display_name ?? ""); }}
                onType={(v) => { setVendor(v); setCustomerId(null); }}
                onCreated={(c) => { onPersonCreated(c); setCustomerId(c.id); setVendor(c.display_name); }} /></div>
          ) : (
            <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">{L.partyLabel}</span>
              <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder={L.partyPh} className={inputClass} /></label>
          )}
          <div><span className="mb-1.5 block text-sm font-medium text-slate-700">{L.modeLabel}</span>
            <SelectMenu value={mode} options={fx.payModes} onChange={setMode} ariaLabel={L.modeLabel} /></div>
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">{t("reference")}</span>
            <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder={t("refPh")} className={inputClass} /></label>
          <div><span className="mb-1.5 block text-sm font-medium text-slate-700">{t("receipt")}</span>
            <input ref={input} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
            <button type="button" onClick={() => input.current?.click()} className="flex w-full items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-left text-sm text-slate-600 hover:border-[#14a39a]">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#0f766e]" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h3l2-3h6l2 3h3v13H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" strokeLinejoin="round" /></svg>
              <span className="truncate">{file ? file.name : expense?.receipt_name ? t("replace") : t("takePhoto")}</span>
            </button>
            {expense?.receipt_path && !file && <button type="button" onClick={openReceipt} className="mt-1 text-[13px] font-medium text-[#0f766e] hover:underline">{t("viewReceipt", { name: expense.receipt_name ?? "" })}</button>}
          </div>
        </div>
        <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">{t("notes")}</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("notesPh")} className={inputClass} /></label>
      </div>
    </Modal>
  );
}
