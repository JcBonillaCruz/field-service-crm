"use client";

import { useTranslations } from "next-intl";
import { TeamMember } from "@/lib/jobs";
import { OFF_COLOR, OFF_HATCH, TimeOff } from "@/lib/time-off";
import { TechDot } from "@/components/jobs/EventBar";

// Paso 6.5: quién está de descanso ese día (Week y Month). Tocar una pastilla abre el día libre para editarlo.
export default function OffChips({ list, team, onOff, max = 2, center = false }: {
  list: TimeOff[]; team: TeamMember[]; onOff?: (o: TimeOff) => void; max?: number; center?: boolean;
}) {
  const t = useTranslations("sched");
  if (!list.length) return null;
  const more = list.length - max;
  return (
    <span className={`flex min-w-0 flex-wrap items-center gap-1 ${center ? "justify-center" : ""}`}>
      {list.slice(0, max).map((o) => {
        const m = team.find((x) => x.user_id === o.user_id);
        const first = (m?.full_name ?? "").split(" ")[0];
        return (
          <button key={o.id} type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => onOff?.(o)}
            title={`${m?.full_name ?? ""} · ${t(`offKind.${o.kind}` as never)}${o.note ? ` — ${o.note}` : ""}`}
            className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-dashed border-slate-300 py-px pl-px pr-1.5 text-[10.5px] font-semibold text-slate-600 transition-all duration-150 hover:-translate-y-px hover:border-slate-400 hover:text-[#0b1f3a]"
            style={{ background: OFF_HATCH }}>
            {m ? <TechDot t={m} size={15} ring={false} /> : <span className="h-[15px] w-[15px] rounded-full bg-slate-300" />}
            <span className="truncate">{first}</span>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: OFF_COLOR[o.kind] }} />
          </button>
        );
      })}
      {more > 0 && (
        <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => onOff?.(list[max])}
          title={list.slice(max).map((o) => team.find((x) => x.user_id === o.user_id)?.full_name ?? "").join(", ")}
          className="rounded-full bg-slate-100 px-1.5 text-[10.5px] font-semibold text-slate-500 hover:bg-slate-200">+{more}</button>
      )}
    </span>
  );
}
