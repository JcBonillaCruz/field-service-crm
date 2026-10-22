"use client";

import { useRef } from "react";

// Deslizar con el dedo entre pestañas (celular): izquierda = siguiente, derecha = anterior.
// No se activa dentro de tablas que se deslizan de lado ni en elementos con data-noswipe.
export function useSwipe(onPrev: () => void, onNext: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("[data-noswipe], input, textarea, select, .overflow-x-auto")) { start.current = null; return; }
      const t = e.touches[0]; start.current = { x: t.clientX, y: t.clientY };
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (!start.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.current.x, dy = t.clientY - start.current.y;
      start.current = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) (dx < 0 ? onNext : onPrev)();
    },
  };
}
