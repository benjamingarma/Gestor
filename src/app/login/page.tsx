import type { Metadata } from "next";
import { FormularioLogin } from "./FormularioLogin";

export const metadata: Metadata = { title: "Entrar · Gestor" };

export default function PaginaLogin() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Gestor</h1>
        <p className="text-texto-suave">Entrá con tu email y contraseña.</p>
      </header>
      <FormularioLogin />
      <p className="text-sm text-texto-suave">
        Solo pueden entrar los socios. Si no tenés cuenta, pedila al administrador.
      </p>
    </main>
  );
}
