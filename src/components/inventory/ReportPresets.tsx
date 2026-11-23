"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { InvItem, InvLocation, InvMember, InvStock, KitRow } from "@/lib/inventory";
import { buildCountPdf, loadPdfBrand, openPdf } from "@/lib/count-pdf";
import { NEEDS_MOVES, ReportMove, ReportPreset, buildPresetInput } from "@/lib/inventory-report";
import { SheetIcon } from "@/components/inventory/CountSheetModal";
import { CartArt } from "@/components/inventory/KpiArt";

// =====================================================================
// Paso 6.12f · Reportes guardados → PDF con el diseño elegido en Ajustes
// =====================================================================
const SELECT = "item_id, kind, qty, from_location, to_location, unit_cost, reason, actor_name, responsible_name, batch_id, created_at, items ( name, sku )";
type Data = { companyId: string; company: string; items: InvItem[]; stock: InvStock[]; locations: InvLocation[]; members: InvMember[]; kit: KitRow[] };

export function useRunPreset(d: Data) {
  const t = useTranslations("invReport");
  const es = useLocale().startsWith("es");
  return useCallback(async (p: ReportPreset) => {
    const sb = createClient();
    let moves: ReportMove[] = [];
    let reversed = new Set<string>();
    if (p.sections.some((s) => NEEDS_MOVES.includes(s))) {
      const since = new Date(Date.now() - p.days * 86400000).toISOString();
      const [m, r] = await Promise.all([
        sb.from("inventory_movements").select(SELECT).eq("company_id", d.companyId).gte("created_at", since).order("created_at", { ascending: false }).limit(20000),
        sb.from("inventory_count_reversals").select("batch_id").eq("company_id", d.companyId),
      ]);
      moves = ((m.data ?? []) as unknown as ReportMove[]).map((x) => ({ ...x, qty: Number(x.qty), items: Array.isArray(x.items) ? (x.items[0] ?? null) : x.items }));
      reversed = new Set(((r.data ?? []) as { batch_id: string }[]).map((x) => x.batch_id));
    }
    const loc = es ? "es-US" : "en-US";
    const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
    const day = (iso: string) => new Date(iso).toLocaleDateString(loc, { month: "short", day: "numeric", year: "numeric" });
    const brand = await loadPdfBrand(d.companyId).catch(() => null);
    const input = buildPresetInput(p, { items: d.items, stock: d.stock, locations: d.locations, members: d.members, kit: d.kit, moves, reversed }, t, { money, day }, d.company);
    const bytes = await buildCountPdf({ ...input, design: brand?.design, orientation: "portrait", logoBytes: brand?.logoBytes, logoPng: brand?.logoPng });
    openPdf(bytes, `${p.name.replace(/[^\w\- ]+/g, "").trim() || "report"}.pdf`);
  }, [d.companyId, d.company, d.items, d.stock, d.locations, d.members, d.kit, t, es]);
}

// Bloque "Mis reportes" para la página de Reportes
export default function ReportPresets({ presets, ...d }: Data & { presets: ReportPreset[] }) {
  const t = useTranslations("invSet");
  const tr = useTranslations("invReport");
  const run = useRunPreset(d);
  const [busy, setBusy] = useState("");
  const go = async (p: ReportPreset) => { setBusy(p.id); try { await run(p); } finally { setBusy(""); } };
  return (
    <section className="mb-5 rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex min-w-0 items-center gap-2.5"><CartArt size={34} /><div className="min-w-0"><h2 className="truncate text-[16px] font-semibold text-[#0b1f3a]">{t("myReports")}</h2><p className="truncate text-[12.5px] text-slate-500">{t("myReportsHint")}</p></div></div>
        <Link prefetch={false} href="/dashboard/inventory/settings?s=reports&new=1" className="group/n inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#0f766e] px-3.5 text-[14px] font-semibold text-white hover:bg-[#0c5f59]">
          <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform duration-200 group-hover/n:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>{t("newShort")}
        </Link>
      </div>
      {presets.length === 0 ? <p className="px-5 py-6 text-center text-[13.5px] text-slate-500">{t("noReportsText")}</p> : (
        <ul className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
          {presets.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => go(p)} disabled={!!busy}
                className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-[#14a39a] hover:shadow-[0_10px_24px_rgba(15,40,60,0.07)] disabled:opacity-60">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e9f7f4] text-[#0f766e] transition-transform group-hover:scale-105"><SheetIcon className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[14.5px] font-semibold text-[#0b1f3a]">{p.name}</span>
                  <span className="block truncate text-[12px] text-slate-500">{busy === p.id ? t("making") : `${tr("lastDays", { n: p.days })} · ${p.sections.length} ${t("parts")}`}</span></span>
                <span className="shrink-0 rounded-lg bg-[#0f766e] px-2.5 py-1 text-[12.5px] font-semibold text-white">PDF</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
