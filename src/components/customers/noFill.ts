"use client";

import { useEffect, useState } from "react";

// Evita que el navegador (Chrome, Safari, Edge) y los gestores de contraseñas
// rellenen el formulario con datos guardados: cada campo recibe un nombre
// aleatorio y un valor de autocomplete que el navegador no reconoce.
export function useNoFill() {
  const [seed, setSeed] = useState("bp");
  useEffect(() => {
    setSeed("bp" + Math.random().toString(36).slice(2, 8));
  }, []);

  return (field: string) => ({
    name: `${seed}-${field}`,
    autoComplete: "bp-off",
    "data-lpignore": "true",
    "data-1p-ignore": "true",
    "data-bwignore": "true",
    "data-form-type": "other",
  });
}
