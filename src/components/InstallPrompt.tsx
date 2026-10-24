"use client";

import { useEffect, useState } from "react";

// =====================================================================
// Instalar la app (PWA) — SIN banner propio.
// · Registramos el service worker para que Chrome en el CELULAR muestre su barrita automática.
// · No bloqueamos esa barrita: guardamos el aviso de Chrome para poder ofrecer, además,
//   una opción discreta "Install app" dentro del menú del celular (útil si alguien cerró
//   la barrita o desinstaló la app: Chrome tarda semanas en volver a mostrarla sola).
// =====================================================================
type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let saved: BIP | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export default function InstallPrompt() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const onBip = (e: Event) => { saved = e as BIP; emit(); };
    const onInstalled = () => { saved = null; emit(); };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onBip); window.removeEventListener("appinstalled", onInstalled); };
  }, []);
  return null;
}

// ¿Se puede instalar ahora mismo? (solo celular, y solo si aún no está instalada)
export function useInstallApp() {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force((n) => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  const mobile = typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;
  const standalone = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
  const can = Boolean(saved) && mobile && !standalone;
  async function install() {
    if (!saved) return;
    const e = saved;
    try { await e.prompt(); await e.userChoice; } catch { /* */ }
    saved = null; emit();
  }
  return { can, install };
}
