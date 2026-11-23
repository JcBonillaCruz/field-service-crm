"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useInvTx } from "@/i18n/useInvTx";
import { InvLocation, invError, pingAlerts, qtyFmt } from "@/lib/inventory";
import type { MoveRow } from "@/lib/inventory-server";
import { buildCountPdf, loadPdfBrand, openPdf } from "@/lib/count-pdf";
import { Modal, btnGhost } from "@/components/sales/SalesBits";
import { inputClass } from "@/components/customers/ui";
import { LocArt } from "@/components/inventory/InvArt";
import { PageHead, pageWrap, useFmt } from "@/components/inventory/PageBits";
import { SheetIcon } from "@/components/inventory/CountSheetModal";

// =====================================================================
// Paso 6.12d · Ficha de un conteo
//   · Todos: ver lo esperado vs. lo contado, sacar PDF (vertical u horizontal) o Excel
//   · Dueño y manager: "Corregir" (revierte y abre un conteo nuevo con los mismos números) o "Revertir" (con motivo).
//     Nada se borra: el conteo queda marcado como revertido y los movimientos de regreso salen en History.
// =====================================================================
export type Reversal = { reason: string; reversed_by_name: string | null; role: string | null; created_at: string };

export default function CountDetail({ companyId, batch, rows, location, company, reversal, reverseSql, canReverse }: {
  companyId: string; batch: string; rows: MoveRow[]; location: (InvLocation & { is_active?: boolean }) | null; company: string; reversal: Reversal | null; reverseSql: boolean; canReverse: boolean;
}) {
  const t = useTranslations("countDetail");
  const ix = useInvTx();
  const usd = ix.money;
  const es = useLocale().startsWith("es");
  const { fmtWhen } = useFmt();
  const router = useRouter();
  const [ask, setAsk] = useState<null | "reverse" | "correct">(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const lines = [...rows].sort((a, b) => (a.items?.name ?? "").localeCompare(b.items?.name ?? "")).map((m) => {
    const exp = Number(m.expected_qty ?? 0), cnt = Number(m.counted_qty ?? 0), d = cnt - exp;
    return { m, exp, cnt, d, value: d * Number(m.unit_cost ?? 0) };
  });
  const missing = lines.filter((l) => l.d < 0).reduce((a, l) => a + -l.d, 0);
  const missingCost = lines.filter((l) => l.d < 0).reduce((a, l) => a + -l.value, 0);
  const extra = lines.filter((l) => l.d > 0).reduce((a, l) => a + l.d, 0);
  const net = lines.reduce((a, l) => a + l.value, 0);
  const first = rows[0];
  const resp = rows.find((m) => m.responsible_name)?.responsible_name;
  const note = rows.find((m) => m.note)?.note;
  const locName = location?.name ?? "—";

  async function pdf() {
    const orientation = "portrait" as "portrait" | "landscape"; // Paso 6.12g: reportes siempre vertical
    const brand = await loadPdfBrand(companyId);
    const bytes = await buildCountPdf({
      design: brand.design, logoBytes: brand.logoBytes, logoPng: brand.logoPng,
      company, title: t("pdfTitle"), subtitle: reversal ? t("pdfReversed", { reason: reversal.reason }) : t("pdfSub"), orientation,
      meta: [[t("mLoc"), locName], [t("mDate"), fmtWhen(first.created_at)], [t("mBy"), first.actor_name ?? "—"], [t("mStatus"), reversal ? t("reversed") : t("saved")]],
      summary: [[t("kItems"), String(lines.length), null], [t("kMissing"), `${qtyFmt(missing)} · ${usd(missingCost)}`, missing ? "neg" : null], [t("kExtra"), qtyFmt(extra), extra ? "pos" : null], [t("kNet"), usd(net), net < 0 ? "neg" : net > 0 ? "pos" : null]],
      columns: [
        { label: "#", w: 3, align: "center" }, { label: t("cItem"), w: orientation === "landscape" ? 26 : 20 }, { label: "SKU", w: 11 },
        { label: t("cExpected"), w: 7, align: "right" }, { label: t("cCounted"), w: 7, align: "right" }, { label: t("cDiff"), w: 7, align: "right" }, { label: t("cValue"), w: 9, align: "right" },
      ],
      rows: lines.map((l, i) => ({
        cells: [String(i + 1), l.m.items?.name ?? "", l.m.items?.sku ?? "", qtyFmt(l.exp), qtyFmt(l.cnt), l.d === 0 ? "0" : `${l.d > 0 ? "+" : "-"}${qtyFmt(Math.abs(l.d))}`, usd(l.value)],
        tone: [null, null, null, null, null, l.d < 0 ? "neg" : l.d > 0 ? "pos" : null, l.d < 0 ? "neg" : l.d > 0 ? "pos" : null],
        ...(l.d < 0 ? { alert: "red" as const } : {}),
      })),
      note: [note ? `${t("note")}: ${note}` : "", resp ? t("respX", { name: resp }) : ""].filter(Boolean).join("   ·   ") || undefined,
      sign: [t("sCounted"), t("sReviewed"), t("sDate")], footer: `BrightPro · ${company}`, page: (n, total) => t("page", { n, total }),
    });
    openPdf(bytes, `${es ? "conteo" : "count"}-${locName}.pdf`);
  }

  async function reverse() {
    if (reason.trim().length < 5) return setError(t("eReason"));
    setBusy(true); setError("");
    const { error: e } = await createClient().rpc("inv_count_reverse", { p_company: companyId, p_batch: batch, p_reason: reason.trim() });
    if (e) { setBusy(false); return setError(/ALREADY_REVERSED/.test(e.message) ? t("eAlready") : /NO_ACCESS/.test(e.message) ? t("eRole") : /REASON/.test(e.message) ? t("eReason") : /does not exist|Could not find/i.test(e.message) ? t("needsSql") : ix.err(invError(e))); }
    pingAlerts();
    fetch("/api/inventory/count-reversed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batch }), keepalive: true }).catch(() => {});
    setBusy(false);
    if (ask === "correct") { router.push(`/dashboard/inventory/counts/new?from=${batch}${location ? `&location=${location.id}` : ""}`); return; }
    setAsk(null); setReason(""); setMsg(t("doneReverse")); router.refresh();
  }

  const btn = "inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 text-[14px] font-medium text-slate-700 transition-all hover:-translate-y-0.5 hover:border-[#14a39a] hover:text-[#0f766e]";
  return (
    <div className={`${pageWrap} min-h-[calc(100vh-4rem)] bg-[#f4f6f8]`}>
      <PageHead back="/dashboard/inventory/history?tab=counts" title={t("title", { loc: locName })} subtitle={[first.actor_name, fmtWhen(first.created_at)].filter(Boolean).join(" · ")}>
        <button type="button" onClick={() => pdf()} className={btn}><SheetIcon />PDF</button>
        {canReverse && !reversal && (
          <>
            <button type="button" onClick={() => { setAsk("correct"); setReason(""); setError(""); }} className={btn}>{t("correct")}</button>
            <button type="button" onClick={() => { setAsk("reverse"); setReason(""); setError(""); }}
              className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-red-200 bg-white px-3.5 text-[14px] font-semibold text-red-600 transition-all hover:-translate-y-0.5 hover:bg-red-50">{t("reverse")}</button>
          </>
        )}
      </PageHead>

      {msg && <p role="status" className="mt-4 rounded-xl bg-[#e7f6f1] px-4 py-3 text-[14px] text-[#0f766e] ring-1 ring-[#bfe6da]">{msg}</p>}
      {reversal && (
        <div className="mt-4 flex flex-wrap items-start gap-3 rounded-2xl border border-slate-300 bg-white p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg></span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-[#0b1f3a]">{t("reversedBy", { name: reversal.reversed_by_name ?? "—", date: fmtWhen(reversal.created_at) })}</p>
            <p className="mt-0.5 text-[14px] text-slate-600">“{reversal.reason}”</p>
            <p className="mt-1 text-[12.5px] text-slate-500">{t("reversedHow")}</p>
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[[t("kItems"), String(lines.length), ""], [t("kMissing"), qtyFmt(missing), missing ? "text-[#be123c]" : ""], [t("kMissingValue"), usd(missingCost), missingCost ? "text-[#be123c]" : ""], [t("kExtra"), qtyFmt(extra), extra ? "text-[#0f766e]" : ""]].map(([k, v, c]) => (
          <div key={k} className={`rounded-2xl border border-slate-200 bg-white p-4 ${reversal ? "opacity-70" : ""}`}><p className="text-[12.5px] font-medium text-slate-500">{k}</p><p className={`mt-1 truncate text-[20px] font-semibold tabular-nums sm:text-[24px] ${c || "text-[#0b1f3a]"}`}>{v}</p></div>
        ))}
      </div>

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
          {location && <LocArt kind={location.kind} size={40} />}
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-semibold text-[#0b1f3a]">{locName}{reversal && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 align-middle text-[11px] font-semibold text-slate-600">{t("reversed")}</span>}</p>
            {(resp || note) && <p className="truncate text-[13px] text-slate-500">{[resp ? t("respX", { name: resp }) : "", note ? `“${note}”` : ""].filter(Boolean).join(" · ")}</p>}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-[14px]">
            <thead><tr className="bg-[#fafbfc] text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="w-10 px-4 py-2.5 text-center">#</th><th className="px-3 py-2.5 text-left">{t("cItem")}</th><th className="px-3 py-2.5 text-right">{t("cExpected")}</th>
              <th className="px-3 py-2.5 text-right">{t("cCounted")}</th><th className="px-3 py-2.5 text-right">{t("cDiff")}</th><th className="px-5 py-2.5 text-right">{t("cValue")}</th>
            </tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.m.id} className="border-t border-slate-100 hover:bg-[#f6fbfa]">
                  <td className="px-4 py-2.5 text-center text-[12.5px] tabular-nums text-slate-400">{i + 1}</td>
                  <td className="px-3 py-2.5"><Link prefetch={false} href={`/dashboard/inventory/${l.m.item_id}`} className="block min-w-0"><span className="block truncate text-[#0b1f3a] hover:text-[#0f766e]">{l.m.items?.name}</span><span className="block truncate font-mono text-[12px] text-slate-400">{l.m.items?.sku}</span></Link></td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{qtyFmt(l.exp)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-[#0b1f3a]">{qtyFmt(l.cnt)}</td>
                  <td className="px-3 py-2.5 text-right">{l.d === 0 ? <span className="text-slate-400">0</span>
                    : <span className={`rounded-full px-2 py-0.5 text-[12.5px] font-semibold tabular-nums ${l.d < 0 ? "bg-[#fff1f2] text-[#be123c]" : "bg-[#e7f6f1] text-[#0f766e]"}`}>{l.d > 0 ? "+" : "−"}{qtyFmt(Math.abs(l.d))}</span>}</td>
                  <td className={`px-5 py-2.5 text-right tabular-nums ${l.value < 0 ? "text-[#be123c]" : l.value > 0 ? "text-[#0f766e]" : "text-slate-500"}`}>{usd(l.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {!canReverse && !reversal && <p className="mt-4 text-[13px] text-slate-500">{t("onlyOwner")}</p>}

      <Modal open={ask !== null} onClose={() => setAsk(null)} title={ask === "correct" ? t("correctQ") : t("reverseQ")}
        footer={<>
          <button type="button" onClick={reverse} disabled={busy || !reverseSql} className={`whitespace-nowrap rounded-lg px-5 py-2.5 text-[15px] font-semibold text-white transition-colors disabled:opacity-60 ${ask === "correct" ? "bg-[#0f766e] hover:bg-[#0c5f59]" : "bg-red-600 hover:bg-red-700"}`}>
            {busy ? t("working") : ask === "correct" ? t("correctGo") : t("reverseGo")}</button>
          <button type="button" onClick={() => setAsk(null)} className={btnGhost}>{t("cancel")}</button>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </>}>
        {!reverseSql && <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{t("needsSql")}</p>}
        <p className="text-[14px] text-slate-600">{ask === "correct" ? t("correctText") : t("reverseText")}</p>
        <ul className="mt-3 space-y-1 text-[13.5px] text-slate-600">
          {missing > 0 && <li>• {t("backIn", { n: qtyFmt(missing), loc: locName })}</li>}
          {extra > 0 && <li>• {t("backOut", { n: qtyFmt(extra), loc: locName })}</li>}
          <li>• {t("kept")}</li>
        </ul>
        <label htmlFor="rev-reason" className="mb-1 mt-4 block text-[13px] font-semibold text-slate-700">{t("reason")}*</label>
        <textarea id="rev-reason" autoFocus rows={3} value={reason} maxLength={300} onChange={(e) => { setReason(e.target.value); setError(""); }} placeholder={t("reasonPh")} className={inputClass} />
      </Modal>
    </div>
  );
}
