"use client";

import { useEffect } from "react";

// Guarda el cliente abierto en "recientes" (para el reloj de la barra superior)
export default function RecentLogger({ id, name }: { id: string; name: string }) {
  useEffect(() => {
    try {
      const key = "bp-recent-customers";
      const list = JSON.parse(localStorage.getItem(key) || "[]") as { id: string; name: string }[];
      const next = [{ id, name }, ...list.filter((r) => r.id !== id)].slice(0, 8);
      localStorage.setItem(key, JSON.stringify(next));
    } catch { /* localStorage no disponible */ }
  }, [id, name]);
  return null;
}
