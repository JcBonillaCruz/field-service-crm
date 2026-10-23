import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options: CookieOptions };

import { KEY_HEADER, USER_HEADER, internalKey } from "@/lib/auth-headers";

// Clave interna (solo servidor) para pasarle al servidor el usuario ya verificado aquí,
// así la página NO vuelve a llamar a /auth/v1/user. Si no existe, el servidor verifica por su cuenta.
const INTERNAL = internalKey();

export async function middleware(request: NextRequest) {
  // Nadie de afuera puede mandar estos encabezados: se borran siempre
  const headers = new Headers(request.headers);
  headers.delete(USER_HEADER);
  headers.delete(KEY_HEADER);

  const path = request.nextUrl.pathname;
  // Las rutas /api verifican la sesión ellas mismas: aquí solo se limpian los encabezados (sin llamar a Supabase)
  if (path.startsWith("/api/")) return NextResponse.next({ request: { headers } });

  let response = NextResponse.next({ request: { headers } });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // las cookies nuevas también deben llegar al servidor en esta misma petición
          headers.set("cookie", request.cookies.toString());
          response = NextResponse.next({ request: { headers } });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // Una sola verificación por petición (renueva el token si hace falta)
  const { data: { user } } = await supabase.auth.getUser();

  if (!user && (path.startsWith("/dashboard") || path.startsWith("/print"))) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (user && (path === "/" || path === "/signup")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (user && INTERNAL) {
    headers.set(USER_HEADER, encodeURIComponent(JSON.stringify({ id: user.id, email: user.email ?? "" })));
    headers.set(KEY_HEADER, INTERNAL);
    const next = NextResponse.next({ request: { headers } });
    response.cookies.getAll().forEach((c) => next.cookies.set(c));
    response = next;
  }
  return response;
}

// Solo donde hace falta: login, panel, impresión y /api (este último solo para limpiar encabezados).
// Antes corría en TODAS las rutas (incluidas las públicas) y llamaba a Supabase cada vez.
export const config = {
  matcher: ["/", "/signup", "/dashboard/:path*", "/print/:path*", "/api/:path*"],
};
