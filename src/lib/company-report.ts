import { FinPeriod, addDaysIso, r2, spanLabel, weekStartIso } from "@/lib/finance-period";
import type { PnlTotals } from "@/lib/job-reports";
import type { PayTotals } from "@/lib/payroll";
import { PdfBlock, PdfDoc, PdfRow, PdfTone, pdfFileName } from "@/lib/report-pdf";

// =====================================================================
// Finances → Reports: el reporte de TODA la compañía (Paso 5.10c) — dueño y manager
//   Ingresos                    = pagos de facturas cobrados (sin el impuesto) + Money In
//   − Costo de los trabajos     = materiales + mano de obra que de verdad se pagó + gastos cargados a un cliente
//   = Ganancia de los trabajos
//   − Gastos generales          = el resto de Expenses, por categoría (renta, gasolina, seguros…)
//   − Pagos de compras a pagos  = lo pagado en el periodo de cada compra financiada (Paso 5.10d)
//   = Ganancia real de la compañía
// Es dinero que de verdad entró y salió en el periodo (lo anotado en Finances). Jobs → Reports sigue diciendo
// cuánto dejó cada trabajo terminado; aquí se muestra al lado para comparar.
// La mano de obra sale de lo pagado (Payroll → Mark as paid, o un gasto escrito a mano), nunca de la tarifa: no se cuenta dos veces.
// =====================================================================
export type RepPayment = { amount: number; paid_on: string; invoice_id: string | null };
export type RepDoc = { id: string; total: number; tax_amount: number };
export type RepIncome = { amount: number; income_date: string; category: string | null };
export type RepExpense = { id?: string; amount: number; expense_date: string; category: string | null; cost_type?: string | null; doc_id?: string | null; customer_id?: string | null };
// financing: gasto → compra a pagos a la que pertenece (los pagos que Financing metió solos a Expenses)
export type RepSource = { payments: RepPayment[]; docs: RepDoc[]; income: RepIncome[]; expenses: RepExpense[]; financing?: Record<string, string> };

export type RepLine = { label: string; amount: number };
export type RepBucket = { label: string; from: string; to: string; income: number; costs: number; net: number };
export type CompanyReport = {
  from: string; to: string;
  invoices: number; salesTax: number; invoicesNet: number; moneyIn: number; moneyInBy: RepLine[]; income: number;
  materials: number; laborEmployees: number; laborSubs: number; laborOther: number; labor: number; jobOther: number; jobCosts: number;
  grossProfit: number; grossMargin: number | null;
  overhead: RepLine[]; overheadTotal: number;
  financing: RepLine[]; financingTotal: number;   // pagos de compras a pagos, por compra
  expenses: number;          // todo lo que salió (costo de trabajos + gastos generales + compras a pagos)
  net: number; margin: number | null;
  empty: boolean;
};

const n = (v: unknown) => Number(v) || 0;
const pctOf = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);
const LABOR_EMP = "Payroll & Labor", LABOR_SUB = "Subcontractors", MATERIALS = "Materials & Supplies";

