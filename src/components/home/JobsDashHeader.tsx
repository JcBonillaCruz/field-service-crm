"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardArt } from "@/components/home/DashArt";

import { useLocale, useTranslations } from "next-intl";
import { intlTag } from "@/i18n/config";
// Encabezado del Dashboard de la app Jobs: título, fecha de hoy y "Create job"
export default function JobsDashHeader() {
  const t = useTranslations("jobsDash");
  const tag = intlTag(useLocale());
  const [day, setDay] = useState("");
  useEffect(() => setDay(new Date().toLocaleDateString(tag, { weekday: "long", month: "long", day: "numeric" })), [tag]);
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-[#f7fbfa] px-4 py-4 lg:px-8 lg:py-5">
      <div className="group flex min-w-0 items-center gap-3">
        <span className="hidden shrink-0 sm:flex"><DashboardArt size={48} /></span>
        <div className="min-w-0">
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-[#0b1f3a] lg:text-[24px]">{t("title")}</h1>
        <p className="mt-0.5 truncate text-[13.5px] text-slate-500 lg:text-[14.5px]">{day ? `${day} · ` : ""}{t("sub")}</p>
        </div>
      </div>
      <Link prefetch={false} href="/dashboard/jobs/new"
        className="group inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-[#0f766e] px-3.5 text-[14px] font-semibold text-white shadow-sm transition-all duration-150 hover:-translate-y-px hover:bg-[#0c5f59] hover:shadow-md lg:h-11 lg:px-4 lg:text-[15px]">
        <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>
        {t("createJob")}
      </Link>
    </div>
  );
}
