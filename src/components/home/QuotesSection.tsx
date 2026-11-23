"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { intlTag } from "@/i18n/config";
import { useJobError } from "@/i18n/useFmt";
import { AlertIcon, QuoteArt } from "@/components/home/DashArt";
import { convertQuoteById, db, logActivity } from "@/lib/sales-client";
import { QUOTE_NO_REPLY_DAYS, type HomeAlert } from "@/lib/home-dashboard";

// =====================================================================
// Paso 6.7 — Cotizaciones en el Home (dueño, manager y oficina).
// Aceptadas sin convertir (con Convert to job / Convert to invoice ahí mismo),
// sin respuesta 3+ días, por vencer y rechazadas en las últimas 2 semanas.
// =====================================================================

type Kind = "quote_accepted" | "quote_expiring" | "quote_no_reply" | "quote_declined";
const KINDS: { k: Kind; level: "teal" | "orange" | "blue" | "red" }[] = [
  { k: "quote_accepted", level: "teal" },
  { k: "quote_expiring", level: "orange" },
  { k: "quote_no_reply", level: "blue" },
  { k: "quote_declined", level: "red" },
];
const TONE: Record<string, { bg: string; ring: string; text: string; sub: string }> = {
  teal: { bg: "bg-[#e7f6f1]", ring: "ring-[#bfe6d8]", text: "text-[#0f766e]", sub: "text-[#0f766e]" },
  orange: { bg: "bg-[#fff6e6]", ring: "ring-[#fde3b4]", text: "text-[#b45309]", sub: "text-[#b45309]" },
  blue: { bg: "bg-[#eef4ff]", ring: "ring-[#d6e4ff]", text: "text-[#1d4ed8]", sub: "text-[#2563eb]" },
  red: { bg: "bg-[#fff1f2]", ring: "ring-[#fecdd3]", text: "text-[#be123c]", sub: "text-[#be123c]" },
};
const ORDER: Record<Kind, number> = { quote_accepted: 0, quote_expiring: 1, quote_no_reply: 2, quote_declined: 3 };

