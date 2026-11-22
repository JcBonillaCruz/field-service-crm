import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getSession } from "@/lib/session";
import { TAG } from "@/lib/data-cache";
import { LOCALE_COOKIE, isLocale } from "@/i18n/config";

export const dynamic = "force-dynamic";

// Paso 6.1: la persona elige su idioma → se guarda en su perfil (para todos sus aparatos) y en la cookie de este.
// Body: { language: "en" | "es" }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const language = body?.language;
  if (!isLocale(language)) return NextResponse.json({ error: "Invalid language" }, { status: 400 });
  const { supabase, user } = await getSession();
  const { error } = await supabase.from("profiles").update({ language }).eq("id", user.id);
  revalidateTag(TAG.profile(user.id));
  const res = NextResponse.json({ ok: true, saved: !error });
  res.cookies.set(LOCALE_COOKIE, language, { path: "/", maxAge: 31536000, sameSite: "lax" });
  return res;
}
