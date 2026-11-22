import { useTranslations } from "next-intl";

// Ícono ilustrado de Maintenance plans: calendario con la flecha de "se repite"
export default function PlanArt({ size = 40, muted = false }: { size?: number; muted?: boolean }) {
  const a = muted ? "#cbd5e1" : "#14a39a", b = muted ? "#94a3b8" : "#0f766e", c = muted ? "#e2e8f0" : "#f59e0b";
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <rect x="6" y="9" width="30" height="29" rx="6" fill="#fff" stroke={b} strokeWidth="2" />
      <path d="M6 15a6 6 0 0 1 6-6h18a6 6 0 0 1 6 6v3H6z" fill={a} />
      <path d="M14 6v6M28 6v6" stroke={b} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M12 24h5M21 24h5M12 30h5" stroke={muted ? "#cbd5e1" : "#9fd8cf"} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="34" cy="33" r="10" fill={c} stroke="#fff" strokeWidth="2.5" />
      <path d="M29.5 33a4.5 4.5 0 0 1 7.9-2.9M38.5 33a4.5 4.5 0 0 1-7.9 2.9" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M37.9 27.6v2.9H35M30.1 38.4v-2.9H33" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Etiqueta pequeña "Plan" para las tarjetas y la ficha de un trabajo que salió de un plan
export function PlanTag({ label, title }: { label?: string; title?: string }) {
  const t = useTranslations("planTag");
  label ??= t("label");
  title ??= t("title");
  return (
    <span title={title} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#fff4e0] px-1.5 py-px text-[10.5px] font-semibold leading-4 text-[#b45309] ring-1 ring-[#fde3b4]">
      <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8a5 5 0 0 1 8.6-3.5M13 8a5 5 0 0 1-8.6 3.5M12 2v3H9M4 14v-3h3" /></svg>
      {label}
    </span>
  );
}
