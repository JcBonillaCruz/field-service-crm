"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { useNotifications } from "@/components/NotificationsProvider";
import type { NoticeKind } from "@/lib/notifications";

const TONE: Record<NoticeKind, string> = {
  overdue: "bg-[#ffe8ee] text-[#be123c]", due_today: "bg-[#fff0e6] text-[#c2410c]", due_soon: "bg-[#fff6e0] text-[#b45309]", job: "bg-[#eef4ff] text-[#2563eb]", low_stock: "bg-[#fff4ec] text-[#ea580c]", activity: "bg-[#e7f7ec] text-[#15803d]",
};

// Campanita: solo muestra lo NO leído. Los datos vienen de un único proveedor compartido
// (celular y computadora usan la misma consulta, no una cada una).
export default function NotificationsBell() {
  const t = useTranslations("notices");
  const ctx = useNotifications();
  if (!ctx) return null;
  const { items: visible, unread, markRead, push, pushMsg, enablePush, disablePush, testPush } = ctx;
  const markAll = () => markRead(visible.map((n) => n.key));
  return (
    <Popover className="relative">
      <PopoverButton aria-label={unread ? t("ariaNew", { count: unread }) : t("title")}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none data-[open]:bg-[#e9f7f4] data-[open]:text-[#0f766e]">
        <svg viewBox="0 0 24 24" className={`h-5 w-5 ${unread ? "origin-top animate-[bp-ring_1.2s_ease-in-out_2]" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        {unread > 0 && <span className="absolute -right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#e11d48] px-1 text-[10.5px] font-bold tabular-nums leading-none text-white ring-2 ring-white">{unread > 999 ? "999+" : unread}</span>}
      </PopoverButton>
      <PopoverPanel anchor="bottom end" transition
        className="z-50 mt-2 flex max-h-[min(34rem,calc(100dvh-6rem))] w-[22rem] max-w-[calc(100vw-1.5rem)] origin-top-right flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,40,60,0.18)] transition duration-200 ease-out data-[closed]:scale-95 data-[closed]:opacity-0">
        {({ close }) => (
          <>
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-2.5 sm:px-5 sm:py-3">
              <p className="text-[15px] font-semibold text-[#0b1f3a]">{t("title")}{unread > 0 && <span className="ml-1.5 rounded-full bg-[#ffe4e6] px-1.5 py-0.5 text-[11.5px] font-bold tabular-nums text-[#be123c]">{unread}</span>}</p>
              {unread > 0 && <button type="button" onClick={markAll} className="whitespace-nowrap text-[12.5px] font-medium text-[#0f766e] hover:underline sm:text-[13px]">{t("markAll")}</button>}
            </div>
            {push !== "unsupported" && (
              <div className={`flex shrink-0 items-center gap-2.5 border-b border-slate-100 px-4 py-2 ${push === "on" ? "bg-[#f3fbf8]" : "bg-[#fff7ef]"}`}>
                <span className="text-[15px]">{push === "on" ? "🔔" : "🔕"}</span>
                <p className="min-w-0 flex-1 text-[12px] leading-snug text-slate-600">
                  {push === "on" ? t("pushOn") : push === "blocked" ? t("pushBlocked") : t("pushOff")}
                  {pushMsg && <span className="block text-red-600">{pushMsg}</span>}
                </p>
                {push === "off" && <button type="button" onClick={enablePush} className="shrink-0 rounded-lg bg-[#0f766e] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#0c5f59]">{t("turnOn")}</button>}
                {push === "on" && <span className="flex shrink-0 items-center gap-2"><button type="button" onClick={testPush} className="text-[12px] font-semibold text-[#0f766e] hover:underline">{t("sendTest")}</button><button type="button" onClick={disablePush} className="text-[12px] text-slate-500 hover:underline">{t("turnOff")}</button></span>}
              </div>
            )}
            {visible.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <svg viewBox="0 0 24 24" className="mx-auto h-10 w-10 text-slate-200" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /></svg>
                <p className="mt-3 text-sm text-slate-500">{t("caughtUp")}</p>
                <p className="mt-1 text-xs text-slate-400">{t("emptyHint")}</p>
              </div>
            ) : (
              <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto overscroll-contain">
                {visible.map((n) => (
                  <li key={n.key} className="animate-[bp-fade_0.2s_ease-out]">
                    <Link href={n.href} prefetch={false} onClick={() => { markRead([n.key]); close(); }}
                      className="flex gap-2.5 px-3.5 py-2.5 transition-colors hover:bg-[#f6fbfa] sm:gap-3 sm:px-4 sm:py-3">
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full sm:h-8 sm:w-8 ${TONE[n.kind]}`}>
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          {n.kind === "activity" ? <path d="M5 12.5 9.5 17 19 7" /> : n.kind === "low_stock" ? <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9zM4 7.5 12 12l8-4.5M12 12v9" /> : n.kind === "job" ? <path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M10 14h4" /> : <path d="M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />}
                        </svg>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold leading-snug text-[#0b1f3a] sm:text-[14px]">{n.title}</span>
                        <span className="block truncate text-[12px] leading-snug text-slate-500 sm:text-[13px]">{n.body}</span>
                      </span>
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#0f766e]" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </PopoverPanel>
    </Popover>
  );
}
