"use client";

import { useState } from "react";
import Link from "next/link";

type Entry = { label: string; href?: string };
type Card = { title: string; icon: string; tone: string; items: Entry[] };
type Section = { title: string; cards: Card[] };

const ic = {
  org: "M4 20V7l8-4 8 4v13M9 20v-5h6v5M8 10h.01M12 10h.01M16 10h.01",
  users: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18.5 14.2a6.5 6.5 0 0 1 3 5.8",
  setup: "M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1M15 5v4M9 10v4M17 15v4",
  brush: "M14 4l6 6-8.5 8.5a3 3 0 0 1-4.2 0l-1.8-1.8a3 3 0 0 1 0-4.2zM4 20c2 0 3-1 3-3",
  bolt: "M13 3 5 14h6l-1 7 8-11h-6z",
  tax: "M9 15l6-6M9.5 9.5h.01M14.5 14.5h.01M5 4h14v16l-3-2-2 2-2-2-2 2-2-2-3 2z",
  doc: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4",
  card: "M3 6.5h18v11H3zM3 10h18M7 14.5h3",
  cart: "M3 4h2l2.2 10.6a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6",
  repeat: "M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4",
  bag: "M6 8h12l-1 12H7zM9 8V6a3 3 0 0 1 6 0v2",
  portal: "M3 5h18v12H3zM8 21h8M12 17v4",
  module: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  plug: "M9 7V3M15 7V3M7 7h10v4a5 5 0 0 1-10 0zM12 16v5",
  code: "M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14",
};

const SECTIONS: Section[] = [
  { title: "Organization Settings", cards: [
    { title: "Organization", icon: ic.org, tone: "bg-[#e9f7f4] text-[#0f766e]", items: [{ label: "Profile" }, { label: "Branding", href: "/dashboard/settings/branding" }, { label: "Custom Domain" }, { label: "Locations" }, { label: "Manage Subscription" }] },
    { title: "Users & Roles", icon: ic.users, tone: "bg-[#fff0f0] text-[#e11d48]", items: [{ label: "Users" }, { label: "Roles" }, { label: "User Preferences" }] },
    { title: "Taxes & Compliance", icon: ic.tax, tone: "bg-[#eef6ff] text-[#2563eb]", items: [{ label: "Taxes" }] },
    { title: "Setup & Configurations", icon: ic.setup, tone: "bg-[#fff6e8] text-[#d97706]", items: [{ label: "General" }, { label: "Currencies" }, { label: "Payment Terms" }, { label: "Reminders" }, { label: "Transaction Number Series", href: "/dashboard/invoices?prefs=1" }] },
    { title: "Customization", icon: ic.brush, tone: "bg-[#fff6e8] text-[#ea580c]", items: [{ label: "PDF Templates", href: "/dashboard/settings/pdf-templates" }, { label: "Email Notifications", href: "/dashboard/settings/email" }, { label: "Hosted Payment Pages" }, { label: "Web Tabs" }] },
    { title: "Automation", icon: ic.bolt, tone: "bg-[#fff0f0] text-[#e11d48]", items: [{ label: "Workflow Rules" }, { label: "Workflow Actions" }, { label: "Workflow Logs" }, { label: "Schedules" }] },
  ] },
  { title: "Module Settings", cards: [
    { title: "General", icon: ic.doc, tone: "bg-[#e9f7f4] text-[#0f766e]", items: [{ label: "Customers", href: "/dashboard/customers" }, { label: "Products", href: "/dashboard/items" }, { label: "Coupons", href: "/dashboard/coupons" }, { label: "Projects" }, { label: "Timesheet" }] },
    { title: "Online Payments", icon: ic.card, tone: "bg-[#fff6e8] text-[#d97706]", items: [{ label: "Payment Gateways" }, { label: "Address Verification Settings" }] },
    { title: "Sales", icon: ic.cart, tone: "bg-[#e9f7f4] text-[#0f766e]", items: [{ label: "Quotes", href: "/dashboard/quotes?prefs=1" }, { label: "Invoices", href: "/dashboard/invoices?prefs=1" }, { label: "Payments Received" }, { label: "Delivery Notes", href: "/dashboard/settings/pdf-templates?for=invoice" }, { label: "Packing Slips", href: "/dashboard/settings/pdf-templates?for=invoice" }] },
    { title: "Subscriptions", icon: ic.repeat, tone: "bg-[#e9f7f4] text-[#0f766e]", items: [{ label: "General", href: "/dashboard/subscriptions?prefs=1" }, { label: "Billing Preferences" }, { label: "Advance Billing" }, { label: "Dunning Management" }, { label: "Cancellation Preferences" }] },
    { title: "Purchases", icon: ic.bag, tone: "bg-[#e9f7f4] text-[#0f766e]", items: [{ label: "Expenses" }] },
    { title: "Customer Portal", icon: ic.portal, tone: "bg-[#e9f7f4] text-[#0f766e]", items: [{ label: "General" }, { label: "Subscription Management" }, { label: "Web Tabs" }] },
    { title: "Custom Modules", icon: ic.module, tone: "bg-[#eef6ff] text-[#2563eb]", items: [{ label: "Overview" }] },
  ] },
  { title: "Extension and Developer Data", cards: [
    { title: "Integrations & Marketplace", icon: ic.plug, tone: "bg-[#e9f7f4] text-[#0f766e]", items: [{ label: "WhatsApp" }, { label: "SMS Integrations" }, { label: "Accounting" }, { label: "Google Calendar" }, { label: "Marketplace" }] },
    { title: "Developer Data", icon: ic.code, tone: "bg-[#fff6e8] text-[#ea580c]", items: [{ label: "Incoming Webhooks" }, { label: "Connections" }, { label: "API Usage" }, { label: "Data Management" }, { label: "Web Forms" }] },
  ] },
];

