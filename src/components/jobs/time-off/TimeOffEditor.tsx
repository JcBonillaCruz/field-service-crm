"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FormHeader } from "@/components/catalog/FormBits";
import { TimeOffForm } from "@/components/jobs/NewItemModal";
import { TeamMember, dayStart } from "@/lib/jobs";
import { TimeOff } from "@/lib/time-off";

// Paso 6.13b · Asignar / editar un día libre o permiso en pantalla completa (solo el menú y el formulario)
// Usa el mismo formulario del calendario (pestaña "Time off" del modal grande).
export default function TimeOffEditor({ companyId, team, offs, editOff, ready, techId }: {
  companyId: string; team: TeamMember[]; offs: TimeOff[]; editOff: TimeOff | null; ready: boolean; techId?: string | null;
}) {
  const t = useTranslations("offDash");
  const tc = useTranslations("common");
  const router = useRouter();
  const [st, setSt] = useState({ saving: false, error: "" });
  const back = "/dashboard/jobs/time-off";
  const slot = { day: dayStart(new Date()), startMin: 8 * 60, endMin: 12 * 60, techId: techId ?? null, dragged: false };
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-white">
      <FormHeader title={editOff ? t("editTitle") : t("newTitle")} closeHref={back} />
      <div className="flex-1">
        <TimeOffForm companyId={companyId} team={team} slot={slot} offs={offs} visits={[]} editOff={editOff} ready={ready}
          onState={setSt} onSaved={(msg) => { router.push(`${back}?saved=${encodeURIComponent(msg)}`); router.refresh(); }} />
      </div>
      <div className="sticky bottom-0 z-10 mt-10 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white px-5 py-3 sm:px-8">
        <button type="submit" form="new-off" disabled={st.saving} className="rounded-lg bg-[#0f766e] px-5 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#0c5f59] disabled:opacity-60">
          {st.saving ? tc("saving") : editOff ? tc("save") : t("assign")}
        </button>
        <Link prefetch={false} href={back} className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-[15px] font-medium text-slate-700 hover:bg-slate-50">{tc("cancel")}</Link>
        {st.error && <p role="alert" className="text-sm text-red-600">{st.error}</p>}
      </div>
    </div>
  );
}
