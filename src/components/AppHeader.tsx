"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import Avatar from "@/components/Avatar";
import CompanySwitcher from "@/components/CompanySwitcher";
import TopSearch from "@/components/TopSearch";
import AppsMenu from "@/components/AppsMenu";
import QuickCreate from "@/components/QuickCreate";
import NotificationsBell from "@/components/NotificationsBell";
import RecentMenu from "@/components/RecentMenu";
import CreateCompanyForm from "@/components/CreateCompanyForm";
import { createClient } from "@/lib/supabase/client";
import { CompanySummary, CurrentUser, setCurrentCompany } from "@/lib/types";

const TRIAL_DAYS = 14;
const popPanel =
  "z-50 mt-2 origin-top-right rounded-xl border border-slate-200 bg-white p-4 shadow-[0_16px_50px_rgba(15,40,60,0.18)] transition duration-200 ease-out data-[closed]:scale-95 data-[closed]:opacity-0";

export default function AppHeader({
  user, companies, currentId, onMenu, onOpenProfile,
}: {
  user: CurrentUser;
  companies: CompanySummary[];
  currentId: string | null;
  onMenu?: () => void;
  onOpenProfile?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    if (!creating) return;
    const onKey = (e: KeyboardEvent) => { if (creating && e.key === "Escape") setCreating(false); };
    document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey);
  }, [creating]);

  const current = companies.find((c) => c.id === currentId) ?? null;
  const daysLeft = current ? Math.max(0, TRIAL_DAYS - Math.floor((Date.now() - new Date(current.createdAt).getTime()) / 86400000)) : 0;

  async function signOut() {
    if (!window.confirm("Sign out of BrightPro?")) return;
    await createClient().auth.signOut();
    window.location.href = "/";
  }

  function switchTo(id: string) {
    setCurrentCompany(id);
    const section = pathname.match(/^\/dashboard\/[^/]+/)?.[0];
    if (section && pathname !== section) router.push(section);
    router.refresh();
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[#cde8e0] bg-[#e7f5f1] px-3 sm:px-6">
        {/* Hamburguesa (celular) */}
        <button type="button" onClick={onMenu} aria-label="Open menu" className="shrink-0 rounded-lg p-2 text-slate-600 hover:bg-white/70 lg:hidden">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>

        {/* ===== Celular: compañía (centro) + campana (derecha) ===== */}
        <div className="flex min-w-0 flex-1 items-center lg:hidden">
          <CompanySwitcher companies={companies} currentId={currentId} userId={user.id} onSwitch={switchTo} onNewCompany={() => setCreating(true)} />
        </div>
        <div className="flex items-center lg:hidden">
          <NotificationsBell />
          {/* Cerrar sesión, visible en el celular */}
          <button type="button" onClick={signOut} aria-label="Sign out" title="Sign out"
            className="group flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-[#fff1f2] hover:text-[#e11d48] active:scale-90">
            <svg viewBox="0 0 24 24" className="h-[22px] w-[22px] transition-transform duration-300 group-hover:rotate-12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v8M7.1 6.3a7.5 7.5 0 1 0 9.8 0" /></svg>
          </button>
        </div>

        {/* ===== Escritorio: barra completa ===== */}
        <div className="hidden min-w-0 flex-1 items-center gap-2 lg:flex">
          <RecentMenu />
          <TopSearch />

          <div className="ml-auto flex items-center gap-1">
            <Popover className="relative">
              <div className="mr-1 hidden items-center gap-2 text-sm xl:flex">
                <span className="text-slate-500">{daysLeft > 0 ? `Trial expires in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}` : "Trial expired"}</span>
                <PopoverButton className="font-semibold text-[#e8713a] hover:underline focus:outline-none">Subscribe</PopoverButton>
              </div>
              <PopoverButton className="mr-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-[#e8713a] hover:bg-[#fdf1ea] focus:outline-none xl:hidden">Subscribe</PopoverButton>
              <PopoverPanel anchor="bottom end" transition className={`${popPanel} w-72`}>
                <p className="font-semibold text-[#0b1f3a]">Online subscriptions are coming soon</p>
                <p className="mt-1 text-sm text-slate-500">You&apos;re on the free trial{daysLeft > 0 ? ` (${daysLeft} ${daysLeft === 1 ? "day" : "days"} left)` : ""}. Plans and payment will arrive with the billing step.</p>
              </PopoverPanel>
            </Popover>

            <CompanySwitcher companies={companies} currentId={currentId} userId={user.id} onSwitch={switchTo} onNewCompany={() => setCreating(true)} />
            <QuickCreate />
            <NotificationsBell />

            <Link prefetch={false} href="/dashboard/settings" aria-label="Settings" title="All Settings" className="group flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-white/70 hover:text-[#0f766e]">
              <span className="transition-transform duration-500 group-hover:rotate-90"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.8 1.2V21a2 2 0 1 1-4 0a1.7 1.7 0 0 0-2.8-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.8H3a2 2 0 1 1 0-4a1.7 1.7 0 0 0 1.2-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.8-1.2V3a2 2 0 1 1 4 0a1.7 1.7 0 0 0 2.8 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-1.2 2.8H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg></span>
            </Link>

            <AppsMenu role={current?.role ?? null} />
            <button type="button" onClick={onOpenProfile} aria-label="Open my profile" className="shrink-0 rounded-full">
              <Avatar name={user.fullName || user.email} url={user.avatarUrl} seed={user.id} size={36} />
            </button>
          </div>
        </div>
      </header>

      {/* New company dialog */}
      {creating && (
        <div className="fixed inset-0 z-[70] overflow-y-auto">
          <button type="button" aria-label="Close" onClick={() => setCreating(false)} className="fixed inset-0 bg-slate-900/30" />
          <div className="relative flex min-h-full items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="new-company-title" className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl sm:p-7 animate-[bp-fade_0.2s_ease-out]">
            <button type="button" onClick={() => setCreating(false)} aria-label="Close" className="group/x absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600">
              <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform duration-300 group-hover/x:rotate-90" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
            </button>
            <h2 id="new-company-title" className="text-xl font-semibold text-[#0b1f3a]">New company</h2>
            <p className="mt-1 mb-6 text-sm text-slate-500">It gets its own customers, invoices and inventory.</p>
            <CreateCompanyForm onDone={() => setCreating(false)} onCancel={() => setCreating(false)} />
          </div>
          </div>
        </div>
      )}
    </>
  );
}
