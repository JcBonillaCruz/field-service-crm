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
  red: ["#fff1f2", "#e11d48"], orange: ["#fff6e6", "#d97706"], blue: ["#eef4ff", "#2563eb"], gray: ["#f1f5f9", "#64748b"],
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
