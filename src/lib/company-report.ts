import { FinPeriod, addDaysIso, money, r2, spanLabel, weekStartIso } from "@/lib/finance-period";
import type { PnlTotals } from "@/lib/job-reports";
import type { PayTotals } from "@/lib/payroll";

// =====================================================================
// Finances → Reports: el reporte de TODA la compañía (Paso 5.10c) — dueño y manager
//   Ingresos                    = pagos de facturas cobrados (sin el impuesto) + Money In
//   − Costo de los trabajos     = materiales + mano de obra que de verdad se pagó + gastos cargados a un cliente
//   = Ganancia de los trabajos
//   − Gastos generales          = el resto de Expenses, por categoría (renta, gasolina, seguros…)
//   = Ganancia real de la compañía
// Es dinero que de verdad entró y salió en el periodo (lo anotado en Finances). Jobs → Reports sigue diciendo
// cuánto dejó cada trabajo terminado; aquí se muestra al lado para comparar.
// La mano de obra sale de lo pagado (Payroll → Mark as paid, o un gasto escrito a mano), nunca de la tarifa: no se cuenta dos veces.
// =====================================================================
export type RepPayment = { amount: number; paid_on: string; invoice_id: string | null };
export type RepDoc = { id: string; total: number; tax_amount: number };
export type RepIncome = { amount: number; income_date: string; category: string | null };
export type RepExpense = { amount: number; expense_date: string; category: string | null; cost_type?: string | null; doc_id?: string | null; customer_id?: string | null };
export type RepSource = { payments: RepPayment[]; docs: RepDoc[]; income: RepIncome[]; expenses: RepExpense[] };

