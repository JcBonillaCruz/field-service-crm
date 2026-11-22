"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { LOCALE_COOKIE, Locale, setLocaleCookie } from "@/i18n/config";

// Paso 6.1: aparato nuevo (sin cookie bp_lang) → copia el idioma guardado en el perfil y repinta.
// Si ya hay cookie, manda la cookie (se mantiene igual al perfil porque los dos se guardan juntos).
export default function LanguageSync({ saved }: { saved: Locale | null }) {
  const router = useRouter();
  const locale = useLocale();
  useEffect(() => {
    const hasCookie = document.cookie.split("; ").some((c) => c.startsWith(`${LOCALE_COOKIE}=`));
    if (hasCookie) return;
    const want = saved ?? (locale as Locale);
    setLocaleCookie(want);
    if (want !== locale) router.refresh();
  }, [saved, locale, router]);
  return null;
}