export function buildCompanyReport(src: RepSource, from: string, to: string): CompanyReport {
  const inside = (d: string | null | undefined) => Boolean(d) && String(d).slice(0, 10) >= from && String(d).slice(0, 10) <= to;
  const docs = new Map(src.docs.map((d) => [d.id, d]));
  let invoices = 0, salesTax = 0;
  for (const p of src.payments) {
    if (!inside(p.paid_on)) continue;
    const a = n(p.amount); invoices += a;
    const d = p.invoice_id ? docs.get(p.invoice_id) : undefined;
    if (d && n(d.total) > 0 && n(d.tax_amount) > 0) salesTax += a * Math.min(1, n(d.tax_amount) / n(d.total)); // parte del pago que es impuesto
  }
  const byIncome = new Map<string, number>();
  for (const i of src.income) if (inside(i.income_date)) byIncome.set(i.category || "Other", (byIncome.get(i.category || "Other") ?? 0) + n(i.amount));
  const moneyInBy = Array.from(byIncome, ([label, amount]) => ({ label, amount: r2(amount) })).sort((a, b) => b.amount - a.amount);
  const moneyIn = r2(moneyInBy.reduce((a, l) => a + l.amount, 0));

  let materials = 0, laborEmployees = 0, laborSubs = 0, laborOther = 0, jobOther = 0;
  const byCat = new Map<string, number>(), byPurchase = new Map<string, number>();
  for (const e of src.expenses) {
    if (!inside(e.expense_date)) continue;
    const a = n(e.amount), cat = e.category || "Other";
    const purchase = e.id ? src.financing?.[e.id] : undefined;
    if (purchase) byPurchase.set(purchase, (byPurchase.get(purchase) ?? 0) + a);
    else if (cat === LABOR_EMP) laborEmployees += a;
    else if (cat === LABOR_SUB) laborSubs += a;
    else if (e.cost_type === "labor") laborOther += a;
    else if (cat === MATERIALS || e.cost_type === "material") materials += a;
    else if (e.doc_id || e.customer_id) jobOther += a;            // cargado a un cliente o a su factura
    else byCat.set(cat, (byCat.get(cat) ?? 0) + a);
  }
  const overhead = Array.from(byCat, ([label, amount]) => ({ label, amount: r2(amount) })).sort((a, b) => b.amount - a.amount);
  const overheadTotal = r2(overhead.reduce((a, l) => a + l.amount, 0));
  const financing = Array.from(byPurchase, ([label, amount]) => ({ label, amount: r2(amount) })).sort((a, b) => b.amount - a.amount);
  const financingTotal = r2(financing.reduce((a, l) => a + l.amount, 0));
  invoices = r2(invoices); salesTax = r2(salesTax);
  const invoicesNet = r2(invoices - salesTax), income = r2(invoicesNet + moneyIn);
  const labor = r2(laborEmployees + laborSubs + laborOther);
  const jobCosts = r2(materials + labor + jobOther);
  const grossProfit = r2(income - jobCosts), net = r2(grossProfit - overheadTotal - financingTotal);
  return {
    from, to, invoices, salesTax, invoicesNet, moneyIn, moneyInBy, income,
    materials: r2(materials), laborEmployees: r2(laborEmployees), laborSubs: r2(laborSubs), laborOther: r2(laborOther), labor, jobOther: r2(jobOther), jobCosts,
    grossProfit, grossMargin: pctOf(grossProfit, income), overhead, overheadTotal, financing, financingTotal, expenses: r2(jobCosts + overheadTotal + financingTotal),
    net, margin: pctOf(net, income), empty: income === 0 && jobCosts === 0 && overheadTotal === 0 && financingTotal === 0,
  };
}

// El periodo partido en pedazos: el mes por semanas, el trimestre y el año por meses
export function buildBuckets(src: RepSource, period: FinPeriod, from: string, to: string, weekStartsOn: number): RepBucket[] {
  const cuts: { label: string; from: string; to: string }[] = [];
  if (period === "month") {
    for (let a = from; a <= to;) {
      const end = addDaysIso(weekStartIso(a, weekStartsOn), 6), b = end < to ? end : to;
      // "Nov 15 – 21" (corto, para que quepa en el celular)
      const full = spanLabel(a, b).replace(/, \d{4}$/, "");
      cuts.push({ label: a.slice(0, 7) === b.slice(0, 7) ? full.replace(/ – [A-Za-z]+ /, " – ") : full, from: a, to: b });
      a = addDaysIso(b, 1);
    }
  } else if (period === "quarter" || period === "year") {
    const [y, m0] = [Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1];
    const count = period === "year" ? 12 : 3;
    for (let i = 0; i < count; i++) {
      const s = new Date(Date.UTC(y, m0 + i, 1)), e = new Date(Date.UTC(y, m0 + i + 1, 0));
      cuts.push({ label: s.toLocaleDateString("en-US", { timeZone: "UTC", month: "long" }), from: s.toISOString().slice(0, 10), to: e.toISOString().slice(0, 10) });
    }
  }
  return cuts.map((c) => { const r = buildCompanyReport(src, c.from, c.to); return { ...c, income: r.income, costs: r.expenses, net: r.net }; });
}

