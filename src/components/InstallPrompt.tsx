"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// =====================================================================
// Instalar la app (PWA)
// · ANDROID: Chrome muestra su propia barrita automática "Instalar app" (no ponemos banner propio).
// · iPHONE / iPAD: Apple NO tiene esa barrita (ni en Safari ni en Chrome). La única forma es
//   Compartir → "Agregar a pantalla de inicio". Por eso, SOLO en iPhone, mostramos una hojita
//   bonita con los pasos (distintos para Safari y para Chrome). Se puede cerrar y no molesta
//   otra vez en 10 días; además queda la opción "Install BrightPro app" en el menú del celular.
// · Nunca aparece en computadora ni si la app ya está instalada.
// =====================================================================
type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let saved: BIP | null = null;
let iosOpen = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const HIDE_KEY = "bp-ios-install-hidden";
const HIDE_DAYS = 10;

type Ios = { ios: boolean; browser: "safari" | "chrome" | "other" };
function detectIos(): Ios {
  if (typeof navigator === "undefined") return { ios: false, browser: "other" };
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const browser = /CriOS/.test(ua) ? "chrome" : /FxiOS|EdgiOS|OPiOS|GSA\//.test(ua) ? "other" : "safari";
  return { ios, browser };
}
function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
export function openIosInstall() { iosOpen = true; emit(); }

export default function InstallPrompt() {
  const pathname = usePathname();
  const [, force] = useState(0);
  const [env, setEnv] = useState<Ios>({ ios: false, browser: "other" });
  useEffect(() => { const f = () => force((n) => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const onBip = (e: Event) => { saved = e as BIP; emit(); };
    const onInstalled = () => { saved = null; emit(); };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onBip); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  // iPhone: la hojita aparece sola una vez (después del splash), si no la cerró hace poco
  useEffect(() => {
    const e = detectIos(); setEnv(e);
    if (!e.ios || isStandalone()) return;
    if (/^\/(share|print)\//.test(pathname || "")) return; // páginas que ven TUS clientes: nunca
    try {
      const until = Number(localStorage.getItem(HIDE_KEY) || 0);
      if (until > Date.now()) return;
    } catch { /* */ }
    const t = setTimeout(() => { iosOpen = true; emit(); }, 2600);
    return () => clearTimeout(t);
  }, [pathname]);

  if (!env.ios || !iosOpen || isStandalone()) return null;
  const close = (remember: boolean) => {
    iosOpen = false; emit();
    if (remember) try { localStorage.setItem(HIDE_KEY, String(Date.now() + HIDE_DAYS * 86400000)); } catch { /* */ }
  };
  return <IosSheet browser={env.browser} onClose={close} />;
}

// ¿Se puede instalar ahora mismo? (solo celular, y solo si aún no está instalada)
export function useInstallApp() {
  const [, force] = useState(0);
  const [ios, setIos] = useState(false);
  useEffect(() => { const f = () => force((n) => n + 1); subs.add(f); setIos(detectIos().ios); return () => { subs.delete(f); }; }, []);
  const mobile = typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;
  const standalone = isStandalone();
  const can = !standalone && ((Boolean(saved) && mobile) || ios);
  async function install() {
    if (ios) { openIosInstall(); return; }
    if (!saved) return;
    const e = saved;
    try { await e.prompt(); await e.userChoice; } catch { /* */ }
    saved = null; emit();
  }
  return { can, install };
}

// ---------- Hojita para iPhone (Safari / Chrome) ----------
const ShareIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12M8 7l4-4 4 4" /><path d="M7 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1" />
  </svg>
);
const AddIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="M12 8v8M8 12h8" /></svg>
);

function IosSheet({ browser, onClose }: { browser: Ios["browser"]; onClose: (remember: boolean) => void }) {
  const steps: { icon: React.ReactNode; text: React.ReactNode }[] = browser === "chrome"
    ? [
        { icon: <ShareIcon />, text: <>Tap <b>Share</b> <ShareIcon className="inline h-4 w-4 -translate-y-px text-[#2563eb]" /> next to the address bar (or inside the <b>•••</b> menu).</> },
        { icon: <AddIcon />, text: <>Scroll and tap <b>Add to Home Screen</b>.</> },
        { icon: <span className="text-[13px] font-bold">Add</span>, text: <>Tap <b>Add</b>. BrightPro appears on your Home Screen like any app.</> },
      ]
    : [
        { icon: <ShareIcon />, text: <>Tap <b>Share</b> <ShareIcon className="inline h-4 w-4 -translate-y-px text-[#2563eb]" /> at the bottom of Safari. On newer iPhones, tap <b>•••</b> first, then Share{browser === "other" ? " (or open this page in Safari)" : ""}.</> },
        { icon: <AddIcon />, text: <>Scroll down and tap <b>Add to Home Screen</b>.</> },
        { icon: <span className="text-[13px] font-bold">Add</span>, text: <>Tap <b>Add</b> at the top right. Done: open BrightPro from your Home Screen.</> },
      ];
  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center lg:hidden" role="dialog" aria-modal="true" aria-label="Install BrightPro">
      <button type="button" aria-label="Close" onClick={() => onClose(false)} className="absolute inset-0 bg-[#0b1f3a]/40 backdrop-blur-[2px] animate-[bp-splash-in_0.25s_ease-out]" />
      <div className="relative w-full max-w-md rounded-t-[28px] bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3 shadow-[0_-12px_40px_rgba(11,31,58,0.25)] animate-[bp-sheet_0.35s_cubic-bezier(.2,.8,.2,1)]">
        <span className="mx-auto mb-4 block h-1.5 w-10 rounded-full bg-slate-200" />
        <div className="flex items-center gap-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/apple-touch-icon.png" alt="" className="h-14 w-14 rounded-2xl shadow-[0_6px_18px_rgba(15,40,60,0.18)]" />
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-bold text-[#0b1f3a]">Install BrightPro</p>
            <p className="text-[13px] text-slate-500">Full screen, faster, with alerts on your iPhone.</p>
          </div>
          <button type="button" onClick={() => onClose(true)} aria-label="Close"
            className="group flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-all hover:bg-[#fff1f2] hover:text-[#e11d48] active:scale-90">
            <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 5l10 10M15 5 5 15" /></svg>
          </button>
        </div>
        <ol className="mt-5 space-y-2.5">
          {steps.map((s, i) => (
            <li key={i} style={{ animationDelay: `${120 + i * 90}ms` }} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-[#f7fbfa] px-3 py-3 animate-[bp-fade_0.35s_ease-out_both]">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0f766e] text-[12px] font-bold text-white">{i + 1}</span>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#2563eb] shadow-sm">{s.icon}</span>
              <span className="text-[14px] leading-snug text-slate-700">{s.text}</span>
            </li>
          ))}
        </ol>
        {browser === "safari" && (
          <div className="pointer-events-none mt-4 flex flex-col items-center text-[#2563eb]">
            <span className="text-[12px] font-semibold">The Share button is down here</span>
            <svg viewBox="0 0 24 24" className="mt-0.5 h-6 w-6 animate-bounce" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
          </div>
        )}
        <button type="button" onClick={() => onClose(true)} className="mt-4 w-full rounded-xl py-2.5 text-[14px] font-semibold text-slate-500 hover:bg-slate-50">Not now</button>
      </div>
    </div>
  );
}
