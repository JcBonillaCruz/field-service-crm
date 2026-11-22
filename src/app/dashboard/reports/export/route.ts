import { NextResponse, type NextRequest } from "next/server";
import { checkExportBody, exportResponse, fileBase } from "@/lib/export-file";
import { getLocale, getTranslations } from "next-intl/server";
import { FinPeriod, FinRange, daysBetweenIso, finRange, isIsoDay, spanLabel } from "@/lib/finance-period";
import { intlTag } from "@/i18n/config";
import { finWords } from "@/i18n/useFinTx";
import { canSeeCompanyMoney, financeContext, loadPayroll } from "@/lib/payroll-server";
import { loadCompanyReport } from "@/lib/company-report-server";
import { RepL, RepTx, statement } from "@/lib/company-report";
import { PayL, basisText, flagText, hoursOf, rateText } from "@/lib/payroll";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { scope?: "all" | "view" | "period"; period?: { from?: string; to?: string }; range?: { from?: string; to?: string }; format?: "csv" | "xlsx"; password?: string };

// Exportar Finances (mismo pop-up de siempre). ?kind=company → el reporte de la compañía, renglón por renglón · ?kind=payroll → una fila por persona.
// Solo dueño y manager. Sin fechas, exporta el mes en curso.
export async function POST(request: NextRequest) {
  const { supabase, current, tz, weekStartsOn, today } = await financeContext();
  if (!current || !canSeeCompanyMoney(current.role)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const kind = request.nextUrl.searchParams.get("kind") === "payroll" ? "payroll" : "company";
  let body: Body = {};
  try { body = await request.json(); } catch { /* valores por defecto */ }
  // Paso 6.2b: encabezados y renglones en el idioma de quien exporta
  const tag = intlTag(await getLocale());
  const [tx, tr, tl, tf] = await Promise.all([getTranslations("finExport"), getTranslations("compRep"), getTranslations("payLib"), getTranslations("finLib")]);
  const money = (v: number | null | undefined) => new Intl.NumberFormat(tag, { style: "currency", currency: "USD" }).format(Number(v) || 0);
  const words = finWords(tf as never);
  const dS = (d: string, y: boolean) => new Date(`${d}T12:00:00Z`).toLocaleDateString(tag, { timeZone: "UTC", month: "short", day: "numeric", ...(y ? { year: "numeric" } : {}) }).replace(".", "");
  const span = (a: string, b: string) => (a === b ? dS(a, true) : `${dS(a, a.slice(0, 4) !== b.slice(0, 4))} – ${dS(b, true)}`);
  const format = body.format === "xlsx" ? "xlsx" : "csv";
  const password = (body.password ?? "").trim();
  const bad = checkExportBody(format, password);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });

  const month = finRange("month", today, weekStartsOn, today);
  const pick = body.scope === "view" ? body.range : body.scope === "period" ? body.period : undefined;
  const from = isIsoDay(pick?.from) ? pick.from : month.from, to = isIsoDay(pick?.to) ? pick.to : isIsoDay(pick?.from) ? today : month.to;
  if (from > to) return NextResponse.json({ error: tx("eDates") }, { status: 400 });
  const days = daysBetweenIso(from, to) + 1;
  const period: FinPeriod = days <= 7 ? "week" : days <= 14 ? "2weeks" : days <= 31 ? "month" : days <= 92 ? "quarter" : "year";
  const base = `${fileBase(kind === "payroll" ? "payroll" : "company-report", current.name)}_${from}_to_${to}`;

  if (kind === "payroll") {
    if (days > 92) return NextResponse.json({ error: tx("e3m") }, { status: 400 });
    const r = await loadPayroll(supabase, current.id, { from, to, period }, tz, weekStartsOn);
    if (!r.payroll) return NextResponse.json({ error: r.error || tx("eFail") }, { status: 500 });
    const L: PayL = { t: tl as unknown as PayL["t"], money, span };
    const matrix: unknown[][] = [["person", "type", "role", "payRate", "from", "to", "hours", "regHours", "otHours", "jobsDone", "how", "earned", "paid", "owed", "status", "paidOn", "paidWith", "reference", "notes"].map((k) => tx(`p_${k}` as never))];
    for (const p of r.payroll.rows) {
      matrix.push([
        p.name, tl(p.workerType), p.member?.job_title || p.member?.role || "", rateText(p, L), from, to, hoursOf(p.minutes), hoursOf(p.regMinutes), hoursOf(p.otMinutes), p.jobCount,
        basisText(p, L), p.calculated, p.paid, p.balance, p.status === "none" ? "" : tx(`s_${p.status}` as never),
        p.payments.map((x) => String(x.paid_on).slice(0, 10)).join(" | "), p.payments.map((x) => (x.payment_mode ? words.pay(x.payment_mode) : "")).filter(Boolean).join(" | "),
        p.payments.map((x) => x.reference ?? "").filter(Boolean).join(" | "), p.flagSpecs.map((f) => flagText(f, L)).join(" | "),
      ]);
    }
    const t = r.payroll.totals;
    matrix.push([tx("total"), tx("people", { n: t.people }), "", "", from, to, hoursOf(t.minutes), "", "", "", "", t.calculated, t.paid, t.balance, "", "", "", "", ""]);
    return exportResponse(matrix, base, format, password, tl("title"));
  }

  const range: FinRange = { period, from, to, label: spanLabel(from, to), title: spanLabel(from, to), prev: from, next: to, isCurrent: false };
  const { report, buckets } = await loadCompanyReport(supabase, current.id, range, tz, weekStartsOn, today);
  const L: RepL = { t: tr as unknown as RepTx, money, cat: words.cat };
  const matrix: unknown[][] = [["section", "concept", "amount", "pct", "from", "to"].map((k) => tx(`c_${k}` as never))];
  let section = "";
  for (const l of statement(report, L)) {
    if (l.kind === "head") { section = l.label; continue; }
    matrix.push([l.kind === "result" ? tx("result") : section, l.kind === "sub" ? `   ${l.label}` : l.kind === "total" ? l.label.toUpperCase() : l.label, l.amount ?? 0, l.pct ?? "", from, to]);
  }
  const inside = tr("inside");
  for (const b of buckets) {
    const label = span(b.from, b.to);
    matrix.push([inside, `${label} · ${tr("income")}`, b.income, "", b.from, b.to]);
    matrix.push([inside, `${label} · ${tr("expenses")}`, b.costs, "", b.from, b.to]);
    matrix.push([inside, `${label} · ${tr("profit")}`, b.net, "", b.from, b.to]);
  }
  return exportResponse(matrix, base, format, password, tr("pdfTitle"));
}
