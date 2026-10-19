"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import ProfilePanel from "@/components/ProfilePanel";
import Avatar from "@/components/Avatar";
import { CompanySummary, CurrentUser, Role } from "@/lib/types";

type NavItem = {
  label: string;
  href?: string;
  addHref?: string; // botón "+" para crear directo desde el menú
  icon: string;
  roles?: Role[];
};

// Íconos de línea (24 px). "roles": quién ve cada opción. Sin "roles", la ven todos.
const NAV: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: "M4 10.2 12 4l8 6.2V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" },
  { label: "Customers", href: "/dashboard/customers", addHref: "/dashboard/customers/new", icon: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18.5 14.2a6.5 6.5 0 0 1 3 5.8", roles: ["owner", "manager", "office"] },
  { label: "Quotes & contracts", icon: "M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4.5M13.5 3 19 8.5M13.5 3v5.5H19M9 12.5h5M9 16h2.5M15 21l5-5-1.8-1.8-5 5V21z", roles: ["owner", "manager", "office"] },
  { label: "Invoices", icon: "M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21zM14.5 8.2c-.4-.7-1.3-1.1-2.5-1.1-1.4 0-2.5.6-2.5 1.6s1.1 1.4 2.5 1.7 2.5.7 2.5 1.7-1.1 1.7-2.5 1.7c-1.2 0-2.1-.4-2.5-1.1M12 5.8v10", roles: ["owner", "manager", "office"] },
  { label: "Payments", icon: "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18M7 15h3", roles: ["owner", "manager"] },
  { label: "Jobs", icon: "M14.7 6.3a4 4 0 0 0-5.4 5.2l-5.8 5.8a1.8 1.8 0 0 0 2.6 2.6l5.8-5.8a4 4 0 0 0 5.2-5.4l-2.5 2.5-2.4-.4-.4-2.4z" },
  { label: "Dispatch", icon: "M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 1 1 13 0c0 5.4-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z", roles: ["owner", "manager", "office"] },
  { label: "Van inventory", icon: "M2.5 7a1 1 0 0 1 1-1h10v10.5h-11zM13.5 9.5h4l3 3.5v3.5h-7zM7 19.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" },
  { label: "Time tracking", icon: "M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 1.5M10 2.5h4M18.5 6.2l1.5-1.5" },
  { label: "Reports", icon: "M4 4v16h16M8.5 16v-4M12.5 16V8M16.5 16v-6", roles: ["owner", "manager"] },
  { label: "Team", icon: "M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6", roles: ["owner", "manager"] },
  { label: "Settings", icon: "M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1M15 5v4M9 10v4M17 15v4", roles: ["owner", "manager"] },
];

function NavList({ role, onNavigate }: { role: Role | null; onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = NAV.filter((i) => !i.roles || (role && i.roles.includes(role)));

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      <ul className="space-y-0.5">
        {items.map((item) => {
          const active = item.href && (item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href));
          const content = (
            <>
              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 group-hover:animate-[bp-nav-pop_0.5s_ease-out_forwards]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={item.icon} />
              </svg>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {!item.href && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-400">Soon</span>}
            </>
          );
          const base = `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] ${item.addHref ? "pr-11" : ""}`;
          return (
            <li key={item.label} className="group relative">
              {item.href ? (
                <Link href={item.href} onClick={onNavigate}
                  className={`${base} ${active ? "bg-[#e9f7f4] font-semibold text-[#0f766e]" : "text-slate-700 hover:bg-slate-50"}`}>
                  {content}
                </Link>
              ) : (
                <span className={`${base} cursor-default text-slate-400`} aria-disabled="true">{content}</span>
              )}
              {item.addHref && (
                <Link href={item.addHref} onClick={onNavigate} aria-label={`New ${item.label.toLowerCase().replace(/s$/, "")}`} title="Create new"
                  className={`absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[#0f766e] transition-all hover:bg-[#0f766e] hover:text-white focus:opacity-100 ${active ? "bg-white/70" : "lg:opacity-0 lg:group-hover:opacity-100"}`}>
                  <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform duration-200 hover:rotate-90" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M10 4.5v11M4.5 10h11" /></svg>
                </Link>
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
  const [profileOpen, setProfileOpen] = useState(false);
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
  );
}
