"use client";

import { useEffect } from "react";

// Barra de arriba en la página de impresión (no sale en el papel). Con ?auto=1 abre el diálogo de imprimir solo.
export default function PrintBar({ auto, title }: { auto: boolean; title: string }) {
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => window.print(), 500);
    return () => clearTimeout(t);
  }, [auto]);
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur print:hidden">
      <p className="truncate text-[15px] font-semibold text-[#0b1f3a]">{title}</p>
      <div className="flex shrink-0 gap-2">
        <button type="button" onClick={() => window.print()} className="rounded-lg bg-[#0f766e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0c5f59]">Print / Save as PDF</button>
        <button type="button" onClick={() => window.close()} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Close</button>
      </div>
    </div>
  );
}
