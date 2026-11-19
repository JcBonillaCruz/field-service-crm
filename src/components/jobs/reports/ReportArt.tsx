// Íconos ilustrados de Reports (mismo estilo que los de All apps: a color, con capas, y una pieza se mueve al pasar el mouse)
export type ReportArtKind = "title" | "done" | "ontime" | "site" | "idle" | "held" | "revenue" | "parts" | "value" | "noscan" | "counts" | "profit";

export default function ReportArt({ kind, size = 48 }: { kind: ReportArtKind; size?: number }) {
  const move = "transition-transform duration-300 ease-out";
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" className="shrink-0">
      {kind === "title" && <>
        <circle cx="24" cy="25" r="20" fill="#dff5ef" />
        <rect x="8" y="9" width="27" height="30" rx="3" fill="#fff" stroke="#8fd3c5" strokeWidth="1.2" />
        <rect x="12" y="13.5" width="11" height="2" rx="1" fill="#0f766e" />
        <rect x="12" y="30" width="4" height="5" rx="1" fill="#9ad9cd" />
        <g className={`origin-[20px_35px] ${move} group-hover:scale-y-110`}><rect x="18" y="25" width="4" height="10" rx="1" fill="#14a39a" /></g>
        <rect x="24" y="21" width="4" height="14" rx="1" fill="#0f766e" />
        <circle cx="35" cy="33" r="8.6" fill="#e8713a" stroke="#fff" strokeWidth="1.6" />
        <path d="M31.4 33.2l2.5 2.5 4.7-5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </>}
      {kind === "done" && <>
        <circle cx="24" cy="25" r="20" fill="#e7f8ee" />
        <rect x="11" y="10" width="24" height="29" rx="3" fill="#fff" stroke="#a7e3bf" strokeWidth="1.2" />
        <rect x="18" y="7.5" width="10" height="5" rx="2" fill="#15803d" />
        <rect x="15" y="17" width="16" height="1.8" rx=".9" fill="#c8eed7" /><rect x="15" y="21.4" width="12" height="1.8" rx=".9" fill="#c8eed7" />
        <g className={`origin-[24px_31px] ${move} group-hover:scale-110`}>
          <circle cx="24" cy="31" r="6.4" fill="#22c55e" />
          <path d="M21 31.2l2.1 2.1 4-4.3" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </>}
      {kind === "ontime" && <>
        <circle cx="24" cy="25" r="20" fill="#eef4ff" />
        <path d="M24 41s-11-9.4-11-18a11 11 0 0 1 22 0c0 8.6-11 18-11 18z" fill="#2563eb" />
        <circle cx="24" cy="23" r="7.6" fill="#fff" />
        <g className={`origin-[24px_23px] ${move} group-hover:rotate-[90deg]`}><path d="M24 23v-4.4" stroke="#0b1f3a" strokeWidth="1.8" strokeLinecap="round" /></g>
        <path d="M24 23l3 1.8" stroke="#e8713a" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="24" cy="23" r="1.1" fill="#0b1f3a" />
      </>}
      {kind === "site" && <>
        <circle cx="24" cy="25" r="20" fill="#fff3e2" />
        <path d="M9 24.5 24 12l15 12.5" fill="none" stroke="#b45309" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12.5 23v15h23V23L24 13.5z" fill="#fff" stroke="#f3c98b" strokeWidth="1.2" />
        <rect x="21" y="29" width="6" height="9" rx="1" fill="#f59e0b" />
        <g className={`origin-[35px_33px] ${move} group-hover:-rotate-[25deg]`}>
          <path d="M31.5 37.5l6-6" stroke="#0b1f3a" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="38.6" cy="30.4" r="3.2" fill="none" stroke="#0b1f3a" strokeWidth="2.2" />
        </g>
      </>}
      {kind === "idle" && <>
        <circle cx="24" cy="25" r="20" fill="#f3efff" />
        <circle cx="24" cy="25" r="13.5" fill="#fff" stroke="#d6c9ff" strokeWidth="1.2" />
        <path d="M24 25V11.5a13.5 13.5 0 0 1 12.8 17.8z" fill="#7c3aed" />
        <g className={`origin-[24px_25px] ${move} group-hover:rotate-[20deg]`}><path d="M24 25 12.2 31.5A13.5 13.5 0 0 1 24 11.5z" fill="#c4b5fd" /></g>
        <circle cx="24" cy="25" r="4.2" fill="#fff" />
      </>}
      {kind === "held" && <>
        <circle cx="24" cy="25" r="20" fill="#fff6e6" />
        <rect x="10" y="12" width="28" height="26" rx="3.2" fill="#fff" stroke="#f3c98b" strokeWidth="1.2" />
        <rect x="10" y="12" width="28" height="7" rx="3.2" fill="#f59e0b" />
        <path d="M17 9.5v5M31 9.5v5" stroke="#0b1f3a" strokeWidth="2.2" strokeLinecap="round" />
        <g className={`origin-[24px_29px] ${move} group-hover:rotate-[-40deg]`}>
          <path d="M29.5 26.5a6 6 0 1 0 .7 5" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" />
          <path d="M30.4 22.8v4.2h-4.2" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </>}
      {(kind === "revenue" || kind === "value" || kind === "profit") && <>
        <circle cx="24" cy="25" r="20" fill={kind === "value" ? "#ffeef0" : "#e7f8ee"} />
        <rect x="8" y="17" width="26" height="16" rx="2.6" fill={kind === "value" ? "#fda4af" : "#86dba8"} />
        <rect x="11" y="14" width="26" height="16" rx="2.6" fill="#fff" stroke={kind === "value" ? "#fda4af" : "#86dba8"} strokeWidth="1.2" />
        <circle cx="24" cy="22" r="4.4" fill={kind === "value" ? "#e11d48" : "#15803d"} />
        <path d="M24 19.6v4.8M25.6 20.7c-.5-.5-2.8-.8-2.9.5 0 1.4 2.9.6 2.9 2 0 1.2-2.3 1.1-3 .4" fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round" />
        <g className={`origin-[35px_34px] ${move} group-hover:-translate-y-1`}>
          <circle cx="35" cy="34" r="7.6" fill={kind === "value" ? "#be123c" : "#0f766e"} stroke="#fff" strokeWidth="1.6" />
          {kind === "value"
            ? <path d="M35 30.6v4M35 37.2v.2" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            : <path d="M31.8 36l2.3-2.6 1.8 1.6 2.5-3" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />}
        </g>
      </>}
      {kind === "parts" && <>
        <circle cx="24" cy="25" r="20" fill="#ffeef0" />
        <path d="M24 10 37 16.5v15L24 38l-13-6.5v-15z" fill="#fff" stroke="#fda4af" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M11 16.5 24 23l13-6.5M24 23v15" fill="none" stroke="#fda4af" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M17.5 13.2l13 6.5" stroke="#fb7185" strokeWidth="2.4" strokeLinecap="round" />
        <g className={`origin-[34px_33px] ${move} group-hover:rotate-12`}>
          <rect x="26.5" y="27" width="15" height="12" rx="2" fill="#0b1f3a" />
          <path d="M29.5 30v6M32 30v6M34 30v6M36.5 30v6M38.5 30v6" stroke="#fff" strokeWidth="1" />
          <path d="M26 41 42 25" stroke="#e11d48" strokeWidth="2.4" strokeLinecap="round" />
        </g>
      </>}
      {kind === "noscan" && <>
        <circle cx="24" cy="25" r="20" fill="#eef2f6" />
        <path d="M11 17v-4a2 2 0 0 1 2-2h4M31 11h4a2 2 0 0 1 2 2v4M37 33v4a2 2 0 0 1-2 2h-4M17 39h-4a2 2 0 0 1-2-2v-4" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M16 19v12M19.5 19v12M22.5 19v12M26 19v12M29 19v12M32 19v12" stroke="#cbd5e1" strokeWidth="1.6" />
        <g className={`${move} group-hover:translate-y-1.5`}><path d="M9.5 23h29" stroke="#e8713a" strokeWidth="2.2" strokeLinecap="round" /></g>
      </>}
      {kind === "counts" && <>
        <circle cx="24" cy="25" r="20" fill="#fff3e2" />
        <rect x="11" y="10" width="24" height="29" rx="3" fill="#fff" stroke="#f3c98b" strokeWidth="1.2" />
        <rect x="18" y="7.5" width="10" height="5" rx="2" fill="#b45309" />
        <path d="M15 19l1.6 1.6 2.8-3" fill="none" stroke="#22c55e" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="22" y="18" width="9" height="1.8" rx=".9" fill="#f6dcb2" />
        <path d="M15 25.5l1.6 1.6 2.8-3" fill="none" stroke="#22c55e" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="22" y="24.5" width="9" height="1.8" rx=".9" fill="#f6dcb2" />
        <g className={`origin-[17px_32px] ${move} group-hover:rotate-90`}><path d="M15.2 30.4l3.6 3.6M18.8 30.4l-3.6 3.6" stroke="#e11d48" strokeWidth="1.8" strokeLinecap="round" /></g>
        <rect x="22" y="31.2" width="7" height="1.8" rx=".9" fill="#fda4af" />
      </>}
    </svg>
  );
}
