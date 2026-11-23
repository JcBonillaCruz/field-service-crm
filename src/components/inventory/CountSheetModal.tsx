"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Modal, btnGhost, btnPrimary } from "@/components/sales/SalesBits";
import SelectMenu from "@/components/ui/SelectMenu";
import { InvItem, InvLocation, InvStock, qtyFmt } from "@/lib/inventory";
import { countList } from "@/lib/inventory-insights";
import { buildCountPdf, openPdf } from "@/lib/count-pdf";
import { useFmt } from "@/components/inventory/PageBits";

// Paso 6.12d · Hoja de conteo para imprimir (PDF vertical u horizontal) o en Excel.
// Mismo orden que la pantalla de New Count: cuentas a mano y luego lo pasas al sistema renglón por renglón.
export async function downloadPost(url: string, body: unknown, fallbackName: string) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error("export");
  const blob = await r.blob();
  const name = /filename="([^"]+)"/.exec(r.headers.get("Content-Disposition") ?? "")?.[1] ?? fallbackName;
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export function SheetIcon({ className = "h-[18px] w-[18px]" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 8V3h10v5M6 17H4V9h16v8h-2M7 14h10v7H7zM9.5 17.5h5" /></svg>;
}

export default function CountSheetModal({ open, onClose, items, stock, locations, company, initialLocation }: {
  open: boolean; onClose: () => void; items: InvItem[]; stock: InvStock[]; locations: InvLocation[]; company: string; initialLocation?: string;
}) {
  const t = useTranslations("countSheet");
  const es = useLocale().startsWith("es");
  const { fmtDay } = useFmt();
  const [loc, setLoc] = useState(initialLocation ?? locations[0]?.id ?? "");
  const [orient, setOrient] = useState<"portrait" | "landscape">("portrait");
  const [expected, setExpected] = useState(false);
  const [busy, setBusy] = useState<"" | "pdf" | "xlsx">("");
  const [error, setError] = useState("");
  useEffect(() => { if (open) { setLoc(initialLocation && locations.some((l) => l.id === initialLocation) ? initialLocation : locations[0]?.id ?? ""); setError(""); } }, [open, initialLocation, locations]);
  const location = locations.find((l) => l.id === loc);
  const list = countList(items, stock, loc);
  const at = (id: string) => Number(stock.find((s) => s.item_id === id && s.location_id === loc)?.qty ?? 0);

  async function pdf() {
    if (!location) return;
    setBusy("pdf"); setError("");
    try {
      const wide = orient === "landscape";
      const bytes = await buildCountPdf({
        company, title: t("pdfTitle"), subtitle: expected ? t("pdfSubExp") : t("pdfSubBlind"), orientation: orient,
        meta: [[t("mLoc"), location.name], [t("mDate"), fmtDay(new Date().toISOString())], [t("mItems"), String(list.length)], [t("mType"), expected ? t("withExpected") : t("blind")]],
        columns: [
          { label: "#", w: 3, align: "center" }, { label: t("cItem"), w: wide ? 26 : 22 }, { label: "SKU", w: wide ? 12 : 11 }, { label: t("cUnit"), w: 5, align: "center" },
          ...(expected ? [{ label: t("cExpected"), w: 6, align: "right" as const }] : []),
          { label: t("cCounted"), w: 8, box: true }, { label: t("cNotes"), w: wide ? 18 : 10, box: true },
        ],
        rows: list.map((it, i) => ({ cells: [String(i + 1), it.name, it.sku ?? "", it.unit ?? "", ...(expected ? [qtyFmt(at(it.id))] : []), "", ""] })),
        note: t("pdfNote"), sign: [t("sCounted"), t("sChecked"), t("sDate")],
        footer: `BrightPro · ${company}`, page: (n, total) => t("page", { n, total }),
      });
      openPdf(bytes, `${es ? "hoja-de-conteo" : "count-sheet"}-${location.name}.pdf`);
    } catch { setError(t("eGen")); }
    setBusy("");
  }
  async function xlsx() {
    setBusy("xlsx"); setError("");
    try { await downloadPost("/dashboard/inventory/counts/export", { location: loc, expected, es }, "count-sheet.xlsx"); } catch { setError(t("eGen")); }
    setBusy("");
  }

  return (
    <Modal open={open} onClose={onClose} title={t("title")} width="max-w-xl"
      footer={<>
        <button type="button" onClick={pdf} disabled={!!busy || !list.length} className={`${btnPrimary} inline-flex items-center gap-2 whitespace-nowrap`}><SheetIcon />{busy === "pdf" ? t("making") : t("pdf")}</button>
        <button type="button" onClick={xlsx} disabled={!!busy || !list.length} className={`${btnGhost} whitespace-nowrap`}>{busy === "xlsx" ? t("making") : "Excel"}</button>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </>}>
      <p className="mb-4 text-[14px] text-slate-600">{t("intro")}</p>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-[13px] text-slate-500">{t("mLoc")}</label>
          <SelectMenu value={loc} ariaLabel={t("mLoc")} onChange={setLoc} options={locations.map((l) => ({ value: l.id, label: l.name }))} />
          <p className="mt-1 text-[12.5px] text-slate-500">{t("nItems", { n: list.length })}</p>
        </div>
        <div>
          <p className="mb-1.5 text-[13px] text-slate-500">{t("orient")}</p>
          <div className="grid grid-cols-2 gap-3">
            {(["portrait", "landscape"] as const).map((o) => (
              <button key={o} type="button" onClick={() => setOrient(o)} aria-pressed={orient === o}
                className={`group flex items-center gap-3 rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 ${orient === o ? "border-[#0f766e] bg-[#f3fbf8]" : "border-slate-200 hover:border-[#14a39a]"}`}>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-slate-200">
                  <span className={`block rounded-[3px] border-2 transition-transform duration-200 group-hover:scale-110 ${orient === o ? "border-[#0f766e] bg-[#e9f7f4]" : "border-slate-300 bg-slate-50"} ${o === "portrait" ? "h-8 w-6" : "h-6 w-8"}`}>
                    <span className="mx-auto mt-1 block h-[2px] w-3/5 rounded bg-current opacity-40" />
                  </span>
                </span>
                <span className="min-w-0"><span className="block text-[14.5px] font-semibold text-[#0b1f3a]">{t(o)}</span><span className="block text-[12px] text-slate-500">{t(`${o}Sub`)}</span></span>
              </button>
            ))}
          </div>
        </div>
        <button type="button" role="switch" aria-checked={expected} onClick={() => setExpected((v) => !v)} className="flex items-center gap-3 py-1 text-left">
          <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${expected ? "bg-[#0f766e]" : "bg-slate-300"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${expected ? "left-[22px]" : "left-0.5"}`} /></span>
          <span><span className="block text-[14.5px] text-slate-700">{expected ? t("withExpected") : t("blind")}</span><span className="block text-[12px] text-slate-500">{t("blindHint")}</span></span>
        </button>
      </div>
    </Modal>
  );
}
