"use client";

import { useEffect, useMemo, useState } from "react";
import { Toast } from "@/components/sales/SalesBits";
import { InvLocation, qtyFmt } from "@/lib/inventory";
import { useTranslations } from "next-intl";
import type { MoveRow } from "@/lib/inventory-server";
import { EmptyBox, Fab, NewButton, PageHead, card, pageWrap, useFmt } from "@/components/inventory/PageBits";

// Historial de transferencias, agrupadas por envío
export default function TransfersView({ locations, moves, done }: { locations: InvLocation[]; moves: MoveRow[]; done: number }) {
  const t = useTranslations("invTransfers");
  const { fmtWhen } = useFmt();
  const [toast, setToast] = useState(done ? t("saved", { n: done }) : "");
  useEffect(() => { if (toast) { const tm = setTimeout(() => setToast(""), 2600); return () => clearTimeout(tm); } }, [toast]);
  const name = (id: string | null) => locations.find((l) => l.id === id)?.name ?? "—";
  const groups = useMemo(() => {
    const map = new Map<string, MoveRow[]>();
    moves.forEach((m) => { const k = m.batch_id ?? m.id; map.set(k, [...(map.get(k) ?? []), m]); });
    return Array.from(map.values());
  }, [moves]);
  return (
    <div className={pageWrap}>
      <PageHead title={t("title")} subtitle={t("subtitle")}>
        <NewButton href="/dashboard/inventory/transfers/new" />
      </PageHead>
      {groups.length === 0 ? (
        <EmptyBox title={t("none")} text={t("noneText")}>
          <NewButton href="/dashboard/inventory/transfers/new" label={t("new")} />
        </EmptyBox>
      ) : (
        <ul className="mt-5 space-y-3">
          {groups.map((g) => {
            const f = g[0];
            return (
              <li key={f.batch_id ?? f.id} className={`${card} p-4`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-[#0b1f3a]">
                    {name(f.from_location)}
                    <svg viewBox="0 0 20 20" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 10h12M12 6l4 4-4 4" /></svg>
                    {name(f.to_location)}
                    {f.kind === "return" && <span className="rounded-full bg-[#f1ebff] px-2 py-0.5 text-[11px] font-semibold text-[#7c3aed]">{t("return")}</span>}
                  </p>
                  <p className="text-[12.5px] text-slate-500">{[f.actor_name, fmtWhen(f.created_at)].filter(Boolean).join(" · ")}</p>
                </div>
                <p className="mt-2 text-[14px] text-slate-600">{g.map((m) => `${qtyFmt(m.qty)} × ${m.items?.name ?? t("item")}`).join(" · ")}</p>
                {f.note && <p className="mt-1 text-[13px] italic text-slate-500">{f.note}</p>}
              </li>
            );
          })}
        </ul>
      )}
      <Fab href="/dashboard/inventory/transfers/new" label={t("new")} />
      <Toast text={toast} />
    </div>
  );
}
