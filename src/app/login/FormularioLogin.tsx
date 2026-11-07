"use client";

import { useActionState } from "react";
import { iniciarSesion, type EstadoLogin } from "@/app/acciones-sesion";
import { Boton } from "@/componentes/Boton";

const estadoInicial: EstadoLogin = {};

export function FormularioLogin() {
  const [estado, accion, enviando] = useActionState(iniciarSesion, estadoInicial);

  return (
    <form action={accion} className="flex flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1">
        <span className="text-base font-medium">Email</span>
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          required
          defaultValue={estado.email}
          className="min-h-[52px] rounded-xl border border-borde bg-superficie px-4 text-lg"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-base font-medium">Contraseña</span>
        <input
          name="contrasena"
          type="password"
          autoComplete="current-password"
          required
          className="min-h-[52px] rounded-xl border border-borde bg-superficie px-4 text-lg"
        />
      </label>

      {estado.error && (
        <p role="alert" className="rounded-lg border border-peligro px-4 py-3 text-peligro">
          {estado.error}
        </p>
      )}

      <Boton type="submit" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </Boton>
    </form>
  );
}
