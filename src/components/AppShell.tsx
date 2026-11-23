"use client";

import { createClient } from "@/lib/supabase/client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import AppHeader from "@/components/AppHeader";
import ProfilePanel from "@/components/ProfilePanel";
import Avatar from "@/components/Avatar";
import NotificationsProvider from "@/components/NotificationsProvider";
import { AppsGrid } from "@/components/AppsMenu";
import { useInstallApp } from "@/components/InstallPrompt";
import { FinanceArt, InventoryArt, JobsArt, QrArt, SettingsArt, TeamAppArt } from "@/components/AppIcons";
import { DashboardArt } from "@/components/home/DashArt";
import { canManageSales } from "@/lib/sales";
import { groupsFor, itemAt } from "@/components/settings/SettingsHub";
import { LAST_APP_KEY } from "@/components/settings/SettingsWindow";
import { CompanySummary, CurrentUser, Role } from "@/lib/types";

type NavItem = {
  label: string;
  href?: string;
  addHref?: string; // botón "+" para crear directo desde el menú
  addLabel?: string; // texto del "+" (por defecto: el nombre en singular)
  icon: string;
  roles?: Role[];
  exclude?: string[]; // rutas hijas que NO marcan este enlace como activo
  also?: string[]; // otras rutas que también lo marcan como activo (Paso 6.12: History = movimientos, transferencias y conteos)
  children?: NavItem[]; // grupo plegable (ej. Product Catalog → Items, Coupons)
  art?: "dashboard"; // ícono a color (el mismo de la pestaña Dashboard del inicio)
};

// Íconos de línea (24 px). "roles": quién ve cada opción. Sin "roles", la ven todos.
// La app se divide en APPS: cada app tiene su propio menú lateral.
//   · Finances: clientes, ventas, catálogo y dinero (todo lo que hay hoy)
//   · QR Studio: su propio menú
// Cuando hagamos Trabajos/Seguimiento o Inventario, cada uno será otra app con su menú.
// Paso 6.1: el texto de cada opción sale de messages/{en,es}.json → nav.<llave> (llave = la etiqueta en camelCase)
export const navKey = (label: string) => label.replace(/&/g, " ").split(/\s+/).filter(Boolean)
  .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())).join("");

export type AppId = "finance" | "qr" | "inventory" | "jobs";
export const appOf = (path: string): AppId =>
  path.startsWith("/dashboard/tools/qr") ? "qr" : path.startsWith("/dashboard/inventory") ? "inventory" : path.startsWith("/dashboard/jobs") ? "jobs" : "finance";

const SETTINGS: NavItem = { label: "Settings", href: "/dashboard/settings", icon: "M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1M15 5v4M9 10v4M17 15v4", roles: ["owner", "manager"] };

