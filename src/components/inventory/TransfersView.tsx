"use client";

import { useEffect, useMemo, useState } from "react";
import { Toast } from "@/components/sales/SalesBits";
import { InvLocation, qtyFmt } from "@/lib/inventory";
import type { MoveRow } from "@/lib/inventory-server";
import { EmptyBox, Fab, NewButton, PageHead, card, fmtWhen, pageWrap } from "@/components/inventory/PageBits";

// Historial de transferencias, agrupadas por envío
export default function TransfersView({ locations, moves, done }: { locations: InvLocation[]; moves: MoveRow[]; done: number }) {
  const [toast, setToast] = useState(done ? `Transfer saved · ${done} item${done === 1 ? "" : "s"}` : "");
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(""), 2600); return () => clearTimeout(t); } }, [toast]);
  const name = (id: string | null) => locations.find((l) => l.id === id)?.name ?? "—";
  const groups = useMemo(() => {
    const map = new Map<string, MoveRow[]>();
    moves.forEach((m) => { const k = m.batch_id ?? m.id; map.set(k, [...(map.get(k) ?? []), m]); });
    return Array.from(map.values());
  }, [moves]);
  return (
    <div className={pageWrap}>
      <PageHead title="Transfers" subtitle="Move parts between the warehouse and your vans. Every transfer is signed.">
        <NewButton href="/dashboard/inventory/transfers/new" />
      </PageHead>
      {groups.length === 0 ? (
        <EmptyBox title="No transfers yet" text="Restock a technician's van from the warehouse. You can add several parts at once or scan them.">
          <NewButton href="/dashboard/inventory/transfers/new" label="New transfer" />
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
                    {f.kind === "return" && <span className="rounded-full bg-[#f1ebff] px-2 py-0.5 text-[11px] font-semibold text-[#7c3aed]">Return</span>}
                  </p>
                  <p className="text-[12.5px] text-slate-500">{[f.actor_name, fmtWhen(f.created_at)].filter(Boolean).join(" · ")}</p>
                </div>
                <p className="mt-2 text-[14px] text-slate-600">{g.map((m) => `${qtyFmt(m.qty)} × ${m.items?.name ?? "item"}`).join(" · ")}</p>
                {f.note && <p className="mt-1 text-[13px] italic text-slate-500">{f.note}</p>}
              </li>
            );
          })}
        </ul>
      )}
      <Fab href="/dashboard/inventory/transfers/new" label="New transfer" />
      <Toast text={toast} />
    </div>
  );
}
