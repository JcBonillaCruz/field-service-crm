"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { PLACES_MIN_CHARS, PlaceAddress, PlaceSuggestion, PlacesOff, newSessionToken } from "@/lib/places";

// =====================================================================
// Paso 6.8 · Campo "Street" con sugerencias de Google.
// - Pide sugerencias 300 ms después de dejar de escribir y con 4+ letras (menos llamadas = menos costo).
// - Un token de sesión por dirección: se cierra al elegir; la siguiente dirección empieza otra sesión.
// - Si no hay llave, está apagado o se llegó al límite del día, se queda como campo normal (sin avisos molestos).
// =====================================================================
let pageOff: PlacesOff | null = null;   // una vez apagado, no se vuelve a preguntar en esta página
let warnedToday = false;

export default function StreetAutocomplete({ id, value, onChange, onPick, country, placeholder, className, inputProps, autoFocus }: {
  id?: string; value: string; onChange: (v: string) => void; onPick: (a: PlaceAddress) => void;
  country: string; placeholder?: string; className?: string; inputProps?: Record<string, string>; autoFocus?: boolean;
}) {
  const t = useTranslations("places");
  const [list, setList] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [note, setNote] = useState<{ text: string; tone: "amber" | "slate" } | null>(null);
  const session = useRef<string | null>(null);
  const typed = useRef(false);           // solo busca si la persona escribió (no al abrir una dirección guardada)
  const cache = useRef(new Map<string, PlaceSuggestion[]>());
  const seq = useRef(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout>>();

  const stop = (why: PlacesOff) => {
    if (why !== "error") pageOff = why; // si Google no respondió, se intenta otra vez en la siguiente dirección
    setList([]); setOpen(false);
    if (why === "limit" || why === "cap") setNote({ text: t("paused"), tone: "slate" });
  };

  useEffect(() => {
    const q = value.trim();
    if (!typed.current || pageOff || q.length < PLACES_MIN_CHARS) { setList([]); return; }
    const key = `${country}|${q.toLowerCase()}`;
    const hit = cache.current.get(key);
    if (hit) { setList(hit); setActive(0); return; }
    const n = ++seq.current;
    const timer = setTimeout(async () => {
      session.current ??= newSessionToken();
      const r = await fetch("/api/places/autocomplete", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: q, session: session.current, country }) }).then((x) => x.json()).catch(() => ({ off: "error" }));
      if (n !== seq.current) return;
      if (r.off) return stop(r.off as PlacesOff);
      const s = (r.suggestions ?? []) as PlaceSuggestion[];
      cache.current.set(key, s); setList(s); setActive(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [value, country]); // eslint-disable-line react-hooks/exhaustive-deps

  async function pick(s: PlaceSuggestion) {
    setOpen(false); setList([]); typed.current = false;
    const token = session.current ?? newSessionToken();
    session.current = null; cache.current.clear();   // la siguiente dirección es otra sesión
    onChange(s.main);                                   // se ve al momento; luego se llena todo
    const r = await fetch("/api/places/details", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: s.id, session: token }) }).then((x) => x.json()).catch(() => ({ off: "error" }));
    if (r.off) { stop(r.off as PlacesOff); return; }
    if (r.address) onPick(r.address as PlaceAddress);
    if (r.warn && !warnedToday) { warnedToday = true; setNote({ text: t("warn", { used: r.picks, limit: r.limit }), tone: "amber" }); }
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || !list.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % list.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + list.length) % list.length); }
    else if (e.key === "Enter") { e.preventDefault(); pick(list[active]); }
    else if (e.key === "Escape") { setOpen(false); }
  }

  const show = open && list.length > 0;
  return (
    <div className="relative">
      <input id={id} value={value} placeholder={placeholder} autoFocus={autoFocus} className={className} {...inputProps}
        role="combobox" aria-expanded={show} aria-autocomplete="list" aria-controls={id ? `${id}-list` : undefined}
        onChange={(e) => { typed.current = true; setOpen(true); onChange(e.target.value); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }}
        onKeyDown={onKey} />
      {show && (
        <ul id={id ? `${id}-list` : undefined} role="listbox"
          className="absolute left-0 right-0 top-full z-[100] mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-[0_12px_40px_rgba(15,40,60,0.16)] animate-[bp-pop-in_0.15s_ease-out]">
          {list.map((s, i) => (
            <li key={s.id} role="option" aria-selected={i === active}>
              <button type="button" tabIndex={-1}
                onMouseDown={(e) => { e.preventDefault(); clearTimeout(blurTimer.current); }}
                onMouseEnter={() => setActive(i)} onClick={() => pick(s)}
                className={`flex w-full items-start gap-3 px-3.5 py-2.5 text-left transition-colors duration-100 ${i === active ? "bg-[#f0faf7]" : ""}`}>
                <PinIcon active={i === active} />
                <span className="min-w-0">
                  <span className="block truncate text-[14.5px] font-medium text-[#0b1f3a]">{s.main}</span>
                  {s.secondary && <span className="block truncate text-[12.5px] text-slate-500">{s.secondary}</span>}
                </span>
              </button>
            </li>
          ))}
          <li className="flex justify-end border-t border-slate-100 px-3.5 pb-1 pt-1.5 text-[11px] text-slate-400" aria-hidden="true">
            powered by <span className="ml-1 font-semibold tracking-tight"><span className="text-[#4285f4]">G</span><span className="text-[#ea4335]">o</span><span className="text-[#fbbc05]">o</span><span className="text-[#4285f4]">g</span><span className="text-[#34a853]">l</span><span className="text-[#ea4335]">e</span></span>
          </li>
        </ul>
      )}
      {note && <p className={`mt-1 text-[12px] ${note.tone === "amber" ? "text-amber-700" : "text-slate-400"}`}>{note.text}</p>}
    </div>
  );
}

function PinIcon({ active }: { active: boolean }) {
  return (
    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors duration-150 ${active ? "bg-[#d6f3ec] text-[#0f766e]" : "bg-slate-100 text-slate-400"}`}>
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
        <path d="M10 18s5.5-5.2 5.5-9.5a5.5 5.5 0 0 0-11 0C4.5 12.8 10 18 10 18z" /><circle cx="10" cy="8.5" r="2" />
      </svg>
    </span>
  );
}
