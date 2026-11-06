"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { crearClienteSupabase } from "@/lib/supabase/servidor";

export type EstadoLogin = { error?: string; email?: string };

const esquemaLogin = z.object({
  email: z.email("Ingresá un email válido."),
  contrasena: z.string().min(1, "Ingresá tu contraseña."),
});

export async function iniciarSesion(_previo: EstadoLogin, formulario: FormData): Promise<EstadoLogin> {
  const email = String(formulario.get("email") ?? "").trim().toLowerCase();
  const datos = esquemaLogin.safeParse({ email, contrasena: formulario.get("contrasena") ?? "" });
  if (!datos.success) {
    return { error: datos.error.issues[0]?.message ?? "Datos inválidos.", email };
  }

  const supabase = await crearClienteSupabase();
  const { error } = await supabase.auth.signInWithPassword({
    email: datos.data.email,
    password: datos.data.contrasena,
  });

  if (error) {
    // Mensaje genérico: no revela si el email existe.
    return { error: "Email o contraseña incorrectos.", email };
  }
  redirect("/");
}

export async function cerrarSesion(): Promise<void> {
  const supabase = await crearClienteSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
