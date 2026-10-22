"use client";

import Link from "next/link";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { Role } from "@/lib/types";

// Cada app con su color suave, su degradado y su ícono. Se actualiza a medida que salen módulos.
type App = { label: string; href?: string; icon: string; tone: [string, string, string]; roles?: Role[]; hint?: string };
const SALES: Role[] = ["owner", "manager", "office"];

const APPS: App[] = [
  { label: "Home", href: "/dashboard", icon: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z", tone: ["#e6f6f2", "#c9ede3", "#0f766e"], hint: "Dashboard" },
  { label: "Customers", href: "/dashboard/customers", icon: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8", tone: ["#eaf1ff", "#d3e2ff", "#2563eb"], roles: SALES, hint: "People & companies" },
  { label: "Quotes", href: "/dashboard/quotes", icon: "M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M9 13h6M9 17h4", tone: ["#f3edff", "#e3d7ff", "#7c3aed"], roles: SALES, hint: "Estimates" },
  { label: "Invoices", href: "/dashboard/invoices", icon: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6", tone: ["#fff1e8", "#ffdcc6", "#e8713a"], roles: SALES, hint: "Bill & get paid" },
  { label: "Subscriptions", href: "/dashboard/subscriptions", icon: "M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4", tone: ["#e7f7ec", "#c8edd4", "#15803d"], roles: SALES, hint: "Recurring plans" },
  { label: "Items", href: "/dashboard/items", icon: "M12 3 20 7.5v9L12 21l-8-4.5v-9zM4 7.5 12 12l8-4.5M12 12v9", tone: ["#e8f6fb", "#c9eaf6", "#0369a1"], roles: SALES, hint: "Products & services" },
  { label: "Coupons", href: "/dashboard/coupons", icon: "M3 8V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a2 2 0 0 0 0 4v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6a2 2 0 0 0 0-4zM9 15l6-6M9.5 9.5h.01M14.5 14.5h.01", tone: ["#ffeef3", "#ffd5e1", "#be123c"], roles: SALES, hint: "Discounts" },
  { label: "Expenses", href: "/dashboard/expenses", icon: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 9h6M9 13h6", tone: ["#fff4e5", "#ffe2bd", "#c2410c"], roles: SALES, hint: "Track spending" },
  { label: "Settings", href: "/dashboard/settings", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 12a8 8 0 0 1 .3-2l-2-1.5 2-3.5 2.3 1a8 8 0 0 1 1.7-1l.3-2.5h4l.3 2.5a8 8 0 0 1 1.7 1l2.3-1 2 3.5-2 1.5a8 8 0 0 1 0 4l2 1.5-2 3.5-2.3-1a8 8 0 0 1-1.7 1l-.3 2.5h-4l-.3-2.5a8 8 0 0 1-1.7-1l-2.3 1-2-3.5 2-1.5a8 8 0 0 1-.3-2z", tone: ["#eef2f6", "#dde4ec", "#334155"], hint: "All settings" },
  { label: "Payments", icon: "M3 7h18v10H3zM3 11h18M7 15h2", tone: ["#f3f5f7", "#f3f5f7", "#cbd5e1"] },
  { label: "Jobs", icon: "M9 6V4h6v2M4 6h16v13H4zM4 12h16", tone: ["#f3f5f7", "#f3f5f7", "#cbd5e1"] },
  { label: "Dispatch", icon: "M4 5h16v15H4zM4 9h16M8 3v4M16 3v4", tone: ["#f3f5f7", "#f3f5f7", "#cbd5e1"] },
  { label: "Reports", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2", tone: ["#f3f5f7", "#f3f5f7", "#cbd5e1"] },
];

export default function AppsMenu({ role }: { role: Role | null }) {
  return (
    <Popover className="relative">
      <PopoverButton aria-label="All apps"
        className="group flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none data-[open]:bg-[#e9f7f4] data-[open]:text-[#0f766e]">
        <svg viewBox="0 0 24 24" className="h-5 w-5 transition-transform duration-500 group-hover:rotate-45 group-data-[open]:rotate-90" fill="currentColor" aria-hidden="true">
          {[5, 12, 19].map((cy) => [5, 12, 19].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.8" />))}
        </svg>
      </PopoverButton>
      <PopoverPanel anchor="bottom end" transition
        className="z-50 mt-2 w-[23rem] max-w-[calc(100vw-1rem)] origin-top-right rounded-3xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_24px_60px_rgba(15,40,60,0.22)] backdrop-blur transition duration-200 ease-out data-[closed]:scale-95 data-[closed]:opacity-0">
        {({ close }) => (
          <>
            <div className="flex items-center justify-between px-1 pb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">All apps</p>
              <span className="text-[11px] text-slate-400">Bright<b className="text-[#e8713a]">Pro</b></span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {APPS.map((a, i) => {
                const allowed = Boolean(a.href && (!a.roles || (role && a.roles.includes(role))));
                const [bg, bg2, fg] = a.tone;
                const icon = (
                  <span className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl transition-all duration-300 group-hover/app:-translate-y-1 group-hover/app:rotate-[-4deg] group-hover/app:shadow-[0_10px_24px_rgba(15,40,60,0.16)] group-active/app:scale-90"
                    style={{ background: allowed ? `linear-gradient(140deg, ${bg} 0%, ${bg2} 100%)` : bg, color: fg }}>
                    {/* brillito que cruza el ícono al pasar el mouse */}
                    {allowed && <span className="pointer-events-none absolute -left-8 top-0 h-full w-6 -skew-x-12 bg-white/70 opacity-0 transition-all duration-700 group-hover/app:left-16 group-hover/app:opacity-100" />}
                    <svg viewBox="0 0 24 24" className="relative h-6 w-6 transition-transform duration-300 group-hover/app:scale-110" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={a.icon} /></svg>
                  </span>
                );
                const text = (
                  <>
                    <span className={`text-[13px] font-semibold ${allowed ? "text-[#0b1f3a]" : "text-slate-400"}`}>{a.label}</span>
                    <span className={`-mt-1 text-[10px] ${allowed ? "text-slate-400" : "text-slate-300"}`}>{allowed ? a.hint : "Soon"}</span>
                  </>
                );
                const cls = "group/app flex flex-col items-center gap-1.5 rounded-2xl px-1 py-3 text-center transition-colors animate-[bp-fade_0.35s_ease-out_both]";
                return allowed ? (
                  <Link key={a.label} href={a.href!} onClick={() => close()} style={{ animationDelay: `${i * 25}ms` }} className={`${cls} hover:bg-[#f6fbfa]`}>{icon}{text}</Link>
                ) : (
                  <span key={a.label} title="Coming soon" style={{ animationDelay: `${i * 25}ms` }} className={`${cls} cursor-default`}>{icon}{text}</span>
                );
              })}
            </div>
          </>
        )}
      </PopoverPanel>
    </Popover>
  );
}
