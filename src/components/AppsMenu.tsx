"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FinanceArt, QrArt } from "@/components/AppIcons";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { Role } from "@/lib/types";

// Apps por CATEGORÍA (no cada función suelta). Cada app abre su propio menú lateral.
//   · Finances: Home, clientes, ventas, catálogo, entradas de dinero y gastos
//   · QR Studio: códigos QR con tu marca
// Cuando salgan Trabajos/Seguimiento o Inventario, se agregan aquí como apps nuevas.
type App = { id: "finance" | "qr"; label: string; href: string; icon: string; tone: [string, string, string]; hint: string; parts: string[] };
export const APPS: App[] = [
  { id: "finance", label: "Finances", href: "/dashboard", icon: "M12 2.5v19M16.6 6.6c-.6-1.6-2.4-2.6-4.6-2.6-2.6 0-4.6 1.3-4.6 3.4 0 4.8 9.4 2.5 9.4 7.4 0 2.1-2.1 3.5-4.8 3.5-2.4 0-4.4-1.1-5-2.9",
    tone: ["#e6f6f2", "#c9ede3", "#0f766e"], hint: "Sales, customers and your money", parts: ["Customers", "Quotes", "Invoices", "Catalog", "Money In", "Expenses"] },
  { id: "qr", label: "QR Studio", href: "/dashboard/tools/qr", icon: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2v2h-2zM18 14h2v2h-2z",
    tone: ["#eef2ff", "#dfe4ff", "#4f46e5"], hint: "Branded QR codes for vans, flyers and reviews", parts: ["Website", "Reviews", "WhatsApp", "Wi-Fi"] },
];

export function AppsGrid({ onPick, layout = "grid" }: { role?: Role | null; onPick?: () => void; layout?: "grid" | "wide" | "stack" }) {
  const stack = layout === "stack";
  const path = usePathname() || "";
  const current = path.startsWith("/dashboard/tools/qr") ? "qr" : "finance";
  return (
    <div className={`grid ${stack ? "gap-2" : "gap-3"} ${layout === "wide" ? "grid-cols-2" : stack ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
      {APPS.map((a, i) => {
        const on = current === a.id;
        return (
          <Link prefetch={false} key={a.id} href={a.href} onClick={() => onPick?.()} style={{ animationDelay: `${i * 40}ms` }}
            className={`group/app flex items-start ${stack ? "gap-2.5 p-2.5" : "gap-3.5 p-4"} rounded-2xl border text-left transition-all duration-200 animate-[bp-fade_0.35s_ease-out_both] hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,40,60,0.10)] active:scale-[0.98] ${on ? "border-[#0f766e] bg-[#f3fbf8]" : "border-slate-200 bg-white hover:border-[#14a39a]"}`}>
            <span className="flex shrink-0 items-center justify-center transition-transform duration-300 group-hover/app:-rotate-3 group-hover/app:scale-105">
              {a.id === "finance" ? <FinanceArt size={stack ? 40 : 56} /> : <QrArt size={stack ? 40 : 56} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-[15px] font-semibold text-[#0b1f3a]">{a.label}{on && <span className="rounded-full bg-[#0f766e] px-2 py-0.5 text-[10px] font-semibold text-white">Open</span>}</span>
              <span className="mt-0.5 block text-[12.5px] leading-snug text-slate-500">{a.hint}</span>
              <span className={`mt-2 flex-wrap gap-1 ${stack ? "hidden" : "flex"}`}>
                {a.parts.map((p) => <span key={p} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-medium text-slate-500">{p}</span>)}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

// Escritorio: botón de 9 puntos que abre un súper menú horizontal de lado a lado, debajo de la barra de arriba
export default function AppsMenu({ role }: { role: Role | null }) {
  return (
    <Popover>
      <PopoverButton aria-label="All apps"
        className="group flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none data-[open]:bg-[#e9f7f4] data-[open]:text-[#0f766e]">
        <svg viewBox="0 0 24 24" className="h-5 w-5 transition-transform duration-500 group-hover:rotate-45 group-data-[open]:rotate-90" fill="currentColor" aria-hidden="true">
          {[5, 12, 19].map((cy) => [5, 12, 19].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.8" />))}
        </svg>
      </PopoverButton>
      {/* Panel horizontal pegado a la derecha: las apps por categoría, una al lado de la otra */}
      <PopoverPanel anchor="bottom end" transition
        className="z-50 mt-2 w-[min(40rem,calc(100vw-2rem))] origin-top-right rounded-3xl border border-slate-200/80 bg-white p-4 shadow-[0_24px_60px_rgba(15,40,60,0.2)] transition duration-200 ease-out data-[closed]:scale-95 data-[closed]:opacity-0">
        {({ close }) => (
          <>
            <div className="flex items-center justify-between px-1 pb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">All apps</p>
              <span className="text-[11px] text-slate-400">Bright<b className="text-[#e8713a]">Pro</b></span>
            </div>
            <AppsGrid role={role} layout="wide" onPick={() => close()} />
          </>
        )}
      </PopoverPanel>
    </Popover>
  );
}
