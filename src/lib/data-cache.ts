import { unstable_cache } from "next/cache";

// =====================================================================
// Caché del servidor SOLO para datos que casi no cambian:
//   · perfil del usuario · logos de sus compañías · preferencias de la empresa · catálogo (items y cupones)
// NUNCA para facturas, cotizaciones, pagos, gastos, actividad ni avisos (esos siempre se consultan en vivo).
// Cada entrada lleva el id del usuario en la llave (respeta los permisos de cada quien) y una etiqueta
// por compañía/usuario para borrarla al instante cuando alguien guarda un cambio (ver /api/cache).
// =====================================================================
export const TAG = {
  profile: (uid: string) => `profile:${uid}`,
  logos: (uid: string) => `logos:${uid}`,
  prefs: (companyId: string) => `prefs:${companyId}`,
  catalog: (companyId: string) => `catalog:${companyId}`,
};
export type CacheScope = "profile" | "prefs" | "catalog";

// Si la consulta falla, NO se guarda en caché (se lanza el error) y se consulta directo.
export async function cached<T>(key: string[], tags: string[], seconds: number, load: () => Promise<T>): Promise<T> {
  try {
    return await unstable_cache(load, ["bp-v1", ...key], { tags, revalidate: seconds })();
  } catch {
    return load();
  }
}

// Convierte la respuesta de Supabase en datos o en error (para no guardar errores en caché)
export function must<T>(r: { data: T | null; error: { message: string } | null }): T | null {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
