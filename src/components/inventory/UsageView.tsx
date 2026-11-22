"use client";

import { useTranslations } from "next-intl";
import { useFmt } from "@/i18n/useFmt";
import { useMemo } from "react";
import { MOVE_LABEL, qtyFmt } from "@/lib/inventory";
import type { MoveRow } from "@/lib/inventory-server";
import { card, pageWrap } from "@/components/inventory/PageBits";

// Técnico: lo que usó, lo que le resurtieron y lo que salió en los conteos de su van (últimos 60 días)
export default function UsageView({ moves, userId }: { moves: MoveRow[]; userId: string }) {
  const t = useTranslations("van");
  const fmt = useFmt();
  // Los motivos se guardan en inglés en la base; aquí se muestran traducidos si son de los conocidos
  const REASONS: Record<string, string> = { "Used on a job": "usedOnJob", "Returned to warehouse": "returnedWh", Missing: "missingR", Damaged: "damaged", Found: "found" };
  const reasonOf = (r: string | null) => (r && REASONS[r] ? t(`reason.${REASONS[r]}`) : r);
  const sum = (f: (m: MoveRow) => boolean) => moves.filter(f).reduce((s, m) => s + m.qty, 0);
  const used = useMemo(() => sum((m) => m.kind === "use" && (m.actor_id === userId || m.responsible_id === userId)), [moves]); // eslint-disable-line react-hooks/exhaustive-deps
  const restocked = useMemo(() => sum((m) => m.kind === "transfer"), [moves]); // eslint-disable-line react-hooks/exhaustive-deps
  const missing = useMemo(() => sum((m) => m.kind === "count" && m.reason === "Missing"), [moves]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`${pageWrap} mx-auto max-w-2xl`}>
      <h1 className="text-[22px] font-semibold tracking-tight text-[#0b1f3a]">{t("usageTitle")}</h1>
      <p className="text-[13.5px] text-slate-500">{t("usageSub")}</p>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {[[t("usedK"), used, "text-[#0b1f3a]"], [t("restocked"), restocked, "text-[#0b1f3a]"], [t("missing"), missing, missing > 0 ? "text-[#be123c]" : "text-[#0b1f3a]"]].map(([k, v, c]) => (
          <div key={k as string} className={`${card} p-3.5`}><p className="text-[12.5px] text-slate-500">{k as string}</p><p className={`text-[22px] font-semibold tabular-nums ${c}`}>{qtyFmt(v as number)}</p></div>
        ))}
      </div>
      {moves.length === 0 ? <p className={`${card} mt-5 px-4 py-10 text-center text-sm text-slate-500`}>{t("usageEmpty")}</p> : (
        <ul className={`${card} mt-5 divide-y divide-slate-100 overflow-hidden`}>
          {moves.map((m) => (
            <li key={m.id} className="px-4 py-3">
              <p className="truncate text-[15px] text-slate-800"><b className="font-semibold">{m.kind in MOVE_LABEL ? t(`move.${m.kind}`) : m.kind}</b> · {qtyFmt(m.qty)} × {m.items?.name}</p>
              <p className="truncate text-[12.5px] text-slate-500">{[reasonOf(m.reason), m.note, fmt.dateTime(new Date(m.created_at))].filter(Boolean).join(" · ")}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
