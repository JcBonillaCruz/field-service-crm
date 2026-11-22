"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Plan } from "@/lib/maintenance";
import { usePlanTx } from "@/i18n/usePlanTx";

// Paso 6.2b2: los planes de mantenimiento en la ficha del cliente, en el idioma de quien lo ve
export default function CustomerPlansList({ plans }: { plans: Plan[] }) {
  const t = useTranslations("custDetail");
  const px = usePlanTx();
  if (plans.length === 0) return <p className="text-sm text-slate-500">{t("noPlan")}</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {plans.map((p) => { const st = px.planState(p); return (
        <li key={p.id}>
          <Link prefetch={false} href={`/dashboard/jobs/plans/${p.id}`} className="flex items-center gap-3 py-2.5 transition-colors hover:bg-[#f6fbfa]">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-[#0b1f3a]">{p.name}</span>
              <span className="block truncate text-xs text-slate-500">{px.freqLabel(p)} · {p.next_visit ? t("nextVisit", { d: px.whenText(p.next_visit) }) : p.status === "active" && p.next_due ? t("nextVisit", { d: px.dayText(p.next_due) }) : t("noVisit")}</span>
            </span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
          </Link>
        </li>
      ); })}
    </ul>
  );
}
