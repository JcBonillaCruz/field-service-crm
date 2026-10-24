// Íconos ilustrados de las apps (a color, estilo de las ilustraciones de referencia)
export function FinanceArt({ size = 48, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} aria-hidden="true">
      <circle cx="26" cy="25" r="20" fill="#e3effd" />
      {/* barras de fondo */}
      <rect x="33" y="17" width="6" height="22" rx="1.2" fill="#9cc3f2" />
      {/* tablero */}
      <rect x="11" y="10" width="20" height="28" rx="2.5" fill="#56708f" />
      <rect x="13" y="13" width="16" height="23" rx="1.2" fill="#fff" />
      <rect x="16.5" y="8" width="9" height="4" rx="1.6" fill="#2b5b8f" />
      <rect x="15" y="25" width="2.4" height="4" rx=".6" fill="#9cc3f2" />
      <rect x="18.6" y="22" width="2.4" height="7" rx=".6" fill="#5b9be0" />
      <rect x="22.2" y="19" width="2.4" height="10" rx=".6" fill="#3b7fd1" />
      <rect x="25.8" y="21" width="2.4" height="8" rx=".6" fill="#7fb0ea" />
      <rect x="15" y="31.5" width="12" height="1.4" rx=".7" fill="#c8d8ec" />
      {/* flecha verde de crecimiento */}
      <g className="origin-[20px_34px] transition-transform duration-300 group-hover/app:scale-110 group-hover:scale-110">
        <path d="M8 36 20 26l5 4 13-12" fill="none" stroke="#3db54a" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M33.5 15.5h6v6z" fill="#3db54a" stroke="#3db54a" strokeWidth="1.6" strokeLinejoin="round" />
      </g>
      {/* monedas */}
      <ellipse cx="34" cy="40.5" rx="6" ry="2" fill="#e59a17" />
      <rect x="28" y="36" width="12" height="4.5" fill="#f5b52a" />
      <ellipse cx="34" cy="36" rx="6" ry="2" fill="#ffd25e" />
      <circle cx="40" cy="33" r="4.2" fill="#f5b52a" stroke="#e59a17" strokeWidth="1" />
      <path d="M40.9 31.4c-.3-.4-.8-.6-1.3-.5-.6.1-.9.5-.8.9.1.9 2.3.5 2.4 1.6.1.6-.4 1-1.1 1-.6 0-1.1-.2-1.4-.6M40 30.4v.6M40 35v.6" fill="none" stroke="#a86400" strokeWidth=".8" strokeLinecap="round" />
    </svg>
  );
}

export function QrArt({ size = 48, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} aria-hidden="true">
      <circle cx="24" cy="25" r="20" fill="#ece9ff" />
      <path d="M6 40c3-6 7-8 10-8s5 3 5 8z" fill="#7bd3a1" opacity=".55" />
      {/* teléfono */}
      <rect x="14" y="7" width="20" height="34" rx="3.5" fill="#24305e" />
      <rect x="16" y="11" width="16" height="25" rx="1.6" fill="#fff" />
      <rect x="21.5" y="8.6" width="5" height="1.2" rx=".6" fill="#4b5893" />
      {/* código QR */}
      <g fill="#24305e">
        <path d="M18 14h4v4h-4zM26 14h4v4h-4zM18 22h4v4h-4z" />
        <path d="M23.2 14h1.6v1.6h-1.6zM23.2 17.2h1.6v1.6h-1.6zM26 20h1.6v1.6H26zM28.4 22.4H30V24h-1.6zM23.2 22.4h1.6V24h-1.6zM26 24.8h1.6v1.6H26zM23.2 20h1.6v1.6h-1.6zM28.4 20H30v1.6h-1.6z" />
      </g>
      <path d="M19.2 15.2h1.6v1.6h-1.6zM27.2 15.2h1.6v1.6h-1.6zM19.2 23.2h1.6v1.6h-1.6z" fill="#e8713a" />
      <rect x="17.5" y="29.5" width="13" height="2.6" rx="1.3" fill="#e8713a" />
      {/* lupa naranja */}
      <g className="transition-transform duration-300 group-hover/app:-translate-x-0.5 group-hover/app:-translate-y-0.5 group-hover:-translate-x-0.5 group-hover:-translate-y-0.5">
        <circle cx="33" cy="25" r="6" fill="#fff" fillOpacity=".55" stroke="#f59e0b" strokeWidth="2.6" />
        <path d="M37.3 29.3 42 34" stroke="#f59e0b" strokeWidth="3.4" strokeLinecap="round" />
      </g>
    </svg>
  );
}
