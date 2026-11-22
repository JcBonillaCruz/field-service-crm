"use client";

import { useTranslations } from "next-intl";

// Paso 6.2b: en el idioma de quien lo ve
export default function NoAccess() {
  const t = useTranslations("noAccess");
  return (
    <section className="mx-auto max-w-lg px-5 py-16 text-center">
      <h1 className="text-xl font-semibold text-[#0b1f3a]">{t("title")}</h1>
      <p className="mt-2 text-slate-500">{t("text")}</p>
    </section>
  );
}