// ---------- Paso 6.2b: los textos llegan en el idioma de quien lo ve ----------
// t = traductor del namespace "compRep" · money = formato de dinero del idioma · cat = nombre de una categoría guardada (en inglés) traducido
export type RepTx = (key: string, values?: Record<string, string | number>) => string;
export type RepL = { t: RepTx; money: (v: number | null | undefined) => string; cat: (name: string) => string };

// ---------- El estado de resultados, renglón por renglón (pantalla, PDF y exportación usan lo mismo) ----------
export type StLine = { kind: "head" | "line" | "sub" | "total" | "result"; label: string; amount?: number; pct?: number | null; hint?: string };
export function statement(r: CompanyReport, L: RepL): StLine[] {
  const { t } = L;
  const p = (v: number) => pctOf(v, r.income);
  const out: StLine[] = [{ kind: "head", label: t("income") }];
  out.push({ kind: "line", label: t("invoicesCollected"), amount: r.invoices, hint: t("hInvoices") });
  if (r.salesTax > 0) out.push({ kind: "line", label: t("salesTax"), amount: -r.salesTax, hint: t("hSalesTax") });
  out.push({ kind: "line", label: t("moneyIn"), amount: r.moneyIn, hint: t("hMoneyIn") });
  r.moneyInBy.forEach((l) => out.push({ kind: "sub", label: L.cat(l.label), amount: l.amount }));
  out.push({ kind: "total", label: t("totalIncome"), amount: r.income, pct: r.income > 0 ? 100 : null });

  out.push({ kind: "head", label: t("jobCosts") });
  out.push({ kind: "line", label: t("materials"), amount: r.materials, pct: p(r.materials), hint: t("hMaterials") });
  out.push({ kind: "line", label: t("laborPaid"), amount: r.labor, pct: p(r.labor), hint: t("hLabor") });
  if (r.laborEmployees > 0) out.push({ kind: "sub", label: t("laborEmp"), amount: r.laborEmployees });
  if (r.laborSubs > 0) out.push({ kind: "sub", label: t("subs"), amount: r.laborSubs });
  if (r.laborOther > 0) out.push({ kind: "sub", label: t("laborOther"), amount: r.laborOther });
  if (r.jobOther > 0) out.push({ kind: "line", label: t("jobOther"), amount: r.jobOther, pct: p(r.jobOther), hint: t("hJobOther") });
  out.push({ kind: "total", label: t("totalJobCosts"), amount: r.jobCosts, pct: p(r.jobCosts) });
  out.push({ kind: "result", label: r.grossProfit >= 0 ? t("jobProfit") : t("jobLoss"), amount: r.grossProfit, pct: r.grossMargin });

  out.push({ kind: "head", label: t("general") });
  if (!r.overhead.length) out.push({ kind: "line", label: t("noGeneral"), amount: 0 });
  r.overhead.forEach((l) => out.push({ kind: "line", label: L.cat(l.label), amount: l.amount, pct: p(l.amount) }));
  out.push({ kind: "total", label: t("totalGeneral"), amount: r.overheadTotal, pct: p(r.overheadTotal) });
  if (r.financing.length) {
    out.push({ kind: "head", label: t("financingHead") });
    r.financing.forEach((l) => out.push({ kind: "line", label: l.label, amount: l.amount, pct: p(l.amount), hint: t("hFinancing") }));
    out.push({ kind: "total", label: t("totalFinancing"), amount: r.financingTotal, pct: p(r.financingTotal) });
  }
  out.push({ kind: "result", label: r.net >= 0 ? t("realProfitCo") : t("realLossCo"), amount: r.net, pct: r.margin });
  return out;
}

