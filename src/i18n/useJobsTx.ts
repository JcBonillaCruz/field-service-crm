"use client";

import { useLocale, useTranslations } from "next-intl";
import { intlTag } from "@/i18n/config";
import {
  HOLD_REASONS, PRIORITIES, timeToMin, viewDays,
  type CalView, type JobSettings, type JobStatus, type Priority, type VisitStatus,
} from "@/lib/jobs";

// =====================================================================
// Paso 6.2a — versiones traducidas de los textos de lib/jobs.ts para las pantallas de oficina.
// lib/jobs.ts sigue igual (códigos y colores); aquí solo cambian las palabras y el formato de fechas.
// =====================================================================
export function useJobsTx() {
  const locale = useLocale();
  const tag = intlTag(locale);
  const ts = useTranslations("status");
  const t = useTranslations("jobsLib");

  const time = (d: Date) => d.toLocaleTimeString(tag, { hour: "numeric", minute: "2-digit" });
  // "9 AM" · "9 a. m."
  const hour = (min: number) => {
    const h = Math.floor(min / 60) % 24;
    return new Date(2000, 0, 1, h, 0).toLocaleTimeString(tag, { hour: "numeric" });
  };
  const dayNames = (style: "short" | "long" | "narrow") =>
    [0, 1, 2, 3, 4, 5, 6].map((i) => new Date(2023, 0, 1 + i).toLocaleDateString(tag, { weekday: style })); // 1 ene 2023 = domingo

  const jobStatus = (s: JobStatus | string) => (s === "on_hold" ? ts("hold") : ts.has(s as never) ? ts(s as never) : String(s));
  const visitStatus = (s: VisitStatus | string) => (ts.has(s as never) ? ts(s as never) : String(s));
  const hold = (v: string | null | undefined) => (v && HOLD_REASONS.some((r) => r.value === v) ? t(`hold.${v}` as never) : ts("hold"));

  return {
    tag,
    locale,
    jobStatus,
    visitStatus,
    hold,
    holdReasons: HOLD_REASONS.map((r) => ({ value: r.value, label: t(`hold.${r.value}` as never) })),
    priority: (p: Priority | string) => (PRIORITIES.some((x) => x.value === p) ? t(`priority.${p}` as never) : String(p)),
    priorities: PRIORITIES.map((p) => ({ ...p, label: t(`priority.${p.value}` as never) })),
    arrival: (m: number) => (m === 0 ? t("exactTime") : m < 60 ? t("minutes", { n: m }) : t("hours", { n: m / 60 })),
    time,
    hour,
    range: (a: Date, b: Date) => `${time(a)} – ${time(b)}`,
    dayLong: (d: Date) => d.toLocaleDateString(tag, { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
    dayShort: (d: Date) => d.toLocaleDateString(tag, { weekday: "short", month: "short", day: "numeric" }),
    monthDay: (d: Date) => d.toLocaleDateString(tag, { month: "short", day: "numeric" }),
    monthYear: (d: Date) => d.toLocaleDateString(tag, { month: "long", year: "numeric" }),
    date: (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString(tag, o),
    dateTime: (d: Date) => d.toLocaleString(tag, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
    weekdayShort: (d: Date) => d.toLocaleDateString(tag, { weekday: "short" }),
    dayNames,
    usd: (v: number) => new Intl.NumberFormat(tag, { style: "currency", currency: "USD" }).format(Number(v) || 0),
    num: (v: number, o?: Intl.NumberFormatOptions) => new Intl.NumberFormat(tag, o).format(Number(v) || 0),
    rangeLabel: (view: CalView, anchor: Date, weekStartsOn: number): string => {
      if (view === "month") return anchor.toLocaleDateString(tag, { month: "long", year: "numeric" });
      if (view === "day" || view === "map") return anchor.toLocaleDateString(tag, { weekday: "short", month: "long", day: "numeric", year: "numeric" });
      const days = viewDays(view, anchor, weekStartsOn);
      const a = days[0], b = days[days.length - 1];
      const mon = (d: Date) => d.toLocaleDateString(tag, { month: "short" }).replace(".", "");
      if (locale === "es") // "1 – 7 nov 2026" · "29 oct – 4 nov 2026"
        return a.getMonth() === b.getMonth() ? `${a.getDate()} – ${b.getDate()} ${mon(b)} ${b.getFullYear()}` : `${a.getDate()} ${mon(a)} – ${b.getDate()} ${mon(b)} ${b.getFullYear()}`;
      return a.getMonth() === b.getMonth() ? `${mon(a)} ${a.getDate()} – ${b.getDate()}, ${b.getFullYear()}` : `${mon(a)} ${a.getDate()} – ${mon(b)} ${b.getDate()}, ${b.getFullYear()}`;
    },
    businessHours: (s: Pick<JobSettings, "day_start" | "day_end" | "business_days">) => {
      const names = dayNames("short");
      const d = [...(s.business_days ?? [])].sort();
      const days = d.length === 5 && d.join() === "1,2,3,4,5" ? t("monFri") : d.length === 6 && d.join() === "1,2,3,4,5,6" ? t("monSat") : d.length === 7 ? t("everyDay") : d.map((x) => names[x]).join(", ");
      return `${days} · ${hour(timeToMin(s.day_start)).replace(" ", "")}–${hour(timeToMin(s.day_end)).replace(" ", "")}`;
    },
  };
}
export type JobsTx = ReturnType<typeof useJobsTx>;

// Errores de las hojas de tiempo (lib/timesheets.ts → timeError) en el idioma de la persona
export function useTimeError() {
  const locale = useLocale();
  const t = useTranslations("jobsLib");
  return (e: { message?: string; code?: string; hint?: string } | null | undefined): string => {
    if (!e) return "";
    const m = `${e.message ?? ""} ${e.hint ?? ""}`;
    if ((m.includes("timesheet_entries") || m.includes("time_entry_") || m.includes("tech_time_log") || m.includes("is_manual")) && (m.includes("does not exist") || m.includes("Could not find")))
      return "Run paso-5.7-timesheets.sql in Supabase first.";
    if (m.includes("NO_ACCESS")) return t("noAccess");
    if (m.includes("tech_time_one_open")) return t("oneOpen");
    if (e.hint && locale === "en") return e.hint;
    return t("generic");
  };
}
