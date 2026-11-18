// Íconos ilustrados de la pantalla de inicio del técnico (mismo estilo que los de All apps:
// a color, con varias capas y una pieza que se mueve). Sin librerías: SVG puro.
type P = { size?: number; className?: string };
const idle = "motion-reduce:animate-none";
const move = "transition-transform duration-300 ease-out";

// Mapita doblado con ruta y pin (botón Navigate)
export function NavArt({ size = 44, className = "" }: P) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" className={`shrink-0 ${className}`}>
      <circle cx="24" cy="24" r="23" fill="#e3f6f1" stroke="#a9dfd4" strokeWidth="1.2" />
      {/* mapa en tres dobleces */}
      <path d="M9 16.5 18 13v20l-9 3.5z" fill="#fff" stroke="#8fd3c5" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M18 13l10 3.5v20L18 33z" fill="#d6f1ea" stroke="#8fd3c5" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M28 16.5 37 13v20l-9 3.5z" fill="#fff" stroke="#8fd3c5" strokeWidth="1.1" strokeLinejoin="round" />
      {/* calles y parque */}
      <path d="M9 24.5l9-3 10 3.2 9-3.2" fill="none" stroke="#c9ece5" strokeWidth="2.2" strokeLinecap="round" />
      <rect x="20.5" y="26.5" width="5" height="4.5" rx="1" fill="#a7e3b5" />
      {/* ruta punteada */}
      <path d="M13 31c3-1 4-5 8-5.5s5 2 8-.5 3-5 3-5" fill="none" stroke="#e8713a" strokeWidth="1.9" strokeLinecap="round" strokeDasharray="2.4 3" />
      <circle cx="13" cy="31" r="2" fill="#0f766e" stroke="#fff" strokeWidth="1" />
      {/* pin que brinca */}
      <g className={`animate-[bp-dot_1.3s_ease-in-out_infinite] ${idle}`}>
        <g className={`origin-[32px_20px] ${move} group-hover:scale-125`}>
          <path d="M32 21.5s5.2-4.7 5.2-8.7a5.2 5.2 0 1 0-10.4 0c0 4 5.2 8.7 5.2 8.7z" fill="#e8713a" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round" />
          <circle cx="32" cy="12.8" r="1.9" fill="#fff" />
        </g>
      </g>
    </svg>
  );
}

// Teléfono (llamar al cliente)
export function CallArt({ size = 44, className = "" }: P) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" className={`shrink-0 ${className}`}>
      <circle cx="24" cy="24" r="23" fill="#eaf2ff" stroke="#bcd3ff" strokeWidth="1.2" />
      <g className={`origin-[24px_24px] ${move} group-hover:animate-[bp-ring_0.7s_ease-in-out]`}>
        <path d="M17.2 12.6l3.3-.9a1.8 1.8 0 0 1 2.1 1l1.6 3.8a1.8 1.8 0 0 1-.5 2.1l-2 1.7a12.6 12.6 0 0 0 6 6l1.7-2a1.8 1.8 0 0 1 2.1-.5l3.8 1.6a1.8 1.8 0 0 1 1 2.1l-.9 3.3a2.6 2.6 0 0 1-2.6 1.9C22.3 33.4 14.6 25.7 15.3 15.2a2.6 2.6 0 0 1 1.9-2.6z" fill="#2563eb" stroke="#1e40af" strokeWidth="1" strokeLinejoin="round" />
      </g>
      {/* ondas */}
      <g className={`origin-[30px_18px] animate-[bp-glow_1.8s_ease-in-out_infinite] ${idle}`}>
        <path d="M29 14.5a5 5 0 0 1 4.5 4.5M30 10.5a9 9 0 0 1 7.5 7.5" fill="none" stroke="#60a5fa" strokeWidth="1.8" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// Burbujas del chat del trabajo
export function ChatArt({ size = 44, className = "" }: P) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" className={`shrink-0 ${className}`}>
      <circle cx="24" cy="24" r="23" fill="#f3efff" stroke="#d6cbff" strokeWidth="1.2" />
      <path d="M22 26.5h11.5a3 3 0 0 1 3 3v3.5a3 3 0 0 1-3 3H33v3l-3.6-3H22a3 3 0 0 1-3-3v-3.5a3 3 0 0 1 3-3z" fill="#c4b5fd" />
      <g className={`origin-[22px_20px] ${move} group-hover:-rotate-6 group-hover:scale-105`}>
        <path d="M13.5 11h17a3.5 3.5 0 0 1 3.5 3.5v8a3.5 3.5 0 0 1-3.5 3.5H21l-5 4v-4h-2.5a3.5 3.5 0 0 1-3.5-3.5v-8a3.5 3.5 0 0 1 3.5-3.5z" fill="#7c3aed" stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />
        <circle cx="16.5" cy="18.5" r="1.5" fill="#fff" className={`animate-[bp-dot_1s_ease-in-out_infinite] ${idle}`} />
        <circle cx="22" cy="18.5" r="1.5" fill="#fff" className={`animate-[bp-dot_1s_ease-in-out_0.15s_infinite] ${idle}`} />
        <circle cx="27.5" cy="18.5" r="1.5" fill="#fff" className={`animate-[bp-dot_1s_ease-in-out_0.3s_infinite] ${idle}`} />
      </g>
    </svg>
  );
}

