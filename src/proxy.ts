import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { opcionesCookies } from "@/lib/supabase/cookies";

const RUTAS_PUBLICAS = ["/login"];

/**
 * Se ejecuta antes de cada página:
 * 1. Renueva la sesión de Supabase si hace falta (cookies nuevas en la respuesta).
 * 2. Si no hay sesión, manda al login.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.SUPABASE_URL;
  const clavePublica = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !clavePublica) {
    return new NextResponse("La app no está configurada (faltan variables de entorno).", { status: 500 });
  }

  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(url, clavePublica, {
    cookieOptions: opcionesCookies,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        for (const { name, value } of lista) request.cookies.set(name, value);
        respuesta = NextResponse.next({ request });
        for (const { name, value, options } of lista) respuesta.cookies.set(name, value, options);
      },
    },
  });

  // Verifica la sesión (y la renueva si venció el token de acceso).
  const { data } = await supabase.auth.getClaims();
  const logueado = Boolean(data?.claims?.sub);
  const ruta = request.nextUrl.pathname;
  const esPublica = RUTAS_PUBLICAS.some((r) => ruta === r || ruta.startsWith(`${r}/`));

  if (!logueado && !esPublica) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/login";
    destino.search = "";
    const redireccion = NextResponse.redirect(destino);
    for (const cookie of respuesta.cookies.getAll()) redireccion.cookies.set(cookie);
    return redireccion;
  }

  if (logueado && esPublica) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/";
    destino.search = "";
    const redireccion = NextResponse.redirect(destino);
    for (const cookie of respuesta.cookies.getAll()) redireccion.cookies.set(cookie);
    return redireccion;
  }

  return respuesta;
}

export const config = {
  matcher: [
    // Todo menos archivos estáticos e imágenes.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
