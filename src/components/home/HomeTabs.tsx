"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CompanyBadge from "@/components/CompanyBadge";
import { HeaderPattern } from "@/components/dashboard/DesktopDashboard";
import { useSwipe } from "@/components/ui/useSwipe";
import { FinanceArt } from "@/components/AppIcons";
import { DashboardArt, HelpArt } from "@/components/home/DashArt";

import { useTranslations } from "next-intl";
// =====================================================================
// Inicio de BrightPro (Paso 5.3f): Dashboard (trabajos y alertas) · Finances (dueño y manager) · Help.
// "Announcements" se quitó: estaba vacía y no se necesitaba.
// =====================================================================
type Tab = "dashboard" | "finances" | "help";
// Íconos a color, iguales a los de All apps (Finances usa el mismo de la app)
const Art = ({ t, size }: { t: Tab; size: number }) => (t === "dashboard" ? <DashboardArt size={size} /> : t === "finances" ? <FinanceArt size={size} /> : <HelpArt size={size} />);
function greeting(h: number) { return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening"; }

export default function HomeTabs({ firstName, companyId, companyName, companyIndex, canFinance, canAddCustomer, dashboard, financesDesktop, financesMobile, financesExtra = null }: {
  firstName: string; companyId: string; companyName: string; companyIndex: number;
  canFinance: boolean; canAddCustomer: boolean;
  dashboard: React.ReactNode; financesDesktop: React.ReactNode; financesMobile: React.ReactNode;
  financesExtra?: React.ReactNode; // Paso 6.16-M: retorno de marketing debajo de las finanzas
}) {
  const tabs: Tab[] = canFinance ? ["dashboard", "finances", "help"] : ["dashboard", "help"];
  const [tab, setTabState] = useState<Tab>("dashboard");
  const t = useTranslations("homeTabs");
  const [hello, setHello] = useState(t("hello"));
  useEffect(() => {
    setHello(t(greeting(new Date().getHours())));
    const q = new URLSearchParams(window.location.search).get("tab") as Tab | null;
    if (q && tabs.includes(q)) setTabState(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setTab = (x: Tab) => {
    setTabState(x);
    const u = new URL(window.location.href);
    if (x === "dashboard") u.searchParams.delete("tab"); else u.searchParams.set("tab", x);
    window.history.replaceState(null, "", u.toString());
  };
  const i = tabs.indexOf(tab);
  const swipe = useSwipe(() => i > 0 && setTab(tabs[i - 1]), () => i < tabs.length - 1 && setTab(tabs[i + 1]));

  const buttons = (
    <div className="flex shrink-0 items-center gap-2">
      <Link prefetch={false} href="/dashboard/jobs/new"
        className="group inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#0f766e] bg-white px-3.5 text-[14px] font-semibold text-[#0f766e] transition-all duration-150 hover:-translate-y-px hover:bg-[#e9f7f4] hover:shadow-sm lg:h-11 lg:px-4 lg:text-[15px]">
        <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M12 13v4M10 15h4" /></svg>
        {t("createJob")}
      </Link>
      {canAddCustomer && (
        <Link prefetch={false} href="/dashboard/customers/new"
          className="group inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#0f766e] px-3.5 text-[14px] font-semibold text-white shadow-sm transition-all duration-150 hover:-translate-y-px hover:bg-[#0c5f59] hover:shadow-md lg:h-11 lg:px-4 lg:text-[15px]">
          <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>
          {t("addCustomer")}
        </Link>
      )}
    </div>
  );

  return (
    <div className="min-h-full bg-[#f4f6f8]">
      {/* Computadora: saludo + botones + pestañas */}
      <div className="sticky -top-[5.5rem] z-20 hidden border-b border-slate-200 bg-[#f7fbfa] lg:block">
        <HeaderPattern />
        <div className="relative flex h-[5.5rem] items-center justify-between gap-6 px-8">
          <div className="flex min-w-0 items-center gap-4">
            <span className="rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_1px_2px_rgba(15,40,60,0.06)]">
              <CompanyBadge id={companyId} name={companyName} index={companyIndex} size={42} />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-[22px] font-semibold leading-tight text-[#0b1f3a]">{hello}, {firstName}</h1>
              <p className="mt-0.5 truncate text-[15px] text-slate-600">{companyName}</p>
            </div>
          </div>
          {buttons}
        </div>
        <div role="tablist" aria-label={t("sections")} className="relative flex h-[3.25rem] items-end gap-9 px-8">
          {tabs.map((x) => (
            <button key={x} type="button" role="tab" aria-selected={tab === x} onClick={() => setTab(x)}
              className={`group relative flex items-center gap-2 pb-2.5 text-[16px] transition-colors ${tab === x ? "font-semibold text-[#0b1f3a]" : "font-medium text-slate-500 hover:text-[#0b1f3a]"}`}>
              <span className={`transition-transform duration-200 group-hover:-translate-y-0.5 ${tab === x ? "" : "opacity-80 group-hover:opacity-100"}`}><Art t={x} size={28} /></span>
              {t(x)}
              {tab === x && <span className="absolute inset-x-0 -bottom-px h-[3px] rounded-full bg-[#0f766e]" />}
            </button>
          ))}
        </div>
      </div>

      {/* Celular: saludo compacto + pestañas (deslizar con el dedo cambia de pestaña) */}
      <div className="px-4 pb-3 pt-4 lg:hidden">
        <p className="truncate text-[20px] font-semibold text-[#0b1f3a]">{hello}, {firstName}</p>
        <p className="truncate text-[13.5px] text-slate-500">{companyName}</p>
        {tab === "dashboard" && <div className="mt-3">{buttons}</div>}
      </div>
      <div role="tablist" aria-label={t("sections")} className="sticky top-16 z-20 flex border-b border-slate-200 bg-white lg:hidden">
        {tabs.map((x) => (
          <button key={x} type="button" role="tab" aria-selected={tab === x} onClick={() => setTab(x)}
            className={`group flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2 text-[14px] transition-colors ${tab === x ? "border-[#0f766e] font-semibold text-[#0b1f3a]" : "border-transparent text-slate-500"}`}>
            <Art t={x} size={26} />
            {t(x)}
          </button>
        ))}
      </div>

      <div {...swipe} key={tab} className="animate-[bp-fade_0.25s_ease-out]">
        {tab === "dashboard" && dashboard}
        {tab === "finances" && canFinance && (
          <>
            <div className="hidden bg-white lg:block">{financesDesktop}</div>
            <div className="lg:hidden">{financesMobile}</div>
            {financesExtra && <div className="bg-[#f4f6f8] px-3 pb-24 pt-1 lg:bg-white lg:px-8 lg:pb-10 lg:pt-2">{financesExtra}</div>}
          </>
        )}
        {tab === "help" && <HelpTab />}
      </div>
    </div>
  );
}

function HelpTab() {
  const t = useTranslations("homeTabs");
  const links = [
    { label: t("jobsSettings"), text: t("jobsSettingsText"), href: "/dashboard/jobs/settings" },
    { label: t("team"), text: t("teamText"), href: "/dashboard/jobs/team" },
    { label: t("notifications"), text: t("notificationsText"), href: "/dashboard" },
  ];
  return (
    <div className="w-full px-4 py-6 lg:px-8 lg:py-8">
      <div className="group rounded-2xl border border-slate-200 bg-white p-6 text-center lg:p-10">
        <span className="inline-flex"><HelpArt size={72} /></span>
        <p className="mt-2 text-[20px] font-semibold text-[#0b1f3a]">{t("needHelp")}</p>
        <p className="mt-1 text-[14.5px] text-slate-500">{t("helpText")}</p>
        <ul className="mx-auto mt-6 grid max-w-4xl gap-3 text-left sm:grid-cols-3">
          {links.map((l) => (
            <li key={l.label}>
              <Link prefetch={false} href={l.href} className="group block rounded-xl border border-slate-200 p-3.5 transition-all duration-150 hover:-translate-y-0.5 hover:border-[#14a39a] hover:shadow-sm">
                <span className="block text-[14.5px] font-semibold text-[#0b1f3a] group-hover:text-[#0f766e]">{l.label} →</span>
                <span className="mt-0.5 block text-[12.5px] text-slate-500">{l.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
