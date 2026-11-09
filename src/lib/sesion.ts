import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { crearClienteSupabase } from "@/lib/supabase/servidor";

export type SocioActual = {
  socioId: string;
  nombre: string;
  email: string;
  negocioId: string;
  negocioNombre: string;
  modoPrueba: boolean;
};

/**
 * Devuelve el socio vinculado al usuario logueado.
 * - Sin sesión -> al login.
 * - Con sesión pero sin socio vinculado -> pantalla "sin acceso".
 * Se memoriza durante un mismo pedido (React cache), no entre pedidos.
 */
export const obtenerSocioActual = cache(async (): Promise<SocioActual> => {
  const supabase = await crearClienteSupabase();
  const { data: datosUsuario } = await supabase.auth.getUser();
  const usuario = datosUsuario.user;
  if (!usuario) redirect("/login");

  // RLS: solo devuelve socios de negocios a los que pertenece el usuario.
  const { data, error } = await supabase
    .from("socios")
    .select("id, nombre, negocio_id, negocios ( nombre, modo_prueba )")
    .eq("user_id", usuario.id)
    .maybeSingle();

  if (error) throw new Error(`No se pudo leer el socio: ${error.message}`);
  if (!data) redirect("/sin-acceso");

  const negocio = data.negocios as unknown as { nombre: string; modo_prueba: boolean } | null;
  return {
    socioId: data.id,
    nombre: data.nombre,
    email: usuario.email ?? "",
    negocioId: data.negocio_id,
    negocioNombre: negocio?.nombre ?? "",
    modoPrueba: negocio?.modo_prueba ?? true,
  };
});
