"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { FormKind, FormTx } from "@/lib/job-forms";

// Paso 6.1: textos de los formularios Work / Tune-Up en el idioma de la persona.
// Si a un campo le falta su traducción se ve el texto original (inglés) de lib/job-forms.ts.
export function useFormTx(): FormTx {
  const t = useTranslations("forms");
  return useMemo<FormTx>(() => {
    const pick = (path: string, fallback: string) => (t.has(path) ? t(path) : fallback);
    return {
      section: (_k, s) => pick(`sec.${s.id}`, s.title),
      label: (k, f) => pick(`f.${k}.${f.key}`, f.label),
      option: (k, f, o) => pick(`o.${k}.${f.key}.${o.value}`, o.label),
      placeholder: (k, f) => (f.placeholder ? pick(`ph.${k}.${f.key}`, f.placeholder) : undefined),
      words: { orMore: t("orMore"), orLess: t("orLess") },
      attention: t("attention"),
      outOfRange: (range) => t("outOfRange", { range }),
      above: (tag, value) => t("above", { tag, value }),
      capOff: (off, tol) => t("capOff", { off, tol }),
      deltaT: t("deltaT"),
      tempRise: t("tempRise"),
    };
  }, [t]);
}

export function useFormTitle() {
  const t = useTranslations("forms");
  return (k: FormKind) => t(`title.${k}`);
}

// Equipos del Job Site: tipos, garantía y nombre ("Condensadora · Trane 4TTR4036") en el idioma de la persona
export function useEquipText() {
  const t = useTranslations("equipment");
  return useMemo(() => {
    const kinds = ["condenser", "air_handler", "furnace", "heat_pump", "package_unit", "mini_split", "coil", "thermostat", "water_heater", "other"];
    const full = (k: string) => (t.has(`kind.${k}`) ? t(`kind.${k}`) : t("kind.other"));
    const short = (k: string) => full(k).replace(/ \(.*\)$/, "");
    return {
      kindOptions: kinds.map((k) => ({ value: k, label: full(k) })),
      kindLabel: short,
      equipmentName: (e: { kind: string; brand: string | null; model: string | null }) => [short(e.kind), [e.brand, e.model].filter(Boolean).join(" ")].filter(Boolean).join(" · "),
      warranty: (w: "active" | "expiring" | "expired" | "unknown") => t(`warranty.${w}`),
    };
  }, [t]);
}
