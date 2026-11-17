"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CompanyBadge from "@/components/CompanyBadge";
import { HeaderPattern } from "@/components/dashboard/DesktopDashboard";
import { useSwipe } from "@/components/ui/useSwipe";

// =====================================================================
// Inicio de BrightPro (Paso 5.3f): Dashboard (trabajos y alertas) · Finances (dueño y manager) · Help.
// "Announcements" se quitó: estaba vacía y no se necesitaba.
// =====================================================================
type Tab = "dashboard" | "finances" | "help";
const ICON: Record<Tab, string> = {
  dashboard: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  finances: "M12 2.5v19M16.6 6.6c-.6-1.6-2.4-2.6-4.6-2.6-2.6 0-4.6 1.3-4.6 3.4 0 4.8 9.4 2.5 9.4 7.4 0 2.1-2.1 3.5-4.8 3.5-2.4 0-4.4-1.1-5-2.9",
  help: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01",
};
const LABEL: Record<Tab, string> = { dashboard: "Dashboard", finances: "Finances", help: "Help" };

function greeting(h: number) { return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; }

export default function HomeTabs({ firstName, companyId, companyName, companyIndex, canFinance, canAddCustomer, dashboard, financesDesktop, financesMobile }: {
  firstName: string; companyId: string; companyName: string; companyIndex: number;
  canFinance: boolean; canAddCustomer: boolean;
  dashboard: React.ReactNode; financesDesktop: React.ReactNode; financesMobile: React.ReactNode;
}) {
  const tabs: Tab[] = canFinance ? ["dashboard", "finances", "help"] : ["dashboard", "help"];
  const [tab, setTabState] = useState<Tab>("dashboard");
  const [hello, setHello] = useState("Hello");
  useEffect(() => {
    setHello(greeting(new Date().getHours()));
    const t = new URLSearchParams(window.location.search).get("tab") as Tab | null;
    if (t && tabs.includes(t)) setTabState(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setTab = (t: Tab) => {
    setTabState(t);
    const u = new URL(window.location.href);
    if (t === "dashboard") u.searchParams.delete("tab"); else u.searchParams.set("tab", t);
    window.history.replaceState(null, "", u.toString());
  };
  const i = tabs.indexOf(tab);
  const swipe = useSwipe(() => i > 0 && setTab(tabs[i - 1]), () => i < tabs.length - 1 && setTab(tabs[i + 1]));

  const buttons = (
    <div className="flex shrink-0 items-center gap-2">
      <Link prefetch={false} href="/dashboard/jobs/new"
        className="group inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#0f766e] bg-white px-3.5 text-[14px] font-semibold text-[#0f766e] transition-all duration-150 hover:-translate-y-px hover:bg-[#e9f7f4] hover:shadow-sm lg:h-11 lg:px-4 lg:text-[15px]">
        <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M12 13v4M10 15h4" /></svg>
        Create job
      </Link>
      {canAddCustomer && (
        <Link prefetch={false} href="/dashboard/customers/new"
          className="group inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#0f766e] px-3.5 text-[14px] font-semibold text-white shadow-sm transition-all duration-150 hover:-translate-y-px hover:bg-[#0c5f59] hover:shadow-md lg:h-11 lg:px-4 lg:text-[15px]">
          <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>
          Add customer
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
        <div role="tablist" aria-label="Home sections" className="relative flex h-12 items-end gap-8 px-8">
          {tabs.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`group relative flex items-center gap-2 pb-3 text-[16px] font-medium transition-colors ${tab === t ? "text-[#0b1f3a]" : "text-slate-500 hover:text-[#0b1f3a]"}`}>
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={ICON[t]} /></svg>
              {LABEL[t]}
              {tab === t && <span className="absolute inset-x-0 -bottom-px h-[3px] rounded-full bg-[#0f766e]" />}
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
      <div role="tablist" aria-label="Home sections" className="sticky top-16 z-20 flex border-b border-slate-200 bg-white lg:hidden">
        {tabs.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-3 text-[14px] transition-colors ${tab === t ? "border-[#0f766e] font-semibold text-[#0f766e]" : "border-transparent text-slate-500"}`}>
            <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={ICON[t]} /></svg>
            {LABEL[t]}
          </button>
        ))}
      </div>

      <div {...swipe} key={tab} className="animate-[bp-fade_0.25s_ease-out]">
        {tab === "dashboard" && dashboard}
        {tab === "finances" && canFinance && (
          <>
            <div className="hidden bg-white lg:block">{financesDesktop}</div>
            <div className="lg:hidden">{financesMobile}</div>
          </>
        )}
        {tab === "help" && <HelpTab />}
      </div>
    </div>
  );
}

function HelpTab() {
  const links = [
    { label: "Jobs settings", text: "Hours, alerts, job types and colors", href: "/dashboard/jobs/settings" },
    { label: "Team", text: "Invite people and set their roles", href: "/dashboard/jobs/team" },
    { label: "Notifications", text: "Turn phone alerts on from the bell", href: "/dashboard" },
  ];
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-8 lg:py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center lg:p-8">
        <p className="text-[18px] font-semibold text-[#0b1f3a]">Need help?</p>
        <p className="mt-1 text-[14.5px] text-slate-500">Guides and support channels are coming soon. Meanwhile, these are the places people look for most.</p>
        <ul className="mt-5 grid gap-2 text-left sm:grid-cols-3">
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