// ---------- Lo que acompaña al estado: periodo anterior, lo que deben los clientes, Jobs y Payroll ----------
export type RepExtras = {
  prev: CompanyReport | null; prevLabel: string;
  receivable: number; receivableCount: number;       // facturas enviadas que aún no se cobran
  jobs: PnlTotals | null;                            // Jobs → Reports → Profit & loss del mismo periodo
  payroll: PayTotals | null;                         // Payroll del mismo periodo (solo semana y mes)
  financing: { count: number; owed: number; monthly: number; overdue: number } | null;  // compras a pagos que siguen abiertas (hoy)
};
const change = (now: number, before: number) => (before === 0 ? null : Math.round(((now - before) / Math.abs(before)) * 100));
export const changeText = (now: number, before: number) => { const c = change(now, before); return c == null ? "" : `${c > 0 ? "+" : ""}${c}%`; };

// prevLabel: el nombre del periodo anterior ya en el idioma ("October 2026" / "octubre de 2026")
export function findings(r: CompanyReport, x: RepExtras, L: RepL, prevLabel = x.prevLabel): string[] {
  const { t, money } = L;
  const out: string[] = [];
  if (r.empty) return [t("fEmpty")];
  out.push(t("fNet", { in: money(r.income), out: money(r.expenses), loss: r.net >= 0 ? "no" : "yes", amt: money(Math.abs(r.net)), pct: r.margin == null ? "none" : String(r.margin) }));
  if (x.prev && !x.prev.empty) {
    const d = r2(r.net - x.prev.net);
    out.push(t("fCompare", { prev: prevLabel, inc: changeText(r.income, x.prev.income) || t("fromZero"), exp: changeText(r.expenses, x.prev.expenses) || t("fromZero"), amt: money(Math.abs(d)), up: d >= 0 ? "yes" : "no" }));
  }
  const big = [{ label: t("materials"), amount: r.materials }, { label: t("labor"), amount: r.labor }, ...r.overhead.map((l) => ({ ...l, label: L.cat(l.label) })), ...r.financing].filter((l) => l.amount > 0).sort((a, b) => b.amount - a.amount)[0];
  if (big && r.expenses > 0) out.push(t("fBiggest", { label: big.label, amt: money(big.amount), pct: Math.round((big.amount / r.expenses) * 100) }));
  if (r.income > 0 && r.overheadTotal > 0) out.push(t("fGeneral", { pct: Math.round((r.overheadTotal / r.income) * 100) }));
  if (x.payroll && x.payroll.balance > 0.005) out.push(t("fPayroll", { amt: money(x.payroll.balance), n: x.payroll.unpaidPeople, after: money(r.net - x.payroll.balance) }));
  if (x.payroll && x.payroll.noRate > 0) out.push(t("fNoRate", { n: x.payroll.noRate }));
  if (x.jobs && x.jobs.jobs > 0) {
    out.push(t("fJobs", { n: x.jobs.jobs, amt: money(x.jobs.profit), loss: x.jobs.profit >= 0 ? "no" : "yes", lost: x.jobs.lossJobs }));
    if (x.jobs.materials > r.materials + 1) out.push(t("fParts", { jobs: money(x.jobs.materials), exp: money(r.materials) }));
  }
  if (r.financingTotal > 0) out.push(t("fFinPaid", { amt: money(r.financingTotal), names: r.financing.map((l) => l.label).join(", ") }));
  if (x.financing && x.financing.owed > 0) out.push(t("fFinOwed", { n: x.financing.count, owed: money(x.financing.owed), monthly: money(x.financing.monthly), overdue: x.financing.overdue }));
  if (x.receivable > 0) out.push(t("fOwe", { amt: money(x.receivable), n: x.receivableCount }));
  return out;
}

