import { initials, softColor } from "@/lib/types";

export default function CompanyBadge({
  id,
  name,
  index,
  size = 32,
}: {
  id: string;
  name: string;
  index?: number;
  size?: number;
}) {
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
