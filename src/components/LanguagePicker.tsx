"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react";
import { LOCALES, Locale, setLocaleCookie } from "@/i18n/config";

// =====================================================================
// Paso 6.1b: selector de idioma = ícono ilustrado del globo + "Language" + desplegable (Headless UI).
// "Language" y los nombres de los idiomas se dejan fijos ("English" / "Español") para que cualquiera
// encuentre el selector aunque la app esté en un idioma que no lee.
// Guarda en el perfil (todos los aparatos) + cookie de este aparato y repinta la pantalla sin recargar.
// =====================================================================
export async function saveLanguage(l: Locale) {
  setLocaleCookie(l); // al instante, aunque falle la red
  try {
    await fetch("/api/language", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language: l }) });
  } catch { /* sin conexión: queda en este aparato y se guarda la próxima vez */ }
}

const NAME: Record<Locale, string> = { en: "English", es: "Español" };
const SUB: Record<Locale, string> = { en: "United States", es: "Estados Unidos" };

// Globo ilustrado (mismo estilo de los íconos de las apps): círculo suave, globo verde con meridianos y una burbujita naranja
export function LanguageArt({ size = 40, spin = false }: { size?: number; spin?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id="bp-lang-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e9f7f4" /><stop offset="1" stopColor="#d3efe8" /></linearGradient>
        <linearGradient id="bp-lang-globe" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2bb3a4" /><stop offset="1" stopColor="#0f766e" /></linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="14" fill="url(#bp-lang-bg)" />
      <g className={spin ? "origin-[21px_25px] animate-[spin_1.2s_ease-in-out]" : ""}>
        <circle cx="21" cy="25" r="12" fill="url(#bp-lang-globe)" />
        <g fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth="1.5" strokeLinecap="round">
          <ellipse cx="21" cy="25" rx="5.2" ry="12" />
          <path d="M9.5 21h23M9.5 29h23M21 13v24" />
        </g>
      </g>
      {/* burbuja de diálogo con "Aa" */}
      <path d="M30 7h11a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-5l-4 3.5V20h-2a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3z" fill="#e8713a" />
      <text x="35.5" y="16.6" textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff" fontFamily="system-ui, sans-serif">Aa</text>
    </svg>
  );
}

export default function LanguagePicker({ compact = false }: { compact?: boolean }) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [busy, start] = useTransition();
  const [picked, setPicked] = useState<Locale>(locale);
  const [spin, setSpin] = useState(false);

  async function choose(l: Locale) {
    if (l === picked) return;
    setPicked(l); setSpin(true); setTimeout(() => setSpin(false), 1300);
    await saveLanguage(l);
    start(() => router.refresh());
  }

  // Paso 6.3d: versión chica para la barra de arriba (globo + idioma), siempre a la vista
  if (compact) return (
    <Listbox value={picked} onChange={choose}>
      <ListboxButton aria-label="Language" title="Language"
        className={`group flex h-10 items-center gap-1.5 rounded-xl pl-1 pr-2 text-[13.5px] font-semibold text-[#0b1f3a] transition-colors hover:bg-white/70 focus:outline-none data-[open]:bg-white ${busy ? "opacity-70" : ""}`}>
        <span className="transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105"><LanguageArt size={30} spin={spin} /></span>
        <span>{NAME[picked]}</span>
        {busy
          ? <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-[#0f766e] border-t-transparent" />
          : <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-data-[open]:rotate-180" fill="currentColor" aria-hidden="true"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>}
      </ListboxButton>
      <ListboxOptions anchor="bottom end" transition
        className="z-[100] mt-2 w-56 origin-top-right rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_16px_40px_rgba(15,40,60,0.16)] transition duration-150 ease-out focus:outline-none data-[closed]:scale-95 data-[closed]:opacity-0">
        {LOCALES.map((l) => (
          <ListboxOption key={l} value={l}
            className="group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-[14px] text-slate-700 transition-colors data-[focus]:bg-slate-50 data-[selected]:bg-[#e9f7f4]">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10.5px] font-bold tracking-wide text-slate-500 group-data-[selected]:bg-white group-data-[selected]:text-[#0f766e]">{l.toUpperCase()}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-[#0b1f3a]">{NAME[l]}</span>
              <span className="block text-[11.5px] text-slate-400">{SUB[l]}</span>
            </span>
            <svg viewBox="0 0 20 20" className="invisible h-4 w-4 shrink-0 text-[#0f766e] group-data-[selected]:visible" fill="currentColor" aria-hidden="true"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" /></svg>
          </ListboxOption>
        ))}
      </ListboxOptions>
    </Listbox>
  );

  return (
    <Listbox value={picked} onChange={choose}>
      <ListboxButton aria-label="Language"
        className={`group flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-left transition-all duration-200 hover:-translate-y-px hover:border-[#9ad9cd] hover:shadow-[0_8px_20px_rgba(15,40,60,0.08)] focus:outline-none data-[open]:border-[#0f766e] ${busy ? "opacity-70" : ""}`}>
        <span className="transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105"><LanguageArt size={40} spin={spin} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-semibold uppercase tracking-wide text-slate-400">Language</span>
          <span className="block truncate text-[15px] font-semibold text-[#0b1f3a]">{NAME[picked]}</span>
        </span>
        {busy
          ? <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#0f766e] border-t-transparent" />
          : <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 group-data-[open]:rotate-180" fill="currentColor" aria-hidden="true"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>}
      </ListboxButton>
      <ListboxOptions anchor="bottom start" transition
        className="z-[100] mt-1.5 w-[var(--button-width)] origin-top rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_16px_40px_rgba(15,40,60,0.16)] transition duration-150 ease-out focus:outline-none data-[closed]:scale-95 data-[closed]:opacity-0">
        {LOCALES.map((l) => (
          <ListboxOption key={l} value={l}
            className="group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] text-slate-700 transition-colors data-[focus]:bg-slate-50 data-[selected]:bg-[#eef4ff]">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold tracking-wide text-slate-500 group-data-[selected]:bg-white group-data-[selected]:text-[#2563eb]">{l.toUpperCase()}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-[#0b1f3a]">{NAME[l]}</span>
              <span className="block text-[12px] text-slate-400">{SUB[l]}</span>
            </span>
            <svg viewBox="0 0 20 20" className="invisible h-4 w-4 shrink-0 text-[#2563eb] group-data-[selected]:visible" fill="currentColor" aria-hidden="true"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" /></svg>
          </ListboxOption>
        ))}
      </ListboxOptions>
    </Listbox>
  );
}
