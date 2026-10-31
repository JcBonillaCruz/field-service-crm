// Íconos ilustrados de las tarjetas de Inventory (mismo estilo que los íconos de las apps).
// Se animan solo al pasar el mouse sobre la tarjeta (clase "group" en la tarjeta).
type P = { size?: number };

// Total Items: cajas apiladas con su etiqueta
export function ItemsArt({ size = 44 }: P) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <circle cx="24" cy="25" r="20" fill="#e6f6f2" />
      <rect x="6" y="39" width="36" height="2.2" rx="1.1" fill="#9fd3c7" />
      <g className="origin-[24px_39px] transition-transform duration-300 ease-out group-hover:-translate-y-1">
        <path d="M24 9l9 4v9l-9 4-9-4v-9z" fill="#ffc876" />
        <path d="M24 9l9 4-9 4-9-4z" fill="#ffe0a8" />
        <path d="M24 17v9l9-4v-9z" fill="#f2a43a" />
        <path d="M19.5 11l9 4" stroke="#fff3dc" strokeWidth="1.1" />
      </g>
      <path d="M15 23l9 4v10l-9 4-9-4V27z" fill="#2bb3a4" />
      <path d="M15 23l9 4-9 4-9-4z" fill="#7fdacd" />
      <path d="M15 31v10l9-4V27z" fill="#0f766e" />
      <path d="M33 23l9 4v10l-9 4-9-4V27z" fill="#14a39a" />
      <path d="M33 23l9 4-9 4-9-4z" fill="#5fcfc0" />
      <path d="M33 31v10l9-4V27z" fill="#0c5f59" />
    </svg>
  );
}

// Inventory Value: billete y monedas
export function ValueArt({ size = 44 }: P) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <circle cx="24" cy="25" r="20" fill="#e8f0fd" />
      <g className="origin-[22px_24px] transition-transform duration-300 ease-out group-hover:-rotate-6">
        <rect x="7" y="14" width="30" height="18" rx="3" fill="#3db54a" />
        <rect x="9.5" y="16.5" width="25" height="13" rx="2" fill="none" stroke="#a7e3ae" strokeWidth="1" />
        <circle cx="22" cy="23" r="4.2" fill="#a7e3ae" />
        <path d="M23 21.3c-.3-.5-.9-.7-1.5-.6-.7.1-1 .5-.9 1 .1 1 2.6.6 2.7 1.8.1.7-.5 1.1-1.3 1.1-.7 0-1.2-.2-1.6-.7M22 20.2v.7M22 25.4v.7" fill="none" stroke="#1f7a2b" strokeWidth=".9" strokeLinecap="round" />
      </g>
      <g className="transition-transform duration-300 ease-out group-hover:-translate-y-1">
        <ellipse cx="34" cy="40" rx="7" ry="2.3" fill="#e59a17" />
        <rect x="27" y="35" width="14" height="5" fill="#f5b52a" />
        <ellipse cx="34" cy="35" rx="7" ry="2.3" fill="#ffd25e" />
        <rect x="27" y="30.5" width="14" height="4.5" fill="#f5b52a" />
        <ellipse cx="34" cy="30.5" rx="7" ry="2.3" fill="#ffe08a" />
        <path d="M31.5 30.5h5" stroke="#e59a17" strokeWidth="1" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// Low Stock: caja medio vacía con alerta ámbar
export function LowArt({ size = 44 }: P) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <circle cx="24" cy="25" r="20" fill="#fff3dc" />
      <path d="M8 22h26v16a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2z" fill="#e8b36a" />
      <path d="M8 22l4-6h18l4 6z" fill="#f4cc8c" />
      <rect x="11" y="31" width="20" height="7" rx="1.5" fill="#d4964a" />
      <rect x="13" y="33" width="5" height="3" rx=".8" fill="#ffe0a8" />
      <path d="M18 22h6" stroke="#fff3dc" strokeWidth="1.4" strokeLinecap="round" />
      <g className="origin-[35px_17px] transition-transform duration-300 ease-out group-hover:scale-110 group-hover:-rotate-6">
        <path d="M35 6.5l9 15.5H26z" fill="#f59e0b" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M35 12v5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <circle cx="35" cy="19.4" r="1.1" fill="#fff" />
      </g>
    </svg>
  );
}

// Out of Stock: caja vacía con señal roja
export function OutArt({ size = 44 }: P) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <circle cx="24" cy="25" r="20" fill="#ffe8ec" />
      <path d="M7 22h28v16a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z" fill="#c9d3df" />
      <path d="M7 22l-2-5h14l2 5zM35 22l2-5H23l-2 5z" fill="#e2e8f0" />
      <path d="M11 26h20" stroke="#aab6c5" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="2 2.5" />
      <path d="M12 36h6" stroke="#aab6c5" strokeWidth="1.4" strokeLinecap="round" />
      <g className="origin-[36px_16px] transition-transform duration-300 ease-out group-hover:rotate-90">
        <circle cx="36" cy="16" r="8" fill="#e11d48" stroke="#fff" strokeWidth="1.8" />
        <path d="M32.8 12.8l6.4 6.4M39.2 12.8l-6.4 6.4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      </g>
    </svg>
  );
}