// Hoja del trabajo con flecha (abrir el trabajo)
export function OpenArt({ size = 44, className = "" }: P) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" className={`shrink-0 ${className}`}>
      <circle cx="24" cy="24" r="23" fill="#fff1e6" stroke="#fbd0b3" strokeWidth="1.2" />
      <rect x="12" y="11" width="19" height="26" rx="2.8" fill="#fff" stroke="#f4b48d" strokeWidth="1.2" />
      <rect x="17.5" y="9" width="8" height="4" rx="1.6" fill="#e8713a" />
      <path d="M15.5 18.5l1.5 1.5 2.6-2.8" fill="none" stroke="#16a34a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="21.5" y="18" width="6.5" height="1.7" rx=".85" fill="#f6c9ab" />
      <path d="M15.5 24.5l1.5 1.5 2.6-2.8" fill="none" stroke="#16a34a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="21.5" y="24" width="5" height="1.7" rx=".85" fill="#f6c9ab" />
      <rect x="15.5" y="30" width="9" height="1.7" rx=".85" fill="#f6c9ab" />
      <g className={`${move} group-hover:translate-x-[2.5px]`}>
        <circle cx="33" cy="31" r="8" fill="#e8713a" stroke="#fff" strokeWidth="1.6" />
        <path d="M29.5 31h7M33.5 27.8l3.2 3.2-3.2 3.2" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

// Caja de herramientas (trabajos de hoy)
export function ToolboxArt({ size = 40, className = "" }: P) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" className={`shrink-0 ${className}`}>
      <circle cx="24" cy="25" r="20" fill="#eaf2ff" />
      <g className={`origin-[24px_20px] ${move} group-hover:-rotate-[14deg]`}>
        <path d="M18 19v-3.5a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3V19" fill="none" stroke="#1e40af" strokeWidth="2.4" strokeLinecap="round" />
      </g>
      <rect x="9" y="18.5" width="30" height="18" rx="3" fill="#2563eb" />
      <rect x="9" y="18.5" width="30" height="7.5" rx="3" fill="#3b82f6" />
      <rect x="9" y="24.5" width="30" height="2" fill="#1e40af" />
      <rect x="20.5" y="22.5" width="7" height="6" rx="1.5" fill="#fbbf24" stroke="#fff" strokeWidth="1.1" />
      <circle cx="24" cy="25.5" r="1" fill="#92400e" />
    </svg>
  );
}

// Medalla con palomita (terminados)
export function DoneArt({ size = 40, className = "" }: P) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" className={`shrink-0 ${className}`}>
      <circle cx="24" cy="25" r="20" fill="#e3f7ea" />
      <path d="M17.5 29l-3 10 5.5-2.5L23 41l2-9zM30.5 29l3 10-5.5-2.5L25 41l-2-9z" fill="#f59e0b" />
      <g className={`origin-[24px_22px] ${move} group-hover:scale-110 group-hover:rotate-[8deg]`}>
        <circle cx="24" cy="22" r="12" fill="#16a34a" stroke="#fff" strokeWidth="1.6" />
        <circle cx="24" cy="22" r="9" fill="none" stroke="#bbf7d0" strokeWidth="1.1" />
        <path d="M18.8 22.3l3.6 3.6 7-7.2" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

// Reloj grande de la tarjeta Clock in / Clock out (las manecillas giran cuando el día está iniciado)
export function ClockArt({ size = 46, running = false, className = "" }: P & { running?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" className={`shrink-0 ${className}`}>
      <circle cx="24" cy="25" r="21" fill={running ? "#dff5ef" : "#eef2f6"} />
      <rect x="20.5" y="3.5" width="7" height="4" rx="1.4" fill={running ? "#0b5f59" : "#64748b"} />
      <path d="M36 11.5l2.6 2.6" stroke={running ? "#0b5f59" : "#64748b"} strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="24" cy="26" r="17" fill={running ? "#0f766e" : "#94a3b8"} />
      <circle cx="24" cy="26" r="13.5" fill="#fff" />
      <path d="M24 14.8v2M24 35.2v2M12.8 26h2M33.2 26h2" stroke={running ? "#9ad9cd" : "#cbd5e1"} strokeWidth="1.5" strokeLinecap="round" />
      <g className={`origin-[24px_26px] ${running ? `animate-[spin_6s_linear_infinite] ${idle}` : `${move} group-hover:rotate-[40deg]`}`}>
        <path d="M24 26v-8.5" stroke="#0b1f3a" strokeWidth="2.2" strokeLinecap="round" />
      </g>
      <path d="M24 26l5.5 3.2" stroke="#e8713a" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="24" cy="26" r="1.8" fill="#0b1f3a" />
    </svg>
  );
}

