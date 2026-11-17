// Íconos ilustrados (mismo estilo que los de las apps) para fotos, galería, PDF y reporte — Paso 5.4c
type P = { size?: number; className?: string };
const move = "transition-transform duration-200 ease-out group-hover:scale-110 group-active:scale-95";

export function CameraArt({ size = 48, className = "" }: P) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="#e3f6f1" />
      <g className={`origin-center ${move}`}>
        <rect x="18" y="12.5" width="12" height="6" rx="2" fill="#0c5f59" />
        <rect x="9" y="16" width="30" height="21" rx="4.5" fill="#14a39a" />
        <rect x="9" y="16" width="30" height="6.5" rx="3.2" fill="#0f766e" />
        <circle cx="24" cy="27.5" r="7.6" fill="#fff" />
        <circle cx="24" cy="27.5" r="5.4" fill="#0b1f3a" />
        <circle cx="24" cy="27.5" r="3" fill="#2f6fd0" />
        <circle cx="22.3" cy="25.8" r="1.2" fill="#fff" opacity=".85" />
        <rect x="32.5" y="18.3" width="3.6" height="2.2" rx="1.1" fill="#ffd25e" />
      </g>
    </svg>
  );
}

export function GalleryArt({ size = 48, className = "" }: P) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="#fff0e6" />
      <g className={`origin-center ${move}`}>
        <rect x="14" y="10.5" width="25" height="20" rx="3.5" fill="#f6b98f" transform="rotate(7 26 20)" />
        <rect x="9" y="15" width="27" height="22" rx="3.5" fill="#fff" stroke="#e8713a" strokeWidth="1.6" />
        <rect x="11.5" y="17.5" width="22" height="17" rx="1.8" fill="#cfe9ff" />
        <circle cx="17" cy="22.5" r="2.6" fill="#ffd25e" />
        <path d="M11.5 32.5 18.5 25l4.5 4.6 3.4-3.2 7.1 6.8v1.3h-22z" fill="#3db57a" />
        <path d="M22.5 34.5 26.4 26.4l7.1 6.8v1.3z" fill="#2a9a63" />
      </g>
    </svg>
  );
}

export function PdfArt({ size = 48, className = "" }: P) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="#ffe9ec" />
      <g className={`origin-center ${move}`}>
        <path d="M14 9.5h13.5L35 17v20a2.5 2.5 0 0 1-2.5 2.5h-18A2.5 2.5 0 0 1 12 37V12a2.5 2.5 0 0 1 2-2.5z" fill="#fff" stroke="#e2596b" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M27.5 9.5V15a2 2 0 0 0 2 2H35z" fill="#f8b7c0" />
        <rect x="16" y="21" width="15" height="1.8" rx=".9" fill="#f3c6cc" />
        <rect x="16" y="24.6" width="11" height="1.8" rx=".9" fill="#f3c6cc" />
        <rect x="8.5" y="28.5" width="21" height="9" rx="2.4" fill="#e2596b" />
        <text x="19" y="35.3" textAnchor="middle" fontSize="6.4" fontWeight="700" fill="#fff" fontFamily="inherit">PDF</text>
      </g>
    </svg>
  );
}

export function ReportArt({ size = 48, className = "" }: P) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="#e6efff" />
      <g className={`origin-center ${move}`}>
        <rect x="12" y="11" width="21" height="27" rx="3" fill="#fff" stroke="#3b7fd1" strokeWidth="1.5" />
        <rect x="18" y="8.5" width="9" height="5" rx="2" fill="#2b5b8f" />
        <rect x="15.5" y="18" width="14" height="1.8" rx=".9" fill="#b9d2f3" />
        <rect x="15.5" y="22" width="10.5" height="1.8" rx=".9" fill="#b9d2f3" />
        <rect x="15.5" y="26" width="12.5" height="1.8" rx=".9" fill="#b9d2f3" />
        <g transform="rotate(42 31 30)">
          <rect x="29" y="16" width="5" height="20" rx="1.2" fill="#f5b52a" />
          <rect x="29" y="16" width="5" height="4" rx="1.2" fill="#e8713a" />
          <path d="M29 36h5l-2.5 4.6z" fill="#0b1f3a" />
        </g>
      </g>
    </svg>
  );
}
