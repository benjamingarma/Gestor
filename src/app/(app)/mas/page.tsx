import Link from "next/link";
import { cerrarSesion } from "@/app/acciones-sesion";
import { Icono } from "@/componentes/Iconos";
import { GESTION } from "@/componentes/menu";
import { obtenerSocioActual } from "@/lib/sesion";

const GRUPOS = ["Negocio", "Historial y correcciones", "Configuración"] as const;

function Fila({ icono, texto, detalle }: { icono: Parameters<typeof Icono>[0]["nombre"]; texto: string; detalle?: string }) {
  return (
    <>
      <span className="flex items-center gap-3.5">
        <Icono nombre={icono} className="h-6 w-6 shrink-0 text-acento" />
        <span className="flex flex-col">
          <span className="font-bold">{texto}</span>
          {detalle && <span className="text-[0.72rem] text-texto-suave">{detalle}</span>}
        </span>
      </span>
      <Icono nombre="flecha" className="h-[18px] w-[18px] shrink-0 text-texto-suave" />
    </>
  );
}

export default async function PaginaMas() {
  const socio = await obtenerSocioActual();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-2 px-4 pt-3 pb-6 leading-[1.2]">
      <h1 className="pb-2 text-[1.25rem] font-extrabold">Más</h1>
      {GRUPOS.map((grupo) => (
        <section key={grupo} className="flex flex-col gap-2" aria-label={grupo}>
          <h2 className="px-1 pt-2 text-[0.72rem] font-bold tracking-[0.04em] text-texto-suave">{grupo.toUpperCase()}</h2>
          <ul className="flex flex-col divide-y divide-borde rounded-[20px] border border-borde bg-superficie px-4 shadow-tarjeta">
            {GESTION.filter((g) => g.grupo === grupo).map((g) => (
              <li key={g.href + g.texto}>
                <Link href={g.href} className="flex items-center justify-between gap-3 py-3">
                  <Fila icono={g.icono} texto={g.texto} detalle={g.detalle || undefined} />
                </Link>
              </li>
            ))}
            {grupo === "Configuración" && (
              <li>
                <form action={cerrarSesion}>
                  <button type="submit" className="flex w-full items-center justify-between gap-3 py-3 text-left">
                    <Fila icono="salir" texto="Cerrar sesión" detalle={socio.email} />
                  </button>
                </form>
              </li>
            )}
          </ul>
        </section>
      ))}
    </main>
  );
}