// Reloj de arena (horas del día)
export function HoursArt({ size = 40, className = "" }: P) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" className={`shrink-0 ${className}`}>
      <circle cx="24" cy="25" r="20" fill="#fff3dc" />
      <g className={`origin-[24px_25px] ${move} group-hover:rotate-180`}>
        <rect x="14" y="10" width="20" height="3.6" rx="1.8" fill="#b45309" />
        <rect x="14" y="36.4" width="20" height="3.6" rx="1.8" fill="#b45309" />
        <path d="M16.5 13.6h15c0 6-5 8-5 11.4s5 5.4 5 11.4h-15c0-6 5-8 5-11.4s-5-5.4-5-11.4z" fill="#fff" stroke="#f1c27a" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M19 16.5h10c-.8 3-3.6 4.3-5 6.3-1.4-2-4.2-3.3-5-6.3z" fill="#f59e0b" />
        <path d="M24 28c2.6 2 5.6 3.6 6.2 7.4H17.8c.6-3.8 3.6-5.4 6.2-7.4z" fill="#fbbf24" />
        <path d="M24 23v4.5" stroke="#f59e0b" strokeWidth="1.3" strokeLinecap="round" strokeDasharray="1.2 1.6" />
      </g>
    </svg>
  );
}

// Camioneta con cajas (My Van)
export function VanArt({ size = 44, className = "" }: P) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" className={`shrink-0 ${className}`}>
      <circle cx="24" cy="25" r="20" fill="#eaf2ff" />
      <ellipse cx="24" cy="37.5" rx="15" ry="1.8" fill="#c9dbfb" />
      <g className={`${move} group-hover:translate-x-[2px]`}>
        <path d="M8 17a2.5 2.5 0 0 1 2.5-2.5h15A2.5 2.5 0 0 1 28 17v16H8z" fill="#2563eb" />
        <path d="M28 20h6a2.5 2.5 0 0 1 2.1 1.2l3.4 5.6V33H28z" fill="#1d4ed8" />
        <path d="M30 22h4l2.8 4.6H30z" fill="#e0f2fe" />
        <rect x="8" y="27.5" width="20" height="2.2" fill="#e8713a" />
        <rect x="11" y="18" width="6" height="6" rx="1" fill="#fbbf24" stroke="#fff" strokeWidth=".9" /><path d="M14 18v6" stroke="#fff" strokeWidth=".9" />
        <rect x="18.5" y="19.5" width="5.5" height="4.5" rx="1" fill="#fde68a" stroke="#fff" strokeWidth=".9" />
        <circle cx="15" cy="34" r="3.8" fill="#1f2937" /><circle cx="15" cy="34" r="1.5" fill="#e5e7eb" />
        <circle cx="33" cy="34" r="3.8" fill="#1f2937" /><circle cx="33" cy="34" r="1.5" fill="#e5e7eb" />
      </g>
    </svg>
  );
}

// Código de barras con la línea del lector (Scan part)
export function ScanArt({ size = 44, className = "" }: P) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" className={`shrink-0 ${className}`}>
      <circle cx="24" cy="25" r="20" fill="#fff1e6" />
      <rect x="10" y="14" width="28" height="22" rx="3" fill="#fff" stroke="#f4b48d" strokeWidth="1.2" />
      <path d="M14.5 19v12M17.5 19v12M21.5 19v12M24 19v12M28 19v12M30.5 19v12M33.5 19v12" stroke="#0b1f3a" strokeLinecap="round" strokeWidth="1.5" />
      <path d="M19.5 19v12M26 19v12" stroke="#0b1f3a" strokeLinecap="round" strokeWidth="2.6" />
      <g className={`animate-[bp-scan_1.8s_ease-in-out_infinite] ${idle}`}>
        <rect x="8" y="24" width="32" height="2.2" rx="1.1" fill="#e8713a" />
        <rect x="8" y="22" width="32" height="6.2" rx="3" fill="#e8713a" opacity=".18" />
      </g>
    </svg>
  );
}

