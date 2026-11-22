"use client";

import { useTranslations } from "next-intl";
import { BILLING, FREQ_PRESETS, Plan } from "@/lib/maintenance";
import { useJobsTx } from "@/i18n/useJobsTx";

// =====================================================================
// Paso 6.2a — textos de Maintenance plans (lib/maintenance.ts) en el idioma de la persona
// =====================================================================
export function usePlanTx() {
  const t = useTranslations("planLib");
  const jt = useJobsTx();
  const months = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(jt.tag, { month: "short" }).replace(".", ""));
  const dayText = (iso: string | null | undefined) => {
    if (!iso) return "—";
    const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
    return jt.date(new Date(y, m - 1, d), { month: "short", day: "numeric", year: "numeric" });
  };
  const whenText = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleString(jt.tag, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
  return {
    t, months, dayText, whenText,
    presets: FREQ_PRESETS.map((p) => ({ ...p, label: t(`preset.${p.value}` as never) })),
    billing: BILLING.map((b) => ({ ...b, label: t(`bill.${b.value}.label` as never), hint: t(`bill.${b.value}.hint` as never) })),
    freqLabel: (p: Pick<Plan, "freq_kind" | "every_n" | "season_months">): string => {
      if (p.freq_kind === "seasonal") return (p.season_months ?? []).length ? t("each", { m: [...p.season_months].sort((a, b) => a - b).map((m) => months[m - 1]).join(t("and")) }) : t("bySeason");
      if (p.freq_kind === "months") return p.every_n === 1 ? t("everyMonth") : p.every_n === 12 ? t("everyYear") : t("everyNMonths", { n: p.every_n });
      return p.every_n === 7 ? t("everyWeek") : p.every_n === 14 ? t("every2Weeks") : p.every_n === 1 ? t("everyDay") : t("everyNDays", { n: p.every_n });
    },
    billingLabel: (p: Pick<Plan, "billing" | "subscription_number">) =>
      p.billing === "subscription" ? t("subscription", { n: p.subscription_number ?? "" }).trim() : p.billing === "included" ? t("included") : t("billedEach"),
    planState: (p: Pick<Plan, "status" | "visits_upcoming">): { label: string; cls: string } => {
      if (p.status === "paused") return { label: t("st.paused"), cls: "bg-[#fff6e6] text-[#b45309]" };
      if (p.status === "cancelled") return { label: t("st.cancelled"), cls: "bg-slate-200 text-slate-500" };
      if (p.status === "finished") return (p.visits_upcoming ?? 0) > 0 ? { label: t("st.lastBooked"), cls: "bg-[#eef4ff] text-[#2563eb]" } : { label: t("st.finished"), cls: "bg-slate-200 text-slate-500" };
      return { label: t("st.active"), cls: "bg-[#e7f6f1] text-[#0f766e]" };
    },
    endLabel: (p: Pick<Plan, "end_kind" | "end_count" | "end_date">) =>
      p.end_kind === "count" ? t("endsAfter", { n: p.end_count ?? 0 }) : p.end_kind === "date" && p.end_date ? t("endsOn", { d: dayText(p.end_date) }) : t("noEnd"),
    planError: (e: { message?: string; hint?: string; code?: string } | null | undefined): string => {
      if (!e) return "";
      const m = `${e.message ?? ""} ${e.hint ?? ""}`;
      if (m.includes("maintenance_") && (m.includes("does not exist") || m.includes("Could not find"))) return "Run paso-5.11-maintenance-plans.sql in Supabase first.";
      if ((m.includes("BAD_PLAN") || m.includes("NOT_FOUND")) && e.hint && jt.locale === "en") return e.hint;
      if (m.includes("NO_ACCESS")) return t("noAccess");
      return t("generic");
    },
  };
}
