"use client";
import { useTranslations } from "next-intl";

// Tipo de negocio: se guarda en inglés ("HVAC", "Plumbing"…) y solo se traduce lo que se ve
export function useIndustry() {
  const t = useTranslations("industry");
  return (v: string | null | undefined) => {
    if (!v) return "";
    const key = `i.${v.replace(/[^A-Za-z0-9]/g, "")}`;
    return t.has(key) ? t(key) : v;
  };
}
