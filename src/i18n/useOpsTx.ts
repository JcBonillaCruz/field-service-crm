"use client";

import { useTranslations } from "next-intl";
import { sameDay } from "@/lib/jobs";
import { OPS_GROUPS, OpsGroup, OpsJob, delayOf } from "@/lib/operations";
import { useJobsTx } from "@/i18n/useJobsTx";

// =====================================================================
// Paso 6.2a — textos de Operations (lib/operations.ts) en el idioma de la persona.
// La lógica (grupos, retrasos, % de avance) sigue en lib/operations.ts; aquí solo cambian las palabras.
// =====================================================================
export function useOpsTx() {
  const t = useTranslations("opsLib");
  const jt = useJobsTx();

  // "25 min" · "2h 10m" · "3 days"
  const late = (min: number) => {
    if (min < 60) return t("min", { n: min });
    if (min < 24 * 60) { const h = Math.floor(min / 60), m = min % 60; return m ? t("hm", { h, m }) : t("h", { h }); }
    return t("days", { n: Math.floor(min / (24 * 60)) });
  };
  const delay = (j: OpsJob, now = Date.now()) => {
    const d = delayOf(j, now);
    if (!d) return null;
    const over = d.label.startsWith("Over");
    return {
      ...d,
      label: over ? t("over", { t: late(d.minutes) }) : t("late", { t: late(d.minutes) }),
      detail: over ? t("overDetail") : j.visit?.status === "on_my_way" ? t("lateOnWay") : t("lateNotStarted"),
    };
  };
  const stage = (j: OpsJob): string => {
    if (j.status === "completed") {
      if (j.billing === "to_invoice") return j.invoice_id ? t("st.sendInvoice") : t("st.createInvoice");
      if (j.billing === "awaiting") return t("st.awaiting");
      if (j.billing === "paid") return t("st.paid");
      if (j.billing === "none") return t("st.noInvoice");
      return j.paid_at ? t("st.paid") : j.invoiced_at ? t("st.invoiced") : t("st.completed");
    }
    const s = j.visit?.status;
    if (j.phase_blocked) return t("st.phaseBlocked");
    if (j.status === "on_hold" && s !== "scheduled") return t("st.onHold");
    if (s === "on_my_way") return t("st.onMyWay");
    if (s === "in_progress") return t("st.working");
    if (s === "paused") return t("st.paused");
    if (s === "scheduled") return t("st.scheduled");
    return j.techs.length ? t("st.notScheduled") : t("st.needsCollab");
  };
  const when = (j: OpsJob, now = Date.now()) => {
    const v = j.visit;
    if (!v?.starts_at) return t("notScheduled");
    const s = new Date(v.starts_at), e = v.ends_at ? new Date(v.ends_at) : null;
    const today = new Date(now), tomorrow = new Date(now + 86400000);
    const day = sameDay(s, today) ? t("today") : sameDay(s, tomorrow) ? t("tomorrow") : jt.dayShort(s);
    return `${day} · ${jt.time(s)}${e ? ` – ${jt.time(e)}` : ""}`;
  };
  return {
    t,
    groups: OPS_GROUPS.map((g) => ({ ...g, label: t(`g.${g.id}.label` as never), hint: t(`g.${g.id}.hint` as never) })),
    groupLabel: (g: OpsGroup) => t(`g.${g}.label` as never),
    groupHint: (g: OpsGroup) => t(`g.${g}.hint` as never),
    live: (s: string) => (t.has(`live.${s}` as never) ? t(`live.${s}` as never) : s),
    delay, stage, when, late,
  };
}
