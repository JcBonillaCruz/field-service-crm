"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Modal, btnPrimary } from "@/components/sales/SalesBits";
import SelectMenu from "@/components/ui/SelectMenu";
import { InvItem, InvLocation, InvStock, qtyFmt } from "@/lib/inventory";
import { countList } from "@/lib/inventory-insights";
import { buildCountPdf, loadPdfBrand, openPdf } from "@/lib/count-pdf";
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

export default function CountSheetModal({ open, onClose, items, stock, locations, company, initialLocation, companyId = "" }: {
  companyId?: string; open: boolean; onClose: () => void; items: InvItem[]; stock: InvStock[]; locations: InvLocation[]; company: string; initialLocation?: string;
}) {
  const t = useTranslations("countSheet");
  const es = useLocale().startsWith("es");
  const { fmtDay } = useFmt();
  const [loc, setLoc] = useState(initialLocation ?? locations[0]?.id ?? "");
  const [expected, setExpected] = useState(false);
  const [busy, setBusy] = useState<"" | "pdf">("");
  const [error, setError] = useState("");
  useEffect(() => { if (open) { setLoc(initialLocation && locations.some((l) => l.id === initialLocation) ? initialLocation : locations[0]?.id ?? ""); setError(""); } }, [open, initialLocation, locations]);
  const location = locations.find((l) => l.id === loc);
  const list = countList(items, stock, loc);
  const at = (id: string) => Number(stock.find((s) => s.item_id === id && s.location_id === loc)?.qty ?? 0);

  async function pdf() {
    if (!location) return;
    setBusy("pdf"); setError("");
    try {
      const wide = true; // Paso 6.12g: la hoja para contar a mano siempre sale horizontal
      const brand = companyId ? await loadPdfBrand(companyId) : null;
      const bytes = await buildCountPdf({
        design: brand?.design, logoBytes: brand?.logoBytes, logoPng: brand?.logoPng,
        company, title: t("pdfTitle"), subtitle: expected ? t("pdfSubExp") : t("pdfSubBlind"), orientation: "landscape",
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

  return (
    <Modal open={open} onClose={onClose} title={t("title")} width="max-w-xl"
      footer={<>
        <button type="button" onClick={pdf} disabled={!!busy || !list.length} className={`${btnPrimary} inline-flex items-center gap-2 whitespace-nowrap`}><SheetIcon />{busy === "pdf" ? t("making") : t("pdf")}</button>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </>}>
      <p className="mb-4 text-[14px] text-slate-600">{t("intro")}</p>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-[13px] text-slate-500">{t("mLoc")}</label>
          <SelectMenu value={loc} ariaLabel={t("mLoc")} onChange={setLoc} options={locations.map((l) => ({ value: l.id, label: l.name }))} />
          <p className="mt-1 text-[12.5px] text-slate-500">{t("nItems", { n: list.length })}</p>
        </div>
        <button type="button" role="switch" aria-checked={expected} onClick={() => setExpected((v) => !v)} className="flex items-center gap-3 py-1 text-left">
          <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${expected ? "bg-[#0f766e]" : "bg-slate-300"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${expected ? "left-[22px]" : "left-0.5"}`} /></span>
          <span><span className="block text-[14.5px] text-slate-700">{expected ? t("withExpected") : t("blind")}</span><span className="block text-[12px] text-slate-500">{t("blindHint")}</span></span>
        </button>
      </div>
    </Modal>
  );
}
