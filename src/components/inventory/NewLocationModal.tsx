"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/sales/SalesBits";

// Paso 6.12 · Botón New → ventana con dos tarjetas: Van / Truck o Warehouse. Después abre el formulario completo.
import { VanArt, WarehouseArt } from "@/components/inventory/InvArt";
export { VanArt, WarehouseArt };

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
