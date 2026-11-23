import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { canManageCustomers } from "@/lib/customers";
import { PLACES_MIN_CHARS, type PlaceSuggestion } from "@/lib/places";
import { companyCenter, googleFetch, okSession, placesKey, takePlaces } from "@/lib/places-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Paso 6.8 · Sugerencias de dirección mientras escribes (Google Places Autocomplete New)
type G = { suggestions?: { placePrediction?: { placeId?: string; text?: { text?: string }; structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } } } }[] };

export async function POST(request: NextRequest) {
  const { supabase, current } = await getSession();
  if (!current || !canManageCustomers(current.role)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const key = placesKey();
  if (!key) return NextResponse.json({ off: "nokey" });
  const b = await request.json().catch(() => null) as { input?: unknown; session?: unknown; country?: unknown } | null;
  const input = typeof b?.input === "string" ? b.input.trim().slice(0, 120) : "";
  const country = typeof b?.country === "string" && /^[A-Za-z]{2}$/.test(b.country) ? b.country.toLowerCase() : "us";
  if (input.length < PLACES_MIN_CHARS || !okSession(b?.session)) return NextResponse.json({ suggestions: [] });

  const take = await takePlaces(supabase, current.id, "search");
  if (!take.ok) return NextResponse.json({ off: take.off });

  const center = await companyCenter(supabase, current.id).catch(() => null);
  const body: Record<string, unknown> = {
    input, sessionToken: b!.session, languageCode: "en",
    includedRegionCodes: [country],
    includedPrimaryTypes: ["street_address", "premise", "subpremise"],
  };
  if (center) body.locationBias = { circle: { center: { latitude: center.lat, longitude: center.lng }, radius: 50000 } };

  const j = await googleFetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat" },
    body: JSON.stringify(body),
  }) as G | undefined;
  if (!j) return NextResponse.json({ off: "error" });
  const suggestions: PlaceSuggestion[] = (j.suggestions ?? []).map((s) => s.placePrediction).filter((p) => p?.placeId).slice(0, 5).map((p) => ({
    id: p!.placeId!,
    main: p!.structuredFormat?.mainText?.text || p!.text?.text || "",
    secondary: p!.structuredFormat?.secondaryText?.text || "",
  }));
  return NextResponse.json({ suggestions });
}
