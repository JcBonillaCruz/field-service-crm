"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";

// =====================================================================
// Invitación a instalar BrightPro como app (PWA).
// · Si ya está instalada: no aparece nunca.
// · Primera visita: aparece a los pocos segundos.
// · Si dicen "Ahora no": vuelve a ofrecerse en 7 días (no molesta en cada entrada).
// · iPhone: muestra cómo agregarla (Compartir → Agregar a inicio), porque Safari no tiene botón de instalar.
// =====================================================================
type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
const KEY = "bp-install-dismissed";
const WAIT_DAYS = 7;

export default function InstallPrompt() {
  const path = usePathname() || "/";
  const [evt, setEvt] = useState<BIP | null>(null);
  const [show, setShow] = useState<"" | "android" | "ios">("");
  const allowed = path === "/" || path === "/signup" || path.startsWith("/dashboard");

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    let last = 0;
    try { last = Number(localStorage.getItem(KEY) || 0); } catch { /* */ }
    if (last && Date.now() - last < WAIT_DAYS * 86400000) return;
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);

    const onBip = (e: Event) => { e.preventDefault(); setEvt(e as BIP); setTimeout(() => setShow("android"), 3500); };
    const onInstalled = () => { setShow(""); setEvt(null); };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    const ua = navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
    const t = isIOS ? setTimeout(() => setShow("ios"), 3500) : undefined;
    return () => { window.removeEventListener("beforeinstallprompt", onBip); window.removeEventListener("appinstalled", onInstalled); if (t) clearTimeout(t); };
  }, []);

  function later() { try { localStorage.setItem(KEY, String(Date.now())); } catch { /* */ } setShow(""); }
  async function install() {
    if (!evt) return;
    await evt.prompt();
    const r = await evt.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    if (r.outcome !== "accepted") later(); else setShow("");
    setEvt(null);
  }

  if (!show || !allowed) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-[400] mx-auto max-w-md animate-[bp-sheet-up_0.35s_ease-out] sm:inset-x-auto sm:right-5 sm:bottom-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(15,40,60,0.22)]">
        <div className="flex items-start gap-3">
          <Image src="/icon-192.png" alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-[#0b1f3a]">Install the BrightPro app</p>
            {show === "android" ? (
              <p className="mt-0.5 text-[13px] text-slate-500">Open it from your home screen like any app — faster, full screen, with alerts.</p>
            ) : (
              <p className="mt-0.5 text-[13px] leading-relaxed text-slate-500">
                Tap <svg viewBox="0 0 24 24" className="mx-0.5 inline h-4 w-4 -translate-y-0.5 text-[#2563eb]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8M5 12.5v6A2 2 0 0 0 7 20.5h10a2 2 0 0 0 2-2v-6" /></svg>
                <b className="text-slate-700">Share</b>, then <b className="text-slate-700">Add to Home Screen</b>.
              </p>
            )}
          </div>
          <button type="button" onClick={later} aria-label="Close" className="-mr-1 -mt-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={later} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-[14px] font-semibold text-slate-600 hover:bg-slate-50">Not now</button>
          {show === "android" && <button type="button" onClick={install} className="flex-1 rounded-xl bg-[#0f766e] py-2.5 text-[14px] font-semibold text-white shadow-[0_6px_16px_rgba(15,118,110,0.3)] hover:bg-[#0c5f59] active:scale-95">Install</button>}
        </div>
      </div>
    </div>
  );
}
