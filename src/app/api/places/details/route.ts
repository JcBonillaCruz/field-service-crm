import { NextResponse, type NextRequest } from "next/server";
import { parseComponents } from "@/lib/places";
import { googleFetch, okSession, placesContext, placesKey, takePlaces } from "@/lib/places-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Paso 6.8 · La dirección elegida, ya separada en calle / ciudad / estado / zip. Cierra la sesión de Google.
// Solo pide campos "Essentials" (addressComponents y location) para que salga lo más barato posible.
type G = { addressComponents?: { longText?: string; shortText?: string; types?: string[] }[]; location?: { latitude?: number; longitude?: number } };

export async function POST(request: NextRequest) {
  const key = placesKey();
  if (!key) return NextResponse.json({ off: "nokey" });
  const ctx = await placesContext();
  if (!ctx) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const b = await request.json().catch(() => null) as { id?: unknown; session?: unknown } | null;
  const id = typeof b?.id === "string" && /^[A-Za-z0-9_-]{10,300}$/.test(b.id) ? b.id : "";
  if (!id || !okSession(b?.session)) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const take = await takePlaces(ctx.sb, ctx.companyId, "pick");
  if (!take.ok) return NextResponse.json({ off: take.off });

  const j = await googleFetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?sessionToken=${encodeURIComponent(b!.session as string)}&languageCode=en`, {
    headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "addressComponents,location" },
  }) as G | undefined;
  if (!j?.addressComponents) return NextResponse.json({ off: "error" });
  return NextResponse.json({
    address: parseComponents(j.addressComponents),
    lat: j.location?.latitude ?? null, lng: j.location?.longitude ?? null,
  });
}
