"use client";

import { useEffect } from "react";

// =====================================================================
// Instalar la app (PWA): SIN banner propio.
// Solo registramos el service worker para que Chrome en el CELULAR muestre
// su barrita automática "Instalar app" (la misma que viste con Supabase/Vercel).
// En la computadora Chrome no muestra nada encima de la app.
// Si la persona la cierra, Chrome decide cuándo volver a ofrecerla (no molesta).
// =====================================================================
export default function InstallPrompt() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}
