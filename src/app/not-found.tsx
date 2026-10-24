"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// Si una página ya no existe (ej. borraste una factura y tocaste "atrás" en el celular),
// en vez del error 404 te llevamos al inicio.
export default function NotFound() {
  const router = useRouter();
  const path = usePathname() || "";
  const isPublic = path.startsWith("/share");
  useEffect(() => {
    if (isPublic) return; // los clientes que abren un enlace viejo solo ven el aviso
    const to = path.startsWith("/print") ? "/" : "/dashboard";
    const t = setTimeout(() => router.replace(to), 150);
    return () => clearTimeout(t);
  }, [path, router, isPublic]);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      {!isPublic && <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#d7f1eb] border-t-[#0f766e]" />}
      <p className="text-[15px] font-medium text-[#0b1f3a]">{isPublic ? "This link is no longer available" : "This page is no longer available"}</p>
      <p className="text-[13px] text-slate-500">{isPublic ? "Ask the business to send you a new link." : "Taking you home…"}</p>
    </div>
  );
}
