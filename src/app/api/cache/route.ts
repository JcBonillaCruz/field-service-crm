import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getSession } from "@/lib/session";
import { CacheScope, TAG } from "@/lib/data-cache";

export const dynamic = "force-dynamic";

// Borra la caché de datos "casi estáticos" justo después de guardar un cambio,
// para que la siguiente pantalla muestre lo nuevo al instante. Body: { scopes: ["catalog" | "prefs" | "profile"] }
export async function POST(req: Request) {
  const { user, current } = await getSession();
  const body = await req.json().catch(() => ({}));
  const scopes: CacheScope[] = Array.isArray(body.scopes) ? body.scopes : [];
  if (scopes.includes("profile")) revalidateTag(TAG.profile(user.id));
  if (scopes.includes("prefs")) {
    revalidateTag(TAG.logos(user.id));
    if (current) revalidateTag(TAG.prefs(current.id));
  }
  if (scopes.includes("catalog") && current) revalidateTag(TAG.catalog(current.id));
  return NextResponse.json({ ok: true });
}
