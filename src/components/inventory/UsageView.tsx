"use client";

import { useMemo } from "react";
import { MOVE_LABEL, MoveKind, qtyFmt } from "@/lib/inventory";
import type { MoveRow } from "@/lib/inventory-server";
import { card, fmtWhen, pageWrap } from "@/components/inventory/PageBits";

// Técnico: lo que usó, lo que le resurtieron y lo que salió en los conteos de su van (últimos 60 días)
export default function UsageView({ moves, userId }: { moves: MoveRow[]; userId: string }) {
  const sum = (f: (m: MoveRow) => boolean) => moves.filter(f).reduce((s, m) => s + m.qty, 0);
  const used = useMemo(() => sum((m) => m.kind === "use" && (m.actor_id === userId || m.responsible_id === userId)), [moves]); // eslint-disable-line react-hooks/exhaustive-deps
  const restocked = useMemo(() => sum((m) => m.kind === "transfer"), [moves]); // eslint-disable-line react-hooks/exhaustive-deps
  const missing = useMemo(() => sum((m) => m.kind === "count" && m.reason === "Missing"), [moves]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`${pageWrap} mx-auto max-w-2xl`}>
      <h1 className="text-[22px] font-semibold tracking-tight text-[#0b1f3a]">My Usage</h1>
      <p className="text-[13.5px] text-slate-500">The last 60 days in your van.</p>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {[["Used", used, "text-[#0b1f3a]"], ["Restocked", restocked, "text-[#0b1f3a]"], ["Missing", missing, missing > 0 ? "text-[#be123c]" : "text-[#0b1f3a]"]].map(([k, v, c]) => (
          <div key={k as string} className={`${card} p-3.5`}><p className="text-[12.5px] text-slate-500">{k as string}</p><p className={`text-[22px] font-semibold tabular-nums ${c}`}>{qtyFmt(v as number)}</p></div>
        ))}
      </div>
      {moves.length === 0 ? <p className={`${card} mt-5 px-4 py-10 text-center text-sm text-slate-500`}>Nothing yet. Scan parts when you use them.</p> : (
        <ul className={`${card} mt-5 divide-y divide-slate-100 overflow-hidden`}>
          {moves.map((m) => (
            <li key={m.id} className="px-4 py-3">
              <p className="truncate text-[15px] text-slate-800"><b className="font-semibold">{MOVE_LABEL[m.kind as MoveKind] ?? m.kind}</b> · {qtyFmt(m.qty)} × {m.items?.name}</p>
              <p className="truncate text-[12.5px] text-slate-500">{[m.reason, m.note, fmtWhen(m.created_at)].filter(Boolean).join(" · ")}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
