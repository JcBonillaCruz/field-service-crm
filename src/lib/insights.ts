import type { MobileStats } from "@/lib/dashboard-server";

export type Insight = { tone: "good" | "warn" | "bad" | "info"; title: string; body: string; href?: string; cta?: string };

const $ = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v || 0);
const pct = (v: number) => `${Math.round(v * 100)}%`;

// Lo que está pasando con tu dinero, en palabras simples, con qué hacer
export function buildInsights(st: MobileStats): Insight[] {
  const out: Insight[] = [];
  const n = st.receipts.length;
  const thisM = st.receipts[n - 1] ?? 0, lastM = st.receipts[n - 2] ?? 0;
  const spentM = st.expenses[n - 1] ?? 0, spentLast = st.expenses[n - 2] ?? 0;
  const profitYtd = st.ytdReceived - st.ytdExpenses;
  const margin = st.ytdReceived > 0 ? profitYtd / st.ytdReceived : 0;

  if (st.ytdReceived > 0 && profitYtd < 0) out.push({ tone: "bad", title: "You're spending more than you collect", body: `This year you've spent ${$(st.ytdExpenses)} but collected ${$(st.ytdReceived)}. Review your biggest expense categories and collect overdue invoices first.`, href: "/dashboard/expenses", cta: "Review expenses" });
  else if (st.ytdReceived > 0 && margin < 0.2) out.push({ tone: "warn", title: `Profit margin is ${pct(margin)}`, body: "Service businesses usually aim for 20–40%. Consider raising prices on your most requested services or cutting one recurring cost.", href: "/dashboard/items", cta: "Check prices" });
  else if (st.ytdReceived > 0 && margin >= 0.4) out.push({ tone: "good", title: `Healthy profit margin: ${pct(margin)}`, body: `You kept ${$(profitYtd)} of every dollar collected this year. Set aside part of it for taxes and slow months.` });

  if (st.overdue > 0) {
    const late = st.agingCount.slice(1).reduce((a, b) => a + b, 0);
    out.push({ tone: "warn", title: `${$(st.overdue)} is overdue`, body: `${late} ${late === 1 ? "invoice is" : "invoices are"} past due. A friendly reminder today usually gets paid within the week.`, href: "/dashboard/invoices?view=overdue", cta: "Send reminders" });
  }
  if (lastM > 0) {
    const ch = (thisM - lastM) / lastM;
    out.push(ch >= 0
      ? { tone: "good", title: `Collections up ${pct(ch)} vs last month`, body: `You've received ${$(thisM)} this month vs ${$(lastM)} last month. Keep the momentum: follow up on open quotes.` }
      : { tone: "info", title: `Collections down ${pct(-ch)} vs last month`, body: `${$(thisM)} so far this month vs ${$(lastM)} last month. The month isn't over: check unpaid invoices and quotes waiting for approval.` });
  }
  if (spentLast > 0 && spentM > spentLast * 1.25) out.push({ tone: "warn", title: `Spending is up ${pct((spentM - spentLast) / spentLast)} this month`, body: `${$(spentM)} spent vs ${$(spentLast)} last month. Make sure each purchase is tied to a job you're billing for.`, href: "/dashboard/expenses", cta: "See expenses" });
  const totalCat = st.expenseByCat.reduce((a, [, v]) => a + v, 0);
  if (st.expenseByCat[0] && totalCat > 0 && st.expenseByCat[0][1] / totalCat > 0.4) out.push({ tone: "info", title: `${st.expenseByCat[0][0]} is ${pct(st.expenseByCat[0][1] / totalCat)} of your spending`, body: "Your biggest cost category. Compare suppliers or buy in bulk for the jobs you do most." });
  if (st.quoteStats.open > 0) out.push({ tone: "info", title: `${$(st.quoteStats.openValue)} waiting in open quotes`, body: `${st.quoteStats.open} ${st.quoteStats.open === 1 ? "quote is" : "quotes are"} sent and not answered yet. A quick call or text can close them.`, href: "/dashboard/quotes?view=sent", cta: "Follow up" });
  const decided = st.quoteStats.accepted + st.quoteStats.declined;
  if (decided >= 3) {
    const win = st.quoteStats.accepted / decided;
    out.push({ tone: win >= 0.5 ? "good" : "warn", title: `You win ${pct(win)} of your quotes`, body: win >= 0.5 ? "Great close rate. You may have room to raise prices a little." : "Try sending quotes the same day, adding photos, and offering good/better/best options." });
  }
  if (st.ytdExpenses === 0) out.push({ tone: "info", title: "Add your expenses to see real profit", body: "Right now BrightPro only knows what comes in. Add supplies, payroll and fuel to see what you actually keep.", href: "/dashboard/expenses", cta: "Add an expense" });
  return out;
}

const TIPS = [
  "Send invoices the same day you finish the job: they get paid up to twice as fast.",
  "Ask for a deposit (30–50%) on big jobs before buying materials.",
  "Set aside 25–30% of every payment for taxes in a separate account.",
  "Offer a maintenance plan (subscription): steady monthly income smooths slow seasons.",
  "Review your prices every 6 months; material costs change, your rates should too.",
  "Take before-and-after photos and attach them to the invoice: fewer disputes, faster payment.",
  "Keep 3 months of expenses as a cash cushion before expanding.",
  "Follow up on quotes within 48 hours; most customers decide in the first week.",
  "Track fuel and mileage per job to know which areas are really profitable.",
  "Offer card and Zelle payments: easier to pay means paid sooner.",
  "Bundle small add-ons (filters, inspections) into your main services.",
  "Call your best customers twice a year: repeat work costs nothing to win.",
  "Separate business and personal spending; it makes taxes and loans much easier.",
  "Check which service makes you the most profit, not just the most revenue.",
  "Late fees work best when they're written on the quote and invoice from day one.",
  "Buy materials per job, not 'just in case', to keep cash free.",
  "A Google review request right after payment can bring your next customer.",
  "Look at last year's same month to plan for slow and busy seasons.",
  "If one customer is more than 30% of your income, start diversifying.",
  "Write down why quotes are declined: price, timing or trust. Fix the most common one.",
];
export const tipOfTheDay = (d = new Date()) => TIPS[(Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000)) % TIPS.length];
