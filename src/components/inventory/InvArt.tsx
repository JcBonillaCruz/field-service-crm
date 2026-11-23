"use client";

import { useId } from "react";

// =====================================================================
// Paso 6.12b · Íconos ilustrados de Inventario (SVG, mismo estilo que los íconos de las apps)
// Se animan al pasar el mouse sobre la tarjeta o el botón (clase "group" en el padre).
// =====================================================================
const uid = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "");

// Van / Truck: camioneta de servicio blanca con franja turquesa, vidrio azul, faro y llantas con rin
export function VanArt({ size = 48 }: { size?: number }) {
  const id = uid(useId());
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff6ee" /><stop offset="1" stopColor="#ffe6d3" /></linearGradient>
        <linearGradient id={`${id}body`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#e8eef3" /></linearGradient>
        <linearGradient id={`${id}glass`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#bfe3ff" /><stop offset="1" stopColor="#5aa7e6" /></linearGradient>
        <linearGradient id={`${id}stripe`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#14a39a" /><stop offset="1" stopColor="#0f766e" /></linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill={`url(#${id}bg)`} />
      <ellipse cx="32" cy="50.5" rx="22" ry="2.6" fill="#0b1f3a" opacity="0.12" />
      {/* Rayitas de velocidad */}
      <g stroke="#f4a261" strokeWidth="2" strokeLinecap="round" className="opacity-0 transition-all duration-300 group-hover:-translate-x-1 group-hover:opacity-100">
        <path d="M4 30h5M3 36h7M5 42h4" />
      </g>
      <g className="transition-transform duration-300 ease-out group-hover:translate-x-1.5">
        {/* Caja de carga */}
        <path d="M9 22a3 3 0 0 1 3-3h24v26H12a3 3 0 0 1-3-3z" fill={`url(#${id}body)`} stroke="#0b1f3a" strokeWidth="1.4" strokeLinejoin="round" />
        {/* Cabina */}
        <path d="M36 25h8.5a3 3 0 0 1 2.4 1.2l5.2 7a3 3 0 0 1 .6 1.8V42a3 3 0 0 1-3 3H36z" fill={`url(#${id}body)`} stroke="#0b1f3a" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M39 28h5.3l4.6 6.2H39z" fill={`url(#${id}glass)`} stroke="#0b1f3a" strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M40.5 29.5l2 0-2.4 3.2" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity="0.8" />
        {/* Franja y logo */}
        <rect x="9.7" y="32" width="42.6" height="4" fill={`url(#${id}stripe)`} />
        <circle cx="22" cy="26" r="3.4" fill="#e8713a" />
        <path d="M20.6 26.1l1 1 1.9-2.2" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M27 24.6h6M27 27.4h4" stroke="#9fb3c8" strokeWidth="1.3" strokeLinecap="round" />
        {/* Faro y defensa */}
        <rect x="49.5" y="38" width="3.2" height="2.4" rx="1" fill="#ffd166" stroke="#0b1f3a" strokeWidth="0.8" />
        <path d="M44 45h8.5" stroke="#0b1f3a" strokeWidth="1.4" strokeLinecap="round" />
        {/* Llantas */}
        <g>
          <circle cx="19" cy="45.5" r="5" fill="#1f2a3d" /><circle cx="19" cy="45.5" r="2.2" fill="#cfd8e3" /><circle cx="19" cy="45.5" r="0.8" fill="#1f2a3d" />
          <circle cx="44" cy="45.5" r="5" fill="#1f2a3d" /><circle cx="44" cy="45.5" r="2.2" fill="#cfd8e3" /><circle cx="44" cy="45.5" r="0.8" fill="#1f2a3d" />
        </g>
      </g>
    </svg>
  );
}

// Warehouse: bodega con techo turquesa, cortina metálica y cajas apiladas
export function WarehouseArt({ size = 48 }: { size?: number }) {
  const id = uid(useId());
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#eefaf7" /><stop offset="1" stopColor="#d3f0e9" /></linearGradient>
        <linearGradient id={`${id}roof`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#14a39a" /><stop offset="1" stopColor="#0c5f59" /></linearGradient>
        <linearGradient id={`${id}wall`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#edf2f6" /></linearGradient>
        <linearGradient id={`${id}door`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#dfe7ee" /><stop offset="1" stopColor="#b9c7d4" /></linearGradient>
        <linearGradient id={`${id}box`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffd08a" /><stop offset="1" stopColor="#f2a43a" /></linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill={`url(#${id}bg)`} />
      <ellipse cx="32" cy="51" rx="23" ry="2.4" fill="#0b1f3a" opacity="0.12" />
      {/* Paredes */}
      <path d="M12 27h40v23H12z" fill={`url(#${id}wall)`} stroke="#0b1f3a" strokeWidth="1.4" strokeLinejoin="round" />
      {/* Techo */}
      <path d="M8 28.5 32 14l24 14.5a1.6 1.6 0 0 1-.8 3H8.8a1.6 1.6 0 0 1-.8-3z" fill={`url(#${id}roof)`} stroke="#0b1f3a" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M14 27.5 32 17l18 10.5" stroke="#7fdacd" strokeWidth="1.1" strokeLinecap="round" fill="none" opacity="0.8" />
      {/* Letrero */}
      <rect x="26" y="22.5" width="12" height="4.6" rx="1.2" fill="#fff" stroke="#0b1f3a" strokeWidth="1" />
      <path d="M29 24.8h6" stroke="#e8713a" strokeWidth="1.4" strokeLinecap="round" />
      {/* Ventanitas */}
      <rect x="15" y="34" width="6" height="4.5" rx="1" fill="#bfe3ff" stroke="#0b1f3a" strokeWidth="1" />
      <rect x="43" y="34" width="6" height="4.5" rx="1" fill="#bfe3ff" stroke="#0b1f3a" strokeWidth="1" />
      {/* Cortina */}
      <path d="M24 34h16v16H24z" fill={`url(#${id}door)`} stroke="#0b1f3a" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M24 37h16M24 40h16M24 43h16" stroke="#8fa2b5" strokeWidth="0.9" />
      {/* Cajas: suben un poquito al pasar el mouse */}
      <g className="transition-transform duration-300 ease-out group-hover:-translate-y-1">
        <rect x="26.5" y="44" width="5.5" height="5.5" rx="0.8" fill={`url(#${id}box)`} stroke="#b45309" strokeWidth="0.9" />
        <rect x="32.3" y="44" width="5.5" height="5.5" rx="0.8" fill={`url(#${id}box)`} stroke="#b45309" strokeWidth="0.9" />
        <rect x="29.4" y="38.6" width="5.5" height="5.5" rx="0.8" fill={`url(#${id}box)`} stroke="#b45309" strokeWidth="0.9" />
        <path d="M29.2 44v2M35 44v2M32.1 38.6v2" stroke="#fff3dc" strokeWidth="0.9" />
      </g>
    </svg>
  );
}

// Ícono pequeño de ubicación (listas, tarjetas, menús): la misma ilustración, en su tamaño
export function LocArt({ kind, size = 40 }: { kind: "warehouse" | "van"; size?: number }) {
  return kind === "van" ? <VanArt size={size} /> : <WarehouseArt size={size} />;
}
