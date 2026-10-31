"use client";

import Link from "next/link";
import { useMemo } from "react";
import { InvLocation, qtyFmt, usd } from "@/lib/inventory";
import type { MoveRow } from "@/lib/inventory-server";
import { EmptyBox, Fab, NewButton, PageHead, card, fmtWhen, pageWrap } from "@/components/inventory/PageBits";

// Conteos físicos hechos (uno por ubicación y fecha) con lo que faltó y quién es responsable
export default function CountsView({ locations, moves }: { locations: InvLocation[]; moves: MoveRow[] }) {
  const name = (id: string | null) => locations.find((l) => l.id === id)?.name ?? "—";
  const groups = useMemo(() => {
    const map = new Map<string, MoveRow[]>();
    moves.forEach((m) => { const k = m.batch_id ?? m.id; map.set(k, [...(map.get(k) ?? []), m]); });
    return Array.from(map.values()).map((g) => {
      const missing = g.filter((m) => m.reason === "Missing");
      return {
        id: g[0].batch_id ?? g[0].id, at: g[0].created_at, by: g[0].actor_name, loc: name(g[0].from_location ?? g[0].to_location), items: g.length,
        missing: missing.reduce((s, m) => s + m.qty, 0), missingCost: missing.reduce((s, m) => s + m.qty * (m.unit_cost ?? 0), 0),
        extra: g.filter((m) => m.reason === "Extra found").reduce((s, m) => s + m.qty, 0), resp: missing.find((m) => m.responsible_name)?.responsible_name ?? null,
        lines: missing.map((m) => `${qtyFmt(m.qty)} × ${m.items?.name ?? "item"}`),
      };
    });
  }, [moves]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={pageWrap}>
      <PageHead title="Counts" subtitle="Count what's really in a van or the warehouse. Anything missing is recorded under that van's technician.">
        <NewButton href="/dashboard/inventory/counts/new" />
      </PageHead>
      {groups.length === 0 ? (
        <EmptyBox title="No counts yet" text="Counting a van every week or two is the best way to know who scans and who doesn't.">
          <NewButton href="/dashboard/inventory/counts/new" label="New count" />
        </EmptyBox>
      ) : (
        <ul className="mt-5 space-y-3">
          {groups.map((g) => (
            <li key={g.id} className={`${card} p-4`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[15px] font-semibold text-[#0b1f3a]">{g.loc}</p>
                  <p className="text-[12.5px] text-slate-500">{[`${g.items} item${g.items === 1 ? "" : "s"} counted`, g.by, fmtWhen(g.at)].filter(Boolean).join(" · ")}</p>
                </div>
                {g.missing > 0
                  ? <span className="rounded-full bg-[#fff1f2] px-2.5 py-1 text-[13px] font-semibold text-[#be123c] ring-1 ring-[#fecdd3]">{qtyFmt(g.missing)} missing · {usd(g.missingCost)}</span>
                  : <span className="rounded-full bg-[#e7f6f1] px-2.5 py-1 text-[13px] font-semibold text-[#0f766e] ring-1 ring-[#bfe6da]">All matched</span>}
              </div>
              {g.missing > 0 && <p className="mt-2 text-[14px] text-slate-600">{g.resp ? <b className="font-semibold">{g.resp}: </b> : null}{g.lines.join(" · ")}</p>}
              {g.extra > 0 && <p className="mt-1 text-[13px] text-[#0f766e]">{qtyFmt(g.extra)} extra found</p>}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-[13px] text-slate-500"><Link prefetch={false} href="/dashboard/inventory/reports" className="font-medium text-[#0f766e] hover:underline">Reports</Link> show the missing parts per technician over time.</p>
      <Fab href="/dashboard/inventory/counts/new" label="New count" />
    </div>
  );
}
