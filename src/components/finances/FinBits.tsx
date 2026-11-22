"use client";

import SelectMenu from "@/components/ui/SelectMenu";
import ReportArt, { ReportArtKind } from "@/components/jobs/reports/ReportArt";
import type { FinPeriod, FinRange } from "@/lib/finance-period";
import { useTranslations } from "next-intl";
import { useFinTx } from "@/i18n/useFinTx";

// Piezas compartidas por Finances → Payroll y Finances → Reports (Paso 5.10c)
export const card = "rounded-2xl border border-slate-200 bg-white";

export function Kpi({ art, title, value, hint, tone = "text-[#0b1f3a]" }: { art: ReportArtKind; title: string; value: string; hint: string; tone?: string }) {
  return (
    <div className="group flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(15,40,60,0.08)]">
      {/* Celular: sin ícono, para que la cifra se lea completa */}
      <span className="hidden shrink-0 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 sm:inline-flex"><ReportArt kind={art} size={44} /></span>
      <span className="min-w-0">
        <span className="block truncate text-[12px] font-medium text-slate-500">{title}</span>
        <span className={`block text-[17px] font-semibold leading-tight tabular-nums sm:text-[20px] ${tone}`}>{value}</span>
        <span className="block truncate text-[11.5px] text-slate-400">{hint}</span>
      </span>
    </div>
  );
}

// Periodo ▾ · ◀ fechas ▶ · This period
export function PeriodBar({ periods, range, today, onGo }: {
  periods: { value: FinPeriod; label: string }[]; range: FinRange; today: string; onGo: (period: FinPeriod, day: string) => void;
}) {
  const t = useTranslations("finBits");
  const fx = useFinTx();
  const arrow = (dir: "prev" | "next") => (
    <button type="button" aria-label={dir === "prev" ? t("prev") : t("next")} onClick={() => onGo(range.period, dir === "prev" ? range.prev : range.next)}
      className="flex h-10 w-9 items-center justify-center text-slate-500 transition-colors hover:bg-[#e9f7f4] hover:text-[#0f766e]">
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={dir === "prev" ? "M12.5 5l-5 5 5 5" : "M7.5 5l5 5-5 5"} /></svg>
    </button>
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-[9.5rem]"><SelectMenu ariaLabel={t("period")} value={range.period} onChange={(v) => onGo(v as FinPeriod, today)} options={fx.periods(periods)} /></div>
      <div className="flex h-10 items-center overflow-hidden rounded-xl border border-slate-200 bg-white">
        {arrow("prev")}
        <span className="min-w-[9.5rem] px-1 text-center text-[13.5px] font-semibold tabular-nums text-[#0b1f3a]">{fx.finTitle(range)}</span>
        {arrow("next")}
      </div>
      {!range.isCurrent && (
        <button type="button" onClick={() => onGo(range.period, today)} className="h-10 rounded-xl px-2.5 text-[13px] font-semibold text-[#0f766e] hover:bg-[#e9f7f4]">{t("today")}</button>
      )}
    </div>
  );
}

export const ghostBtn = "inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-[13.5px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50";
export const tealBtn = "inline-flex h-10 items-center gap-2 rounded-xl bg-[#0f766e] px-3.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#0b5f59] disabled:opacity-50";
export const ExportIcon = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3v9M6.5 8.5 10 12l3.5-3.5M4 15.5h12" /></svg>
);
export const PrintIcon = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 7V3h8v4M6 14H4.5A1.5 1.5 0 0 1 3 12.5v-4A1.5 1.5 0 0 1 4.5 7h11A1.5 1.5 0 0 1 17 8.5v4a1.5 1.5 0 0 1-1.5 1.5H14M6 11.5h8V17H6z" /></svg>
);
export const Chevron = ({ open }: { open: boolean }) => (
  <svg viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.5 5l5 5-5 5" /></svg>
);
