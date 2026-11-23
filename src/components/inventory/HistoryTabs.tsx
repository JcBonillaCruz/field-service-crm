"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

// Paso 6.12 · History: movimientos, transferencias y conteos en un solo lugar (pestañas arriba)
export type HistTab = "movements" | "transfers" | "counts";
export default function HistoryTabs({ active }: { active: HistTab }) {
  const t = useTranslations("invHistory");
  return (
    <div className="border-b border-slate-200 bg-white px-4 lg:px-8">
      <div className="flex items-end justify-between gap-4 pt-4">
        <h1 className="pb-2 text-[20px] font-semibold tracking-tight text-[#0b1f3a] lg:text-[22px]">{t("title")}</h1>
      </div>
      <div role="tablist" className="-mb-px flex gap-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(["movements", "transfers", "counts"] as const).map((k) => (
          <Link key={k} prefetch={false} role="tab" aria-selected={active === k} href={`/dashboard/inventory/history?tab=${k}`}
            className={`relative shrink-0 py-3 text-[15px] transition-colors ${active === k ? "font-semibold text-[#0f766e]" : "text-slate-600 hover:text-[#0b1f3a]"}`}>
            {t(k)}<span className={`absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-[#0f766e] transition-transform duration-200 ${active === k ? "scale-x-100" : "scale-x-0"}`} />
          </Link>
        ))}
      </div>
    </div>
  );
}
