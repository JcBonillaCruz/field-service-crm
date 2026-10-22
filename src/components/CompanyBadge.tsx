import { initials, softColor } from "@/lib/types";

export default function CompanyBadge({
  id,
  name,
  index,
  size = 32,
  logoUrl,
}: {
  id: string;
  name: string;
  index?: number;
  size?: number;
  logoUrl?: string | null;
}) {
  // Con logo, se muestra el logo (cuadrito blanco); sin logo, las iniciales de color
  if (logoUrl) {
    return (
      <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white" style={{ width: size, height: size }} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="" className="h-full w-full object-contain p-0.5" />
      </span>
    );
  }
  // Con "index", cada compañía de la lista recibe un color distinto, en orden de creación
  const c = softColor(index ?? id);
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-md font-semibold"
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.36), backgroundColor: c.bg, color: c.text }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
