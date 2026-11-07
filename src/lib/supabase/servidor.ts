import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { configuracionSupabase } from "@/lib/configuracion";
import { opcionesCookies } from "./cookies";

/**
 * Cliente de Supabase para páginas y acciones del servidor.
 * Siempre actúa COMO EL USUARIO LOGUEADO: la seguridad (RLS) la aplica la base.
 * Se crea uno nuevo por pedido; nunca se comparte entre usuarios.
 */
export async function crearClienteSupabase() {
  const { url, clavePublica } = configuracionSupabase();
  const almacen = await cookies();

  return createServerClient(url, clavePublica, {
    cookieOptions: opcionesCookies,
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: (lista) => {
        try {
          for (const { name, value, options } of lista) almacen.set(name, value, options);
        } catch {
          // Desde un Server Component no se pueden escribir cookies; el proxy ya renueva la sesión.
        }
      },
    },
  });
}
