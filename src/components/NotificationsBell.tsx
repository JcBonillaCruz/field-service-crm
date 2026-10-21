"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";

type Notice = { id: string; kind: "overdue" | "due_today" | "due_soon" | "activity"; title: string; body: string; href: string; when: string };
const SEEN = "bp-notices-seen";
const TONE: Record<Notice["kind"], string> = {
  overdue: "bg-[#ffe8ee] text-[#be123c]", due_today: "bg-[#fff0e6] text-[#c2410c]", due_soon: "bg-[#fff6e0] text-[#b45309]", activity: "bg-[#e7f7ec] text-[#15803d]",
};

// Campanita: facturas por vencer o vencidas y lo que hizo el cliente (abrió el correo, aceptó y firmó…)
export default function NotificationsBell() {
  const pathname = usePathname();
  const [items, setItems] = useState<Notice[]>([]);
  const [seen, setSeen] = useState<string[]>([]);
  const load = useCallback(async () => {
    try { const r = await fetch("/api/notifications", { cache: "no-store" }); if (r.ok) setItems((await r.json()).items ?? []); } catch { /* sin conexión */ }
  }, []);
  useEffect(() => { try { setSeen(JSON.parse(localStorage.getItem(SEEN) || "[]")); } catch { /* */ } }, []);
  useEffect(() => { load(); const t = setInterval(load, 120000); return () => clearInterval(t); }, [load, pathname]);
  // Los avisos de vencimiento cuentan por día; la actividad por evento
  const key = (n: Notice) => (n.kind === "activity" ? n.id : `${n.id}-${new Date().toISOString().slice(0, 10)}`);
  const unread = items.filter((n) => !seen.includes(key(n))).length;
  function markAll() {
    const next = Array.from(new Set([...seen, ...items.map(key)])).slice(-400);
    setSeen(next);
    try { localStorage.setItem(SEEN, JSON.stringify(next)); } catch { /* */ }
  }
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
            {items.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <svg viewBox="0 0 24 24" className="mx-auto h-10 w-10 text-slate-200" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /></svg>
                <p className="mt-3 text-sm text-slate-500">You&apos;re all caught up.</p>
                <p className="mt-1 text-xs text-slate-400">Invoices about to be due, overdue invoices and what your customers do (open, accept, sign) show up here.</p>
              </div>
            ) : (
              <ul className="max-h-[26rem] divide-y divide-slate-100 overflow-y-auto">
                {items.map((n) => {
                  const isNew = !seen.includes(key(n));
                  return (
                    <li key={n.id}>
                      <Link href={n.href} onClick={() => { const next = [...seen, key(n)]; setSeen(next); try { localStorage.setItem(SEEN, JSON.stringify(next.slice(-400))); } catch { /* */ } close(); }}
                        className={`flex gap-3 px-4 py-3 transition-colors hover:bg-[#f6fbfa] ${isNew ? "bg-[#fbfdfc]" : ""}`}>
                        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${TONE[n.kind]}`}>
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            {n.kind === "activity" ? <path d="M5 12.5 9.5 17 19 7" /> : <path d="M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />}
                          </svg>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-[14px] ${isNew ? "font-semibold text-[#0b1f3a]" : "text-slate-700"}`}>{n.title}</span>
                          <span className="block truncate text-[13px] text-slate-500">{n.body}</span>
                        </span>
                        {isNew && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#0f766e]" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </PopoverPanel>
    </Popover>
  );
}
