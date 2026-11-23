"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Role } from "@/lib/types";

// =====================================================================
// Settings (Paso 6.17): una ventana flotante con el menú a la izquierda y la pantalla elegida a la derecha
// (como Inventory settings). Solo opciones que ya funcionan: nada de "Soon".
//   · Las de "Mi cuenta" y "Organización" se abren DENTRO de la ventana (/dashboard/settings/...)
//   · Las de "Apps" abren los ajustes de cada app (Quotes, Invoices, Jobs, Inventory…)
// Lo usan: SettingsWindow (ventana), esta pantalla de inicio y el menú izquierdo (AppShell).
// =====================================================================
export type SetItem = { key: string; href: string; icon: string; roles?: Role[]; out?: boolean };
export type SetGroup = { key: string; items: SetItem[] };

const MANAGE: Role[] = ["owner", "manager", "office"];
const BOSS: Role[] = ["owner", "manager"];
const ic = {
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5a7.5 7.5 0 0 1 15 0",
  org: "M4 20V7l8-4 8 4v13M9 20v-5h6v5M8 10h.01M12 10h.01M16 10h.01",
  users: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18.5 14.2a6.5 6.5 0 0 1 3 5.8",
  tax: "M9 15l6-6M9.5 9.5h.01M14.5 14.5h.01M5 4h14v16l-3-2-2 2-2-2-2 2-2-2-3 2z",
  lead: "M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15 9a3 3 0 0 1 0 6M18 6a7 7 0 0 1 0 12",
  colors: "M12 21a9 9 0 1 1 9-9c0 1.7-1.3 3-3 3h-2a2 2 0 0 0-1.5 3.3A1.6 1.6 0 0 1 12 21zM7.5 11.5h.01M10 7.5h.01M14.5 7.5h.01M17 11h.01",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  pdf: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4",
  tpl: "M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 8h6M9 12h6M9 16h3",
  quote: "M6 3h9l4 4v14H6zM15 3v4h4M9 12h6M9 16h4",
  invoice: "M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6M9 16h3",
  repeat: "M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4",
  jobs: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h3M8 17h6",
  box: "M12 3 20 7.5v9L12 21l-8-4.5v-9zM4 7.5 12 12l8-4.5M12 12v9",
};
const S = "/dashboard/settings";
export const SETTINGS_GROUPS: SetGroup[] = [
  { key: "account", items: [
    { key: "account", href: `${S}/account`, icon: ic.user },
  ] },
  { key: "org", items: [
    { key: "branding", href: `${S}/branding`, icon: ic.org, roles: MANAGE },
    { key: "users", href: `${S}/users`, icon: ic.users, roles: BOSS },
    { key: "taxes", href: `${S}/taxes`, icon: ic.tax, roles: MANAGE },
    { key: "leadSources", href: `${S}/lead-sources`, icon: ic.lead, roles: MANAGE },
    { key: "statusColors", href: `${S}/status-colors`, icon: ic.colors, roles: MANAGE },
    { key: "email", href: `${S}/email`, icon: ic.mail, roles: MANAGE },
    { key: "pdf", href: `${S}/pdf-templates`, icon: ic.pdf, roles: MANAGE },
    { key: "templates", href: `${S}/templates`, icon: ic.tpl, roles: MANAGE },
  ] },
  { key: "apps", items: [
    { key: "quotes", href: "/dashboard/quotes?prefs=1", icon: ic.quote, roles: MANAGE, out: true },
    { key: "invoices", href: "/dashboard/invoices?prefs=1", icon: ic.invoice, roles: MANAGE, out: true },
    { key: "subscriptions", href: "/dashboard/subscriptions?prefs=1", icon: ic.repeat, roles: MANAGE, out: true },
    { key: "jobs", href: "/dashboard/jobs/settings", icon: ic.jobs, roles: BOSS, out: true },
    { key: "inventory", href: "/dashboard/inventory/settings", icon: ic.box, roles: MANAGE, out: true },
  ] },
];
export const groupsFor = (role: Role | null) => SETTINGS_GROUPS
  .map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || Boolean(role && i.roles.includes(role))) }))
  .filter((g) => g.items.length);
// La opción que corresponde a la pantalla donde estás
export const itemAt = (path: string) => SETTINGS_GROUPS.flatMap((g) => g.items).find((i) => !i.out && (path === i.href || path.startsWith(`${i.href}/`)));

export const OutIcon = ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
  <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3M11 4h5v5M9.5 10.5 16 4" /></svg>
);

// Inicio de Settings (lado derecho de la ventana): todas las opciones con su explicación, y un buscador
export default function SettingsHub({ role }: { role: Role | null }) {
  const t = useTranslations("settingsHub");
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const groups = groupsFor(role).map((g) => ({
    ...g, items: g.items.filter((i) => !term || `${t(`i.${i.key}`)} ${t(`d.${i.key}`)}`.toLowerCase().includes(term)),
  })).filter((g) => g.items.length);
  return (
    <div className="px-4 py-5 sm:px-7 sm:py-6">
      <div className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-[#0f766e] sm:max-w-sm">
        <svg viewBox="0 0 20 20" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} aria-label={t("search")} className="w-full bg-transparent py-2.5 text-[15px] focus:outline-none" />
      </div>
      {groups.length === 0 && <p className="py-16 text-center text-slate-500">{t("none", { q })}</p>}
      {groups.map((g) => (
        <section key={g.key} className="mt-6">
          <h3 className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-400">{t(`g.${g.key}`)}</h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {g.items.map((i) => (
              <Link key={i.key} prefetch={false} href={i.href}
                className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-[#bfe7de] hover:shadow-[0_8px_24px_rgba(15,40,60,0.08)]">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e9f7f4] text-[#0f766e] transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-110">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={i.icon} /></svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[15px] font-semibold text-[#0b1f3a]">{t(`i.${i.key}`)}{i.out && <span className="text-slate-400"><OutIcon /></span>}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-slate-500">{t(`d.${i.key}`)}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
