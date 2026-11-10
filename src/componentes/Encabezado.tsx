import Link from "next/link";
import { Icono } from "./Iconos";

/** Título de pantalla (estilo de las maquetas de McStock) con "Volver" grande arriba. */
export function Encabezado({ titulo, volverA, subtitulo }: { titulo: string; volverA?: string; subtitulo?: string }) {
  return (
    <header className="flex flex-col gap-1 leading-[1.2]">
      {volverA && (
        <Link href={volverA} className="-ml-2 inline-flex min-h-[44px] w-fit items-center gap-0.5 px-2 text-[0.9rem] font-semibold text-acento">
          <Icono nombre="flecha" className="h-[18px] w-[18px] rotate-180" strokeWidth={2.2} />
          Volver
        </Link>
      )}
      <h1 className="text-[1.25rem] font-extrabold lg:text-[1.6rem]">{titulo}</h1>
      {subtitulo && <p className="text-[0.9rem] text-texto-suave">{subtitulo}</p>}
    </header>
  );
}
