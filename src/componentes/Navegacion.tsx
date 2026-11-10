"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cerrarSesion } from "@/app/acciones-sesion";
import { Icono, Logo } from "./Iconos";
import { esPantallaCompleta, GESTION, GESTION_LATERAL, PRINCIPALES, type Item } from "./menu";

/**
 * Navegación de McStock (docs/maquetas/README.md):
 * - celular: barra inferior de 5 ítems con Vender en el centro;
 * - PC: barra lateral con Vender arriba y el grupo "Gestión" (lo mismo que "Más").
 */

export function BarraInferior() {
  const ruta = usePathname();
  if (esPantallaCompleta(ruta)) return null;
  const item = (i: Item) => {
    const activo = i.activo(ruta);
    return (
      <Link
        key={i.href + i.texto}
        href={i.href}
        aria-current={activo ? "page" : undefined}
        className={`flex flex-col items-center justify-center gap-[3px] text-[0.68rem] font-semibold ${activo ? "text-acento" : "text-texto-suave"}`}
      >
        <Icono nombre={i.icono} strokeWidth={activo ? 2.4 : 1.9} />
        {i.texto}
      </Link>
    );
  };
  const masActivo = ruta === "/mas" || GESTION.some((g) => g.activo(ruta));
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-borde bg-superficie px-1 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.75rem)] lg:hidden"
    >
      {item(PRINCIPALES[0])}
      {item(PRINCIPALES[1])}
      <Link href="/ventas/nueva" className="-mt-[26px] flex flex-col items-center gap-[3px] text-[0.68rem] font-extrabold text-acento">
        <span className="grid h-[58px] w-[58px] place-items-center rounded-full bg-acento text-acento-texto shadow-[0_0_0_5px_var(--superficie),0_6px_16px_rgba(15,109,92,0.35)]">
          <Icono nombre="vender" className="h-[30px] w-[30px]" strokeWidth={2.6} />
        </span>
        Vender
      </Link>
      {item(PRINCIPALES[2])}
      <Link
        href="/mas"
        aria-current={masActivo ? "page" : undefined}
        className={`flex flex-col items-center justify-center gap-[3px] text-[0.68rem] font-semibold ${masActivo ? "text-acento" : "text-texto-suave"}`}
      >
        <Icono nombre="mas" strokeWidth={masActivo ? 2.4 : 1.9} />
        Más
      </Link>
    </nav>
  );
}

export function BarraLateral({ nombreSocio }: { nombreSocio: string }) {
  const ruta = usePathname();
  const item = (i: Item, clave: string) => {
    const activo = i.activo(ruta);
    return (
      <Link
        key={clave}
        href={i.href}
        aria-current={activo ? "page" : undefined}
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.95rem] font-semibold transition-colors ${
          activo ? "bg-acento-suave text-acento" : "text-texto-suave hover:bg-superficie-2 hover:text-texto"
        }`}
      >
        <Icono nombre={i.icono} />
        {i.texto}
      </Link>
    );
  };
  return (
    <aside className="sticky top-0 hidden h-dvh w-[260px] shrink-0 flex-col gap-0.5 overflow-y-auto leading-[1.2] border-r border-borde bg-superficie px-3.5 py-5 lg:flex">
      <Link href="/" className="flex items-center gap-2 px-2.5 pt-1.5 pb-[18px] text-[1.15rem] font-extrabold">
        <Logo />
        McStock
      </Link>
      <Link
        href="/ventas/nueva"
        className="mb-3 flex min-h-[50px] items-center justify-center gap-2 rounded-[14px] bg-acento font-extrabold text-acento-texto hover:opacity-90"
      >
        <Icono nombre="vender" />
        Vender
      </Link>
      {PRINCIPALES.map((i) => item(i, i.texto))}
      <p className="px-3 pt-[18px] pb-1.5 text-[0.72rem] font-bold tracking-[0.06em] text-texto-suave">GESTIÓN</p>
      {GESTION_LATERAL.map((i) => item(i, i.texto))}
      <form action={cerrarSesion} className="mt-auto pt-4">
        <button type="submit" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[0.95rem] font-semibold text-texto-suave hover:bg-superficie-2">
          <Icono nombre="salir" />
          {nombreSocio} · salir
        </button>
      </form>
    </aside>
  );
}