export type RepLine = { label: string; amount: number };
export type RepBucket = { label: string; from: string; to: string; income: number; costs: number; net: number };
export type CompanyReport = {
  from: string; to: string;
  invoices: number; salesTax: number; invoicesNet: number; moneyIn: number; moneyInBy: RepLine[]; income: number;
  materials: number; laborEmployees: number; laborSubs: number; laborOther: number; labor: number; jobOther: number; jobCosts: number;
  grossProfit: number; grossMargin: number | null;
  overhead: RepLine[]; overheadTotal: number;
  expenses: number;          // todo lo que salió (costo de trabajos + gastos generales)
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
  const byCat = new Map<string, number>();
  for (const e of src.expenses) {
    if (!inside(e.expense_date)) continue;
    const a = n(e.amount), cat = e.category || "Other";
    if (cat === LABOR_EMP) laborEmployees += a;
    else if (cat === LABOR_SUB) laborSubs += a;
    else if (e.cost_type === "labor") laborOther += a;
    else if (cat === MATERIALS || e.cost_type === "material") materials += a;
    else if (e.doc_id || e.customer_id) jobOther += a;            // cargado a un cliente o a su factura
    else byCat.set(cat, (byCat.get(cat) ?? 0) + a);
  }
  const overhead = Array.from(byCat, ([label, amount]) => ({ label, amount: r2(amount) })).sort((a, b) => b.amount - a.amount);
  const overheadTotal = r2(overhead.reduce((a, l) => a + l.amount, 0));
  invoices = r2(invoices); salesTax = r2(salesTax);
  const invoicesNet = r2(invoices - salesTax), income = r2(invoicesNet + moneyIn);
  const labor = r2(laborEmployees + laborSubs + laborOther);
  const jobCosts = r2(materials + labor + jobOther);
  const grossProfit = r2(income - jobCosts), net = r2(grossProfit - overheadTotal);
  return {
    from, to, invoices, salesTax, invoicesNet, moneyIn, moneyInBy, income,
    materials: r2(materials), laborEmployees: r2(laborEmployees), laborSubs: r2(laborSubs), laborOther: r2(laborOther), labor, jobOther: r2(jobOther), jobCosts,
    grossProfit, grossMargin: pctOf(grossProfit, income), overhead, overheadTotal, expenses: r2(jobCosts + overheadTotal),
    net, margin: pctOf(net, income), empty: income === 0 && jobCosts === 0 && overheadTotal === 0,
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

// ---------- El estado de resultados, renglón por renglón (pantalla, hoja para imprimir y exportación usan lo mismo) ----------
export type StLine = { kind: "head" | "line" | "sub" | "total" | "result"; label: string; amount?: number; pct?: number | null; hint?: string };
export function statement(r: CompanyReport): StLine[] {
  const p = (v: number) => pctOf(v, r.income);
  const out: StLine[] = [{ kind: "head", label: "Income" }];
  out.push({ kind: "line", label: "Invoices collected", amount: r.invoices, hint: "Payments received on invoices in this period" });
  if (r.salesTax > 0) out.push({ kind: "line", label: "− Sales tax inside those payments", amount: -r.salesTax, hint: "Not your money: it goes to the state" });
  out.push({ kind: "line", label: "Money In", amount: r.moneyIn, hint: "Cash jobs, direct payments and everything recorded in Money In" });
  r.moneyInBy.forEach((l) => out.push({ kind: "sub", label: l.label, amount: l.amount }));
  out.push({ kind: "total", label: "Total income", amount: r.income, pct: r.income > 0 ? 100 : null });

  out.push({ kind: "head", label: "Cost of the jobs" });
  out.push({ kind: "line", label: "Materials", amount: r.materials, pct: p(r.materials), hint: "Expenses in Materials & Supplies or marked as Material" });
  out.push({ kind: "line", label: "Labor paid", amount: r.labor, pct: p(r.labor), hint: "What was really paid: Payroll → Mark as paid, or a labor expense written by hand" });
  if (r.laborEmployees > 0) out.push({ kind: "sub", label: "Direct employees (Payroll & Labor)", amount: r.laborEmployees });
  if (r.laborSubs > 0) out.push({ kind: "sub", label: "Subcontractors", amount: r.laborSubs });
  if (r.laborOther > 0) out.push({ kind: "sub", label: "Other labor / job pay", amount: r.laborOther });
  if (r.jobOther > 0) out.push({ kind: "line", label: "Other costs charged to a customer", amount: r.jobOther, pct: p(r.jobOther), hint: "Expenses linked to a customer or an invoice" });
  out.push({ kind: "total", label: "Total cost of the jobs", amount: r.jobCosts, pct: p(r.jobCosts) });
  out.push({ kind: "result", label: r.grossProfit >= 0 ? "Profit from the jobs" : "Loss from the jobs", amount: r.grossProfit, pct: r.grossMargin });

  out.push({ kind: "head", label: "General expenses" });
  if (!r.overhead.length) out.push({ kind: "line", label: "No general expenses recorded", amount: 0 });
  r.overhead.forEach((l) => out.push({ kind: "line", label: l.label, amount: l.amount, pct: p(l.amount) }));
  out.push({ kind: "total", label: "Total general expenses", amount: r.overheadTotal, pct: p(r.overheadTotal) });
  out.push({ kind: "result", label: r.net >= 0 ? "Real profit of the company" : "Real loss of the company", amount: r.net, pct: r.margin });
  return out;
}

// ---------- Lo que acompaña al estado: periodo anterior, lo que deben los clientes, Jobs y Payroll ----------
export type RepExtras = {
  prev: CompanyReport | null; prevLabel: string;
  receivable: number; receivableCount: number;       // facturas enviadas que aún no se cobran
  jobs: PnlTotals | null;                            // Jobs → Reports → Profit & loss del mismo periodo
  payroll: PayTotals | null;                         // Payroll del mismo periodo (solo semana y mes)
};
const change = (now: number, before: number) => (before === 0 ? null : Math.round(((now - before) / Math.abs(before)) * 100));
export const changeText = (now: number, before: number) => { const c = change(now, before); return c == null ? "" : `${c > 0 ? "+" : ""}${c}%`; };

export function findings(r: CompanyReport, x: RepExtras): string[] {
  const out: string[] = [];
  if (r.empty) return ["Nothing was recorded in Finances for this period: no invoice payments, no Money In and no expenses."];
  out.push(`${money(r.income)} came in and ${money(r.expenses)} went out: ${r.net >= 0 ? "a real profit" : "a real loss"} of ${money(Math.abs(r.net))}${r.margin != null ? ` (${r.margin}% of income)` : ""}.`);
  if (x.prev && !x.prev.empty) {
    const d = r2(r.net - x.prev.net);
    out.push(`Compared with ${x.prevLabel}: income ${changeText(r.income, x.prev.income) || "from $0"}, expenses ${changeText(r.expenses, x.prev.expenses) || "from $0"}, and the profit is ${money(Math.abs(d))} ${d >= 0 ? "higher" : "lower"}.`);
  }
  const big = [{ label: "Materials", amount: r.materials }, { label: "Labor", amount: r.labor }, ...r.overhead].filter((l) => l.amount > 0).sort((a, b) => b.amount - a.amount)[0];
  if (big && r.expenses > 0) out.push(`Biggest expense: ${big.label} (${money(big.amount)}, ${Math.round((big.amount / r.expenses) * 100)}% of everything spent).`);
  if (r.income > 0 && r.overheadTotal > 0) out.push(`General expenses took ${Math.round((r.overheadTotal / r.income) * 100)}% of the income.`);
  if (x.payroll && x.payroll.balance > 0.005) out.push(`Payroll for this period is not fully paid: ${money(x.payroll.balance)} still owed to ${x.payroll.unpaidPeople} ${x.payroll.unpaidPeople === 1 ? "person" : "people"}. After paying it, the profit would be ${money(r.net - x.payroll.balance)}.`);
  if (x.payroll && x.payroll.noRate > 0) out.push(`${x.payroll.noRate} ${x.payroll.noRate === 1 ? "person has" : "people have"} no pay rate, so Payroll can't calculate what to pay them.`);
  if (x.jobs && x.jobs.jobs > 0) {
    out.push(`Jobs finished in this period: ${x.jobs.jobs}, with ${money(x.jobs.profit)} ${x.jobs.profit >= 0 ? "profit" : "loss"} by job (Jobs → Reports).${x.jobs.lossJobs ? ` ${x.jobs.lossJobs} lost money.` : ""}`);
    if (x.jobs.materials > r.materials + 1) out.push(`Jobs used ${money(x.jobs.materials)} in parts at cost, but Expenses only shows ${money(r.materials)} in materials for this period. If those parts were bought now and the purchase isn't in Expenses, the real profit is lower.`);
  }
  if (x.receivable > 0) out.push(`Customers still owe ${money(x.receivable)} on ${x.receivableCount} invoice${x.receivableCount === 1 ? "" : "s"}. That money is not counted here until it's collected.`);
  return out;
}

// ---------- Hoja lista para imprimir o guardar como PDF ----------
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
export function companyReportHtml(r: CompanyReport, x: RepExtras, buckets: RepBucket[], o: { company: string; title: string; range: string; by: string }): string {
  const neg = (v: number) => (v < 0 ? "neg" : "");
  const pct = (v: number | null | undefined) => (v == null ? "" : `${v}%`);
  const rows = statement(r).map((l) =>
    l.kind === "head" ? `<tr class="head"><td colspan="3">${esc(l.label)}</td></tr>`
      : `<tr class="${l.kind}"><td>${esc(l.label)}</td><td class="r ${neg(l.amount ?? 0)}">${money(l.amount)}</td><td class="r pc">${pct(l.pct)}</td></tr>`).join("");
  const kpi = (label: string, value: string, cls = "") => `<div class="kpi"><span>${esc(label)}</span><b class="${cls}">${value}</b></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Company report · ${esc(o.company)} · ${esc(o.range)}</title><style>
*{box-sizing:border-box}body{font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#0b1f3a;margin:28px;font-size:12.5px;line-height:1.45}
h1{font-size:21px;margin:0}h2{font-size:14px;margin:22px 0 8px;color:#0f766e}.sub{color:#64748b;margin-top:3px}
.kpis{display:flex;gap:10px;margin-top:16px}.kpi{flex:1;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px}.kpi b{display:block;font-size:17px}.kpi span{color:#64748b;font-size:11px}
table{width:100%;border-collapse:collapse}th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;border-bottom:1.5px solid #cbd5e1;padding:5px 6px}
td{padding:5px 6px;border-bottom:1px solid #eef2f6;vertical-align:top}.r{text-align:right;white-space:nowrap}.pc{color:#64748b;width:70px}.neg{color:#be123c}.pos{color:#15803d}
tr.head td{font-weight:700;color:#0f766e;text-transform:uppercase;font-size:10.5px;letter-spacing:.05em;padding-top:14px;border-bottom:1.5px solid #cbd5e1}
tr.sub td{color:#64748b;font-size:11.5px}tr.sub td:first-child{padding-left:22px}tr.total td{font-weight:700}tr.result td{font-weight:700;font-size:14px;background:#f1f8f6;border-top:1.5px solid #0f766e}
ul{margin:0;padding-left:18px}li{margin:3px 0}.foot{margin-top:22px;color:#94a3b8;font-size:10.5px}tr{page-break-inside:avoid}@media print{body{margin:12mm}}</style></head><body>
<h1>Company report</h1><div class="sub">${esc(o.company)} · ${esc(o.title)} (${esc(o.range)}) · prepared by ${esc(o.by)}</div>
<div class="kpis">${kpi("Income", money(r.income))}${kpi("Cost of the jobs", money(r.jobCosts))}${kpi("General expenses", money(r.overheadTotal))}${kpi(r.net >= 0 ? "Real profit" : "Real loss", money(r.net), r.net < 0 ? "neg" : "pos")}${kpi("Margin", r.margin == null ? "—" : `${r.margin}%`)}</div>
<h2>Summary</h2><ul>${findings(r, x).map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
<h2>Income and expenses</h2><table><tr><th>Concept</th><th class="r">Amount</th><th class="r">% of income</th></tr>${rows}</table>
${buckets.length ? `<h2>Inside this period</h2><table><tr><th></th><th class="r">Income</th><th class="r">Expenses</th><th class="r">Profit</th></tr>${buckets.map((b) => `<tr><td>${esc(b.label)}</td><td class="r">${money(b.income)}</td><td class="r">${money(b.costs)}</td><td class="r ${neg(b.net)}">${money(b.net)}</td></tr>`).join("")}</table>` : ""}
${x.payroll ? `<h2>Payroll for this period</h2><table><tr><th></th><th class="r">People</th><th class="r">Calculated</th><th class="r">Paid</th><th class="r">Still owed</th></tr>
<tr><td>Direct employees</td><td class="r">${x.payroll.employees.people}</td><td class="r">${money(x.payroll.employees.calculated)}</td><td class="r">${money(x.payroll.employees.paid)}</td><td class="r">${money(x.payroll.employees.balance)}</td></tr>
<tr><td>Subcontractors</td><td class="r">${x.payroll.subs.people}</td><td class="r">${money(x.payroll.subs.calculated)}</td><td class="r">${money(x.payroll.subs.paid)}</td><td class="r">${money(x.payroll.subs.balance)}</td></tr>
<tr class="total"><td>Total</td><td class="r">${x.payroll.people}</td><td class="r">${money(x.payroll.calculated)}</td><td class="r">${money(x.payroll.paid)}</td><td class="r ${x.payroll.balance > 0 ? "neg" : ""}">${money(x.payroll.balance)}</td></tr></table>` : ""}
${x.jobs && x.jobs.jobs > 0 ? `<h2>Jobs finished in this period (Jobs → Reports)</h2><table><tr><th>Jobs</th><th class="r">Revenue before tax</th><th class="r">Labor by pay rate</th><th class="r">Parts at cost</th><th class="r">Profit by job</th></tr>
<tr><td>${x.jobs.jobs}${x.jobs.lossJobs ? ` · ${x.jobs.lossJobs} lost money` : ""}</td><td class="r">${money(x.jobs.revenue)}</td><td class="r">${money(x.jobs.labor)}</td><td class="r">${money(x.jobs.materials)}</td><td class="r ${neg(x.jobs.profit)}">${money(x.jobs.profit)}</td></tr></table>` : ""}
<div class="foot">This report counts the money that really came in and went out in the period, as recorded in Finances: invoice payments, Money In and Expenses. Labor is what was paid (Payroll → Mark as paid), not the pay rate. Jobs → Reports shows the profit of each finished job, which is a different question, so the two numbers don't have to match. Generated by BrightPro on ${esc(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }))}.</div>
</body></html>`;
}