// ---------- El mismo reporte como PDF real (se ve en el visor, se imprime o se descarga) ----------
// buckets: con su etiqueta ya en el idioma
export function companyReportPdf(r: CompanyReport, x: RepExtras, buckets: RepBucket[], o: { company: string; title: string; range: string; by: string; prevLabel: string }, L: RepL): PdfDoc {
  const { t, money } = L;
  const tone = (v: number): PdfTone | undefined => (v < 0 ? "neg" : undefined);
  const pct = (v: number | null | undefined) => (v == null ? "" : `${v}%`);
  const rows: PdfRow[] = statement(r, L).map((l) =>
    l.kind === "head" ? { cells: [l.label], style: "section" as const }
      : { cells: [l.label, { text: money(l.amount), tone: l.kind === "result" ? ((l.amount ?? 0) < 0 ? "neg" : "pos") : tone(l.amount ?? 0) }, pct(l.pct)], style: l.kind === "line" ? undefined : l.kind });
  const blocks: PdfBlock[] = [
    { type: "kpis", items: [
      { label: t("income"), value: money(r.income) }, { label: t("jobCosts"), value: money(r.jobCosts) }, { label: t("general"), value: money(r.overheadTotal) },
      ...(r.financingTotal > 0 ? [{ label: t("financing"), value: money(r.financingTotal) }] : []),
      { label: r.net >= 0 ? t("realProfit") : t("realLoss"), value: money(r.net), tone: r.net < 0 ? "neg" as const : "pos" as const }, { label: t("margin"), value: r.margin == null ? "-" : `${r.margin}%` },
    ] },
    { type: "heading", text: t("summary") }, { type: "bullets", items: findings(r, x, L, o.prevLabel) },
    { type: "heading", text: t("incomeExpenses") },
    { type: "table", columns: [{ label: t("concept"), width: 6 }, { label: t("amount"), width: 2, align: "right" }, { label: t("pctIncome"), width: 1.3, align: "right" }], rows },
  ];
  if (buckets.length) blocks.push({ type: "heading", text: t("inside") }, {
    type: "table", columns: [{ label: "", width: 3 }, { label: t("income"), width: 2, align: "right" }, { label: t("expenses"), width: 2, align: "right" }, { label: t("profit"), width: 2, align: "right" }],
    rows: buckets.map((b) => ({ cells: [b.label, money(b.income), money(b.costs), { text: money(b.net), tone: tone(b.net) }] })),
  });
  if (x.payroll) {
    const g = (label: string, v: { people: number; calculated: number; paid: number; balance: number }, style?: "total"): PdfRow =>
      ({ cells: [label, String(v.people), money(v.calculated), money(v.paid), { text: money(v.balance), tone: style && v.balance > 0.005 ? "neg" : undefined }], style });
    blocks.push({ type: "heading", text: t("payrollHead") }, {
      type: "table", columns: [{ label: "", width: 3 }, { label: t("people"), width: 1.2, align: "right" }, { label: t("earned"), width: 2, align: "right" }, { label: t("paid"), width: 2, align: "right" }, { label: t("stillOwed"), width: 2, align: "right" }],
      rows: [g(t("directEmployees"), x.payroll.employees), g(t("subs"), x.payroll.subs), g(t("total"), x.payroll, "total")],
    });
  }
  if (x.jobs && x.jobs.jobs > 0) blocks.push({ type: "heading", text: t("jobsHead") }, {
    type: "table", columns: [{ label: t("jobs"), width: 2.4 }, { label: t("revenueBT"), width: 2, align: "right" }, { label: t("laborRate"), width: 2, align: "right" }, { label: t("partsCost"), width: 2, align: "right" }, { label: t("profitByJob"), width: 2, align: "right" }],
    rows: [{ cells: [x.jobs.lossJobs ? t("jobsLost", { n: x.jobs.jobs, lost: x.jobs.lossJobs }) : String(x.jobs.jobs), money(x.jobs.revenue), money(x.jobs.labor), money(x.jobs.materials), { text: money(x.jobs.profit), tone: tone(x.jobs.profit) }] }],
  });
  blocks.push({ type: "note", text: t("pdfNote") });
  return { title: t("pdfTitle"), subtitle: t("pdfSubtitle", { title: o.title, range: o.range, by: o.by }), company: o.company, blocks, footer: o.range, fileName: pdfFileName("company-report", o.company, o.range) };
}