export default function SettingsHub({ companyName }: { companyName: string }) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const sections = SECTIONS.map((s) => ({
    ...s, cards: s.cards.map((c) => ({ ...c, items: c.items.filter((i) => !term || `${c.title} ${i.label}`.toLowerCase().includes(term)) })).filter((c) => c.items.length),
  })).filter((s) => s.cards.length);
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f6f8f9]">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-4 px-5 py-3.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e9f7f4] text-[#0f766e]">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3" /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" strokeLinecap="round" /></svg>
          </span>
          <div className="min-w-0"><h1 className="text-xl font-semibold text-[#0b1f3a]">All Settings</h1><p className="text-[13px] text-slate-500">{companyName}</p></div>
          <div className="order-last flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-[#0f766e] focus-within:bg-white sm:order-none sm:mx-auto sm:w-80">
            <svg viewBox="0 0 20 20" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search settings" className="w-full bg-transparent py-2.5 text-[15px] focus:outline-none" />
          </div>
          <Link href="/dashboard" className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:ml-0">
            Close Settings<svg viewBox="0 0 20 20" className="h-4 w-4 text-red-500" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
          </Link>
        </div>
      </div>
      <div className="mx-auto max-w-[1240px] space-y-6 px-4 py-6 sm:px-5 sm:py-8">
        {sections.length === 0 && <p className="py-16 text-center text-slate-500">No settings match “{q}”.</p>}
        {sections.map((sec) => (
          <section key={sec.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,40,60,0.04)] sm:p-7">
            <h2 className="mb-5 text-[18px] font-semibold text-[#0b1f3a]">{sec.title}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sec.cards.map((c) => (
                <div key={c.title} className="rounded-xl border border-slate-100 p-2 transition-shadow hover:shadow-[0_6px_24px_rgba(15,40,60,0.08)]">
                  <div className={`mb-1 flex items-center gap-2.5 rounded-lg px-3 py-2.5 ${c.tone.split(" ")[0]}`}>
                    <svg viewBox="0 0 24 24" className={`h-[18px] w-[18px] ${c.tone.split(" ")[1]}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={c.icon} /></svg>
                    <p className="font-semibold text-[#0b1f3a]">{c.title}</p>
                  </div>
                  <ul>
                    {c.items.map((i) => (
                      <li key={i.label}>
                        {i.href ? (
                          <Link href={i.href} className="group flex items-center justify-between rounded-lg px-3 py-2 text-[15px] text-slate-700 transition-colors hover:bg-[#e9f7f4] hover:text-[#0f766e]">
                            {i.label}<svg viewBox="0 0 20 20" className="h-4 w-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" fill="currentColor"><path d="M7.3 5.3a1 1 0 0 1 1.4 0l4 4a1 1 0 0 1 0 1.4l-4 4a1 1 0 0 1-1.4-1.4L10.6 10 7.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
                          </Link>
                        ) : (
                          <span className="flex items-center justify-between rounded-lg px-3 py-2 text-[15px] text-slate-400">
                            {i.label}<span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">Soon</span>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
