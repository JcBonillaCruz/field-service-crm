"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseCsv, downloadCsv } from "@/lib/csv";
import { DocKind, SalesLine, computeTotals, round2, today } from "@/lib/sales";
import { db, logActivity, nextNumber, saveLines } from "@/lib/sales-client";
import { btnGhost, btnPrimary } from "@/components/sales/SalesBits";

type Customer = { id: string; display_name: string; company_name: string | null };
type Doc = { number: string | null; customer: string; date: string; second: string | null; status: string; reference: string | null; salesperson: string | null; subject: string | null; notes: string | null; terms: string | null; lines: SalesLine[] };

const ALIASES: Record<string, string[]> = {
  number: ["quote number", "quote#", "invoice number", "invoice#", "number", "estimate number"],
  customer: ["customer name", "customer", "client", "display name"],
  date: ["quote date", "invoice date", "date", "estimate date"],
  second: ["expiry date", "due date", "expiration date"],
  status: ["status", "quote status", "invoice status"],
  reference: ["reference#", "reference number", "reference", "order number", "p.o.#", "po number"],
  salesperson: ["salesperson", "sales person"],
  subject: ["subject"],
  notes: ["customer notes", "notes"],
  terms: ["terms & conditions", "terms and conditions", "terms"],
  item: ["item name", "item", "product", "service"],
  desc: ["item desc", "item description", "description"],
  qty: ["quantity", "qty"],
  rate: ["item price", "rate", "price", "unit price"],
  discount: ["discount", "discount %", "item discount"],
  unit: ["usage unit", "unit"],
};
const toISO = (v: string) => {
  const t = (v ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(t);
  if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  const d = new Date(t); return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

// Importar cotizaciones o facturas (CSV de BrightPro, Zoho u hoja propia): una fila por artículo
export default function SalesImport({ kind, companyId, actor, customers }: { kind: DocKind; companyId: string; actor: string; customers: Customer[] }) {
  const router = useRouter();
  const noun = kind === "quote" ? "Quote" : "Invoice";
  const base = kind === "quote" ? "/dashboard/quotes" : "/dashboard/invoices";
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ ok: number; skipped: string[] } | null>(null);
  const [progress, setProgress] = useState(0);
  const file = useRef<HTMLInputElement>(null);

  async function read(f?: File) {
    if (!f) return;
    setDone(null);
    const rows = parseCsv(await f.text());
    if (rows.length < 2) { setProblems(["The file is empty."]); setDocs(null); return; }
    const head = rows[0].map((h) => h.trim().toLowerCase());
    const col = (k: string) => head.findIndex((h) => ALIASES[k].includes(h));
    const c = Object.fromEntries(Object.keys(ALIASES).map((k) => [k, col(k)])) as Record<string, number>;
    const miss = (["customer", "item", "rate"] as const).filter((k) => c[k] < 0);
    if (miss.length) { setProblems([`Missing column(s): ${miss.map((k) => ALIASES[k][0]).join(", ")}.`]); setDocs(null); return; }
    const get = (r: string[], k: string) => (c[k] >= 0 ? (r[c[k]] ?? "").trim() : "");
    const map = new Map<string, Doc>();
    const errs: string[] = [];
    rows.slice(1).forEach((r, i) => {
      if (!r.some((x) => x.trim())) return;
      const customer = get(r, "customer");
      if (!customer) { errs.push(`Row ${i + 2}: no customer name.`); return; }
      const number = get(r, "number") || null;
      const key = number ?? `${customer}|${get(r, "date")}`;
      if (!map.has(key)) map.set(key, {
        number, customer, date: toISO(get(r, "date")) || today(), second: toISO(get(r, "second")) || null, status: get(r, "status").toLowerCase(),
        reference: get(r, "reference") || null, salesperson: get(r, "salesperson") || null, subject: get(r, "subject") || null,
        notes: get(r, "notes") || null, terms: get(r, "terms") || null, lines: [],
      });
      const name = get(r, "item");
      if (!name) return;
      map.get(key)!.lines.push({
        position: map.get(key)!.lines.length, item_id: null, name, description: get(r, "desc") || null,
        quantity: Number(get(r, "qty").replace(/[^0-9.]/g, "")) || 1, unit: get(r, "unit") || null,
        rate: round2(Number(get(r, "rate").replace(/[^0-9.\-]/g, "")) || 0), discount: Number(get(r, "discount").replace(/[^0-9.]/g, "")) || 0, discount_type: "percent", amount: 0,
      });
    });
    setDocs(Array.from(map.values())); setProblems(errs);
  }

  async function run() {
    if (!docs?.length) return;
    setBusy(true); setProgress(0);
    const s = db();
    const { data: existing } = await s.from("sales_docs").select("number").eq("company_id", companyId).eq("kind", kind);
    const used = new Set((existing ?? []).map((x) => x.number as string));
    const byName = new Map(customers.flatMap((cu) => [[cu.display_name.toLowerCase(), cu], ...(cu.company_name ? [[cu.company_name.toLowerCase(), cu] as const] : [])]));
    let ok = 0; const skipped: string[] = [];
    for (let i = 0; i < docs.length; i++) {
      const d = docs[i];
      const number = d.number ?? (await nextNumber(companyId, kind));
      if (!number || used.has(number)) { skipped.push(`${d.number ?? d.customer}: number already exists`); setProgress(i + 1); continue; }
      used.add(number);
      const cu = byName.get(d.customer.toLowerCase());
      const t = computeTotals(d.lines, {});
      const st = d.status;
      const status = kind === "quote"
        ? (["draft", "sent", "accepted", "declined", "invoiced"].find((x) => st.startsWith(x)) ?? "draft")
        : st.includes("paid") && !st.includes("partial") && !st.includes("unpaid") ? "paid" : st.includes("void") ? "void" : st.includes("draft") ? "draft" : "sent";
      const { data: row, error } = await s.from("sales_docs").insert({
        company_id: companyId, kind, number, customer_id: cu?.id ?? null, customer_name: cu?.display_name ?? d.customer, emails: [],
        doc_date: d.date, ...(kind === "quote" ? { expiry_date: d.second, reference: d.reference } : { due_date: d.second ?? d.date, order_number: d.reference, payment_terms: "Custom" }),
        salesperson: d.salesperson, subject: d.subject, notes: d.notes, terms: d.terms, status,
        subtotal: t.subtotal, total: t.total, discount_value: 0, discount_type: "percent", tax_rate: 0, tax_amount: 0, shipping: 0, adjustment: 0,
        amount_paid: status === "paid" ? t.total : 0, written_off: 0, created_by_name: actor,
      }).select("id").single();
      if (error || !row) { skipped.push(`${number}: ${error?.message ?? "couldn't be saved"}`); setProgress(i + 1); continue; }
      await saveLines(companyId, { doc_id: row.id }, d.lines);
      await logActivity(companyId, kind, row.id, `${noun} imported from CSV`, actor);
      ok++; setProgress(i + 1);
    }
    setBusy(false); setDone({ ok, skipped }); setDocs(null);
    router.refresh();
  }

  const template = () => downloadCsv(`${kind}s-import-template.csv`, [
    [`${noun} Number`, "Customer Name", `${noun} Date`, kind === "quote" ? "Expiry Date" : "Due Date", "Status", "Item Name", "Item Desc", "Quantity", "Item Price", "Discount", "Notes"],
    [kind === "quote" ? "QT-000101" : "INV-000101", "Jane Smith", today(), today(), kind === "quote" ? "Sent" : "Sent", "AC Tune-Up", "Full inspection", "1", "149", "0", "Thank you!"],
    [kind === "quote" ? "QT-000101" : "INV-000101", "Jane Smith", today(), today(), kind === "quote" ? "Sent" : "Sent", "Capacitor", "45/5 MFD", "1", "232", "10", ""],
  ]);
  const lineCount = docs?.reduce((a, d) => a + d.lines.length, 0) ?? 0;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f6f8f9] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <Link prefetch={false} href={base} className="text-[13px] font-medium text-[#0f766e] hover:underline">← Back to {kind === "quote" ? "quotes" : "invoices"}</Link>
        <h1 className="mt-1 text-2xl font-semibold text-[#0b1f3a]">Import {noun}s</h1>
        <p className="mt-1 text-[15px] text-slate-500">Upload a CSV with one row per item. Rows with the same {noun.toLowerCase()} number become one {noun.toLowerCase()}. Works with files exported from BrightPro or Zoho.</p>

        <div className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <input ref={file} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { read(e.target.files?.[0]); e.target.value = ""; }} />
          <button type="button" onClick={() => file.current?.click()} disabled={busy}
            className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-8 text-center transition-colors hover:border-[#14a39a] hover:bg-[#f6fbfa] active:scale-[0.99]">
            <svg viewBox="0 0 24 24" className="h-8 w-8 text-[#0f766e]" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 15V4m0 0L8 8m4-4 4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span className="text-[15px] font-semibold text-[#0b1f3a]">Choose a CSV file</span>
            <span className="text-[13px] text-slate-500">Required columns: Customer Name, Item Name, Item Price</span>
          </button>
          <button type="button" onClick={template} className="text-[14px] font-medium text-[#2563eb] hover:underline">Download a sample file</button>

          {problems.length > 0 && <ul className="space-y-1 rounded-xl bg-[#fff7ed] px-4 py-3 text-[13px] text-[#9a3412]">{problems.slice(0, 8).map((p) => <li key={p}>{p}</li>)}</ul>}
          {docs && (
            <div className="rounded-xl bg-[#f3fbf8] px-4 py-3">
              <p className="text-[15px] font-semibold text-[#0b1f3a]">Ready: {docs.length} {noun.toLowerCase()}{docs.length === 1 ? "" : "s"} · {lineCount} items</p>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-[13px] text-slate-600">
                {docs.slice(0, 50).map((d, i) => <li key={i} className="flex justify-between gap-3"><span className="truncate">{d.number ?? "(new number)"} · {d.customer}</span><span className="tabular-nums">{computeTotals(d.lines, {}).total.toFixed(2)}</span></li>)}
              </ul>
            </div>
          )}
          {busy && <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#0f766e] transition-all" style={{ width: `${(progress / Math.max(1, docs?.length ?? 1)) * 100}%` }} /></div>}
          {done && (
            <div className="rounded-xl bg-[#ecfdf5] px-4 py-3 text-[14px] text-[#065f46]">
              <p className="font-semibold">{done.ok} {noun.toLowerCase()}{done.ok === 1 ? "" : "s"} imported.</p>
              {done.skipped.length > 0 && <ul className="mt-1 text-[13px] text-[#9a3412]">{done.skipped.slice(0, 10).map((x) => <li key={x}>Skipped {x}</li>)}</ul>}
            </div>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={run} disabled={busy || !docs?.length} className={btnPrimary}>{busy ? `Importing ${progress}/${docs?.length ?? 0}…` : "Import"}</button>
            <Link prefetch={false} href={base} className={btnGhost}>{done ? "Done" : "Cancel"}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
