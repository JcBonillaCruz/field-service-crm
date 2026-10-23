"use client";

import Link from "next/link";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { useNotifications } from "@/components/NotificationsProvider";
import type { NoticeKind } from "@/lib/notifications";

const TONE: Record<NoticeKind, string> = {
  overdue: "bg-[#ffe8ee] text-[#be123c]", due_today: "bg-[#fff0e6] text-[#c2410c]", due_soon: "bg-[#fff6e0] text-[#b45309]", activity: "bg-[#e7f7ec] text-[#15803d]",
};

// Campanita: solo muestra lo NO leído. Los datos vienen de un único proveedor compartido
// (celular y computadora usan la misma consulta, no una cada una).
export default function NotificationsBell() {
  const ctx = useNotifications();
  if (!ctx) return null;
  const { items: visible, unread, markRead, push, pushMsg, enablePush, disablePush } = ctx;
  const markAll = () => markRead(visible.map((n) => n.key));
  return (
    <Popover className="relative">
      <PopoverButton aria-label={`Notifications${unread ? ` (${unread} new)` : ""}`}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none data-[open]:bg-[#e9f7f4] data-[open]:text-[#0f766e]">
        <svg viewBox="0 0 24 24" className={`h-5 w-5 ${unread ? "origin-top animate-[bp-ring_1.2s_ease-in-out_2]" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e11d48] px-1 text-[10px] font-semibold text-white">{unread > 9 ? "9+" : unread}</span>}
      </PopoverButton>
      <PopoverPanel anchor="bottom end" transition
        className="z-50 mt-2 w-[22rem] max-w-[calc(100vw-1.5rem)] origin-top-right rounded-2xl border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,40,60,0.18)] transition duration-200 ease-out data-[closed]:scale-95 data-[closed]:opacity-0">
        {({ close }) => (
          <>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <p className="font-semibold text-[#0b1f3a]">Notifications</p>
              {unread > 0 && <button type="button" onClick={markAll} className="text-[13px] font-medium text-[#0f766e] hover:underline">Mark all as read</button>}
            </div>
            {push !== "unsupported" && (
              <div className={`flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 ${push === "on" ? "bg-[#f3fbf8]" : "bg-[#fff7ef]"}`}>
                <span className="text-lg">{push === "on" ? "🔔" : "🔕"}</span>
                <p className="min-w-0 flex-1 text-[13px] text-slate-600">
                  {push === "on" ? "Sound alerts are on for this device." : push === "blocked" ? "Alerts are blocked. Allow notifications for this site in your browser settings." : "Get a sound alert on this phone or computer, even when BrightPro is closed."}
                  {pushMsg && <span className="block text-red-600">{pushMsg}</span>}
                </p>
                {push === "off" && <button type="button" onClick={enablePush} className="shrink-0 rounded-lg bg-[#0f766e] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#0c5f59]">Turn on</button>}
                {push === "on" && <button type="button" onClick={disablePush} className="shrink-0 text-[12px] text-slate-500 hover:underline">Turn off</button>}
              </div>
            )}
            {visible.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <svg viewBox="0 0 24 24" className="mx-auto h-10 w-10 text-slate-200" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /></svg>
                <p className="mt-3 text-sm text-slate-500">You&apos;re all caught up.</p>
                <p className="mt-1 text-xs text-slate-400">Invoices about to be due, overdue invoices and what your customers did in the last 30 days (open, accept, sign) show up here.</p>
              </div>
            ) : (
              <ul className="max-h-[26rem] divide-y divide-slate-100 overflow-y-auto">
                {visible.map((n) => (
                  <li key={n.key} className="animate-[bp-fade_0.2s_ease-out]">
                    <Link href={n.href} prefetch={false} onClick={() => { markRead([n.key]); close(); }}
                      className="flex gap-3 px-4 py-3 transition-colors hover:bg-[#f6fbfa]">
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${TONE[n.kind]}`}>
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          {n.kind === "activity" ? <path d="M5 12.5 9.5 17 19 7" /> : <path d="M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />}
                        </svg>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold text-[#0b1f3a]">{n.title}</span>
                        <span className="block truncate text-[13px] text-slate-500">{n.body}</span>
                      </span>
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#0f766e]" />
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
