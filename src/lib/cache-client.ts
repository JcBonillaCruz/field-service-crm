// Después de guardar perfil, preferencias o catálogo: borra su caché antes de refrescar la pantalla
export async function bustCache(...scopes: ("profile" | "prefs" | "catalog")[]) {
  try {
    await fetch("/api/cache", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scopes }) });
  } catch { /* sin conexión: la caché igual vence sola en pocos minutos */ }
}
