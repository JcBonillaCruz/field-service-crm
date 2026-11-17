// Íconos ilustrados del Dashboard de inicio (mismo estilo que los de las apps y Operations).
// Se animan solo al pasar el mouse sobre la tarjeta (clase "group" en la tarjeta).
type P = { size?: number };

// Disponibilidad del equipo: dos personas y una palomita
export function TeamArt({ size = 44 }: P) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" className="shrink-0 drop-shadow-sm">
      <circle cx="24" cy="24" r="22.5" fill="#eef4ff" stroke="#bfd3fe" strokeWidth="1.5" />
      <circle cx="29" cy="18.5" r="4.2" fill="#c8d8f5" />
      <path d="M21.5 32a7.5 7.5 0 0 1 15 0z" fill="#c8d8f5" />
      <circle cx="19.5" cy="19.5" r="4.8" fill="#3b6fd8" />
      <path d="M11 34a8.5 8.5 0 0 1 17 0z" fill="#3b6fd8" />
      <g className="origin-center transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" style={{ transformBox: "fill-box" }}>
        <circle cx="35" cy="33" r="6.5" fill="#fff" stroke="#14a39a" strokeWidth="1.6" />
        <path d="m32.2 33.1 2 2 3.9-4" fill="none" stroke="#0f766e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

// Ícono de cada aviso (círculo suave del color del nivel)
const TONE = {
  red: ["#fff1f2", "#e11d48"], orange: ["#fff6e6", "#d97706"], blue: ["#eef4ff", "#2563eb"], gray: ["#f1f5f9", "#64748b"], teal: ["#e7f6f1", "#0f766e"],
} as const;
const PATHS: Record<string, string> = {
  delayed: "M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.6 1.8M9.5 2.5h5",
  unassigned: "M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3.5 20a6.5 6.5 0 0 1 11-4.7M17.5 15.5a2.2 2.2 0 1 1 2.5 2.2c-.4.1-.7.4-.7.8v.4M19.3 21.5h.01",
  needs_followup: "M9 4h6v3H9zM7 5.5H5.5V21h13V5.5H17M9 12h6M9 16h4",
  paused: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM10 9v6M14 9v6",
  low_stock: "M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8",
  out_of_stock: "M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8",
  overdue: "M5 3h11l3 3v15H5zM9 9h6M9 13h6M9 17h3",
  due_soon: "M5 3h11l3 3v15H5zM9 9h6M9 13h6M9 17h3",
  after_hours: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z",
  check: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v5M12 16.5h.01",
  on_my_way: "M2.5 7h11v8.5h-11zM13.5 10h4l3 3v2.5h-7zM6.5 19a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6zM17 19a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h3M13 14h3M8 17h3",
  working: "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.1-.4-.4-2.1z",
};
export function AlertIcon({ kind, level, size = 36 }: { kind: string; level: keyof typeof TONE; size?: number }) {
  const [bg, fg] = TONE[level];
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110" style={{ width: size, height: size, backgroundColor: bg, color: fg }}>
      <svg viewBox="0 0 24 24" className="h-[52%] w-[52%]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d={PATHS[kind] ?? PATHS.check} />
      </svg>
    </span>
  );
}

// ---------- Íconos de las pestañas del inicio (mismo estilo que All apps) ----------
// Dashboard: tablero con tarjetas, una gráfica y una campanita de aviso
export function DashboardArt({ size = 48, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} aria-hidden="true">
      <circle cx="24" cy="25" r="20" fill="#e6f6f2" />
      {/* pantalla */}
      <rect x="7" y="10" width="30" height="24" rx="3" fill="#24305e" />
      <rect x="9.5" y="12.5" width="25" height="19" rx="1.6" fill="#fff" />
      <rect x="18" y="34" width="8" height="3.5" fill="#56708f" />
      <rect x="14" y="37.5" width="16" height="2.4" rx="1.2" fill="#56708f" />
      {/* tarjetas */}
      <rect x="11.5" y="14.5" width="6" height="5" rx="1" fill="#14a39a" />
      <rect x="19" y="14.5" width="6" height="5" rx="1" fill="#3b82f6" />
      <rect x="26.5" y="14.5" width="6" height="5" rx="1" fill="#e8713a" />
      {/* barras */}
      <rect x="12" y="25" width="2.6" height="4.5" rx=".6" fill="#9fd3c7" />
      <rect x="16" y="23" width="2.6" height="6.5" rx=".6" fill="#5fcfc0" />
      <rect x="20" y="21.5" width="2.6" height="8" rx=".6" fill="#14a39a" />
      <rect x="24" y="24" width="2.6" height="5.5" rx=".6" fill="#7fdacd" />
      <path d="M28 22.5h4.5M28 25.5h3M28 28.5h4" stroke="#c8d8ec" strokeWidth="1.3" strokeLinecap="round" />
      {/* campanita */}
      <g className="origin-[38px_15px] transition-transform duration-300 group-hover/app:rotate-12 group-hover:rotate-12">
        <circle cx="38" cy="18" r="7.5" fill="#fff" stroke="#f59e0b" strokeWidth="1.6" />
        <path d="M35 20.5h6l-.9-1.3v-2.6a2.1 2.1 0 0 0-4.2 0v2.6z" fill="#f59e0b" />
        <circle cx="38" cy="21.8" r="1" fill="#f59e0b" />
        <circle cx="42.5" cy="12.5" r="2.4" fill="#e11d48" stroke="#fff" strokeWidth="1" />
      </g>
    </svg>
  );
}

// Help: burbuja de chat con signo de pregunta y un salvavidas
export function HelpArt({ size = 48, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} aria-hidden="true">
      <circle cx="24" cy="25" r="20" fill="#ece9ff" />
      {/* burbuja */}
      <path d="M8 13a4 4 0 0 1 4-4h18a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H17l-6 5v-5h0a3 3 0 0 1-3-3z" fill="#4f46e5" />
      <path d="M17.5 15.5a3.5 3.5 0 1 1 5 3.2c-.9.4-1.5 1.1-1.5 2v.6" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="21" cy="24.6" r="1.3" fill="#fff" />
      {/* salvavidas */}
      <g className="origin-[35px_33px] transition-transform duration-300 group-hover/app:rotate-45 group-hover:rotate-45">
        <circle cx="35" cy="33" r="8.5" fill="#fff" stroke="#e8713a" strokeWidth="4" />
        <path d="M35 24.5v3.5M35 38v3.5M26.5 33H30M40 33h3.5" stroke="#fff" strokeWidth="2.6" />
        <circle cx="35" cy="33" r="4" fill="none" stroke="#f4a37a" strokeWidth="1" />
      </g>
    </svg>
  );
}
