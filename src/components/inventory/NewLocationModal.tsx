"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/sales/SalesBits";

// Paso 6.12 · Botón New → ventana con dos tarjetas: Van / Truck o Warehouse. Después abre el formulario completo.
export function VanArt({ size = 56 }: { size?: number }) {
  return (
    <svg viewBox="0 0 56 56" width={size} height={size} aria-hidden="true">
      <circle cx="28" cy="28" r="26" fill="#fff4ec" />
      <g className="transition-transform duration-300 ease-out group-hover:translate-x-1.5">
        <path d="M9 20h22v16H9z" fill="#fff" stroke="#ea580c" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M31 25h8l5 5.5V36H31z" fill="#ffd2b3" stroke="#ea580c" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M34 27h4.2l2.6 3H34z" fill="#fff" />
        <path d="M13 26h9M13 30h6" stroke="#fdba8c" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="16" cy="38" r="3.6" fill="#0b1f3a" /><circle cx="16" cy="38" r="1.4" fill="#fff" />
        <circle cx="37" cy="38" r="3.6" fill="#0b1f3a" /><circle cx="37" cy="38" r="1.4" fill="#fff" />
      </g>
    </svg>
  );
}
export function WarehouseArt({ size = 56 }: { size?: number }) {
  return (
    <svg viewBox="0 0 56 56" width={size} height={size} aria-hidden="true">
      <circle cx="28" cy="28" r="26" fill="#e6f6f2" />
      <path d="M10 24 28 13l18 11v18H10z" fill="#fff" stroke="#0f766e" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M18 42V29h20v13" fill="#d7f1eb" stroke="#0f766e" strokeWidth="1.6" />
      <g className="transition-transform duration-300 ease-out group-hover:-translate-y-1">
        <path d="M22 33h5v5h-5zM29 33h5v5h-5zM25.5 28h5v5h-5z" fill="#f2a43a" stroke="#b45309" strokeWidth="1" />
      </g>
    </svg>
  );
}

export default function NewLocationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("invNewLoc");
  const cards = [
    { kind: "van", Art: VanArt, title: t("van"), sub: t("vanSub") },
    { kind: "warehouse", Art: WarehouseArt, title: t("warehouse"), sub: t("warehouseSub") },
  ] as const;
  return (
    <Modal open={open} onClose={onClose} title={t("title")} width="max-w-2xl">
      <p className="mb-4 text-[14px] text-slate-600">{t("intro")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map(({ kind, Art, title, sub }) => (
          <Link key={kind} prefetch={false} href={`/dashboard/inventory/locations/new?kind=${kind}`} onClick={onClose}
            className="group flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-6 text-center transition-all duration-200 hover:-translate-y-1 hover:border-[#14a39a] hover:shadow-[0_14px_30px_rgba(15,40,60,0.1)]">
            <Art size={72} />
            <span className="mt-3 text-[17px] font-semibold text-[#0b1f3a] group-hover:text-[#0f766e]">{title}</span>
            <span className="mt-1 text-[13.5px] text-slate-500">{sub}</span>
          </Link>
        ))}
      </div>
    </Modal>
  );
}
