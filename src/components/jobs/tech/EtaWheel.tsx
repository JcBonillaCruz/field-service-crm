"use client";

import { useEffect, useRef } from "react";
import { ETA_VALUES, etaLabel } from "@/lib/customer-notice-text";

// Paso 5.8b · Rueda vertical para escoger en cuánto llega el técnico (de 5 minutos a 4 horas, de 5 en 5).
// Se desliza con el dedo; también tiene − y + para subir o bajar de a un paso.
const ROW = 44; // alto de cada opción (px)
export default function EtaWheel({ value, onChange }: { value: number; onChange: (m: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const t = useRef<ReturnType<typeof setTimeout>>();
  const i = Math.max(0, ETA_VALUES.indexOf(value));

  // Al abrir: la rueda queda parada en el valor actual
  useEffect(() => { if (box.current) box.current.scrollTop = i * ROW; /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const go = (n: number, smooth = true) => {
    const k = Math.min(ETA_VALUES.length - 1, Math.max(0, n));
    box.current?.scrollTo({ top: k * ROW, behavior: smooth ? "smooth" : "auto" });
    onChange(ETA_VALUES[k]);
  };
  const onScroll = () => {
    clearTimeout(t.current);
    t.current = setTimeout(() => {
      const k = Math.min(ETA_VALUES.length - 1, Math.max(0, Math.round((box.current?.scrollTop ?? 0) / ROW)));
      if (ETA_VALUES[k] !== value) onChange(ETA_VALUES[k]);
    }, 60);
  };
  const step = "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[#6d28d9] transition-transform active:scale-95 disabled:opacity-40";

  return (
    <div className="flex items-center justify-center gap-4">
      <button type="button" aria-label="Less time" disabled={i === 0} onClick={() => go(i - 1)} className={step}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 12h12" /></svg>
      </button>
      <div className="relative w-40">
        {/* La franja del centro marca el valor elegido */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-11 -translate-y-1/2 rounded-xl border border-[#e2d9ff] bg-[#f3efff]" />
        <div ref={box} onScroll={onScroll} role="listbox" aria-label="Minutes until you arrive" tabIndex={0}
          onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); go(i + 1); } if (e.key === "ArrowUp") { e.preventDefault(); go(i - 1); } }}
          className="relative h-[220px] snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] focus:outline-none [&::-webkit-scrollbar]:hidden"
          style={{ paddingTop: (220 - ROW) / 2, paddingBottom: (220 - ROW) / 2, WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 30%, #000 70%, transparent)", maskImage: "linear-gradient(to bottom, transparent, #000 30%, #000 70%, transparent)" }}>
          {ETA_VALUES.map((m, k) => (
            <button key={m} type="button" role="option" aria-selected={m === value} onClick={() => go(k)}
              className={`flex w-full snap-center items-center justify-center transition-all ${m === value ? "text-[19px] font-semibold text-[#6d28d9]" : "text-[15px] text-slate-400"}`} style={{ height: ROW }}>
              {etaLabel(m)}
            </button>
          ))}
        </div>
      </div>
      <button type="button" aria-label="More time" disabled={i === ETA_VALUES.length - 1} onClick={() => go(i + 1)} className={step}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 6v12M6 12h12" /></svg>
      </button>
    </div>
  );
}
