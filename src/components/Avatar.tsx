/* eslint-disable @next/next/no-img-element */
import { initials, solidColor } from "@/lib/types";

export default function Avatar({
  name,
  url,
  seed,
  size = 36,
}: {
  name: string;
  url: string | null;
  seed?: string;
  size?: number;
}) {
  if (url) {
    return (
      <img src={url} alt={name} width={size} height={size}
        className="rounded-full object-cover ring-2 ring-white" style={{ width: size, height: size }} />
    );
  }
  return (
    <span
      className="flex items-center justify-center rounded-full font-semibold text-white ring-2 ring-white"
      style={{ width: size, height: size, fontSize: size * 0.38, backgroundColor: solidColor(seed || name) }}
      aria-label={name}
    >
      {initials(name)}
    </span>
  );
}
