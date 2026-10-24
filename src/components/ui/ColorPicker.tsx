"use client";

import { useEffect, useRef, useState } from "react";

// =====================================================================
// Selector de color propio (igual en celular y computadora):
// cuadro de saturación/brillo, barra de tono, gotero (si el navegador lo permite),
// R G B y código hex. Se abre HACIA ABAJO, dentro de la misma tarjeta (nunca flota por encima).
// Reemplaza el selector del sistema de Android que solo muestra 8 cuadritos.
// =====================================================================
type HSV = { h: number; s: number; v: number };
const clamp = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n));
const isHex = (v: string) => /^#?[0-9a-f]{6}$/i.test(v.trim());
function hexToRgb(hex: string) { const h = hex.replace("#", ""); return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }; }
const rgbToHex = (r: number, g: number, b: number) => `#${[r, g, b].map((x) => Math.round(clamp(x, 0, 255)).toString(16).padStart(2, "0")).join("")}`;
function rgbToHsv(r: number, g: number, b: number): HSV {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}
function hsvToRgb({ h, s, v }: HSV) {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

function useDrag(onMove: (x: number, y: number) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const handle = (e: React.PointerEvent) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    onMove(clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height));
  };
  return {
    ref,
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); (e.target as Element).setPointerCapture?.(e.pointerId); handle(e); },
    onPointerMove: (e: React.PointerEvent) => { if (e.buttons || e.pointerType === "touch") handle(e); },
  };
}

export default function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  const [open, setOpen] = useState(false);
  const safe = isHex(value) ? (value.startsWith("#") ? value : `#${value}`) : "#000000";
  const [hsv, setHsv] = useState<HSV>(() => { const { r, g, b } = hexToRgb(safe); return rgbToHsv(r, g, b); });
  const [hexText, setHexText] = useState(safe);
  const own = useRef(safe);
  // Si el color cambia desde afuera (por un tema), actualizar el selector
  useEffect(() => {
    if (safe.toLowerCase() === own.current.toLowerCase()) return;
    own.current = safe; setHexText(safe);
    const { r, g, b } = hexToRgb(safe); setHsv((p) => { const n = rgbToHsv(r, g, b); return n.s === 0 || n.v === 0 ? { ...n, h: p.h } : n; });
  }, [safe]);

  const emit = (n: HSV) => {
    setHsv(n);
    const { r, g, b } = hsvToRgb(n); const hex = rgbToHex(r, g, b);
    own.current = hex; setHexText(hex); onChange(hex);
  };
  const emitHex = (hex: string) => {
    const h = hex.startsWith("#") ? hex : `#${hex}`;
    own.current = h; setHexText(h);
    const { r, g, b } = hexToRgb(h); setHsv((p) => { const n = rgbToHsv(r, g, b); return n.s === 0 || n.v === 0 ? { ...n, h: p.h } : n; });
    onChange(h.toLowerCase());
  };
  const sv = useDrag((x, y) => emit({ ...hsv, s: x, v: 1 - y }));
  const hue = useDrag((x) => emit({ ...hsv, h: x * 359.9 }));
  const rgb = hsvToRgb(hsv);
  const canDrop = typeof window !== "undefined" && "EyeDropper" in window;
  async function eyedrop() {
    try {
      const ED = (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
      const res = await new ED().open(); emitHex(res.sRGBHex);
    } catch { /* cancelado */ }
  }
  const pure = rgbToHex(...(Object.values(hsvToRgb({ h: hsv.h, s: 1, v: 1 })) as [number, number, number]));

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="w-28 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-label={`Pick ${label} color`} aria-expanded={open}
          className={`h-9 w-9 shrink-0 rounded-lg border shadow-inner transition-transform active:scale-90 ${open ? "border-[#0f766e] ring-2 ring-[#0f766e]/25" : "border-slate-200"}`} style={{ background: safe }} />
        <input value={hexText} onChange={(e) => { setHexText(e.target.value); if (isHex(e.target.value)) emitHex(e.target.value.trim()); }}
          className="w-28 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-[13px] text-slate-800 focus:border-[#0f766e] focus:bg-white focus:outline-none" />
      </div>
      {open && (
        <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_10px_28px_rgba(15,40,60,0.10)] animate-[bp-fade_0.18s_ease-out]">
          {/* Saturación (izq→der) y brillo (arriba→abajo) */}
          <div {...sv} className="relative h-40 w-full touch-none cursor-crosshair select-none overflow-hidden rounded-xl"
            style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${pure})` }}>
            <span className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35),0_2px_6px_rgba(0,0,0,0.3)]"
              style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: safe }} />
          </div>
          <div className="mt-3 flex items-center gap-3">
            {canDrop && (
              <button type="button" onClick={eyedrop} aria-label="Pick a color from the screen" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m14 7 3 3M5 19l1.5-.5L17 8a2.1 2.1 0 0 0-3-3L3.5 15.5 3 17zM15 4l5 5" /></svg>
              </button>
            )}
            <span className="h-9 w-9 shrink-0 rounded-full border border-slate-200" style={{ background: safe }} />
            <div {...hue} className="relative h-3.5 flex-1 touch-none cursor-pointer select-none rounded-full"
              style={{ background: "linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)" }}>
              <span className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3),0_2px_6px_rgba(0,0,0,0.25)]"
                style={{ left: `${(hsv.h / 360) * 100}%`, background: pure }} />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(["r", "g", "b"] as const).map((k) => (
              <label key={k} className="block text-center">
                <input inputMode="numeric" value={Math.round(rgb[k])}
                  onChange={(e) => { const n = clamp(Number(e.target.value.replace(/\D/g, "")) || 0, 0, 255); const c = { ...rgb, [k]: n }; emitHex(rgbToHex(c.r, c.g, c.b)); }}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 text-center text-[14px] tabular-nums focus:border-[#0f766e] focus:bg-white focus:outline-none" />
                <span className="mt-1 block text-[11px] font-semibold text-slate-500">{k.toUpperCase()}</span>
              </label>
            ))}
          </div>
          <button type="button" onClick={() => setOpen(false)} className="mt-2 w-full rounded-lg py-2 text-[13px] font-semibold text-[#0f766e] hover:bg-[#f0faf7]">Done</button>
        </div>
      )}
    </div>
  );
}