// Trabajo programado (fila de la lista): casa con calendario
export function JobArt({ size = 30, color = "#14a39a", className = "" }: P & { color?: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" className={`shrink-0 ${className}`}>
      <circle cx="24" cy="24" r="23" fill="#fff" stroke={color} strokeOpacity=".35" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="23" fill={color} opacity=".1" />
      <path d="M13.5 23.5 24 14.5l10.5 9V35h-21z" fill="#fff" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M11 24.5 24 13.3l13 11.2" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="21" y="27" width="6" height="8" rx="1" fill={color} />
      <rect x="15.8" y="25.5" width="3.6" height="3.6" rx=".7" fill={color} opacity=".35" /><rect x="28.6" y="25.5" width="3.6" height="3.6" rx=".7" fill={color} opacity=".35" />
    </svg>
  );
}

// Íconos chicos de las pestañas: Today · New · Paused · Done
export function TabArt({ kind, on, size = 20 }: { kind: "today" | "new" | "paused" | "done"; on: boolean; size?: number }) {
  const c = on ? { today: "#e8713a", new: "#2563eb", paused: "#e11d48", done: "#16a34a" }[kind] : "#94a3b8";
  const soft = on ? { today: "#ffe9d9", new: "#e0ebff", paused: "#ffe4e6", done: "#dcfce7" }[kind] : "#e9eef3";
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className={`shrink-0 transition-transform duration-200 ${on ? "scale-110" : ""}`}>
      {kind === "today" && <>
        <circle cx="12" cy="12" r="5" fill={c} />
        <g className={`origin-[12px_12px] ${on ? `animate-[spin_9s_linear_infinite] ${idle}` : ""}`}>
          <path d="M12 2.5v2.3M12 19.2v2.3M2.5 12h2.3M19.2 12h2.3M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
        </g>
      </>}
      {kind === "new" && <>
        <rect x="3.5" y="5" width="17" height="15" rx="3" fill={soft} stroke={c} strokeWidth="1.5" />
        <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M12 11.8v5.4M9.3 14.5h5.4" stroke={c} strokeWidth="1.9" strokeLinecap="round" />
      </>}
      {kind === "paused" && <>
        <circle cx="12" cy="12" r="9" fill={soft} stroke={c} strokeWidth="1.5" />
        <rect x="8.6" y="8" width="2.4" height="8" rx="1" fill={c} /><rect x="13" y="8" width="2.4" height="8" rx="1" fill={c} />
      </>}
      {kind === "done" && <>
        <circle cx="12" cy="12" r="9" fill={on ? c : soft} stroke={c} strokeWidth="1.5" />
        <path d="M7.8 12.3l2.9 2.9 5.5-5.7" fill="none" stroke={on ? "#fff" : c} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      </>}
    </svg>
  );
}

// Dibujo para cuando no hay trabajos: portapapeles tranquilo con una taza de café
export function EmptyArt({ size = 92 }: { size?: number }) {
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} aria-hidden="true" className="mx-auto">
      <circle cx="48" cy="50" r="40" fill="#e9f7f4" />
      <ellipse cx="48" cy="80" rx="28" ry="3.5" fill="#cfece6" />
      <rect x="24" y="20" width="36" height="50" rx="5" fill="#fff" stroke="#8fd3c5" strokeWidth="1.8" />
      <rect x="34" y="16" width="16" height="8" rx="3" fill="#0f766e" />
      <path d="M31 36l3 3 5.5-6" fill="none" stroke="#16a34a" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="43" y="34.5" width="12" height="3" rx="1.5" fill="#c9ece5" />
      <path d="M31 48l3 3 5.5-6" fill="none" stroke="#16a34a" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="43" y="46.5" width="9" height="3" rx="1.5" fill="#c9ece5" />
      <rect x="31" y="58" width="20" height="3" rx="1.5" fill="#c9ece5" />
      {/* taza */}
      <g className={`animate-[bp-dot_2.4s_ease-in-out_infinite] ${idle}`}>
        <path d="M62 44c0-3 3-3 3-6M68 44c0-3 3-3 3-6" fill="none" stroke="#f4b48d" strokeWidth="2" strokeLinecap="round" />
      </g>
      <path d="M56 50h20v10a10 10 0 0 1-20 0z" fill="#e8713a" stroke="#fff" strokeWidth="1.8" />
      <path d="M76 53h3a4 4 0 0 1 0 8h-3.6" fill="none" stroke="#e8713a" strokeWidth="2.6" strokeLinecap="round" />
      <rect x="54" y="70" width="24" height="3" rx="1.5" fill="#c2410c" />
    </svg>
  );
}
