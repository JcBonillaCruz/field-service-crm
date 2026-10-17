/* eslint-disable @next/next/no-img-element */
import { initials } from "@/lib/types";

export default function Avatar({
  name,
  url,
  size = 36,
}: {
  name: string;
  url: string | null;
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
      className="flex items-center justify-center rounded-full bg-[#0f766e] font-semibold text-white ring-2 ring-white"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-label={name}
    >
      {initials(name)}
    </span>
  );
}
