// Íconos ilustrados de los formularios y equipos (mismo estilo que FileArt) — Paso 5.5
type P = { size?: number; className?: string };
const move = "transition-transform duration-200 ease-out group-hover:scale-110 group-active:scale-95";

export function WorkFormArt({ size = 40, className = "" }: P) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="#e9f1ff" />
      <g className={`origin-center ${move}`}>
        <rect x="13" y="11" width="22" height="28" rx="3.5" fill="#fff" stroke="#2563eb" strokeWidth="1.6" />
        <rect x="19" y="8.5" width="10" height="5.5" rx="2" fill="#2563eb" />
        <path d="M17.5 21h13M17.5 26h13M17.5 31h8" stroke="#9db8ee" strokeWidth="1.8" strokeLinecap="round" />
        <path d="m27.5 31.5 2.2 2.2 4.3-4.6" stroke="#14a39a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
    </svg>
  );
}

export function TuneUpArt({ size = 40, className = "" }: P) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="#fff3e3" />
      <g className={`origin-center ${move}`}>
        <path d="M10 30a14 14 0 0 1 28 0z" fill="#fff" stroke="#e8713a" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M13 30a11 11 0 0 1 5-9.2" stroke="#14a39a" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M30 20.8A11 11 0 0 1 35 30" stroke="#e11d48" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M24 30l6.5-8.5" stroke="#0b1f3a" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="24" cy="30" r="2.6" fill="#0b1f3a" />
        <rect x="14" y="33.5" width="20" height="4" rx="2" fill="#f6b98f" />
      </g>
    </svg>
  );
}

export function EquipmentArt({ size = 40, className = "" }: P) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="#e3f6f1" />
      <g className={`origin-center ${move}`}>
        <rect x="10" y="14" width="28" height="21" rx="3.5" fill="#14a39a" />
        <rect x="10" y="14" width="28" height="5" rx="2.5" fill="#0f766e" />
        <circle cx="20.5" cy="26.5" r="6.2" fill="#fff" />
        <path d="M20.5 21.3v10.4M15.3 26.5h10.4M16.8 22.8l7.4 7.4M24.2 22.8l-7.4 7.4" stroke="#0f766e" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="20.5" cy="26.5" r="1.7" fill="#0b1f3a" />
        <path d="M30 23h5M30 26.5h5M30 30h5" stroke="#d9f3ec" strokeWidth="1.6" strokeLinecap="round" />
        <rect x="14" y="35" width="4" height="2.5" rx="1" fill="#0c5f59" /><rect x="30" y="35" width="4" height="2.5" rx="1" fill="#0c5f59" />
      </g>
    </svg>
  );
}
