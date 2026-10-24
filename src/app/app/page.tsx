"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// =====================================================================
// Puerta de entrada de la app instalada (start_url del manifest).
// Es una página estática (sin esperar a la base de datos), así Android quita
// su pantalla del ícono quieto casi al instante y aparece NUESTRA animación
// mientras se carga el panel de verdad.
// =====================================================================
export default function Launch() {
  const router = useRouter();
  useEffect(() => { router.replace("/dashboard"); }, [router]);
  return null;
}
