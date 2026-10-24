"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { hideSplash, splashPending } from "@/lib/splash";

// =====================================================================
// Pantalla de bienvenida de BrightPro (solo la marca BrightPro, nunca el logo del cliente).
// Aparece después de escribir tus datos en el login, y también al abrir/recargar la app con la
// sesión ya iniciada, mientras se cargan los datos del panel. Nunca en la pantalla de login
// ni en las páginas públicas que ven tus clientes, ni al moverte entre pantallas.
// =====================================================================
const MIN_MS = 1100; // siempre se alcanza a ver la animación (también al abrir la app instalada)
const MAX_MS = 12000;
const FADE_MS = 450;

export default function SplashScreen() {
  const path = usePathname() || "/";
  // Al ABRIR o RECARGAR la app con la sesión ya iniciada (entra directo al panel), también sale.
  // Se dibuja desde el primer instante (antes de que lleguen los datos), así nunca se ve la pantalla en blanco.
  const [phase, setPhase] = useState<"on" | "out" | "off">(() => (path.startsWith("/dashboard") || path === "/app" ? "on" : "off"));
  const shownAt = useRef(0);
  const fromLaunch = useRef(path === "/app"); // abierta desde el ícono de la app instalada
  // Al abrir la app, el tiempo mínimo cuenta desde que la animación aparece en pantalla
  useEffect(() => { if (phase === "on") shownAt.current = performance.now(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Encender: al enviar el login (evento) o si la página se recargó a mitad del ingreso
  useEffect(() => {
    const on = () => { shownAt.current = performance.now(); setPhase("on"); };
    const off = () => setPhase("off");
    if (splashPending()) on();
    window.addEventListener("bp-splash:show", on);
    window.addEventListener("bp-splash:hide", off);
    return () => { window.removeEventListener("bp-splash:show", on); window.removeEventListener("bp-splash:hide", off); };
  }, []);

  // Apagar con desvanecido cuando el panel ya está dibujado y sin pantallas de carga
  useEffect(() => {
    if (phase !== "on") return;
    // Si la sesión no estaba abierta y terminó en el login, se quita enseguida
    if (fromLaunch.current && (path === "/" || path === "/signup")) { fromLaunch.current = false; setPhase("off"); hideSplash(); return; }
    if (!path.startsWith("/dashboard")) return;
    const ready = () => Boolean(document.querySelector("[data-bp-ready]")) && !document.querySelector("[data-bp-loading]");
    let done = false;
    let t1: ReturnType<typeof setTimeout> | undefined, t2: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (done) return;
      done = true; mo.disconnect();
      t1 = setTimeout(() => {
        setPhase("out");
        t2 = setTimeout(() => { setPhase("off"); hideSplash(); }, FADE_MS);
      }, Math.max(0, MIN_MS - (performance.now() - shownAt.current)));
    };
    const mo = new MutationObserver(() => { if (ready()) finish(); });
    if (ready()) finish(); else mo.observe(document.body, { childList: true, subtree: true, attributes: true });
    const maxT = setTimeout(finish, MAX_MS);
    return () => { mo.disconnect(); clearTimeout(maxT); if (t1) clearTimeout(t1); if (t2) clearTimeout(t2); };
  }, [phase, path]);

  if (phase === "off") return null;
  return (
    <div aria-hidden="true"
      className={`fixed inset-0 z-[300] flex flex-col items-center justify-center bg-white transition-opacity ease-out motion-reduce:transition-none ${phase === "out" ? "pointer-events-none opacity-0" : "opacity-100 animate-[bp-splash-in_0.25s_ease-out]"}`}
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