export default function QuotesSection({ items, actor }: { items: HomeAlert[]; actor: string }) {
  const T = useTranslations("dash");
  const tag = intlTag(useLocale());
  const jobError = useJobError();
  const router = useRouter();
  const usd0 = (v: number) => new Intl.NumberFormat(tag, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(v) || 0);
  const usd2 = (v: number) => new Intl.NumberFormat(tag, { style: "currency", currency: "USD" }).format(Number(v) || 0);
  const [cat, setCat] = useState<Kind | "all">("all");
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const list = useMemo(() => [...items].sort((a, b) => {
    const ka = a.kind as Kind, kb = b.kind as Kind;
    if (ORDER[ka] !== ORDER[kb]) return ORDER[ka] - ORDER[kb];
    // aceptadas y rechazadas: las más nuevas primero · por vencer: la que vence antes · sin respuesta: la que lleva más días
    if (ka === "quote_expiring") return (a.days ?? 0) - (b.days ?? 0);
    if (ka === "quote_no_reply") return (b.days ?? 0) - (a.days ?? 0);
    return b.at.localeCompare(a.at);
  }), [items]);
  const of = (k: Kind) => list.filter((i) => i.kind === k);
  const filtered = cat === "all" ? list : of(cat);
  const shown = all ? filtered : filtered.slice(0, 5);
  const sum = (l: HomeAlert[]) => l.reduce((a, i) => a + (i.amount ?? 0), 0);

  const ago = (n: number) => (n <= 0 ? T("q.today") : n === 1 ? T("q.yesterday") : T("q.ago", { n }));
  const line = (a: HomeAlert): { text: string; short?: string; hint: string } => {
    const n = a.days ?? 0;
    switch (a.kind as Kind) {
      case "quote_accepted": return { text: T("q.acceptedWhen", { when: ago(n) }), hint: T("q.convertIt") };
      case "quote_declined": return { text: T("q.declinedWhen", { when: ago(n) }), hint: T("q.askWhy") };
      case "quote_expiring": return { text: n <= 0 ? T("q.expToday") : n === 1 ? T("q.expTomorrow") : T("q.expIn", { n }), hint: T("q.callNow") };
      default: return { text: T("q.sentAgo", { n }), short: T("q.sentShort", { n }), hint: T("q.callNow") };
    }
  };

  async function toJob(a: HomeAlert) {
    if (!a.docId || busy) return;
    setBusy(`${a.id}-job`); setError("");
    const { data: id, error: e } = await db().rpc("job_from_quote", { p_quote: a.docId });
    if (e || !id) { setBusy(null); setError(e?.hint || jobError(e) || T("q.eJob")); return; }
    const { data: made } = await db().from("jobs").select("number, company_id").eq("id", id as string).maybeSingle();
    if (made?.company_id) await logActivity(made.company_id as string, "quote", a.docId, `Job ${(made.number as string) ?? ""} created from this quote`.replace("  ", " "), actor);
    // Igual que en la cotización: abre el trabajo para elegir tipo, fecha y colaboradores
    router.push(`/dashboard/jobs/${id}/edit`);
    router.refresh();
  }
  async function toInvoice(a: HomeAlert) {
    if (!a.docId || busy) return;
    setBusy(`${a.id}-inv`); setError("");
    const id = await convertQuoteById(a.docId, actor).catch(() => null);
    if (!id) { setBusy(null); setError(T("q.eInvoice")); return; }
    router.push(`/dashboard/invoices/${id}/edit`);
    router.refresh();
  }

  return (
    <section className="flex flex-col rounded-2xl border border-slate-200 bg-white" aria-label={T("q.title")}>
      <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-5 lg:px-5 lg:pt-4">
        <div className="group flex min-w-0 items-center gap-3">
          <QuoteArt size={42} />
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-semibold leading-tight text-[#0b1f3a] sm:text-[18px] lg:text-[19px]">{T("q.title")}</h2>
            <p className="mt-0.5 truncate text-[12.5px] text-slate-500">{list.length ? T("q.sub") : T("q.subEmpty")}</p>
          </div>
        </div>
        <Link prefetch={false} href="/dashboard/quotes" className="shrink-0 rounded-lg px-2.5 py-1.5 text-[13.5px] font-semibold text-[#6d4fd6] hover:bg-[#f4f0ff]">{T("q.open")}</Link>
      </div>

      {/* Tarjetitas: tocar una filtra la lista (tocarla otra vez quita el filtro) */}
      <div className="grid grid-cols-2 gap-3 px-4 pt-4 lg:gap-2.5 lg:px-5 lg:pt-3">
        {KINDS.map(({ k, level }) => {
          const l = of(k), on = cat === k, t = TONE[level];
          return (
            <button key={k} type="button" onClick={() => { setCat(on ? "all" : k); setAll(false); }} aria-pressed={on} disabled={!l.length}
              className={`group flex items-center gap-3 rounded-2xl p-3.5 text-left ring-1 transition-all duration-150 lg:rounded-xl lg:p-3 ${l.length ? `${t.bg} ${t.ring} hover:-translate-y-px hover:shadow-sm` : "cursor-default bg-white ring-slate-200"} ${on ? "ring-2 ring-[#0f766e]" : ""}`}>
              <span className="hidden sm:flex"><AlertIcon kind={k} level={l.length ? level : "gray"} size={34} /></span>
              <span className="min-w-0">
                <span className="flex items-baseline gap-1.5">
                  <span className={`text-[22px] font-semibold leading-none tabular-nums ${l.length ? t.text : "text-slate-300"}`}>{l.length}</span>
                  {l.length > 0 && <span className={`truncate text-[12px] font-semibold tabular-nums ${t.sub}`}>{usd0(sum(l))}</span>}
                </span>
                <span className={`mt-1 line-clamp-2 block text-[12.5px] font-semibold leading-snug ${l.length ? "text-[#0b1f3a]" : "text-slate-400"}`}>
                  {k === "quote_no_reply" ? T("q.t.quote_no_reply", { n: QUOTE_NO_REPLY_DAYS }) : T(`q.t.${k}` as never)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {error && <p role="alert" className="mx-4 mt-3 rounded-lg border border-[#fecdd3] bg-[#fff1f2] px-3 py-2 text-[13px] text-[#be123c] lg:mx-5">{error}</p>}

      {!list.length ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-8 pt-6 text-center">
          <span className="group"><QuoteArt size={56} /></span>
          <p className="mt-2 text-[14.5px] font-semibold text-[#0b1f3a]">{T("q.none")}</p>
          <p className="mt-1 max-w-sm text-[13px] text-slate-500">{T("q.noneHint")}</p>
        </div>
      ) : (
        <ul className="mt-5 border-t border-slate-100 px-2 pb-3 pt-1.5 lg:mt-2 lg:border-0 lg:px-3 lg:pb-2 lg:pt-0">
          {shown.map((a) => {
            const k = a.kind as Kind, level = KINDS.find((x) => x.k === k)!.level, l = line(a), accepted = k === "quote_accepted";
            return (
              <li key={a.id} className="border-b border-slate-100 last:border-0">
                <div className="group flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-xl px-2 py-3.5 transition-colors hover:bg-slate-50 lg:gap-x-3 lg:px-3 lg:py-2.5">
                  <Link prefetch={false} href={a.href} className="flex min-w-0 flex-1 items-center gap-3.5 lg:gap-3">
                    <AlertIcon kind={k} level={level} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="truncate text-[14.5px] font-semibold text-[#0b1f3a]">{a.customer}</span>
                        <span className="hidden shrink-0 text-[12px] tabular-nums text-slate-400 sm:inline">{a.number}</span>
                        {(k === "quote_no_reply" || k === "quote_expiring") && (
                          <span className={`shrink-0 rounded-full px-1.5 py-px text-[10.5px] font-semibold ${a.viewed ? "bg-[#f1ebff] text-[#7c3aed]" : "bg-slate-100 text-slate-500"}`}>
                            {a.viewed ? T("q.viewed") : T("q.notOpened")}
                          </span>
                        )}
                      </span>
                      <span className={`mt-0.5 block truncate text-[12.5px] font-medium lg:mt-0 ${TONE[level].sub}`}>
                        <span className="sm:hidden">{l.short ?? l.text}</span><span className="hidden sm:inline">{l.text} · {l.hint}</span>
                        <span className="font-normal tabular-nums text-slate-400 sm:hidden"> · {a.number}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[14.5px] font-semibold tabular-nums text-[#0b1f3a]">{usd2(a.amount ?? 0)}</span>
                      {!accepted && <span className="hidden text-[11.5px] font-semibold text-[#0f766e] opacity-0 transition-opacity group-hover:opacity-100 lg:block">{T("q.followUp")}</span>}
                    </span>
                  </Link>
                  {accepted && (
                    <span className="flex w-full justify-end gap-2 pl-[3.1rem] sm:w-auto sm:pl-0">
                      <ActBtn label={T("q.toJob")} title={T("q.toJobFull")} busy={busy === `${a.id}-job`} disabled={Boolean(busy)} onClick={() => toJob(a)} icon="job" />
                      <ActBtn label={T("q.toInvoice")} title={T("q.toInvoiceFull")} busy={busy === `${a.id}-inv`} disabled={Boolean(busy)} onClick={() => toInvoice(a)} icon="invoice" />
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {filtered.length > shown.length && (
        <div className="mt-auto border-t border-slate-100 px-4 py-2.5 text-center">
          <button type="button" onClick={() => setAll(true)} className="rounded-lg px-3 py-1.5 text-[13.5px] font-semibold text-[#0f766e] hover:bg-[#e9f7f4]">{T("seeAll", { n: filtered.length })}</button>
        </div>
      )}
    </section>
  );
}

// Botón chico con ícono: "To job" (calendario con palomita) · "To invoice" (hoja con $)
function ActBtn({ label, title, icon, busy, disabled, onClick }: { label: string; title: string; icon: "job" | "invoice"; busy: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} aria-label={title}
      className="group/b inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#bfe6d8] bg-white px-2.5 text-[12.5px] font-semibold text-[#0f766e] transition-all duration-150 hover:-translate-y-px hover:border-[#14a39a] hover:bg-[#e9f7f4] disabled:translate-y-0 disabled:opacity-60">
      {busy ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 3a9 9 0 1 0 9 9" /></svg>
      ) : icon === "job" ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform duration-150 group-hover/b:scale-110" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M9 15l2 2 4-4" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform duration-150 group-hover/b:scale-110" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h9l4 4v14H6zM12 9.5v7M14 11h-2.8a1.4 1.4 0 0 0 0 2.8h1.6a1.4 1.4 0 0 1 0 2.8H10" /></svg>
      )}
      {label}
    </button>
  );
}
