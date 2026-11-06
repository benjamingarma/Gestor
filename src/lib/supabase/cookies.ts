import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * La sesión vive en cookies que el JavaScript del navegador NO puede leer (httpOnly):
 * toda la autenticación ocurre en el servidor. Eso protege la sesión ante scripts maliciosos.
 * La sesión es persistente: se renueva sola mientras se use la app.
 */
export const opcionesCookies: CookieOptionsWithName = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};
