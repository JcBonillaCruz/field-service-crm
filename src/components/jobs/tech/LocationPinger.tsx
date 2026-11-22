"use client";

import { useTranslations } from "next-intl";
import { useEffect, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { LOC_EVENT, needsMapSql } from "@/lib/live-map";

// =====================================================================
// Paso 5.9 · Compartir ubicación con el día iniciado.
// Vive en el layout: funciona en cualquier pantalla mientras la app esté abierta y a la vista.
//  · Primero pregunta a la base si esta persona debe compartir (ajuste encendido + Clock in hecho).
//    Así NUNCA se pide el permiso de ubicación a quien no tiene el día iniciado (dueño en la oficina, etc.).
//  · Manda la posición cada minuto más o menos; la base solo guarda un punto nuevo si se movió.
//  · Con el teléfono bloqueado o en otra app no se manda nada (límite de las apps web).
// =====================================================================
const EVERY = 60_000;        // con el día iniciado
const IDLE = 5 * 60_000;     // sin día iniciado: solo se vuelve a preguntar cada 5 min (o al tocar Clock in)

let sharing = false;
const subs = new Set<() => void>();
function setSharing(v: boolean) { if (v !== sharing) { sharing = v; subs.forEach((f) => f()); } }
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useSharing = () => useSyncExternalStore(subscribe, () => sharing, () => false);

const getPos = () => new Promise<GeolocationPosition | null>((ok) =>
  navigator.geolocation.getCurrentPosition(ok, () => ok(null), { enableHighAccuracy: true, timeout: 12000, maximumAge: 20000 }));

export default function LocationPinger({ companyId }: { companyId: string }) {
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    let stopped = false, busy = false, dead = false, nextAt = 0;
    let soon: ReturnType<typeof setTimeout>;

    async function tick(force = false) {
      if (stopped || busy || dead || document.visibilityState !== "visible") return;
      if (!force && Date.now() < nextAt) return;
      busy = true;
      try {
        const sb = createClient();
        const st = await sb.rpc("tech_tracking_state", { p_company: companyId });
        if (st.error) { if (needsMapSql(st.error)) dead = true; setSharing(false); nextAt = Date.now() + IDLE; return; }
        if (!(st.data as { on?: boolean } | null)?.on) { setSharing(false); nextAt = Date.now() + IDLE; return; }
        const pos = await getPos();
        if (stopped) return;
        if (!pos) { setSharing(false); nextAt = Date.now() + EVERY; return; }
        const r = await sb.rpc("tech_ping", { p_company: companyId, p_lat: pos.coords.latitude, p_lng: pos.coords.longitude, p_accuracy: Math.min(99999, Math.round(pos.coords.accuracy)) });
        setSharing(!r.error && (r.data as { on?: boolean } | null)?.on === true);
        nextAt = Date.now() + EVERY - 5000;
      } catch { /* sin señal: se intenta en la siguiente vuelta */ } finally { busy = false; }
    }

    const now = () => { clearTimeout(soon); soon = setTimeout(() => tick(true), 900); }; // deja que Clock in / On my way se guarden primero
    const onShow = () => { if (document.visibilityState === "visible") tick(true); };
    tick(true);
    const iv = setInterval(() => tick(), 30_000);
    window.addEventListener(LOC_EVENT, now);
    document.addEventListener("visibilitychange", onShow);
    return () => { stopped = true; clearInterval(iv); clearTimeout(soon); window.removeEventListener(LOC_EVENT, now); document.removeEventListener("visibilitychange", onShow); setSharing(false); };
  }, [companyId]);
  return null;
}

// Aviso discreto para el colaborador: su ubicación se está compartiendo con la oficina
export function SharingBadge({ className = "" }: { className?: string }) {
  const t = useTranslations("eta");
  const on = useSharing();
  if (!on) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium text-[#15803d] ${className}`} title={t("sharingHint")}>
      <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22c55e] opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#16a34a]" /></span>
      {t("sharing")}
    </span>
  );
}
