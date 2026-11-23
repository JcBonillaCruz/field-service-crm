"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { loadCustomerOptions, loadJobBasics } from "@/lib/jobs-server";
import { addDays, dayStart, timeToMin } from "@/lib/jobs";
import { OFF_SELECT, TimeOff } from "@/lib/time-off";
import NewItemModal, { NewSlot } from "@/components/jobs/NewItemModal";

type Data = Omit<Awaited<ReturnType<typeof loadJobBasics>>, "needsSql"> & {
  customers: Awaited<ReturnType<typeof loadCustomerOptions>>; offs: TimeOff[]; offReady: boolean;
};

// =====================================================================
// Paso 6.5b — Cualquier "+ New job" del sistema (Home, Dashboard de Jobs, Operations, el "+" del menú,
// "trabajo sin programar" de la bandeja) abre el mismo modal grande en vez de la página completa.
// Los datos se cargan en segundo plano al entrar, así el modal abre al instante. Si todavía no están
// (o abres con Ctrl/Cmd-clic en otra pestaña), se abre la página de siempre.
// =====================================================================
export default function NewJobHost({ companyId, canQuote }: { companyId: string; canQuote: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [slot, setSlot] = useState<NewSlot | null>(null);
  const [toast, setToast] = useState("");
  const dataRef = useRef<Data | null>(null);
  const busy = useRef(false);

  const fetchData = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const sb = createClient();
      const [basics, customers, off] = await Promise.all([
        loadJobBasics(sb, companyId),
        loadCustomerOptions(sb, companyId),
        sb.from("team_time_off").select(OFF_SELECT).eq("company_id", companyId)
          .gt("ends_at", addDays(dayStart(new Date()), -1).toISOString()).order("starts_at").limit(1000),
      ]);
      if (basics.needsSql) return;
      const { needsSql: _n, ...rest } = basics; // eslint-disable-line @typescript-eslint/no-unused-vars
      const d: Data = { ...rest, customers, offs: off.error ? [] : ((off.data ?? []) as TimeOff[]), offReady: !off.error };
      dataRef.current = d;
      setData(d);
    } catch { /* sin datos: se usa la página normal */ } finally { busy.current = false; }
  }, [companyId]);

  // Carga en segundo plano, sin estorbar la pantalla que se está abriendo
  useEffect(() => {
    const id = setTimeout(fetchData, 1200);
    return () => clearTimeout(id);
  }, [fetchData]);

  // Toma los clics a /dashboard/jobs/new (antes que el enlace) y abre el modal
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname !== "/dashboard/jobs/new") return;
      if (Array.from(url.searchParams.keys()).some((k) => k !== "unscheduled")) return; // casos especiales: página normal
      const d = dataRef.current;
      if (!d) return;
      e.preventDefault();
      e.stopPropagation();
      const start = Math.max(timeToMin(d.settings.day_start), 8 * 60);
      setSlot({ day: dayStart(new Date()), startMin: start, endMin: Math.min(24 * 60 - 15, start + d.settings.default_duration_min),
        techId: null, dragged: false, unscheduled: url.searchParams.get("unscheduled") === "1" });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const close = useCallback(() => { setSlot(null); fetchData(); }, [fetchData]);

  return (
    <>
      {slot && data && (
        <NewItemModal companyId={companyId} settings={data.settings} types={data.types} tags={data.tags} team={data.team} templates={data.templates}
          customers={data.customers} offs={data.offs} visits={[]} canQuote={canQuote} offReady={data.offReady} slot={slot} showSlot={false}
          onClose={close}
          onSaved={(msg) => {
            close();
            setToast(msg);
            setTimeout(() => setToast((x) => (x === msg ? "" : x)), 3200);
            router.refresh();
          }} />
      )}
      {toast && (
        <div role="status" className="fixed bottom-5 left-1/2 z-[98] max-w-[92vw] -translate-x-1/2 rounded-xl bg-[#0b1f3a] px-4 py-2.5 text-[13.5px] font-medium text-white shadow-[0_14px_36px_rgba(15,40,60,0.25)] animate-[bp-pop-in_0.2s_ease-out]">
          {toast}
        </div>
      )}
    </>
  );
}
