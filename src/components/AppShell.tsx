"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import Avatar from "@/components/Avatar";
import { CompanySummary, CurrentUser, Role } from "@/lib/types";

type NavItem = {
  label: string;
  href?: string;
  icon: string;
  roles?: Role[];
};

// "roles": quién ve cada opción. Sin "roles", la ven todos.
const NAV: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { label: "Customers", icon: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8", roles: ["owner", "manager", "office"] },
  { label: "Quotes & contracts", icon: "M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M9 13h6M9 17h4", roles: ["owner", "manager", "office"] },
  { label: "Invoices", icon: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3", roles: ["owner", "manager", "office"] },
  { label: "Payments", icon: "M3 7h18v10H3zM3 11h18M7 15h2", roles: ["owner", "manager"] },
  { label: "Jobs", icon: "M9 6V4h6v2M4 6h16v13H4zM4 12h16", },
  { label: "Dispatch", icon: "M4 5h16v15H4zM4 9h16M8 3v4M16 3v4", roles: ["owner", "manager", "office"] },
  { label: "Van inventory", icon: "M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" },
  { label: "Time tracking", icon: "M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 2M9 2h6" },
  { label: "Reports", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2", roles: ["owner", "manager"] },
  { label: "Team", icon: "M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M10 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 8v6M23 11h-6", roles: ["owner", "manager"] },
  { label: "Settings", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z", roles: ["owner", "manager"] },
];

function NavList({ role, onNavigate }: { role: Role | null; onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = NAV.filter((i) => !i.roles || (role && i.roles.includes(role)));

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      <ul className="space-y-0.5">
        {items.map((item) => {
          const active = item.href && pathname === item.href;
          const content = (
            <>
              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={item.icon} />
              </svg>
              <span className="flex-1">{item.label}</span>
              {!item.href && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-400">Soon</span>}
            </>
          );
          const base = "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px]";
          return (
            <li key={item.label}>
              {item.href ? (
                <Link href={item.href} onClick={onNavigate}
                  className={`${base} ${active ? "bg-[#e9f7f4] font-semibold text-[#0f766e]" : "text-slate-700 hover:bg-slate-50"}`}>
                  {content}
                </Link>
              ) : (
                <span className={`${base} cursor-default text-slate-400`} aria-disabled="true">{content}</span>
              )}
            </li>
          );
        })}
      </ul>
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
  const pathname = usePathname();
  const role = companies.find((c) => c.id === currentId)?.role ?? null;

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-[#f4f6f8] lg:pl-64">
      {/* Menú fijo en computadora */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-slate-200 px-6">
          <Image src="/logo-brightpro.png" alt="BrightPro" width={140} height={38} className="h-8 w-auto" priority />
        </div>
        <NavList role={role} />
      </aside>

      {/* Menú deslizable en celular */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} className="absolute inset-0 bg-slate-900/30" />
          <aside className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col bg-white shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
              <Image src="/logo-brightpro.png" alt="BrightPro" width={130} height={36} className="h-7 w-auto" />
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                  <path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
              <Avatar name={user.fullName || user.email} url={user.avatarUrl} seed={user.id} size={44} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-[#0b1f3a]">{user.fullName || "Your name"}</p>
                <p className="truncate text-sm text-slate-500">{user.email}</p>
              </div>
            </div>
            <NavList role={role} onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <AppHeader user={user} companies={companies} currentId={currentId} onMenu={() => setMenuOpen(true)} />
      <main>{children}</main>
    </div>
  );
}
