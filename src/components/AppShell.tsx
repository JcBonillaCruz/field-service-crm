"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import ProfilePanel from "@/components/ProfilePanel";
import Avatar from "@/components/Avatar";
import NotificationsProvider from "@/components/NotificationsProvider";
import { AppsGrid } from "@/components/AppsMenu";
import { useInstallApp } from "@/components/InstallPrompt";
import { FinanceArt, QrArt } from "@/components/AppIcons";
import { canManageSales } from "@/lib/sales";
import { CompanySummary, CurrentUser, Role } from "@/lib/types";

type NavItem = {
  label: string;
  href?: string;
  addHref?: string; // botón "+" para crear directo desde el menú
  icon: string;
  roles?: Role[];
  children?: NavItem[]; // grupo plegable (ej. Product Catalog → Items, Coupons)
};

// Íconos de línea (24 px). "roles": quién ve cada opción. Sin "roles", la ven todos.
// La app se divide en APPS: cada app tiene su propio menú lateral.
//   · Finances: clientes, ventas, catálogo y dinero (todo lo que hay hoy)
//   · QR Studio: su propio menú
// Cuando hagamos Trabajos/Seguimiento o Inventario, cada uno será otra app con su menú.
export type AppId = "finance" | "qr";
export const appOf = (path: string): AppId => (path.startsWith("/dashboard/tools/qr") ? "qr" : "finance");

const SETTINGS: NavItem = { label: "Settings", href: "/dashboard/settings", icon: "M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1M15 5v4M9 10v4M17 15v4", roles: ["owner", "manager"] };

const FINANCE_NAV: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: "M4 10.2 12 4l8 6.2V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" },
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
    ] },
  { label: "Payments", icon: "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18M7 15h3", roles: ["owner", "manager"] },
  { label: "Reports", icon: "M4 4v16h16M8.5 16v-4M12.5 16V8M16.5 16v-6", roles: ["owner", "manager"] },
  { label: "Team", icon: "M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6", roles: ["owner", "manager"] },
  SETTINGS,
];