const FINANCE_NAV: NavItem[] = [
  { label: "Home", href: "/dashboard", roles: ["owner", "manager", "office"], icon: "M4 10.2 12 4l8 6.2V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" },
  { label: "Customers", href: "/dashboard/customers", addHref: "/dashboard/customers/new", icon: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18.5 14.2a6.5 6.5 0 0 1 3 5.8", roles: ["owner", "manager", "office"] },
  { label: "Product Catalog", icon: "M5 8.5h14l-1.2 11a1.5 1.5 0 0 1-1.5 1.3H7.7a1.5 1.5 0 0 1-1.5-1.3zM9 8.5V7a3 3 0 0 1 6 0v1.5M9.5 13h5", roles: ["owner", "manager", "office"],
    children: [
      { label: "Items", href: "/dashboard/items", addHref: "/dashboard/items/new", icon: "" },
      { label: "Coupons", href: "/dashboard/coupons", addHref: "/dashboard/coupons/new", icon: "" },
    ] },
  { label: "Sales", icon: "M3 4h2l2.2 10.6a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6M9.5 20a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4zM17 20a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z", roles: ["owner", "manager", "office"],
    children: [
      { label: "Quotes", href: "/dashboard/quotes", addHref: "/dashboard/quotes/new", icon: "" },
      { label: "Invoices", href: "/dashboard/invoices", addHref: "/dashboard/invoices/new", icon: "" },
      { label: "Subscriptions", href: "/dashboard/subscriptions", addHref: "/dashboard/subscriptions/new", icon: "" },
    ] },
  // Finanzas: el grupo lleva el ícono ($); Money In y Expenses van sin ícono, igual que Sales y Product Catalog
  { label: "Finances", icon: "M4 19.5h16M6.5 15.5l4-4.2 3 2.7 5-6M15 8h4v4", roles: ["owner", "manager", "office"],
    children: [
      { label: "Money In", href: "/dashboard/income", icon: "" },
      { label: "Expenses", href: "/dashboard/expenses", icon: "" },
      { label: "Recurring expenses", href: "/dashboard/recurring", icon: "" },
      // Paso 5.10c: nómina por persona y el reporte de toda la compañía (dueño y manager)
      { label: "Payroll", href: "/dashboard/payroll", icon: "", roles: ["owner", "manager"] },
      // Paso 5.10d: compras a pagos (dueño y manager)
      { label: "Financing", href: "/dashboard/financing", icon: "", roles: ["owner", "manager"] },
      { label: "Reports", href: "/dashboard/reports", icon: "", roles: ["owner", "manager"] },
    ] },
  { label: "Team", href: "/dashboard/team", addHref: "/dashboard/team/invite", addLabel: "Member", icon: "M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6", roles: ["owner", "manager"] },
  SETTINGS,
];

const QR_NAV: NavItem[] = [
  { label: "Create QR code", href: "/dashboard/tools/qr", icon: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2zM6.5 6.5h1M16.5 6.5h1M6.5 16.5h1" },
  SETTINGS,
];
// Inventory: su propio menú. El técnico ve solo lo suyo (su van, escanear, su consumo).
const MANAGE: Role[] = ["owner", "manager", "office"];
// Paso 6.12: menú nuevo → Dashboard (primera pantalla) · Items (Scan como botón) · Stock & Vans (transferir, contar, resurtir dentro)
// · Labels · History (movimientos, transferencias y conteos juntos) · Reports · Team · Settings
const INV = "/dashboard/inventory";
const INVENTORY_NAV: NavItem[] = [
  { label: "Dashboard", href: `${INV}/dashboard`, roles: MANAGE, icon: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z", art: "dashboard" },
  { label: "Items", href: INV, exclude: ["dashboard", "labels", "settings", "locations", "transfers", "movements", "counts", "history", "reports", "team", "purchasing", "van-history"].map((x) => `${INV}/${x}`), addHref: `${INV}/new`, roles: MANAGE, icon: "M12 3 20 7.5v9L12 21l-8-4.5v-9zM4 7.5 12 12l8-4.5M12 12v9" },
  { label: "My Van", href: `${INV}/van`, roles: ["technician"], icon: "M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 19a1.8 1.8 0 1 0 0-3.6A1.8 1.8 0 0 0 7 19zM17 19a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z" },
  { label: "Scan", href: `${INV}/scan`, roles: ["technician"], icon: "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 8v8M10 8v8M13 8v8M16.5 8v8" },
  { label: "Stock & Vans", href: `${INV}/locations`, addHref: `${INV}/locations?new=1`, addLabel: "Location", roles: MANAGE, icon: "M3 10.5 12 4l9 6.5V20H3zM8 20v-6h8v6M8 17h8", also: [`${INV}/transfers/new`, `${INV}/counts/new`] },
  // Paso 6.14: compras (órdenes, por comprar, proveedores)
  { label: "Purchasing", href: `${INV}/purchasing`, addHref: `${INV}/purchasing/new`, addLabel: "Order", roles: MANAGE, icon: "M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.7L21 8H6.2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" },
  { label: "Labels", href: `${INV}/labels`, roles: MANAGE, icon: "M7 8V3h10v5M6 17H4V9h16v8h-2M7 14h10v7H7z" },
  { label: "History", href: `${INV}/history`, roles: MANAGE, icon: "M12 8v4l2.5 2.5M3.5 12a8.5 8.5 0 1 0 2.5-6M3 4v4h4", also: [`${INV}/movements`, `${INV}/transfers`, `${INV}/counts`], exclude: [`${INV}/transfers/new`, `${INV}/counts/new`] },
  { label: "Reports", href: `${INV}/reports`, roles: MANAGE, icon: "M4 4v16h16M8.5 16v-4M12.5 16V8M16.5 16v-6" },
  { label: "My Usage", href: `${INV}/usage`, roles: ["technician"], icon: "M4 4v16h16M8.5 16v-4M12.5 16V8M16.5 16v-6" },
  { label: "Team", href: `${INV}/team`, addHref: `${INV}/team/invite`, addLabel: "Member", roles: ["owner", "manager"], icon: "M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6" },
  { label: "Settings", href: `${INV}/settings`, roles: MANAGE, icon: "M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1M15 5v4M9 10v4M17 15v4" },
];
// Jobs: calendario (Schedule) para la oficina; el técnico ve solo sus trabajos
const JOBS_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard/jobs/dashboard", roles: MANAGE, icon: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z", art: "dashboard" },
  { label: "Operations", href: "/dashboard/jobs/operations", roles: MANAGE, icon: "M3 12h4l2.5-6 4 12 2.5-6H21" },
  { label: "Schedule", href: "/dashboard/jobs/schedule", addHref: "/dashboard/jobs/new", addLabel: "Job", roles: MANAGE, icon: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h3M13 14h3M8 17h3" },
  { label: "Assign jobs", href: "/dashboard/jobs/assign", roles: MANAGE, icon: "M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2.5 15a5.5 5.5 0 0 1 11 0M14 12h7M18 9l3 3-3 3" },
  // Paso 6.13b: días libres, permisos y vacaciones del equipo
  { label: "Time off", href: "/dashboard/jobs/time-off", addHref: "/dashboard/jobs/time-off/new", addLabel: "Time off", roles: MANAGE, icon: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M9 14.5l2 2 4-4" },
  // Paso 5.11: planes de mantenimiento (visitas que se repiten y se crean solas)
  { label: "Maintenance plans", href: "/dashboard/jobs/plans", addHref: "/dashboard/jobs/plans/new", addLabel: "Plan", roles: MANAGE, icon: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M9 15a3 3 0 0 1 5.2-2M15 15a3 3 0 0 1-5.2 2M14.5 11.5V13H13M9.5 18.5V17H11" },
  // Paso 6.10: plantillas de trabajo y cotización (Tune-up, cambio de capacitor…)
  { label: "Templates", href: "/dashboard/jobs/templates", addHref: "/dashboard/jobs/templates/new", addLabel: "Template", roles: MANAGE, icon: "M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 8h6M9 12h6M9 16h3" },
  { label: "Confirmations", href: "/dashboard/jobs/confirmations", roles: MANAGE, icon: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M9 15l2.2 2.2L15.5 13" },
  { label: "Timesheets", href: "/dashboard/jobs/timesheets", roles: MANAGE, icon: "M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 1.5M9.5 2.5h5" },
  { label: "Reports", href: "/dashboard/jobs/reports", roles: MANAGE, icon: "M4 4v16h16M8.5 16v-4M12.5 16V8M16.5 16v-6" },
  { label: "Cancelled", href: "/dashboard/jobs/cancelled", roles: MANAGE, icon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8" },
  // My Jobs: el técnico y cualquiera que reciba trabajos (el dueño también puede ser colaborador)
  { label: "My Jobs", href: "/dashboard/jobs/mine", icon: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h3M8 17h6" },
  { label: "My Timesheet", href: "/dashboard/jobs/my-timesheet", icon: "M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 1.5M9.5 2.5h5" },
  { label: "Team", href: "/dashboard/jobs/team", addHref: "/dashboard/jobs/team/invite", addLabel: "Member", roles: ["owner", "manager"], icon: "M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6" },
  { label: "Settings", href: "/dashboard/jobs/settings", roles: ["owner", "manager"], icon: "M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1M15 5v4M9 10v4M17 15v4" },
];
const NAV_BY_APP: Record<AppId, NavItem[]> = { finance: FINANCE_NAV, qr: QR_NAV, inventory: INVENTORY_NAV, jobs: JOBS_NAV };
const APP_TITLE: Record<AppId, { label: string; icon: string; color: string }> = {
  finance: { label: "Finances", icon: "M12 2.5v19M16.6 6.6c-.6-1.6-2.4-2.6-4.6-2.6-2.6 0-4.6 1.3-4.6 3.4 0 4.8 9.4 2.5 9.4 7.4 0 2.1-2.1 3.5-4.8 3.5-2.4 0-4.4-1.1-5-2.9", color: "#0f766e" },
  qr: { label: "QR Studio", icon: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2v2h-2zM18 14h2v2h-2z", color: "#4f46e5" },
  inventory: { label: "Inventory", icon: "M12 3 20 7.5v9L12 21l-8-4.5v-9zM4 7.5 12 12l8-4.5M12 12v9", color: "#d97706" },
  jobs: { label: "Jobs", icon: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4", color: "#2563eb" },
};

// Paso 6.3 — Computadora: las apps viven en el menú izquierdo (acordeón).
// Clic en una app = va a su inicio (Finances → Home) y abre su menú de siempre debajo, con sus grupos desplegables.
// Al tocar otra app, la anterior se cierra y se abre la nueva. La flechita abre/cierra sin cambiar de pantalla.
// Paso 6.3c: Team y Settings (los de toda la compañía) son filas propias, como una app más (dueño y manager).
const APP_ORDER: AppId[] = ["finance", "jobs", "inventory", "qr"];
const appArt = (id: AppId, size: number) =>
  id === "finance" ? <FinanceArt size={size} /> : id === "inventory" ? <InventoryArt size={size} /> : id === "jobs" ? <JobsArt size={size} /> : <QrArt size={size} />;
// Inicio de cada app (el técnico va directo a lo suyo)
const appHome = (id: AppId, role: Role | null) =>
  role === "technician" ? (id === "inventory" ? "/dashboard/inventory/van" : "/dashboard/jobs/mine")
    : id === "finance" ? "/dashboard" : id === "jobs" ? "/dashboard/jobs" : id === "inventory" ? "/dashboard/inventory/dashboard" : "/dashboard/tools/qr";
const GLOBAL_SETTINGS = "/dashboard/settings";
const GLOBAL_TEAM = "/dashboard/team";
const ACCOUNT = "/dashboard/account";

// Paso 6.3d / 6.17: Settings general en el menú izquierdo, con las mismas opciones de la ventana de Settings
// (Mi cuenta, Organización, Apps). Solo las opciones que ya funcionan.
function SettingsMenu({ role }: { role: Role | null }) {
  const t = useTranslations("settingsHub");
  const pathname = usePathname() || "";
  const here = itemAt(pathname);
  return (
    <ul className="space-y-0.5">
      {groupsFor(role).flatMap((g) => g.items).map((it) => {
        const on = here?.key === it.key;
        return (
          <li key={it.key}>
            <Link prefetch={false} href={it.href}
              className={`flex items-center gap-2.5 rounded-lg py-2 pl-[2.1rem] pr-2.5 text-[13px] transition-all duration-150 ${on ? "bg-[#dcf2ec] font-semibold text-[#0b5e57]" : "text-slate-700 hover:bg-[#eef7f4] hover:text-[#0b1f3a]"}`}>
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={it.icon} /></svg>
              <span className="min-w-0 flex-1 truncate">{t(`i.${it.key}`)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function DesktopNav({ role }: { role: Role | null }) {
  const t = useTranslations("shell");
  const ta = useTranslations("apps");
  const tn = useTranslations("nav");
  const pathname = usePathname() || "";
  // En Team o Settings generales no se abre ninguna app
  const inSettings = pathname.startsWith(GLOBAL_SETTINGS) || pathname.startsWith(ACCOUNT);
  const standalone = pathname.startsWith(GLOBAL_TEAM) || inSettings;
  const current: AppId | null = standalone ? null : appOf(pathname);
  type Open = AppId | "settings" | null;
  const now: Open = inSettings ? "settings" : current;
  const [expanded, setExpanded] = useState<Open>(now);
  useEffect(() => setExpanded(now), [now]);
  // El técnico solo ve Jobs e Inventory
  const apps = APP_ORDER.filter((id) => role !== "technician" || id === "inventory" || id === "jobs");
  const showGlobal = Boolean(role && SETTINGS.roles?.includes(role));
  const extras = showGlobal ? [
    { key: "team", href: GLOBAL_TEAM, label: tn("team"), art: <TeamAppArt size={26} /> },
    { key: "settings", href: GLOBAL_SETTINGS, label: tn("settings"), art: <SettingsArt size={26} /> },
  ] : [];

  return (
    <>
      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        <p className="px-2.5 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-400">{t("apps")}</p>
        <ul className="space-y-0.5">
          {apps.map((id) => {
            const open = expanded === id;
            const here = current === id;
            return (
              <li key={id}>
                <div className={`group/app relative flex items-center rounded-lg transition-colors duration-150 ${
                  here ? "bg-[#e6f5f0]" : "hover:bg-[#eef7f4]"}`}>
                  <Link prefetch={false} href={appHome(id, role)} onClick={() => setExpanded(id)}
                    className={`flex min-w-0 flex-1 items-center gap-2.5 py-1.5 pl-2 pr-1 text-[13.5px] ${here ? "font-semibold text-[#0b5e57]" : "text-slate-700 group-hover/app:text-[#0b1f3a]"}`}>
                    <span className="-my-0.5 flex shrink-0 transition-transform duration-200 group-hover/app:-rotate-3 group-hover/app:scale-110">{appArt(id, 26)}</span>
                    <span className="min-w-0 flex-1 truncate">{ta(`${id}.label`)}</span>
                  </Link>
                  <button type="button" onClick={() => setExpanded(open ? null : id)} aria-expanded={open} aria-label={ta(`${id}.label`)}
                    className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white hover:text-[#0f766e]">
                    <svg viewBox="0 0 20 20" className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "text-[#0f766e]" : "-rotate-90"}`} fill="currentColor" aria-hidden="true">
                      <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
                    </svg>
                  </button>
                </div>
                {open && (
                  <div className="mb-2 mt-1 animate-[bp-fade_0.2s_ease-out]">
                    <NavList role={role} forApp={id} embedded />
                  </div>
                )}
              </li>
            );
          })}
          {extras.map((x) => {
            const on = x.key === "settings" ? inSettings : pathname.startsWith(x.href);
            const isSettings = x.key === "settings";
            const open = isSettings && expanded === "settings";
            return (
              <li key={x.key}>
                <div className={`group/app relative flex items-center rounded-lg transition-colors duration-150 ${on ? "bg-[#e6f5f0]" : "hover:bg-[#eef7f4]"}`}>
                  <Link prefetch={false} href={x.href} onClick={() => setExpanded(isSettings ? "settings" : null)}
                    className={`flex min-w-0 flex-1 items-center gap-2.5 py-1.5 pl-2 pr-2 text-[13.5px] ${on ? "font-semibold text-[#0b5e57]" : "text-slate-700 group-hover/app:text-[#0b1f3a]"}`}>
                    <span className="-my-0.5 flex shrink-0 transition-transform duration-200 group-hover/app:-rotate-3 group-hover/app:scale-110">{x.art}</span>
                    <span className="min-w-0 flex-1 truncate">{x.label}</span>
                  </Link>
                  {isSettings && (
                    <button type="button" onClick={() => setExpanded(open ? null : "settings")} aria-expanded={open} aria-label={x.label}
                      className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white hover:text-[#0f766e]">
                      <svg viewBox="0 0 20 20" className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "text-[#0f766e]" : "-rotate-90"}`} fill="currentColor" aria-hidden="true">
                        <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
                      </svg>
                    </button>
                  )}
                </div>
                {open && (
                  <div className="mb-2 mt-1 animate-[bp-fade_0.2s_ease-out]">
                    <SettingsMenu role={role} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

// embedded (paso 6.3): el menú de una app dentro del acordeón de la computadora (sin encabezado)
function NavList({ role, onNavigate, forApp, embedded = false }: { role: Role | null; onNavigate?: () => void; forApp?: AppId; embedded?: boolean }) {
  const t = useTranslations("shell");
  const tn = useTranslations("nav");
  const ta = useTranslations("navAdd");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const app = forApp ?? appOf(pathname);
  const NAV = NAV_BY_APP[app];
  const allowed = (i: NavItem) => !i.roles || Boolean(role && i.roles.includes(role));
  // Los hijos de un grupo también respetan "roles" (Payroll y Reports de Finances: dueño y manager)
  // En la computadora, "Settings" de toda la app tiene su propia fila (no repetido dentro de Finances / QR)
  // y "Team" también tiene su propia fila (paso 6.3c)
  // Nada de "Soon": una opción sin pantalla (sin href ni hijos) no se muestra
  const items = NAV.filter(allowed).filter((i) => i.href || i.children?.length).filter((i) => !(embedded && (i.href === GLOBAL_SETTINGS || i.label === "Team")))
    .map((i) => (i.children ? { ...i, children: i.children.filter(allowed) } : i));
  const excludes = new Map(NAV.filter((n) => n.exclude && n.href).map((n) => [n.href as string, n.exclude as string[]]));
  const alsoOf = new Map(NAV.filter((n) => n.also && n.href).map((n) => [n.href as string, n.also as string[]]));
  const isActive = (href?: string) => Boolean(href && (href === "/dashboard" ? pathname === "/dashboard"
    : (pathname.startsWith(href) || (alsoOf.get(href) ?? []).some((x) => pathname.startsWith(x))) && !(excludes.get(href) ?? []).some((x) => pathname.startsWith(x))));
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [appsOpen, setAppsOpen] = useState(false);
  const installApp = useInstallApp();
  useEffect(() => setAppsOpen(false), [app]);
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>();
  // Solo queda abierto el grupo donde estás. Al ir a Home, Customers, etc. se vuelve a cerrar.
  const insideGroups = () => Object.fromEntries(NAV.filter((g) => g.children?.some((c) => isActive(c.href))).map((g) => [g.label, true]));
  useEffect(() => {
    setOpen(insideGroups());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Flechita a la izquierda (como Zoho). Los que no tienen grupo dejan el mismo espacio para que todo quede alineado.
  const caret = (isOpen?: boolean) => (
    <span className="flex w-3.5 shrink-0 justify-center">
      {isOpen !== undefined && (
        <svg viewBox="0 0 20 20" className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? "text-[#0f766e]" : "-rotate-90 text-slate-400"}`} fill="currentColor" aria-hidden="true">
          <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
        </svg>
      )}
    </span>
  );

  const mobile = Boolean(onNavigate); // el menú de hamburguesa (celular)
  const size = mobile ? "text-[15px] py-2.5" : "text-[13px] py-2";
  // Paso 6.3: seleccionado = franja verde menta muy suave + texto/ícono verde oscuro (sin degradado)
  const activeCls = "bg-[#dcf2ec] font-semibold text-[#0b5e57]";

  const icon = (d: string) => (
    <svg viewBox="0 0 24 24" className={`${mobile ? "h-5 w-5" : "h-[18px] w-[18px]"} shrink-0 group-hover:animate-[bp-nav-pop_0.5s_ease-out_forwards]`} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
  function entry(item: NavItem, child = false) {
    const active = isActive(item.href);
    const showAdd = Boolean(item.addHref) && !mobile;
    const content = (
      <>
        {!child && caret()}
        {!child && (item.art ? <span className="-my-1 flex shrink-0 transition-transform duration-200 group-hover:scale-110"><DashboardArt size={mobile ? 26 : 24} /></span> : icon(item.icon))}
        <span className="min-w-0 flex-1 truncate">{tn(navKey(item.label))}</span>
        {!item.href && <span className="shrink-0 rounded-full bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">{tc("soon")}</span>}
      </>
    );
    const base = `flex items-center gap-2.5 rounded-lg transition-all duration-150 ${size} ${child ? (mobile ? "pl-[3.6rem] pr-2.5" : "pl-[3.35rem] pr-2.5") : "px-2.5"} ${showAdd ? "pr-10" : ""}`;
    const addText = item.addHref ? ta(navKey(item.addLabel ?? item.label)) : "";
    return (
      <li key={`${item.label}-${item.href ?? item.roles?.join("")}`} className="group relative">
        {item.href ? (
          <Link prefetch={false} href={item.href} onClick={onNavigate}
            className={`${base} ${active ? activeCls : "text-slate-700 hover:bg-[#eef7f4] hover:text-[#0b1f3a] active:bg-[#dcf2ec]"}`}>
            {content}
          </Link>
        ) : (
          <span className={`${base} cursor-default text-slate-400`} aria-disabled="true">{content}</span>
        )}
        {showAdd && item.addHref && (
          <Link prefetch={false} href={item.addHref} onClick={onNavigate} aria-label={addText} title={addText}
            className={`absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md transition-all duration-150 focus:opacity-100 ${
              active
                ? "bg-white/80 text-[#0f766e] hover:scale-110 hover:bg-[#0f766e] hover:text-white hover:shadow-md"
                : "bg-slate-200/80 text-slate-500 hover:scale-110 hover:bg-[#0f766e] hover:text-white hover:shadow-md hover:shadow-[#0f766e]/30 lg:opacity-0 lg:group-hover:opacity-100"
            }`}>
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 transition-transform duration-200 hover:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M10 4.5v11M4.5 10h11" /></svg>
          </Link>
        )}
      </li>
    );
  }

  const list = (
      <ul className="space-y-0.5"
        onMouseEnter={() => clearTimeout(leaveTimer.current)}
        // Si abriste un grupo y sacas el mouse sin elegir nada, se vuelve a cerrar
        onMouseLeave={() => { leaveTimer.current = setTimeout(() => setOpen(insideGroups()), 700); }}>
        {items.map((item) => {
          if (!item.children) return entry(item);
          const isOpen = Boolean(open[item.label]);
          const inside = item.children.some((c) => isActive(c.href));
          return (
            <li key={item.label}>
              <button type="button" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [item.label]: !isOpen }))}
                className={`group flex w-full items-center gap-2.5 rounded-lg px-2.5 text-left ${size} transition-colors hover:bg-[#eef7f4] ${inside ? "font-semibold text-[#0b5e57]" : "text-slate-700 hover:text-[#0b1f3a]"}`}>
                {caret(isOpen)}
                {icon(item.icon)}
                <span className="min-w-0 flex-1 truncate">{tn(navKey(item.label))}</span>
              </button>
              {isOpen && (
                <ul className="mt-0.5 space-y-0.5 animate-[bp-fade_0.2s_ease-out]">
                  {item.children.map((c) => entry(c, true))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
  );
  if (embedded) return list;

  return (
    <nav className="flex-1 overflow-y-auto px-2.5 py-3">
      {/* Ícono de la app actual (sencillo, sin borde ni sombreado).
          Celular: al lado, "Apps" abre la pantalla completa para cambiar de app.
          Computadora (paso 6.3): DesktopNav (acordeón de apps). */}
      <div className="mb-2 flex items-center gap-2 px-2">
        {mobile ? (
          <span title={tn(navKey(APP_TITLE[app].label))} aria-label={tn(navKey(APP_TITLE[app].label))} className="flex">
            {app === "finance" ? <FinanceArt size={40} /> : app === "inventory" ? <InventoryArt size={40} /> : app === "jobs" ? <JobsArt size={40} /> : <QrArt size={40} />}
          </span>
        ) : (
          <span className="flex">{appArt(app, 34)}</span>
        )}
        {mobile && (
          <button type="button" onClick={() => setAppsOpen(true)}
            className="group ml-1 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[15px] font-semibold text-[#0f766e] transition-colors active:bg-[#d7f1eb]">
            <svg viewBox="0 0 24 24" className="h-5 w-5 transition-transform duration-300 group-active:scale-90" fill="currentColor" aria-hidden="true">
              {[5, 12, 19].map((cy) => [5, 12, 19].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.9" />))}
            </svg>
            {t("apps")}
          </button>
        )}
      </div>
      {mobile && appsOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[95] flex flex-col bg-white animate-[bp-sheet-up_0.25s_ease-out]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <p className="text-[19px] font-semibold text-[#0b1f3a]">{t("apps")}</p>
              <p className="text-[13px] text-slate-500">{t("chooseApp")}</p>
            </div>
            <button type="button" onClick={() => setAppsOpen(false)} aria-label={tc("close")}
              className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition-all hover:rotate-90 hover:bg-red-50 hover:text-red-600">
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <AppsGrid role={role} onPick={() => { setAppsOpen(false); onNavigate?.(); }} />
          </div>
        </div>,
        document.body,
      )}
      {list}
      {/* Celular: opción discreta para instalar la app (solo si Chrome lo permite y aún no está instalada) */}
      {mobile && installApp.can && (
        <button type="button" onClick={installApp.install}
          className="group mt-3 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-[15px] text-[#0f766e] transition-colors hover:bg-[#d7f1eb]">
          <svg viewBox="0 0 24 24" className="h-5 w-5 transition-transform duration-300 group-hover:translate-y-0.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v11M7.5 9.5 12 14l4.5-4.5M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" /></svg>
          {t("installApp")}
        </button>
      )}
    </nav>
  );
}

export default function AppShell({
  user,
  companies,
  currentId,
  children,
}: {
  user: CurrentUser;
  companies: CompanySummary[];
  currentId: string | null;
  children: React.ReactNode;
}) {
  const t = useTranslations("shell");
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const pathname = usePathname();
  const role = companies.find((c) => c.id === currentId)?.role ?? null;
  // Logo → inicio de la app donde estás (Finances, Inventory o QR Studio). El técnico va a su van.
  const appNow = appOf(pathname || "");
  const homeHref = role === "technician" ? (appNow === "inventory" ? "/dashboard/inventory/van" : "/dashboard/jobs/mine")
    : appNow === "inventory" ? "/dashboard/inventory" : appNow === "jobs" ? "/dashboard/jobs" : appNow === "qr" ? "/dashboard/tools/qr" : "/dashboard";

  // Paso 6.17: al cerrar la ventana de Settings se regresa a la última pantalla de la app
  useEffect(() => {
    if (!pathname || pathname.startsWith(GLOBAL_SETTINGS) || pathname.startsWith(ACCOUNT)) return;
    try { sessionStorage.setItem(LAST_APP_KEY, pathname); } catch { /* sin almacenamiento */ }
  }, [pathname]);

  // Presencia: cada minuto avisa que la app está abierta y si la persona la está usando (para Team: verde / naranja / rojo)
  useEffect(() => {
    if (!currentId) return;
    let last = Date.now();
    const mark = () => { last = Date.now(); };
    const ping = () => {
      if (document.visibilityState !== "visible") return;
      createClient().rpc("touch_presence", { p_company: currentId, p_active: Date.now() - last < 2 * 60000 }).then(() => {}, () => {});
    };
    const evs = ["pointerdown", "keydown", "mousemove", "scroll", "touchstart"] as const;
    evs.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    const onVis = () => { if (document.visibilityState === "visible") { mark(); ping(); } };
    document.addEventListener("visibilitychange", onVis);
    ping();
    const t = setInterval(ping, 60000);
    return () => { clearInterval(t); evs.forEach((e) => window.removeEventListener(e, mark)); document.removeEventListener("visibilitychange", onVis); };
  }, [currentId]);

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <NotificationsProvider companyId={currentId} userId={user.id} enabled={Boolean(role)} tech={Boolean(role && !canManageSales(role))}>
    <div data-bp-ready className="min-h-screen bg-[#f4f6f8] lg:pl-64">
      {/* Menú fijo en computadora */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-[#dfe7ee] bg-[#f4f7fa] lg:flex">
        <div className="flex h-16 items-center border-b border-[#cde8e0] bg-[#e7f5f1] px-6">
          <Link prefetch={false} href={homeHref} aria-label="BrightPro home" className="transition-opacity hover:opacity-80">
            <Image src="/logo-brightpro.png" alt="BrightPro" width={140} height={38} className="h-8 w-auto" priority />
          </Link>
        </div>
        <DesktopNav role={role} />
      </aside>

      {/* Menú deslizable en celular */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label={t("closeMenu")} onClick={() => setMenuOpen(false)} className="absolute inset-0 bg-slate-900/30" />
          <aside className="absolute inset-y-0 left-0 flex w-[74%] max-w-[290px] flex-col bg-[#f4f7fa] shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-[#cde8e0] bg-[#e7f5f1] px-5">
              <Link prefetch={false} href={homeHref} onClick={() => setMenuOpen(false)} aria-label="BrightPro home">
                <Image src="/logo-brightpro.png" alt="BrightPro" width={130} height={36} className="h-7 w-auto" />
              </Link>
              <button type="button" onClick={() => setMenuOpen(false)} aria-label={t("closeMenu")} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                  <path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" />
                </svg>
              </button>
            </div>
            <button type="button" onClick={() => { setMenuOpen(false); setProfileOpen(true); }}
              className="flex w-full items-center gap-3 border-b border-slate-100 px-5 py-4 text-left hover:bg-slate-50">
              <Avatar name={user.fullName || user.email} url={user.avatarUrl} seed={user.id} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-[#0b1f3a]">{user.fullName || t("yourName")}</p>
                <p className="truncate text-sm text-slate-500">{user.email}</p>
              </div>
              <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-slate-300" fill="currentColor"><path d="M7.5 5 12.5 10l-5 5" /></svg>
            </button>
            <NavList role={role} onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <AppHeader user={user} companies={companies} currentId={currentId} onMenu={() => setMenuOpen(true)} onOpenProfile={() => setProfileOpen(true)} />
      <ProfilePanel user={user} companies={companies} currentId={currentId} open={profileOpen} onClose={() => setProfileOpen(false)} />
      <main>{children}</main>
    </div>
    </NotificationsProvider>
  );
}
