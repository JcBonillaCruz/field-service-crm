"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { DEFAULT_PALETTE, JobColorKey, StatusPalette, StoredPalette, groupTones, mergePalette, pillStyle } from "@/lib/status-colors";
import type { JobStatus } from "@/lib/jobs";

// Paso 6.4: la paleta de la compañía, disponible en todas las pantallas del panel
const Ctx = createContext<{ palette: StatusPalette; setPalette: (p: StatusPalette) => void }>({ palette: DEFAULT_PALETTE, setPalette: () => {} });

export function StatusColorsProvider({ stored, children }: { stored: StoredPalette; children: React.ReactNode }) {
  const initial = useMemo(() => mergePalette(stored), [stored]);
  const [palette, setPalette] = useState(initial);
  useEffect(() => setPalette(initial), [initial]);
  return <Ctx.Provider value={{ palette, setPalette }}>{children}</Ctx.Provider>;
}

// Sin el proveedor (páginas públicas) usa los colores de fábrica
export const useStatusColors = () => useContext(Ctx).palette;
export const useSetStatusColors = () => useContext(Ctx).setPalette;
export const useGroupTones = () => groupTones(useStatusColors());

// Etiqueta del estado del trabajo con el color de la compañía
export function JobStatusBadge({ s, size = "md", className = "" }: { s: JobStatus | JobColorKey; size?: "sm" | "md"; className?: string }) {
  const p = useStatusColors();
  const ts = useTranslations("status");
  const label = s === "on_hold" ? ts("hold") : ts(s as never);
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold ${size === "sm" ? "px-2 py-0.5 text-[10.5px]" : "px-2.5 py-0.5 text-[12.5px]"} ${s === "cancelled" ? "line-through" : ""} ${className}`}
      style={pillStyle(p.job[s as JobColorKey] ?? p.job.scheduled)}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.job[s as JobColorKey] ?? p.job.scheduled }} />
      {label}
    </span>
  );
}