const QR_NAV: NavItem[] = [
  { label: "Create QR code", href: "/dashboard/tools/qr", icon: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2zM6.5 6.5h1M16.5 6.5h1M6.5 16.5h1" },
  { label: "My QR codes", icon: "M4 5h16v14H4zM4 9h16M8 13h3M8 16h6" },
  { label: "Scan stats", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  SETTINGS,
];
const NAV_BY_APP: Record<AppId, NavItem[]> = { finance: FINANCE_NAV, qr: QR_NAV };
const APP_TITLE: Record<AppId, { label: string; icon: string; color: string }> = {
  finance: { label: "Finances", icon: "M12 2.5v19M16.6 6.6c-.6-1.6-2.4-2.6-4.6-2.6-2.6 0-4.6 1.3-4.6 3.4 0 4.8 9.4 2.5 9.4 7.4 0 2.1-2.1 3.5-4.8 3.5-2.4 0-4.4-1.1-5-2.9", color: "#0f766e" },
  qr: { label: "QR Studio", icon: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2v2h-2zM18 14h2v2h-2z", color: "#4f46e5" },
};

function NavList({ role, onNavigate }: { role: Role | null; onNavigate?: () => void }) {
  const pathname = usePathname();
  const app = appOf(pathname);
  const NAV = NAV_BY_APP[app];
  const items = NAV.filter((i) => !i.roles || (role && i.roles.includes(role)));
  const isActive = (href?: string) => Boolean(href && (href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href)));
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
  const activeCls = mobile
    ? "bg-[#dff3ee] font-semibold text-[#0f766e]"   // suavecito, como la app de Zoho
    : "bg-[radial-gradient(120%_140%_at_50%_120%,#2bb3a4_0%,#1a8f84_45%,#167d74_100%)] font-semibold text-white shadow-[0_4px_14px_rgba(15,118,110,0.22)]";

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
        {!child && icon(item.icon)}
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {!item.href && <span className="shrink-0 rounded-full bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">Soon</span>}
      </>
    );
    const base = `flex items-center gap-2.5 rounded-lg transition-all duration-150 ${size} ${child ? (mobile ? "pl-[3.6rem] pr-2.5" : "pl-[3.35rem] pr-2.5") : "px-2.5"} ${showAdd ? "pr-10" : ""}`;
    const singular = item.label.replace(/s$/, "");
    return (
      <li key={item.label} className="group relative">
        {item.href ? (
          <Link prefetch={false} href={item.href} onClick={onNavigate}
            className={`${base} ${active ? activeCls : "text-slate-700 hover:bg-[#d7f1eb] hover:text-[#0b1f3a] active:bg-[#c3eadf]"}`}>
            {content}
          </Link>
        ) : (
          <span className={`${base} cursor-default text-slate-400`} aria-disabled="true">{content}</span>
        )}
        {showAdd && item.addHref && (
          <Link prefetch={false} href={item.addHref} onClick={onNavigate} aria-label={`New ${singular}`} title={`New ${singular}`}
            className={`absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md transition-all duration-150 focus:opacity-100 ${
              active
                ? "bg-white/25 text-white hover:scale-110 hover:bg-white hover:text-[#0f766e] hover:shadow-md"
                : "bg-slate-200/80 text-slate-500 hover:scale-110 hover:bg-[#0f766e] hover:text-white hover:shadow-md hover:shadow-[#0f766e]/30 lg:opacity-0 lg:group-hover:opacity-100"
            }`}>
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 transition-transform duration-200 hover:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M10 4.5v11M4.5 10h11" /></svg>
          </Link>
        )}
      </li>
    );
  }

  return (
    <nav className="flex-1 overflow-y-auto px-2.5 py-3"
      onMouseEnter={() => clearTimeout(leaveTimer.current)}
      // Si abriste un grupo y sacas el mouse del menú sin elegir nada, se vuelve a cerrar
      onMouseLeave={() => { leaveTimer.current = setTimeout(() => setOpen(insideGroups()), 700); }}>
      {/* Ícono de la app actual (sencillo, sin borde ni sombreado).
          Celular: al lado, "Apps" abre la pantalla completa para cambiar de app.
          Computadora: solo el ícono (allá se cambia con los 9 puntos de arriba). */}
      <div className="mb-2 flex items-center gap-2 px-2">
        <span title={APP_TITLE[app].label} aria-label={APP_TITLE[app].label} className="flex">
          {app === "finance" ? <FinanceArt size={mobile ? 40 : 34} /> : <QrArt size={mobile ? 40 : 34} />}
        </span>
        {mobile && (
          <button type="button" onClick={() => setAppsOpen(true)}
            className="group ml-1 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[15px] font-semibold text-[#0f766e] transition-colors active:bg-[#d7f1eb]">
            <svg viewBox="0 0 24 24" className="h-5 w-5 transition-transform duration-300 group-active:scale-90" fill="currentColor" aria-hidden="true">
              {[5, 12, 19].map((cy) => [5, 12, 19].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.9" />))}
            </svg>
            Apps
          </button>
        )}
      </div>
      {mobile && appsOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[95] flex flex-col bg-white animate-[bp-sheet-up_0.25s_ease-out]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <p className="text-[19px] font-semibold text-[#0b1f3a]">Apps</p>
              <p className="text-[13px] text-slate-500">Choose where you want to work</p>
            </div>
            <button type="button" onClick={() => setAppsOpen(false)} aria-label="Close"
              className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition-all hover:rotate-90 hover:bg-red-50 hover:text-red-600">
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <AppsGrid onPick={() => { setAppsOpen(false); onNavigate?.(); }} />
          </div>
        </div>,
        document.body,
      )}
      <ul className="space-y-0.5">
        {items.map((item) => {
          if (!item.children) return entry(item);
          const isOpen = Boolean(open[item.label]);
          const inside = item.children.some((c) => isActive(c.href));
          return (
            <li key={item.label}>
              <button type="button" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [item.label]: !isOpen }))}
                className={`group flex w-full items-center gap-2.5 rounded-lg px-2.5 text-left ${size} transition-colors hover:bg-[#d7f1eb] ${inside ? "bg-[#e9f7f4] font-semibold text-[#0f766e]" : "text-slate-700 hover:text-[#0b1f3a]"}`}>
                {caret(isOpen)}
                {icon(item.icon)}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
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
      {/* Celular: opción discreta para instalar la app (solo si Chrome lo permite y aún no está instalada) */}
      {mobile && installApp.can && (
        <button type="button" onClick={installApp.install}
          className="group mt-3 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-[15px] text-[#0f766e] transition-colors hover:bg-[#d7f1eb]">
          <svg viewBox="0 0 24 24" className="h-5 w-5 transition-transform duration-300 group-hover:translate-y-0.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v11M7.5 9.5 12 14l4.5-4.5M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" /></svg>
          Install BrightPro app
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const pathname = usePathname();
  const role = companies.find((c) => c.id === currentId)?.role ?? null;

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <NotificationsProvider companyId={currentId} userId={user.id} enabled={Boolean(role && canManageSales(role))}>
    <div data-bp-ready className="min-h-screen bg-[#f4f6f8] lg:pl-64">
      {/* Menú fijo en computadora */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-[#dfe7ee] bg-[#f4f7fa] lg:flex">
        <div className="flex h-16 items-center border-b border-[#cde8e0] bg-[#e7f5f1] px-6">
          <Image src="/logo-brightpro.png" alt="BrightPro" width={140} height={38} className="h-8 w-auto" priority />
        </div>
        <NavList role={role} />
      </aside>

      {/* Menú deslizable en celular */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} className="absolute inset-0 bg-slate-900/30" />
          <aside className="absolute inset-y-0 left-0 flex w-[74%] max-w-[290px] flex-col bg-[#f4f7fa] shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-[#cde8e0] bg-[#e7f5f1] px-5">
              <Image src="/logo-brightpro.png" alt="BrightPro" width={130} height={36} className="h-7 w-auto" />
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                  <path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" />
                </svg>
              </button>
            </div>
            <button type="button" onClick={() => { setMenuOpen(false); setProfileOpen(true); }}
              className="flex w-full items-center gap-3 border-b border-slate-100 px-5 py-4 text-left hover:bg-slate-50">
              <Avatar name={user.fullName || user.email} url={user.avatarUrl} seed={user.id} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-[#0b1f3a]">{user.fullName || "Your name"}</p>
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
