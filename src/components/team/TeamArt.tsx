// Íconos ilustrados de las tarjetas de Team (mismo estilo que los de las apps). Se animan al pasar el mouse (clase "group").
type P = { size?: number };

export function MembersArt({ size = 44 }: P) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <circle cx="24" cy="25" r="20" fill="#e6f6f2" />
      <g className="transition-transform duration-300 ease-out group-hover:-translate-x-0.5">
        <circle cx="15" cy="20" r="5" fill="#7fdacd" /><path d="M6 36a9 9 0 0 1 18 0z" fill="#5fcfc0" />
      </g>
      <g className="transition-transform duration-300 ease-out group-hover:translate-x-0.5">
        <circle cx="33" cy="20" r="5" fill="#7fdacd" /><path d="M24 36a9 9 0 0 1 18 0z" fill="#5fcfc0" />
      </g>
      <g className="origin-[24px_30px] transition-transform duration-300 ease-out group-hover:-translate-y-1">
        <circle cx="24" cy="17" r="6.2" fill="#ffd2a8" /><path d="M17.8 15.5a6.2 6.2 0 0 1 12.4 0c-2-1.6-4-2.2-6.2-2.2s-4.2.6-6.2 2.2z" fill="#3b2a20" />
        <path d="M13 40a11 11 0 0 1 22 0z" fill="#0f766e" /><path d="M24 29l2 3-2 6-2-6z" fill="#14a39a" />
      </g>
    </svg>
  );
}

export function ActiveArt({ size = 44 }: P) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <circle cx="24" cy="25" r="20" fill="#e8f0fd" />
      <circle cx="21" cy="18" r="6.5" fill="#ffd2a8" /><path d="M14.5 16.5a6.5 6.5 0 0 1 13 0c-2.1-1.6-4.2-2.3-6.5-2.3s-4.4.7-6.5 2.3z" fill="#6b4226" />
      <path d="M9 40a12 12 0 0 1 24 0z" fill="#2563eb" />
      <g className="origin-[35px_33px] transition-transform duration-300 ease-out group-hover:scale-110">
        <circle cx="35" cy="33" r="8" fill="#22c55e" stroke="#fff" strokeWidth="1.8" />
        <path d="M31.4 33.2l2.5 2.5 4.8-5" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export function TechArt({ size = 44 }: P) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <circle cx="24" cy="25" r="20" fill="#fff3e8" />
      <circle cx="22" cy="20" r="6.2" fill="#ffd2a8" />
      <path d="M14.5 17.5a7.5 7.5 0 0 1 15 0z" fill="#f59e0b" /><rect x="13" y="16.6" width="18" height="2.4" rx="1.2" fill="#d97706" />
      <path d="M10 40a12 12 0 0 1 24 0z" fill="#ea580c" /><path d="M18 30h8v10h-8z" fill="#c2410c" opacity=".55" />
      <g className="origin-[37px_31px] transition-transform duration-300 ease-out group-hover:rotate-[20deg]">
        <path d="M40.5 25.5a4.6 4.6 0 0 1-6 5.8l-5.6 5.6a1.9 1.9 0 0 1-2.7-2.7l5.6-5.6a4.6 4.6 0 0 1 5.8-6l-2.8 2.8.5 2.4 2.4.5z" fill="#64748b" stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export function InviteArt({ size = 44 }: P) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <circle cx="24" cy="25" r="20" fill="#f1ebff" />
      <rect x="8" y="17" width="30" height="21" rx="3" fill="#a78bfa" />
      <g className="origin-[23px_20px] transition-transform duration-300 ease-out group-hover:-translate-y-1.5">
        <rect x="12" y="11" width="22" height="18" rx="2" fill="#fff" />
        <path d="M16 16h14M16 20h10" stroke="#c4b5fd" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      <path d="M8 21l15 10 15-10v14a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3z" fill="#7c3aed" />
      <path d="M8 38l11-9M38 38l-11-9" stroke="#6d28d9" strokeWidth="1.2" />
      <g className="origin-[38px_14px] transition-transform duration-300 ease-out group-hover:scale-110">
        <circle cx="38" cy="14" r="6" fill="#e8713a" stroke="#fff" strokeWidth="1.6" />
        <path d="M38 11v6M35 14h6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      </g>
    </svg>
  );
}
