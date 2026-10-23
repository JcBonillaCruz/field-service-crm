"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";

// =====================================================================
// Pantalla de bienvenida de BrightPro (solo la marca BrightPro, nunca el logo del cliente).
// Sale en el primer instante al ABRIR la app (web o celular) mientras se valida la sesión
// y se cargan los datos principales; se desvanece sola cuando todo está listo.
// No aparece al moverte entre pantallas ni en las páginas públicas que ven tus clientes.
// =====================================================================
const MIN_MS = 700;    // tiempo mínimo para que se vea elegante (no un parpadeo)
const MAX_MS = 9000;   // por si algo tarda demasiado: nunca se queda pegada
const FADE_MS = 450;

const isAppPath = (p: string) => p === "/" || p === "/signup" || p.startsWith("/dashboard");

export default function SplashScreen() {
  const path = usePathname() || "/";
  const [phase, setPhase] = useState<"on" | "out" | "off">(isAppPath(path) ? "on" : "off");

  useEffect(() => {
    if (phase !== "on") return;
    const start = performance.now();
    const inApp = path.startsWith("/dashboard");
    // Listo = ya se dibujó el panel (data-bp-ready) y no queda ninguna pantalla de carga (data-bp-loading)
    const ready = () => !inApp || (Boolean(document.querySelector("[data-bp-ready]")) && !document.querySelector("[data-bp-loading]"));
    let done = false;
    let outT: ReturnType<typeof setTimeout> | undefined;
    let offT: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (done) return;
      done = true;
      mo.disconnect();
      outT = setTimeout(() => {
        setPhase("out");
        offT = setTimeout(() => setPhase("off"), FADE_MS);
      }, Math.max(0, MIN_MS - (performance.now() - start)));
    };
    const mo = new MutationObserver(() => { if (ready()) finish(); });
    if (ready()) finish(); else mo.observe(document.body, { childList: true, subtree: true });
    const maxT = setTimeout(finish, MAX_MS);
    return () => { mo.disconnect(); clearTimeout(maxT); if (outT) clearTimeout(outT); if (offT) clearTimeout(offT); };
    // Solo al abrir la app
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "off") return null;
  return (
    <div aria-hidden="true"
      className={`fixed inset-0 z-[300] flex flex-col items-center justify-center bg-white transition-opacity ease-out motion-reduce:transition-none ${phase === "out" ? "pointer-events-none opacity-0" : "opacity-100"}`}
      style={{ transitionDuration: `${FADE_MS}ms`, backgroundImage: "radial-gradient(70% 55% at 50% 38%, #eaf7f3 0%, rgba(255,255,255,0) 70%)" }}>
      <div className="animate-[bp-splash-pulse_1.8s_ease-in-out_infinite] motion-reduce:animate-none">
        <Image src="/logo-brightpro.png" alt="" width={220} height={44} priority className="h-auto w-[180px] sm:w-[220px]" />
      </div>
      <div className="mt-8 h-1 w-40 overflow-hidden rounded-full bg-[#e3efec]">
        <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-[#0f766e] to-[#14a39a] animate-[bp-splash-bar_1.2s_ease-in-out_infinite] motion-reduce:animate-none" />
      </div>
    </div>
  );
}
