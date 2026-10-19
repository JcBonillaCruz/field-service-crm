"use client";

import Link from "next/link";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { Role } from "@/lib/types";

type App = { label: string; href?: string; icon: string; roles?: Role[] };

const APPS: App[] = [
  { label: "Home", href: "/dashboard", icon: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { label: "Customers", href: "/dashboard/customers", icon: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8", roles: ["owner", "manager", "office"] },
  { label: "Quotes", icon: "M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M9 13h6M9 17h4" },
  { label: "Invoices", icon: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" },
  { label: "Payments", icon: "M3 7h18v10H3zM3 11h18M7 15h2" },
  { label: "Jobs", icon: "M9 6V4h6v2M4 6h16v13H4zM4 12h16" },
  { label: "Dispatch", icon: "M4 5h16v15H4zM4 9h16M8 3v4M16 3v4" },
  { label: "Inventory", icon: "M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" },
  { label: "Time", icon: "M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 2" },
  { label: "Reports", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { label: "Team", icon: "M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M10 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" },
  { label: "Settings", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 12a8 8 0 0 1 .3-2l-2-1.5 2-3.5 2.3 1a8 8 0 0 1 1.7-1l.3-2.5h4l.3 2.5a8 8 0 0 1 1.7 1l2.3-1 2 3.5-2 1.5a8 8 0 0 1 0 4l2 1.5-2 3.5-2.3-1a8 8 0 0 1-1.7 1l-.3 2.5h-4l-.3-2.5a8 8 0 0 1-1.7-1l-2.3 1-2-3.5 2-1.5a8 8 0 0 1-.3-2z" },
];

export default function AppsMenu({ role }: { role: Role | null }) {
  return (
    <Popover className="relative">
      <PopoverButton aria-label="All apps"
        className="group flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none data-[open]:bg-[#e9f7f4] data-[open]:text-[#0f766e]">
        <svg viewBox="0 0 24 24" className="h-5 w-5 transition-transform duration-300 group-data-[open]:rotate-90" fill="currentColor" aria-hidden="true">
          {[5, 12, 19].map((cy) => [5, 12, 19].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.8" />))}
        </svg>
      </PopoverButton>
      <PopoverPanel anchor="bottom end" transition
        className="z-50 mt-2 w-[21rem] origin-top-right rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_16px_50px_rgba(15,40,60,0.18)] transition duration-200 ease-out data-[closed]:scale-95 data-[closed]:opacity-0">
        <p className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">All apps</p>
        <div className="grid grid-cols-3 gap-1">
          {APPS.map((a) => {
            const allowed = a.href && (!a.roles || (role && a.roles.includes(role)));
            const inner = (
              <>
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${allowed ? "bg-[#e9f7f4] text-[#0f766e]" : "bg-slate-50 text-slate-300"}`}>
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={a.icon} /></svg>
                </span>
                <span className={`text-xs font-medium ${allowed ? "text-slate-700" : "text-slate-400"}`}>{a.label}</span>
                {!allowed && <span className="text-[9px] font-medium text-slate-300">Soon</span>}
              </>
            );
            const box = "flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center transition-colors";
            return allowed ? (
              <Link key={a.label} href={a.href!} className={`${box} hover:bg-slate-50`}>{inner}</Link>
            ) : (
              <span key={a.label} title="Coming soon" className={`${box} cursor-default`}>{inner}</span>
            );
          })}
        </div>
      </PopoverPanel>
    </Popover>
  );
}
