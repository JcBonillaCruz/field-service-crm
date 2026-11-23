"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import SelectMenu from "@/components/ui/SelectMenu";
import { OutIcon, groupsFor, itemAt } from "@/components/settings/SettingsHub";
import type { Role } from "@/lib/types";

// =====================================================================
// Settings como ventana flotante (Paso 6.17), igual que Inventory settings:
// fondo gris, menú a la izquierda y la pantalla elegida a la derecha. Cada pantalla de /dashboard/settings/* se pinta aquí adentro.
// Celular: pantalla completa, con un selector arriba en lugar del menú.
// =====================================================================
export const LAST_APP_KEY = "bp_last_app"; // a dónde regresar al cerrar (lo guarda AppShell)

export default function SettingsWindow({ role, company, children }: { role: Role | null; company: string; children: React.ReactNode }) {
  const t = useTranslations("settingsHub");
  const tc = useTranslations("common");
  const router = useRouter();
  const path = usePathname() || "";
  const groups = groupsFor(role);
  const here = itemAt(path);
  const home = path === "/dashboard/settings";
  const close = () => {
    let to = "/dashboard";
    try { to = sessionStorage.getItem(LAST_APP_KEY) || to; } catch { /* sin almacenamiento */ }
    router.push(to);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector("[role=dialog]")) close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const X = ({ cls }: { cls: string }) => (
    <button type="button" onClick={close} aria-label={tc("close")} className={`group/x shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-600 ${cls}`}>
      <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform duration-300 group-hover/x:rotate-90" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
    </button>
  );
  const navItem = (href: string, icon: string, label: string, on: boolean, out = false) => (
    <Link key={href} prefetch={false} href={href} aria-current={on ? "page" : undefined}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-left text-[14px] transition-colors ${on ? "bg-[#dcf2ec] font-semibold text-[#0b5e57]" : "text-slate-700 hover:bg-[#eef7f4]"}`}>
      <svg viewBox="0 0 24 24" className="h-[19px] w-[19px] shrink-0 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {out && <span className="text-slate-300 group-hover:text-slate-500"><OutIcon /></span>}
    </Link>
  );
  const HOME_ICON = "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z";
  const options = [{ value: "/dashboard/settings", label: t("allSettings") },
    ...groups.flatMap((g) => g.items.map((i) => ({ value: i.href, label: `${t(`i.${i.key}`)}${i.out ? " ↗" : ""}` })))];

  return (
    <div className="fixed inset-0 z-[65] flex items-stretch justify-center bg-slate-900/45 p-0 backdrop-blur-[2px] sm:p-6 lg:p-10"
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex w-full max-w-[1240px] flex-col overflow-hidden bg-[#f6f8f9] shadow-2xl sm:rounded-3xl lg:flex-row">
        {/* Menú (computadora) · encabezado + selector (celular) */}
        <aside className="shrink-0 border-b border-slate-200 bg-white lg:flex lg:w-72 lg:flex-col lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
            <div className="min-w-0"><h1 className="truncate text-[19px] font-semibold text-[#0b1f3a]">{t("title")}</h1><p className="truncate text-[12.5px] text-slate-500">{company}</p></div>
            <X cls="flex h-9 w-9 lg:hidden" />
          </div>
          <div className="px-4 pb-3 lg:hidden">
            <SelectMenu ariaLabel={t("menu")} value={home ? "/dashboard/settings" : here?.href ?? "/dashboard/settings"} options={options} onChange={(v) => router.push(v)} />
          </div>
          <nav className="hidden min-h-0 flex-1 overflow-y-auto px-3 pb-4 lg:block">
            {navItem("/dashboard/settings", HOME_ICON, t("allSettings"), home)}
            {groups.map((g) => (
              <div key={g.key} className="mt-4">
                <p className="px-3 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-400">{t(`g.${g.key}`)}</p>
                <div className="space-y-0.5">{g.items.map((i) => navItem(i.href, i.icon, t(`i.${i.key}`), here?.key === i.key, i.out))}</div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Pantalla elegida */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="hidden items-center justify-between gap-4 border-b border-slate-200 bg-white px-7 py-4 lg:flex">
            <div className="min-w-0">
              <h2 className="truncate text-[18px] font-semibold text-[#0b1f3a]">{here ? t(`i.${here.key}`) : t("allSettings")}</h2>
              <p className="truncate text-[13px] text-slate-500">{here ? t(`d.${here.key}`) : t("homeSub")}</p>
            </div>
            <X cls="flex h-10 w-10" />
          </div>
          <div className="bp-settings-pane min-h-0 flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}
