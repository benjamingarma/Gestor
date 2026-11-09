import Link from "next/link";

/** Título de pantalla con botón "volver" grande. */
export function Encabezado({ titulo, volverA, subtitulo }: { titulo: string; volverA?: string; subtitulo?: string }) {
  return (
    <header className="flex flex-col gap-1">
      {volverA && (
        <Link
          href={volverA}
          className="-ml-2 inline-flex min-h-[44px] w-fit items-center px-2 text-base font-medium text-acento"
        >
          ← Volver
        </Link>
      )}
      <h1 className="text-2xl font-bold">{titulo}</h1>
      {subtitulo && <p className="text-texto-suave">{subtitulo}</p>}
    </header>
  );
}
